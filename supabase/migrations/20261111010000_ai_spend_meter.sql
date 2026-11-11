-- The AI spend meter.
--
-- Why this exists: the chat limiters in lib/bot/chat.ts hold their windows in a
-- Map, in one server instance's memory. Its own comment says "in-memory per
-- instance (v1)". That is honest for talk, where a turn costs a fraction of a
-- cent, and it does not hold at all once a turn can run tools and a sandbox:
-- every instance would hand out the full budget, and a restart would clear it.
--
-- So the meter lives here, where it is durable and shared, and the window is
-- counted over real rows instead of process memory.
--
-- Where authority sits: the human or authorized worker can meter its own actor. These
-- functions take no target actor from an end user — the actor comes from
-- kernel.resolve_caller — so there is no cross-actor read to authorize, and no
-- capability can widen it. Service callers may act for an actor they are
-- allowed to act for, which resolve_caller already decides.
--
-- Where policy sits: the kernel reports what has been spent; it does not decide
-- what is too much. The limit stays in app config (CHAT_MAX_TOKENS_PER_HOUR and
-- the per-tool budgets to come) so it can be tuned without a migration. The
-- durable count is the thing that was missing, not the threshold.
--
-- Append-only, like the rest of kernel memory: rows are inserted and read.
-- No update or delete is granted to any API role.
--
-- Note for callers: anonymous (guest) sessions cannot use the kernel at all —
-- kernel.resolve_caller raises KA001 — so guest spend is still metered in
-- process, per IP, by the caller. See lib/bot/meter.ts.

create table kernel.ai_meter (
  id bigint generated always as identity primary key,
  actor_id uuid not null references kernel.actors (id),
  at timestamptz not null default now(),
  -- Total tokens (input + output) the call actually reported.
  tokens integer not null check (tokens between 1 and 10000000),
  -- What spent them: 'chat', 'draft', 'tool', … Free-form but shaped.
  kind text not null check (length(kind) between 1 and 40 and kind ~ '^[a-z][a-z0-9_]*$'),
  -- Idempotency: a retried call must not be charged twice.
  request_id text check (request_id is null or length(request_id) between 1 and 200)
);

-- The only read pattern: one actor's recent rows, newest first.
create index ai_meter_actor_at on kernel.ai_meter (actor_id, at desc);
-- A request is charged at most once per actor.
create unique index ai_meter_request_once on kernel.ai_meter (actor_id, request_id)
  where request_id is not null;

-- Window bounds: a minute to a day. Anything else is a caller bug, not a policy.
create function kernel.require_meter_window(p_window_seconds integer) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if p_window_seconds is null or p_window_seconds not between 60 and 86400 then
    raise exception using errcode = 'KA003',
      message = 'meter window must be between 60 and 86400 seconds';
  end if;
end;
$$;

-- What this actor has spent in the window. The check before spending.
create function kernel_api.read_ai_spend(
  p_window_seconds integer default 3600,
  p_as_actor uuid default null
) returns table (tokens bigint, calls integer)
language plpgsql stable security definer set search_path = '' as $$
declare c kernel.caller := kernel.resolve_caller(p_as_actor);
begin
  perform kernel.require_meter_window(p_window_seconds);
  return query
    select coalesce(sum(m.tokens), 0)::bigint, count(*)::integer
    from kernel.ai_meter m
    where m.actor_id = c.actor_id
      and m.at > now() - make_interval(secs => p_window_seconds);
end;
$$;

revoke all on function kernel_api.read_ai_spend(integer, uuid) from public;
grant execute on function kernel_api.read_ai_spend(integer, uuid) to authenticated, service_role;

-- Charge a completed call, then report the window. One round trip, so the
-- caller never has to read-then-write and race itself.
--
-- Idempotent on p_request_id: charging the same request twice records once and
-- still returns the true window total, so a retry is safe.
create function kernel_api.record_ai_spend(
  p_tokens integer,
  p_kind text,
  p_window_seconds integer default 3600,
  p_request_id text default null,
  p_as_actor uuid default null
) returns table (tokens bigint, calls integer)
language plpgsql security definer set search_path = '' as $$
declare c kernel.caller := kernel.resolve_caller(p_as_actor);
begin
  -- External OAuth apps, including newly connected agents, must not gain a
  -- write path to the metering table merely by having an authenticated JWT.
  -- Only the human's own session or an explicitly service-authorized worker
  -- may record spend; connected app scopes (Read/Add) do not authorize this.
  if c.auth_method = 'app_read_only'
     or (c.kind = 'agent' and c.auth_method = 'user_jwt') then
    raise exception using errcode = 'KA002',
      message = 'connected apps cannot record AI spend directly';
  end if;
  perform kernel.require_meter_window(p_window_seconds);
  if p_tokens is null or p_tokens not between 1 and 10000000 then
    raise exception using errcode = 'KA003', message = 'tokens must be between 1 and 10000000';
  end if;
  if p_kind is null or p_kind !~ '^[a-z][a-z0-9_]*$' or length(p_kind) > 40 then
    raise exception using errcode = 'KA003', message = 'kind must be a short lowercase name';
  end if;

  insert into kernel.ai_meter (actor_id, tokens, kind, request_id)
  values (c.actor_id, p_tokens, p_kind, nullif(btrim(coalesce(p_request_id, '')), ''))
  on conflict do nothing;

  return query
    select coalesce(sum(m.tokens), 0)::bigint, count(*)::integer
    from kernel.ai_meter m
    where m.actor_id = c.actor_id
      and m.at > now() - make_interval(secs => p_window_seconds);
end;
$$;

revoke all on function kernel_api.record_ai_spend(integer, text, integer, text, uuid) from public;
grant execute on function kernel_api.record_ai_spend(integer, text, integer, text, uuid) to authenticated, service_role;

-- The table itself is never reachable from an API role: only the two functions
-- above touch it, and they are security definer.
revoke all on table kernel.ai_meter from public;
