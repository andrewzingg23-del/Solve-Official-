-- The actor remains immutable. Current display names are a projection of its
-- signed-in profile events; the stable ID and original identity record do not change.
create index events_person_label_latest on kernel.events(actor_id, seq desc)
  where type = 'kernel.person.label.updated';
create function kernel.actor_label(p_actor_id uuid) returns text
language sql stable set search_path = '' as $$
  select coalesce((select e.payload ->> 'label' from kernel.events e
    where e.actor_id = a.id and e.scope = 'actor:' || a.id::text
      and e.type = 'kernel.person.label.updated' order by e.seq desc limit 1), a.label)
  from kernel.actors a where a.id = p_actor_id;
$$;
revoke all on function kernel.actor_label(uuid) from public;

-- A person's public display name follows their canonical identity; account/profile
-- edits never create a new actor or let a client supply someone else's actor ID.
create function kernel_api.set_person_label(p_label text, p_request_id text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(null);
  claims jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
  v_scope text := 'actor:' || c.actor_id::text;
  v_label text := btrim(p_label);
  v_key text := 'person-label:' || p_request_id;
  v_request jsonb;
  v_authority uuid;
  v_event uuid;
begin
  if c.kind <> 'human' or claims ->> 'role' is distinct from 'authenticated' or
     nullif(current_setting('role', true), 'none') is distinct from 'authenticated' then
    raise exception using errcode = 'KA001', message = 'A signed-in person must update their profile';
  end if;
  if v_label is null or length(v_label) not between 1 and 60 or p_label ~ '[[:cntrl:]]' or
     p_request_id is null or p_request_id !~ '^[A-Za-z0-9_-]{8,64}$' then
    raise exception using errcode = 'KA003', message = 'Invalid profile name or request';
  end if;
  perform kernel.lock_chain();
  v_authority := kernel.require_allowed(c.actor_id, 'identity.profile.write', v_scope);
  v_request := jsonb_build_object('label', v_label);
  if kernel.replay_request(c.actor_id, v_key, 'kernel.person.label.updated', v_request) is not null then
    return (select e.id from kernel.events e where e.actor_id = c.actor_id and e.idempotency_key = v_key);
  end if;
  v_event := kernel.append_event(c, 'kernel.person.label.updated', v_scope, v_authority,
    jsonb_build_object('request', v_request, 'label', v_label), null, v_key);
  return v_event;
end;
$$;
revoke all on function kernel_api.set_person_label(text, text) from public;
grant execute on function kernel_api.set_person_label(text, text) to authenticated;

-- Existing identity/conversation reads keep their authority checks and expose the current name.
create or replace function kernel_api.whoami(p_as_actor uuid default null)
returns table (actor_id uuid, kind text, label text, owner_id uuid)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
begin
  return query select a.id, a.kind, kernel.actor_label(a.id), a.owner_id from kernel.actors a where a.id = c.actor_id;
end;
$$;

create or replace function kernel_api.read_actors(p_actor_ids uuid[], p_as_actor uuid default null)
returns table (actor_id uuid, kind text, label text, owner_id uuid, accountable_party uuid, role text)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
begin
  if p_actor_ids is null or cardinality(p_actor_ids) > 500 then
    raise exception using errcode = 'KA003', message = 'ask for at most 500 actors';
  end if;
  return query
    select a.id, a.kind, kernel.actor_label(a.id), a.owner_id, kernel.party_of(a.id), r.role
    from kernel.actors a left join kernel.agent_roles r on r.actor_id = a.id
    where a.id = any (p_actor_ids)
    order by a.created_at, a.id;
end;
$$;

create or replace function kernel_api.read_room_messages(
  p_world_id uuid, p_before_seq bigint default null, p_limit integer default 50,
  p_kind text default null, p_as_actor uuid default null
) returns table (message_id uuid, seq bigint, occurred_at timestamptz, actor_id uuid,
  actor_kind text, actor_label text, kind text, text text, reply_to uuid, source_refs jsonb,
  ask_ai boolean, reply_state text, request_id text)
language plpgsql security definer set search_path = '' as $$
declare c kernel.caller := kernel.resolve_caller(p_as_actor); v_scope text := 'world:' || p_world_id::text;
begin
  if p_limit is null or p_limit not between 1 and 100 or p_before_seq <= 0 or
     (p_kind is not null and p_kind not in ('message', 'decision', 'ai_draft')) then
    raise exception using errcode = 'KA003', message = 'Invalid conversation cursor or limit';
  end if;
  perform kernel.require_allowed(c.actor_id, 'kernel.read', v_scope);
  perform kernel.require_idea_world(p_world_id);
  return query select q.* from (
    select e.id, e.seq, e.occurred_at, e.actor_id, a.kind, kernel.actor_label(a.id),
           e.payload ->> 'kind', e.payload ->> 'text', (e.payload ->> 'reply_to')::uuid,
           coalesce(e.payload -> 'source_refs', '[]'::jsonb),
           coalesce((e.payload ->> 'ask_ai')::boolean, false),
           case when e.payload ->> 'ask_ai' = 'true' then
             coalesce(case when r.state = 'pending' and r.lease_until <= now() then 'failed' else r.state end, 'failed')
           else null end,
           substr(e.idempotency_key, length('room:message:') + 1)
    from kernel.events e join kernel.actors a on a.id = e.actor_id
    left join kernel.room_replies r on r.message_id = e.id
    where e.scope = v_scope and e.type = 'kernel.room.message.posted'
      and (p_before_seq is null or e.seq < p_before_seq)
      and (p_kind is null or e.payload ->> 'kind' = p_kind)
    order by e.seq desc limit p_limit
  ) q order by q.seq;
end;
$$;

create or replace function kernel_api.read_world_presence(p_scope text, p_as_actor uuid default null)
returns table (actor_id uuid, label text, at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare c kernel.caller := kernel.resolve_caller(p_as_actor);
begin
  perform kernel.require_scope(p_scope);
  perform kernel.require_allowed(c.actor_id, 'kernel.read', p_scope);
  return query select q.actor_id, kernel.actor_label(a.id), q.occurred_at from (
    select distinct on (e.actor_id) e.actor_id, e.occurred_at from kernel.events e
    where e.scope = p_scope and e.type = 'world.presence.heartbeat' and e.occurred_at > now() - interval '90 seconds'
    order by e.actor_id, e.seq desc
  ) q join kernel.actors a on a.id = q.actor_id order by kernel.actor_label(a.id);
end;
$$;
