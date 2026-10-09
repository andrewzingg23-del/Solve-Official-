-- Invitations are a consent projection backed by reserved append-only events.
-- The bearer token never enters storage: only its SHA-256 hash is retained.
create table kernel.world_invitations (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  world_id uuid not null,
  owner_id uuid not null references kernel.actors(id),
  role text not null check (role in ('viewer', 'editor')),
  expires_at timestamptz not null,
  event_id uuid not null unique references kernel.events(id),
  read_parent uuid not null references kernel.grants(id),
  write_parent uuid references kernel.grants(id),
  cancelled_at timestamptz,
  accepted_by uuid references kernel.actors(id),
  accepted_at timestamptz
);

create function kernel.require_idea_owner(p_actor_id uuid, p_world_id uuid) returns uuid
language plpgsql stable set search_path = '' as $$
declare v_scope text := 'world:' || p_world_id::text; v_owner uuid;
begin
  select e.actor_id into v_owner from kernel.events e
    where e.scope = v_scope and e.type = 'kernel.scope.claimed' order by e.seq limit 1;
  if v_owner is distinct from p_actor_id or
     not exists (select 1 from kernel.actors a where a.id = p_actor_id and a.kind = 'human') or
     not exists (select 1 from kernel.grants g where g.grantee_id = p_actor_id and
       g.capability = '*' and g.scope = v_scope and kernel.grant_is_active(g.id)) then
    raise exception using errcode = 'KA002', message = 'Only the current human World owner can manage invitations';
  end if;
  perform kernel.require_idea_world(p_world_id);
  return kernel.require_allowed(p_actor_id, 'kernel.grant.issue', v_scope);
end;
$$;

create function kernel_api.create_world_invitation(
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
  v_request := jsonb_build_object('world_id', p_world_id, 'token_hash', p_token_hash, 'role', p_role);
  v_replay := kernel.replay_request(c.actor_id, 'world:invite:' || p_request_id, 'kernel.world.invitation.created', v_request);
  if v_replay is not null then
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

create function kernel_api.accept_world_invitation(p_token_hash text, p_as_actor uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor); i kernel.world_invitations;
  v_scope text; authority uuid; cap text; parent uuid; gid uuid; eid uuid; granted uuid[] := '{}';
begin
  if c.kind <> 'human' then raise exception using errcode = 'KA002', message = 'A signed-in person must accept'; end if;
  perform kernel.lock_chain();
  select * into i from kernel.world_invitations inv where inv.token_hash = p_token_hash for update;
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

create function kernel_api.cancel_world_invitation(p_invitation_id uuid, p_as_actor uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare c kernel.caller := kernel.resolve_caller(p_as_actor); i kernel.world_invitations; authority uuid;
begin
  perform kernel.lock_chain();
  select * into i from kernel.world_invitations inv where inv.id = p_invitation_id for update;
  if not found then raise exception using errcode = 'KA007', message = 'Invitation not found'; end if;
  authority := kernel.require_idea_owner(c.actor_id, i.world_id);
  if i.accepted_by is not null then raise exception using errcode = 'KA004', message = 'Remove the member to revoke accepted access'; end if;
  if i.cancelled_at is not null then return; end if;
  perform kernel.append_event(c, 'kernel.world.invitation.cancelled', 'world:' || i.world_id::text, authority,
    jsonb_build_object('invitation_id', i.id));
  update kernel.world_invitations set cancelled_at = now() where id = i.id;
end;
$$;

create function kernel_api.read_world_invitations(p_world_id uuid, p_as_actor uuid default null)
returns table (invitation_id uuid, role text, expires_at timestamptz, accepted_by uuid, cancelled_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare c kernel.caller := kernel.resolve_caller(p_as_actor);
begin
  perform kernel.require_idea_owner(c.actor_id, p_world_id);
  return query select i.id, i.role, i.expires_at, i.accepted_by, i.cancelled_at
    from kernel.world_invitations i where i.world_id = p_world_id
    order by i.expires_at desc limit 50;
end;
$$;

create function kernel_api.update_document_version(
  p_entity_id uuid, p_scope text, p_expected_version integer, p_title text, p_summary text,
  p_attributes jsonb, p_idempotency_key text, p_as_actor uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare c kernel.caller := kernel.resolve_caller(p_as_actor); authority uuid; v_version integer;
begin
  if p_expected_version is null or p_expected_version < 1 then
    raise exception using errcode = 'KA003', message = 'A displayed version is required';
  end if;
  perform kernel.require_scope(p_scope);
  perform kernel.lock_chain();
  authority := kernel.require_allowed(c.actor_id, 'world.entity.write', p_scope);
  perform kernel.require_allowed(c.actor_id, 'kernel.read', p_scope);
  if not exists (select 1 from kernel.entities e where e.id = p_entity_id and e.kind = 'document' and e.scope = p_scope) then
    raise exception using errcode = 'KA007', message = 'Document not found in this World';
  end if;
  -- Existing retries still use do_upsert_entity's exact-payload replay check.
  if not exists (select 1 from kernel.events e where e.actor_id = c.actor_id and e.idempotency_key = p_idempotency_key) then
    select max(v.version) into v_version from kernel.entity_versions v where v.entity_id = p_entity_id;
    if v_version <> p_expected_version then
      raise exception using errcode = 'KA004', message = 'This document changed. Compare the saved revision before trying again.';
    end if;
  end if;
  return kernel.do_upsert_entity(c, authority, p_entity_id, 'document', p_scope, p_title, p_summary,
    p_attributes, null, null, null, null, 'members', 50, p_idempotency_key);
end;
$$;

create index events_presence_recent on kernel.events(scope, occurred_at desc, actor_id)
  where type = 'world.presence.heartbeat';
create function kernel_api.read_world_presence(p_scope text, p_as_actor uuid default null)
returns table (actor_id uuid, label text, at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare c kernel.caller := kernel.resolve_caller(p_as_actor);
begin
  perform kernel.require_scope(p_scope);
  perform kernel.require_allowed(c.actor_id, 'kernel.read', p_scope);
  return query select q.actor_id, a.label, q.occurred_at from (
    select distinct on (e.actor_id) e.actor_id, e.occurred_at from kernel.events e
    where e.scope = p_scope and e.type = 'world.presence.heartbeat' and e.occurred_at > now() - interval '90 seconds'
    order by e.actor_id, e.seq desc
  ) q join kernel.actors a on a.id = q.actor_id order by a.label;
end;
$$;

revoke all on function kernel.require_idea_owner(uuid, uuid) from public;
revoke all on function kernel_api.create_world_invitation(uuid, text, text, text, uuid),
  kernel_api.accept_world_invitation(text, uuid), kernel_api.cancel_world_invitation(uuid, uuid),
  kernel_api.read_world_invitations(uuid, uuid),
  kernel_api.update_document_version(uuid, text, integer, text, text, jsonb, text, uuid),
  kernel_api.read_world_presence(text, uuid) from public;
grant execute on function kernel_api.create_world_invitation(uuid, text, text, text, uuid),
  kernel_api.accept_world_invitation(text, uuid), kernel_api.cancel_world_invitation(uuid, uuid),
  kernel_api.read_world_invitations(uuid, uuid),
  kernel_api.update_document_version(uuid, text, integer, text, text, jsonb, text, uuid),
  kernel_api.read_world_presence(text, uuid) to authenticated, service_role;
