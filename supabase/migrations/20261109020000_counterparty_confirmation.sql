-- Counterparty confirmation. The other side confirms its own side.
--
-- Until now a record could hold what one person said happened, with their own evidence attached.
-- That is only ever their word to an outsider: the customer who disputes the work, the GC who
-- wants the item proven closed, the carrier that needs the document acknowledged. A record whose
-- only author is its owner cannot settle a disagreement with anyone who has no reason to trust them.
--
-- This adds the missing half. The owner asks a specific person to confirm one specific thing. The
-- link carries a token; only its SHA-256 hash is stored, exactly as world invitations already work.
-- Holding the token lets that person read *that one thing* and nothing else, and record their
-- answer — confirmed or disputed — as evidence authored by them.
--
-- Three properties the kernel already guarantees and this relies on rather than reimplements:
--   * `kernel.attach` refuses `witnessed` evidence when the caller's party is the target's party,
--     so nobody can confirm their own work. No actor authors its own proof.
--   * The answer is appended under the owner's own delegable authority, re-checked at answer time,
--     so a confirmation cannot land after the owner's authority over the scope has ended.
--   * Events are append-only, so a dispute is recorded beside the claim and never replaces it.
--
-- Nothing existing is altered: no applied migration is edited and no function is replaced.

create table kernel.confirmation_requests (
  id uuid primary key default gen_random_uuid(),
  -- The bearer token never enters storage; only this hash does.
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  entity_id uuid not null references kernel.entities (id),
  scope text not null,
  owner_id uuid not null references kernel.actors (id),
  -- The owner's own words for who they asked. Self-reported, never verified by the kernel.
  asked_of text not null default '' check (length(asked_of) <= 200),
  question text not null default '' check (length(question) <= 500),
  expires_at timestamptz not null,
  event_id uuid not null unique references kernel.events (id),
  -- The owner's authority this answer will be appended under, re-checked when it is answered.
  authority_grant uuid not null references kernel.grants (id),
  cancelled_at timestamptz,
  answered_by uuid references kernel.actors (id),
  answered_at timestamptz,
  decision text check (decision in ('confirmed', 'disputed')),
  answer_event uuid references kernel.events (id),
  check ((answered_by is null) = (answered_at is null) and (answered_by is null) = (decision is null))
);

create index confirmation_requests_entity on kernel.confirmation_requests (entity_id);
create index confirmation_requests_owner on kernel.confirmation_requests (owner_id);

------------------------------------------------------------------------------------------------
-- The event a confirmation witnesses: the thing's most recent version.

create or replace function kernel.entity_latest_event(p_entity_id uuid)
returns uuid language sql stable set search_path = '' as $$
  select ev.event_id from kernel.entity_versions ev
  where ev.entity_id = p_entity_id
  order by ev.version desc
  limit 1;
$$;

------------------------------------------------------------------------------------------------
-- Ask a named person to confirm one thing.

