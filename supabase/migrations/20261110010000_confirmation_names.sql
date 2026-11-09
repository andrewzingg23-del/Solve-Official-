-- Confirmation readers name people by their chosen name.
--
-- 20261109020000 read `kernel.actors.label` directly. That column is a person's label at
-- registration — empty for almost every visitor. A person's chosen name is event-sourced and read
-- through `kernel.actor_label(id)` (20261009060000_person_profile), as `read_actors` already does.
-- Found by the staging acceptance run on 2026-11-09: the person asked was told "Someone asked you"
-- by an asker who had named themselves, and the holder saw "Confirmed by the person asked" rather
-- than who it was.
--
-- Also adds `answered_by_you` to what the person holding the link may read. It says only whether
-- the caller is the one who answered — nothing about anyone else — so a person returning to a link
-- they already answered is told it was them, not that "it was already answered" as though by a
-- stranger.
--
-- Same signatures, same authority, same refusals. Only the names and that one boolean change.

create or replace function kernel_api.read_confirmation_request(
  p_token_hash text, p_as_actor uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  r kernel.confirmation_requests; v jsonb;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = 'KA007', message = 'That confirmation link is unavailable';
  end if;
  select * into r from kernel.confirmation_requests cr where cr.token_hash = p_token_hash;
  if not found or r.cancelled_at is not null then
    raise exception using errcode = 'KA007', message = 'That confirmation link is unavailable';
  end if;

  select jsonb_build_object(
    'title', ev.title, 'summary', ev.summary,
    'type', coalesce(ev.attributes ->> 'type', en.kind),
    'data', coalesce(ev.attributes -> 'data', '{}'::jsonb),
    'recorded_at', ev.created_at)
    into v
  from kernel.entities en
  join lateral (
    select ev2.title, ev2.summary, ev2.attributes, ev2.created_at
    from kernel.entity_versions ev2 where ev2.entity_id = en.id
    order by ev2.version desc limit 1
  ) ev on true
  where en.id = r.entity_id;

  return jsonb_build_object(
    'thing', v,
    'asked_by', coalesce(kernel.actor_label(r.owner_id), ''),
    'asked_of', r.asked_of,
    'question', r.question,
    'expires_at', r.expires_at,
    'expired', r.expires_at <= now(),
    'answered', r.answered_by is not null,
    'answered_by_you', r.answered_by is not null and r.answered_by = c.actor_id,
    'decision', r.decision,
    'answered_at', r.answered_at
  );
end;
$$;

create or replace function kernel_api.read_confirmations(
  p_entity_id uuid, p_as_actor uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  v_scope text;
begin
  select en.scope into v_scope from kernel.entities en where en.id = p_entity_id;
  if v_scope is null then
    raise exception using errcode = 'KA007', message = 'No such thing';
  end if;
  perform kernel.require_allowed(c.actor_id, 'world.entity.read', v_scope);
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'confirmation_id', r.id,
      'asked_of', r.asked_of,
      'question', r.question,
      'expires_at', r.expires_at,
      'state', case
        when r.cancelled_at is not null then 'withdrawn'
        when r.decision is not null then r.decision
        when r.expires_at <= now() then 'expired'
        else 'awaiting' end,
      'answered_at', r.answered_at,
      'answered_by', case when r.answered_by is null then null else coalesce(kernel.actor_label(r.answered_by), '') end
    ) order by r.expires_at), '[]'::jsonb)
    from kernel.confirmation_requests r where r.entity_id = p_entity_id
  );
end;
$$;

revoke all on all functions in schema kernel from public, anon, authenticated, service_role;
revoke all on all functions in schema kernel_api from public, anon;
grant execute on all functions in schema kernel_api to authenticated, service_role;
revoke execute on function kernel_api.verify_chain() from authenticated;
