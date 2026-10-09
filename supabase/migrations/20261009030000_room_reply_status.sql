-- Expose the saved question's retry state so a browser reload does not lose it.
drop function kernel_api.read_room_messages(uuid, bigint, integer, text, uuid);
create function kernel_api.read_room_messages(
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
    select e.id, e.seq, e.occurred_at, e.actor_id, a.kind, a.label,
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
revoke all on function kernel_api.read_room_messages(uuid, bigint, integer, text, uuid) from public;
grant execute on function kernel_api.read_room_messages(uuid, bigint, integer, text, uuid) to authenticated, service_role;
