-- Authoritative invitation tokens and typed draft references. Applied migrations
-- stay unchanged. Old append-only events may retain hashes; they no longer grant
-- access. New invitation events keep digests only in the private projection.

create or replace function kernel_api.create_world_invitation(
  p_world_id uuid, p_token_hash text, p_role text, p_request_id text, p_as_actor uuid default null
) returns table (invitation_id uuid, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor); authority uuid;
  v_scope text := 'world:' || p_world_id::text; v_id uuid := gen_random_uuid(); v_event uuid;
  v_expiry timestamptz := now() + interval '48 hours'; v_read uuid; v_write uuid; v_request jsonb; v_replay jsonb;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' or p_role is null or
     p_role not in ('viewer', 'editor') or p_request_id is null or length(p_request_id) not between 1 and 100 then
    raise exception using errcode = 'KA003', message = 'Invalid invitation';
  end if;
  perform kernel.lock_chain();
  authority := kernel.require_idea_owner(c.actor_id, p_world_id);
  v_request := jsonb_build_object('world_id', p_world_id, 'role', p_role);
  -- Preserve exact retries of old events without putting hashes into new history.
  if exists (select 1 from kernel.events e where e.actor_id = c.actor_id and
      e.idempotency_key = 'world:invite:' || p_request_id and (e.payload -> 'request') ? 'token_hash') then
    v_replay := kernel.replay_request(c.actor_id, 'world:invite:' || p_request_id,
      'kernel.world.invitation.created', v_request || jsonb_build_object('token_hash', p_token_hash));
  else
    v_replay := kernel.replay_request(c.actor_id, 'world:invite:' || p_request_id, 'kernel.world.invitation.created', v_request);
  end if;
  if v_replay is not null then
    if not exists (select 1 from kernel.world_invitations i join kernel.events e on e.id = i.event_id
      where e.actor_id = c.actor_id and e.idempotency_key = 'world:invite:' || p_request_id and i.token_hash = p_token_hash) then
      raise exception using errcode = 'KA004', message = 'Invitation retry changed its token';
    end if;
    return query select i.id, i.expires_at from kernel.world_invitations i where i.event_id =
      (select e.id from kernel.events e where e.actor_id = c.actor_id and e.idempotency_key = 'world:invite:' || p_request_id);
    return;
  end if;
  v_read := kernel.find_delegable_grant(c.actor_id, 'kernel.read', v_scope);
  if p_role = 'editor' then v_write := kernel.find_delegable_grant(c.actor_id, 'world.entity.write', v_scope); end if;
  if v_read is null or (p_role = 'editor' and v_write is null) then
    raise exception using errcode = 'KA002', message = 'The owner cannot delegate this role';
  end if;
  v_event := kernel.append_event(c, 'kernel.world.invitation.created', v_scope, authority,
    jsonb_build_object('request', v_request, 'invitation_id', v_id, 'role', p_role, 'expires_at', v_expiry),
    null, 'world:invite:' || p_request_id);
  insert into kernel.world_invitations(id, token_hash, world_id, owner_id, role, expires_at, event_id, read_parent, write_parent)
    values (v_id, p_token_hash, p_world_id, c.actor_id, p_role, v_expiry, v_event, v_read, v_write);
  return query select v_id, v_expiry;
end;
$$;

-- Renaming the RPC input requires replacing the function signature.
drop function kernel_api.accept_world_invitation(text, uuid);
create function kernel_api.accept_world_invitation(p_token text, p_as_actor uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor); i kernel.world_invitations;
  v_token_hash text; v_scope text; authority uuid; cap text; parent uuid; gid uuid; eid uuid; granted uuid[] := '{}';
