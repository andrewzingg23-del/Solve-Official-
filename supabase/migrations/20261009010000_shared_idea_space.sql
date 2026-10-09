-- Persistent World conversation. Reserved kernel.* event types prevent generic
-- record_event callers from forging typed messages, decisions or AI reply state.
create index events_room_messages on kernel.events (scope, seq desc)
  where type = 'kernel.room.message.posted';

create table kernel.room_replies (
  message_id uuid primary key references kernel.events(id),
  state text not null check (state in ('pending', 'failed', 'complete')),
  lease_token uuid,
  lease_until timestamptz,
  attempt integer not null default 1,
  reply_id uuid references kernel.events(id)
);

create function kernel.require_idea_world(p_world_id uuid) returns text
language plpgsql stable set search_path = '' as $$
declare v_scope text := 'world:' || p_world_id::text;
begin
  perform kernel.require_scope(v_scope);
  if not exists (select 1 from kernel.entities e where e.scope = v_scope and e.kind = 'world') then
    raise exception using errcode = 'KA007', message = 'World not found';
  end if;
  return v_scope;
end;
$$;

create function kernel_api.post_room_message(
  p_world_id uuid, p_text text, p_request_id text,
  p_kind text default 'message', p_ask_ai boolean default false, p_as_actor uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  v_scope text := 'world:' || p_world_id::text;
  v_authority uuid;
  v_request jsonb;
  v_replay jsonb;
  v_key text := 'room:message:' || p_request_id;
begin
  if p_text is null or length(btrim(p_text)) not between 1 and 8000 or
     p_kind is null or p_kind not in ('message', 'decision') or
     p_request_id is null or length(p_request_id) not between 1 and 100 or
     p_ask_ai is null or (p_ask_ai and p_kind <> 'message') then
    raise exception using errcode = 'KA003', message = 'Invalid room message';
  end if;
  if (p_kind = 'decision' or p_ask_ai) and c.kind <> 'human' then
    raise exception using errcode = 'KA002', message = 'A person must record decisions or request in-app AI';
  end if;
  perform kernel.lock_chain();
  v_authority := kernel.require_allowed(c.actor_id, 'world.entity.write', v_scope);
  perform kernel.require_allowed(c.actor_id, 'kernel.read', v_scope);
  perform kernel.require_idea_world(p_world_id);
  v_request := jsonb_build_object('world_id', p_world_id, 'text', btrim(p_text), 'kind', p_kind, 'ask_ai', p_ask_ai);
  v_replay := kernel.replay_request(c.actor_id, v_key, 'kernel.room.message.posted', v_request);
  if v_replay is not null then
    return (select e.id from kernel.events e where e.actor_id = c.actor_id and e.idempotency_key = v_key);
  end if;
  return kernel.append_event(c, 'kernel.room.message.posted', v_scope, v_authority,
    jsonb_build_object('request', v_request, 'text', btrim(p_text), 'kind', p_kind, 'ask_ai', p_ask_ai,
                       'basis', 'self_reported', 'source_refs', '[]'::jsonb), null, v_key);
end;
$$;

create function kernel_api.read_room_messages(
  p_world_id uuid, p_before_seq bigint default null, p_limit integer default 50,
  p_kind text default null, p_as_actor uuid default null
) returns table (message_id uuid, seq bigint, occurred_at timestamptz, actor_id uuid,
  actor_kind text, actor_label text, kind text, text text, reply_to uuid, source_refs jsonb)
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
    select e.id, e.seq, e.occurred_at, e.actor_id, a.kind, a.label,
           e.payload ->> 'kind', e.payload ->> 'text', (e.payload ->> 'reply_to')::uuid,
           coalesce(e.payload -> 'source_refs', '[]'::jsonb)
    from kernel.events e join kernel.actors a on a.id = e.actor_id
    where e.scope = v_scope and e.type = 'kernel.room.message.posted'
      and (p_before_seq is null or e.seq < p_before_seq)
      and (p_kind is null or e.payload ->> 'kind' = p_kind)
    order by e.seq desc limit p_limit
  ) q order by q.seq;