create or replace function kernel_api.request_confirmation(
  p_entity_id uuid, p_token_hash text, p_asked_of text default '', p_question text default '',
  p_request_id text default null, p_as_actor uuid default null
) returns table (request_id uuid, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  v_scope text; v_id uuid := gen_random_uuid(); v_event uuid; v_authority uuid; v_own uuid;
  v_expiry timestamptz := now() + interval '30 days';
  v_key text; v_request jsonb; v_replay jsonb;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = 'KA003', message = 'A confirmation needs a token hash';
  end if;
  if p_request_id is null or length(p_request_id) not between 1 and 100 then
    raise exception using errcode = 'KA003', message = 'A confirmation needs a request id';
  end if;
  if length(coalesce(p_asked_of, '')) > 200 or length(coalesce(p_question, '')) > 500 then
    raise exception using errcode = 'KA003', message = 'That is too long to record';
  end if;

  select en.scope into v_scope from kernel.entities en where en.id = p_entity_id;
  if v_scope is null then
    raise exception using errcode = 'KA007', message = 'No such thing';
  end if;

  perform kernel.lock_chain();
  v_key := 'confirm:ask:' || p_request_id;
  v_request := jsonb_build_object('entity_id', p_entity_id, 'token_hash', p_token_hash,
    'asked_of', coalesce(p_asked_of, ''), 'question', coalesce(p_question, ''));
  v_replay := kernel.replay_request(c.actor_id, v_key, 'kernel.confirmation.requested', v_request);
  if v_replay is not null then
    return query select r.id, r.expires_at from kernel.confirmation_requests r
      where r.event_id = (select e.id from kernel.events e
        where e.actor_id = c.actor_id and e.idempotency_key = v_key);
    return;
  end if;

  -- Asking for confirmation is an act on the thing, so it needs authority over the thing.
  perform kernel.require_allowed(c.actor_id, 'world.entity.write', v_scope);
  -- The answer will be appended under this authority, which the owner must be able to delegate.
  v_authority := kernel.find_delegable_grant(c.actor_id, 'world.entity.write', v_scope);
  if v_authority is null then
    raise exception using errcode = 'KA002', message = 'You cannot delegate confirmation of this thing';
  end if;
  v_own := kernel.require_allowed(c.actor_id, 'world.entity.write', v_scope);

  if kernel.entity_latest_event(p_entity_id) is null then
    raise exception using errcode = 'KA007', message = 'That thing has no recorded version to confirm';
  end if;

  v_event := kernel.append_event(c, 'kernel.confirmation.requested', v_scope, v_own,
    jsonb_build_object('request', v_request, 'confirmation_id', v_id, 'expires_at', v_expiry),
    null, v_key);
  insert into kernel.confirmation_requests
    (id, token_hash, entity_id, scope, owner_id, asked_of, question, expires_at, event_id, authority_grant)
  values (v_id, p_token_hash, p_entity_id, v_scope, c.actor_id, coalesce(p_asked_of, ''),
    coalesce(p_question, ''), v_expiry, v_event, v_authority);
  return query select v_id, v_expiry;
end;
$$;

------------------------------------------------------------------------------------------------
-- What the person holding the link may see: that one thing, and nothing else.
-- A wrong token and a token that was never issued are indistinguishable, so the existence of
-- anything cannot be learned by guessing.

create or replace function kernel_api.read_confirmation_request(
  p_token_hash text, p_as_actor uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r kernel.confirmation_requests; v jsonb; v_owner text;
begin
  perform kernel.resolve_caller(p_as_actor);
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

  select a.label into v_owner from kernel.actors a where a.id = r.owner_id;

  return jsonb_build_object(
    'thing', v,
    'asked_by', coalesce(v_owner, ''),
    'asked_of', r.asked_of,
    'question', r.question,
    'expires_at', r.expires_at,
    'expired', r.expires_at <= now(),
    'answered', r.answered_by is not null,
    'decision', r.decision,
    'answered_at', r.answered_at
  );
end;
$$;

------------------------------------------------------------------------------------------------
-- The other side's answer. Confirmed or disputed; both are recorded, neither replaces anything.

create or replace function kernel_api.answer_confirmation(
  p_token_hash text, p_decision text, p_note text default '',
  p_request_id text default null, p_as_actor uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  r kernel.confirmation_requests; v_target uuid; v_event uuid; v_note text; v_hash text; v_key text;
begin
  if p_decision is null or p_decision not in ('confirmed', 'disputed') then
    raise exception using errcode = 'KA003', message = 'An answer is confirmed or disputed';
  end if;
  v_note := coalesce(p_note, '');
  if length(v_note) > 2000 then
    raise exception using errcode = 'KA003', message = 'That note is too long to record';
  end if;
  if p_request_id is null or length(p_request_id) not between 1 and 100 then
    raise exception using errcode = 'KA003', message = 'An answer needs a request id';
  end if;

  perform kernel.lock_chain();
  select * into r from kernel.confirmation_requests cr where cr.token_hash = p_token_hash for update;
  if not found or r.cancelled_at is not null then
    raise exception using errcode = 'KA007', message = 'That confirmation link is unavailable';
  end if;

  -- An exact retry returns the original answer; a different answer never overwrites one.
  if r.answered_by is not null then
    if r.answered_by = c.actor_id and r.decision = p_decision then
      return r.answer_event;
    end if;
    raise exception using errcode = 'KA004', message = 'This was already answered';
  end if;
  if r.expires_at <= now() then
    raise exception using errcode = 'KA004', message = 'That confirmation link has expired';
  end if;
  -- Said plainly here; kernel.attach would also refuse to let a party witness its own event.
  if r.owner_id = c.actor_id then
    raise exception using errcode = 'KA002', message = 'You cannot confirm your own record';
  end if;
  if not kernel.grant_is_active(r.authority_grant) then
    raise exception using errcode = 'KA002', message = 'The authority behind this request has ended';
  end if;

  v_target := kernel.entity_latest_event(r.entity_id);
  if v_target is null then
    raise exception using errcode = 'KA007', message = 'That thing has no recorded version to confirm';
  end if;

  v_key := 'confirm:answer:' || p_request_id;
  v_event := kernel.append_event(c, 'kernel.confirmation.answered', r.scope, r.authority_grant,
    jsonb_build_object('confirmation_id', r.id, 'entity_id', r.entity_id,
      'decision', p_decision, 'note', v_note, 'owner_id', r.owner_id),
    null, v_key);

  -- The answer is evidence authored by the other side. The hash commits to their exact words, so
  -- the note cannot be altered later without the record showing it.
  v_hash := 'sha256:' || encode(pg_catalog.sha256(pg_catalog.convert_to(
    p_decision || '|' || v_note, 'UTF8')), 'hex');
  perform kernel.attach(c, v_target,
    jsonb_build_array(jsonb_build_object(
      'basis', 'witnessed', 'content_hash', v_hash, 'media_type', 'text/plain',
      'description', left(case when v_note = '' then p_decision else p_decision || ': ' || v_note end, 1000))),
    r.authority_grant, v_key || ':evidence');

  update kernel.confirmation_requests
    set answered_by = c.actor_id, answered_at = now(), decision = p_decision, answer_event = v_event
    where id = r.id;
  return v_event;
end;
$$;

------------------------------------------------------------------------------------------------
-- The owner withdraws a request. An answer already given stays in the record.

create or replace function kernel_api.cancel_confirmation(
  p_confirmation_id uuid, p_as_actor uuid default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  r kernel.confirmation_requests;
begin
  perform kernel.lock_chain();
  select * into r from kernel.confirmation_requests cr where cr.id = p_confirmation_id for update;
  if not found or r.owner_id <> c.actor_id then
    raise exception using errcode = 'KA007', message = 'That confirmation is unavailable';
  end if;
  if r.cancelled_at is not null then return; end if;
  perform kernel.append_event(c, 'kernel.confirmation.cancelled', r.scope,
    kernel.require_allowed(c.actor_id, 'world.entity.write', r.scope),
    jsonb_build_object('confirmation_id', r.id, 'entity_id', r.entity_id));
  update kernel.confirmation_requests set cancelled_at = now() where id = r.id;
end;
$$;

------------------------------------------------------------------------------------------------
-- What the owner's surface shows: who was asked, and whether they answered. Absence is a state,
-- not a gap, so an unanswered request is reported as plainly as an answered one.

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
      'answered_by', (select a.label from kernel.actors a where a.id = r.answered_by)
    ) order by r.expires_at), '[]'::jsonb)
    from kernel.confirmation_requests r where r.entity_id = p_entity_id
  );
end;
$$;

------------------------------------------------------------------------------------------------

revoke all on all tables in schema kernel from public, anon, authenticated, service_role;
revoke all on all sequences in schema kernel from public, anon, authenticated, service_role;
revoke all on all functions in schema kernel from public, anon, authenticated, service_role;
revoke all on all functions in schema kernel_api from public, anon;
grant execute on all functions in schema kernel_api to authenticated, service_role;
revoke execute on function kernel_api.verify_chain() from authenticated;