begin
  if c.kind <> 'human' then raise exception using errcode = 'KA002', message = 'A signed-in person must accept'; end if;
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = 'KA003', message = 'Invalid invitation token';
  end if;
  -- A stored or disclosed digest is not a bearer credential. The raw token is
  -- used only in this request and never appended to an event or saved in a row.
  v_token_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token, 'UTF8')), 'hex');
  perform kernel.lock_chain();
  select * into i from kernel.world_invitations inv where inv.token_hash = v_token_hash for update;
  if not found then raise exception using errcode = 'KA007', message = 'Invitation is unavailable'; end if;
  v_scope := 'world:' || i.world_id::text;
  if i.accepted_by is not null then
    if i.accepted_by <> c.actor_id then raise exception using errcode = 'KA004', message = 'Invitation has already been used'; end if;
    perform kernel.require_allowed(c.actor_id, 'kernel.read', v_scope);
    return i.world_id;
  end if;
  if i.cancelled_at is not null or i.expires_at <= now() then
    raise exception using errcode = 'KA004', message = 'Invitation expired or was cancelled';
  end if;
  if i.owner_id = c.actor_id then raise exception using errcode = 'KA003', message = 'You already own this World'; end if;
  authority := kernel.require_idea_owner(i.owner_id, i.world_id);
  if not kernel.grant_is_active(i.read_parent) or
     (i.role = 'editor' and not kernel.grant_is_active(i.write_parent)) then
    raise exception using errcode = 'KA002', message = 'Invitation authority has ended';
  end if;
  -- Do not silently change an existing member's role or create hidden duplicate grants.
  if exists (select 1 from kernel.grants g where g.grantee_id = c.actor_id and g.scope = v_scope
    and g.capability in ('kernel.read', 'world.entity.write', '*') and kernel.grant_is_active(g.id)) then
    raise exception using errcode = 'KA004', message = 'You already have access; ask the owner before changing roles';
  end if;
  foreach cap in array case when i.role = 'editor' then array['kernel.read', 'world.entity.write'] else array['kernel.read'] end loop
    parent := case when cap = 'kernel.read' then i.read_parent else i.write_parent end;
    -- Policies are evaluated for delegation, and again for each authority being delegated.
    perform kernel.require_allowed(i.owner_id, cap, v_scope);
    gid := gen_random_uuid();
    eid := kernel.append_event(c, 'kernel.grant.issued', v_scope, authority,
      jsonb_build_object('grant_id', gid, 'grantee_id', c.actor_id, 'capability', cap, 'scope', v_scope,
        'parent_grant_id', parent, 'expires_at', null, 'basis', 'invitation',
        'issued_by', i.owner_id, 'invitation_event_id', i.event_id));
    insert into kernel.grants(id, grantee_id, capability, scope, issued_by, parent_grant_id, event_id)
      values (gid, c.actor_id, cap, v_scope, i.owner_id, parent, eid);
    granted := array_append(granted, gid);
  end loop;
  perform kernel.append_event(c, 'kernel.world.invitation.accepted', v_scope, authority,
    jsonb_build_object('invitation_id', i.id, 'role', i.role, 'grant_ids', to_jsonb(granted), 'owner_id', i.owner_id));
  update kernel.world_invitations set accepted_by = c.actor_id, accepted_at = now() where id = i.id;
  return i.world_id;
end;
$$;

create or replace function kernel_api.finish_room_reply(
  p_message_id uuid, p_lease_token uuid, p_text text, p_model text,
  p_source_refs jsonb default '[]'::jsonb, p_as_actor uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare c kernel.caller := kernel.resolve_caller(p_as_actor); m kernel.events; r kernel.room_replies; v_id uuid; authority uuid;
begin
  if p_text is null or length(btrim(p_text)) not between 1 and 8000 or p_model is null or
     length(p_model) not between 1 and 200 or p_source_refs is null or
     jsonb_typeof(p_source_refs) <> 'array' or octet_length(p_source_refs::text) > 16000 then
    raise exception using errcode = 'KA003', message = 'Invalid AI draft';
  end if;
  if exists (select 1 from jsonb_array_elements(p_source_refs) s(value) where
      jsonb_typeof(s.value) is distinct from 'object' or
      jsonb_typeof(s.value -> 'entityId') is distinct from 'string' or
      coalesce(s.value ->> 'entityId', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or
      jsonb_typeof(s.value -> 'version') is distinct from 'number' or
      coalesce(s.value ->> 'version', '') !~ '^[1-9][0-9]{0,9}$' or
      (s.value -> 'version') > '2147483647'::jsonb or
      jsonb_typeof(s.value -> 'title') is distinct from 'string' or
      length(btrim(s.value ->> 'title')) = 0) then
    raise exception using errcode = 'KA003', message = 'Invalid AI source reference';
  end if;
  perform kernel.lock_chain();
  m := kernel.require_room_question(c, p_message_id);
  select * into r from kernel.room_replies rr where rr.message_id = p_message_id;
  if found and r.state = 'complete' then return r.reply_id; end if;
  if not found or r.state <> 'pending' or p_lease_token is null or
     r.lease_token <> p_lease_token or r.lease_until <= now() then
    raise exception using errcode = 'KA004', message = 'AI reply lease expired or changed';
  end if;
  authority := kernel.require_allowed(c.actor_id, 'world.entity.write', m.scope);
  -- The requesting human is the authenticated author of this saved draft.
  -- It is declared model output, not a separately authenticated agent or verified evidence.
  v_id := kernel.append_event(c, 'kernel.room.message.posted', m.scope, authority,
    jsonb_build_object('text', btrim(p_text), 'kind', 'ai_draft', 'reply_to', p_message_id,
      'model', p_model, 'basis', 'self_reported', 'source_refs', p_source_refs), null, 'room:reply:' || p_message_id::text);
  update kernel.room_replies set state = 'complete', reply_id = v_id, lease_token = null, lease_until = null
    where message_id = p_message_id;
  return v_id;
end;
$$;

revoke all on function kernel_api.accept_world_invitation(text, uuid) from public;
grant execute on function kernel_api.accept_world_invitation(text, uuid) to authenticated, service_role;