end;
$$;

create function kernel.require_room_question(c kernel.caller, p_message_id uuid) returns kernel.events
language plpgsql stable set search_path = '' as $$
declare m kernel.events;
begin
  select * into m from kernel.events e where e.id = p_message_id;
  if not found or m.actor_id <> c.actor_id or m.type <> 'kernel.room.message.posted' or
     m.payload ->> 'kind' <> 'message' or m.payload ->> 'ask_ai' is distinct from 'true' then
    raise exception using errcode = 'KA002', message = 'Only the question author can request its reply';
  end if;
  perform kernel.require_allowed(c.actor_id, 'kernel.read', m.scope);
  perform kernel.require_allowed(c.actor_id, 'world.entity.write', m.scope);
  return m;
end;
$$;

create function kernel_api.claim_room_reply(p_message_id uuid, p_as_actor uuid default null)
returns table (state text, lease_token uuid, reply_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  m kernel.events; r kernel.room_replies; token uuid := gen_random_uuid(); authority uuid;
begin
  perform kernel.lock_chain();
  m := kernel.require_room_question(c, p_message_id);
  select * into r from kernel.room_replies rr where rr.message_id = p_message_id;
  if found and r.state = 'complete' then return query select 'complete'::text, null::uuid, r.reply_id; return; end if;
  if found and r.state = 'pending' and r.lease_until > now() then
    return query select 'pending'::text, null::uuid, null::uuid; return;
  end if;
  insert into kernel.room_replies(message_id, state, lease_token, lease_until)
  values (p_message_id, 'pending', token, now() + interval '2 minutes')
  on conflict (message_id) do update set state = 'pending', lease_token = token,
    lease_until = now() + interval '2 minutes', attempt = kernel.room_replies.attempt + 1;
  authority := kernel.require_allowed(c.actor_id, 'world.entity.write', m.scope);
  perform kernel.append_event(c, 'kernel.room.reply.claimed', m.scope, authority,
    jsonb_build_object('message_id', p_message_id, 'lease_until', now() + interval '2 minutes'));
  return query select 'claimed'::text, token, null::uuid;
end;
$$;

create function kernel_api.finish_room_reply(
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

create function kernel_api.fail_room_reply(p_message_id uuid, p_lease_token uuid, p_as_actor uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare c kernel.caller := kernel.resolve_caller(p_as_actor); m kernel.events; authority uuid;
begin
  perform kernel.lock_chain();
  m := kernel.require_room_question(c, p_message_id);
  update kernel.room_replies set state = 'failed', lease_token = null, lease_until = null
    where message_id = p_message_id and state = 'pending' and lease_token = p_lease_token;
  if found then
    authority := kernel.require_allowed(c.actor_id, 'world.entity.write', m.scope);
    perform kernel.append_event(c, 'kernel.room.reply.failed', m.scope, authority,
      jsonb_build_object('message_id', p_message_id));
  end if;
end;
$$;

revoke all on function kernel.require_idea_world(uuid), kernel.require_room_question(kernel.caller, uuid) from public;
revoke all on function kernel_api.post_room_message(uuid, text, text, text, boolean, uuid),
  kernel_api.read_room_messages(uuid, bigint, integer, text, uuid), kernel_api.claim_room_reply(uuid, uuid),
  kernel_api.finish_room_reply(uuid, uuid, text, text, jsonb, uuid), kernel_api.fail_room_reply(uuid, uuid, uuid) from public;
grant execute on function kernel_api.post_room_message(uuid, text, text, text, boolean, uuid),
  kernel_api.read_room_messages(uuid, bigint, integer, text, uuid), kernel_api.claim_room_reply(uuid, uuid),
  kernel_api.finish_room_reply(uuid, uuid, text, text, jsonb, uuid), kernel_api.fail_room_reply(uuid, uuid, uuid)
  to authenticated, service_role;
