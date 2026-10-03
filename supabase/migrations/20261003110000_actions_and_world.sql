-- solve kernel v4: authority decisions, governance, actions, the World Graph, operational tasks
-- and avatars. DOMAIN-CONTRACTS.md is the specification.
--
-- Laws enforced here:
--   1. Authority, not humanness, controls action. A decision comes from active grants, lease
--      limits and the most specific action policy: ALLOW, REQUIRE_SECOND_AUTHORITY,
--      REQUIRE_QUORUM, REQUIRE_MULTISIG, REQUIRE_DELAY, REQUIRE_CHALLENGE_WINDOW or DENY.
--   2. No principal invents authority. A delegated grant or lease never exceeds what its issuer
--      holds; governance can approve an action but cannot enact more than the proposer's grant.
--      A limited lease authorizes only where its limits are checked: plain capability lookups
--      (and so every earlier kernel_api function) never see it.
--   3. Agents are first-class: they enact, create agents and hold leases. An agent's accountable
--      party is found by following ownership to a human or service.
--   4. Every action has one lifecycle and completes at most once; enactment re-checks authority,
--      so revocation stops it; external enactment records `enacting` first and completes with
--      evidence; unknown outcomes are needs_reconciliation.
--   5. The World Graph changes only through events: versioned entities, relations ended by
--      events, one canonical ref per thing.
--   6. A task is completed by its worker or, when verification is required, by a distinct
--      verifier, with the evidence the task declared.
--   7. An avatar is one identity with versioned seeds and representations, acting only through
--      its agent's grants.

------------------------------------------------------------------------------------------------
-- Refs and request replay
------------------------------------------------------------------------------------------------

create function kernel.is_ref(r text) returns boolean
language sql immutable set search_path = '' as $$
  select r is not null and (
    r ~ '^(actor|entity|task|action|event|relation):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or r ~ '^(payment|settlement):[0-9a-f]{64}$'
  );
$$;

create function kernel.ref_id(r text) returns text
language sql immutable set search_path = '' as $$
  select split_part(r, ':', 2);
$$;

-- Returns the original event's payload when an actor retries a request with the same key; a
-- different request under the same key is rejected.
create function kernel.replay_request(p_actor uuid, p_key text, p_type text, p_request jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  v_original kernel.events;
begin
  if p_key is null then
    return null;
  end if;
  select * into v_original from kernel.events e where e.actor_id = p_actor and e.idempotency_key = p_key;
  if not found then
    return null;
  end if;
  if v_original.type <> p_type or v_original.payload -> 'request' is distinct from p_request then
    raise exception using errcode = 'KA004', message = 'idempotency key already used for a different request';
  end if;
  return v_original.payload;
end;
$$;

------------------------------------------------------------------------------------------------
-- Principals: accountable parties, agent roles, agents creating agents
------------------------------------------------------------------------------------------------

-- The accountable party behind an actor: agents follow ownership to a human or service.
create or replace function kernel.party_of(p_actor uuid) returns uuid
language sql stable set search_path = '' as $$
  with recursive up as (
    select a.id, a.kind, a.owner_id, 0 as depth from kernel.actors a where a.id = p_actor
    union all
    select o.id, o.kind, o.owner_id, up.depth + 1
    from kernel.actors o join up on o.id = up.owner_id
    where up.kind = 'agent' and up.depth < 32
  )
  select up.id from up where up.kind <> 'agent' order by up.depth limit 1;
$$;

-- Same rules as v1; an agent now acts on behalf of its accountable party through any chain of
-- agent ownership.
create or replace function kernel.resolve_caller(p_as_actor uuid) returns kernel.caller
language plpgsql stable set search_path = '' as $$
declare
  claims jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
  jwt_role text := claims ->> 'role';
  session_role text := nullif(current_setting('role', true), 'none');
  result kernel.caller;
begin
  if session_role is not null and session_role is distinct from jwt_role then
    raise exception using errcode = 'KA001', message = 'session role does not match token role';
  end if;

  if jwt_role = 'authenticated' then
    if p_as_actor is not null then
      raise exception using errcode = 'KA002', message = 'end users act only as themselves';
    end if;
    if coalesce((claims ->> 'is_anonymous')::boolean, false) then
      raise exception using errcode = 'KA001', message = 'anonymous sessions cannot use the kernel';
    end if;
    select a.id, a.kind into result.actor_id, result.kind
    from kernel.identity_links l
    join kernel.actors a on a.id = l.actor_id
    where l.provider = 'supabase_auth' and l.subject = claims ->> 'sub';
    if result.actor_id is null then
      raise exception using errcode = 'KA001', message = 'caller is not registered; call kernel_api.register() first';
    end if;
    result.auth_method := 'user_jwt';
    return result;
  end if;

  if jwt_role = 'service_role' then
    if p_as_actor is null then
      raise exception using errcode = 'KA003', message = 'service calls must name the agent or service actor they act as';
    end if;
    if p_as_actor = kernel.kernel_actor_id() then
      raise exception using errcode = 'KA002', message = 'the kernel acts only through its own functions';
    end if;
    select a.id, a.kind, case when a.kind = 'agent' then kernel.party_of(a.id) end
    into result.actor_id, result.kind, result.principal_id
    from kernel.actors a where a.id = p_as_actor;
    if result.actor_id is null then
      raise exception using errcode = 'KA007', message = 'unknown actor';
    end if;
    if result.kind = 'human' then
      raise exception using errcode = 'KA002', message = 'the service key cannot act as a human';
    end if;
    result.auth_method := 'service_role';
    return result;
  end if;

  raise exception using errcode = 'KA001', message = 'unauthenticated';
end;
$$;

create table kernel.agent_roles (
  actor_id uuid primary key references kernel.actors (id),
  role text not null check (role in (
    'personal_avatar', 'ai_companion', 'world_agent', 'organization_agent', 'state_agent',
    'system_agent', 'engineering_agent', 'specialist'
  )),
  serves text check (serves is null or kernel.is_scope(serves)),
  event_id uuid not null unique references kernel.events (id),
  created_at timestamptz not null default now()
);

-- Delegates a capability from an issuer's own grant (kernel-internal; callers check authority).
create function kernel.delegate(p_issuer kernel.caller, p_grantee uuid, p_capability text, p_scope text,
                                p_expires_at timestamptz, p_basis text) returns uuid
language plpgsql set search_path = '' as $$
declare
  v_parent uuid := kernel.find_delegable_grant(p_issuer.actor_id, p_capability, p_scope);
  v_grant uuid := gen_random_uuid();
  v_event uuid;
begin
  if v_parent is null then
    raise exception using errcode = 'KA002', message = format('cannot grant %s on %s: the issuer does not hold it', p_capability, p_scope);
  end if;
  v_event := kernel.append_event(
    p_issuer, 'kernel.grant.issued', p_scope, v_parent,
    jsonb_build_object('grant_id', v_grant, 'grantee_id', p_grantee, 'capability', p_capability, 'scope', p_scope,
                       'parent_grant_id', v_parent, 'expires_at', p_expires_at, 'basis', p_basis)
  );
  insert into kernel.grants (id, grantee_id, capability, scope, issued_by, parent_grant_id, expires_at, event_id)
  values (v_grant, p_grantee, p_capability, p_scope, p_issuer.actor_id, v_parent, p_expires_at, v_event);
  return v_grant;
end;
$$;

-- Creates an agent owned by the creator, which may itself be an agent. The creator needs
-- kernel.actor.create on the scope the agent will serve (its own actor scope by default) and
-- receives authority over the new agent's actor scope.
create function kernel.do_spawn_agent(c kernel.caller, p_label text, p_role text, p_serves text,
                                      p_idempotency_key text) returns uuid
language plpgsql set search_path = '' as $$
declare
  v_scope text := coalesce(p_serves, 'actor:' || c.actor_id);
  v_request jsonb := jsonb_build_object('label', coalesce(p_label, ''), 'role', p_role, 'serves', p_serves);
  v_replay jsonb;
  v_authority uuid;
  v_agent uuid := gen_random_uuid();
  v_event uuid;
begin
  if c.kind = 'service' and c.auth_method = 'kernel' then
    raise exception using errcode = 'KA002', message = 'the kernel does not own agents';
  end if;
  perform kernel.require_scope(v_scope);
  v_replay := kernel.replay_request(c.actor_id, p_idempotency_key, 'kernel.agent.spawned', v_request);
  if v_replay is not null then
    return (v_replay ->> 'actor_id')::uuid;
  end if;
  v_authority := kernel.require_grant(c.actor_id, 'kernel.actor.create', v_scope);

  insert into kernel.actors (id, kind, owner_id, label) values (v_agent, 'agent', c.actor_id, coalesce(p_label, ''));
  v_event := kernel.append_event(
    c, 'kernel.agent.spawned', v_scope, v_authority,
    jsonb_build_object('request', v_request, 'actor_id', v_agent, 'owner_id', c.actor_id,
                       'accountable_party', kernel.party_of(c.actor_id), 'authority_grant', v_authority),
    null, p_idempotency_key
  );
  insert into kernel.agent_roles (actor_id, role, serves, event_id) values (v_agent, p_role, p_serves, v_event);
  perform kernel.issue_policy_grant(c.actor_id, '*', 'actor:' || v_agent, 'creator');
  return v_agent;
end;
$$;

create function kernel_api.spawn_agent(
  p_label text,
  p_role text,
  p_serves text default null,
  p_idempotency_key text default null,
  p_as_actor uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
begin
  if p_role is null or p_role not in ('personal_avatar', 'ai_companion', 'world_agent', 'organization_agent', 'state_agent',
                                      'system_agent', 'engineering_agent', 'specialist') then
    raise exception using errcode = 'KA003', message = 'unknown agent role';
  end if;
  if length(coalesce(p_label, '')) > 200 then
    raise exception using errcode = 'KA003', message = 'label is limited to 200 characters';
  end if;
  perform kernel.lock_chain();
  perform kernel.require_allowed(c.actor_id, 'kernel.actor.create', coalesce(p_serves, 'actor:' || c.actor_id));
  return kernel.do_spawn_agent(c, p_label, p_role, p_serves, p_idempotency_key);
end;
$$;

------------------------------------------------------------------------------------------------
-- Leases: grants with limits
------------------------------------------------------------------------------------------------

create table kernel.grant_limits (
  grant_id uuid primary key references kernel.grants (id),
  max_amount numeric(38, 0) check (max_amount > 0),
  asset text references kernel.assets (code),
  counterparty_ref text check (counterparty_ref is null or kernel.is_ref(counterparty_ref)),
  task_ref text check (task_ref is null or (task_ref ~ '^task:' and kernel.is_ref(task_ref))),
  event_id uuid not null unique references kernel.events (id),
  created_at timestamptz not null default now(),
  check ((max_amount is null) = (asset is null))
);

-- The tightest limits along a grant's chain: lowest amount, and the counterparty and task nearest
-- the grant. A chain that limits two different assets permits neither.
create function kernel.effective_limits(p_grant uuid)
returns table (max_amount numeric, asset text, counterparty_ref text, task_ref text, conflicting boolean)
language sql stable set search_path = '' as $$
  with recursive chain as (
    select g.id, g.parent_grant_id, 0 as depth from kernel.grants g where g.id = p_grant
    union all
    select p.id, p.parent_grant_id, chain.depth + 1 from kernel.grants p join chain on p.id = chain.parent_grant_id
  ), limits as (
    select l.*, chain.depth from chain join kernel.grant_limits l on l.grant_id = chain.id
  )
  select
    (select min(l.max_amount) from limits l),
    (select l.asset from limits l where l.asset is not null order by l.depth limit 1),
    (select l.counterparty_ref from limits l where l.counterparty_ref is not null order by l.depth limit 1),
    (select l.task_ref from limits l where l.task_ref is not null order by l.depth limit 1),
    (select count(distinct l.asset) > 1 from limits l where l.asset is not null)
    or (select count(distinct l.counterparty_ref) > 1 from limits l where l.counterparty_ref is not null)
    or (select count(distinct l.task_ref) > 1 from limits l where l.task_ref is not null);
$$;

-- Whether a grant's limits permit a request.
create function kernel.limits_permit(p_grant uuid, p_amount numeric, p_asset text, p_counterparty text, p_task text)
returns text
language plpgsql stable set search_path = '' as $$
declare
  l record;
begin
  select * into l from kernel.effective_limits(p_grant);
  if l.conflicting then
    return 'the lease chain carries conflicting limits';
  end if;
  if l.max_amount is not null and p_amount is not null then
    if p_asset is distinct from l.asset then
      return format('the lease covers %s only', l.asset);
    end if;
    if p_amount > l.max_amount then
      return format('amount %s exceeds the delegated limit of %s %s', p_amount, l.max_amount, l.asset);
    end if;
  end if;
  if l.counterparty_ref is not null and p_counterparty is distinct from l.counterparty_ref then
    return format('the lease is limited to counterparty %s', l.counterparty_ref);
  end if;
  if l.task_ref is not null and p_task is distinct from l.task_ref then
    return format('the lease is limited to %s', l.task_ref);
  end if;
  -- Authority limited to a task ends with the task.
  if l.task_ref is not null
     and (kernel.task_status(kernel.ref_id(l.task_ref)::uuid)).status in ('completed', 'failed', 'cancelled') then
    return format('%s is closed', l.task_ref);
  end if;
  return null;
end;
$$;

-- Whether any grant along a chain carries limits.
create function kernel.grant_limited(p_grant uuid) returns boolean
language sql stable set search_path = '' as $$
  with recursive chain as (
    select g.id, g.parent_grant_id from kernel.grants g where g.id = p_grant
    union all
    select p.id, p.parent_grant_id from kernel.grants p join chain on p.id = chain.parent_grant_id
  )
  select exists (select 1 from chain join kernel.grant_limits l on l.grant_id = chain.id);
$$;

-- Plain capability lookup, used by every function that checks a capability without a request's
-- amount, counterparty or task. A limited lease is invisible here, so a lease limited to one task
-- or counterparty cannot be spent through such a function as if it were unlimited.
create or replace function kernel.find_grant(p_actor uuid, p_capability text, p_scope text) returns uuid
language sql stable set search_path = '' as $$
  select g.id
  from kernel.grants g
  where g.grantee_id = p_actor
    and kernel.capability_covers(g.capability, p_capability)
    and kernel.scope_covers(g.scope, p_scope)
    and kernel.grant_is_active(g.id)
    and not kernel.grant_limited(g.id)
  order by g.created_at, g.id
  limit 1;
$$;

-- The first active grant whose limits permit a specific request, without consulting policy: for
-- checks that are not themselves governed actions (task verification and management, approvals).
create function kernel.find_permitted_grant(p_actor uuid, p_capability text, p_scope text, p_amount numeric default null,
                                            p_asset text default null, p_counterparty text default null,
                                            p_task text default null) returns uuid
language sql stable set search_path = '' as $$
  select g.id
  from kernel.grants g
  where g.grantee_id = p_actor
    and kernel.capability_covers(g.capability, p_capability)
    and kernel.scope_covers(g.scope, p_scope)
    and kernel.grant_is_active(g.id)
    and kernel.limits_permit(g.id, p_amount, p_asset, p_counterparty, p_task) is null
  order by g.created_at, g.id
  limit 1;
$$;

-- The grant a delegation hangs from, unlimited first. A limited lease may still be delegated
-- from: its limits bind every grant below it (effective_limits) and issue_lease never widens them.
create function kernel.find_delegable_grant(p_actor uuid, p_capability text, p_scope text) returns uuid
language sql stable set search_path = '' as $$
  select g.id
  from kernel.grants g
  where g.grantee_id = p_actor
    and kernel.capability_covers(g.capability, p_capability)
    and kernel.scope_covers(g.scope, p_scope)
    and kernel.grant_is_active(g.id)
  order by kernel.grant_limited(g.id), g.created_at, g.id
  limit 1;
$$;

-- Issues a lease: a delegated grant plus limits, all within the issuer's own limits.
create function kernel_api.issue_lease(
  p_grantee uuid,
  p_capability text,
  p_scope text,
  p_expires_at timestamptz default null,
  p_max_amount text default null,
  p_asset text default null,
  p_counterparty_ref text default null,
  p_task_ref text default null,
  p_idempotency_key text default null,
  p_as_actor uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  v_grant uuid;
  v_parent uuid;
  v_parent_limits record;
  v_event uuid;
begin
  if (p_max_amount is null) <> (p_asset is null) then
    raise exception using errcode = 'KA003', message = 'an amount limit needs an asset';
  end if;
  if p_max_amount is not null and p_max_amount !~ '^[1-9][0-9]{0,37}$' then
    raise exception using errcode = 'KA003', message = 'max amount must be a positive integer in minor units';
  end if;
  if p_counterparty_ref is not null and not kernel.is_ref(p_counterparty_ref) then
    raise exception using errcode = 'KA003', message = 'invalid counterparty ref';
  end if;
  if p_task_ref is not null and (p_task_ref !~ '^task:' or not kernel.is_ref(p_task_ref)) then
    raise exception using errcode = 'KA003', message = 'invalid task ref';
  end if;
  if p_task_ref is not null and not kernel.ref_exists(p_task_ref) then
    raise exception using errcode = 'KA007', message = 'a lease can only be limited to a task that exists';
  end if;

  v_grant := kernel_api.issue_grant(p_grantee, p_capability, p_scope, p_expires_at, p_idempotency_key, p_as_actor);
  if exists (select 1 from kernel.grant_limits l where l.grant_id = v_grant) then
    return v_grant;
  end if;
  select g.parent_grant_id into v_parent from kernel.grants g where g.id = v_grant;
  select * into v_parent_limits from kernel.effective_limits(v_parent);
  if v_parent_limits.max_amount is not null
     and (p_max_amount is null or p_asset is distinct from v_parent_limits.asset or p_max_amount::numeric > v_parent_limits.max_amount) then
    raise exception using errcode = 'KA002', message = 'a lease cannot exceed the amount limit of the authority it comes from';
  end if;
  if v_parent_limits.counterparty_ref is not null and p_counterparty_ref is distinct from v_parent_limits.counterparty_ref then
    raise exception using errcode = 'KA002', message = 'a lease cannot widen the counterparty limit it comes from';
  end if;
  if v_parent_limits.task_ref is not null and p_task_ref is distinct from v_parent_limits.task_ref then
    raise exception using errcode = 'KA002', message = 'a lease cannot widen the task limit it comes from';
  end if;
  if p_max_amount is null and p_counterparty_ref is null and p_task_ref is null then
    return v_grant;
  end if;

  v_event := kernel.append_event(
    c, 'kernel.lease.limited', case when p_scope = '*' then 'system' else p_scope end, v_parent,
    jsonb_build_object('grant_id', v_grant, 'max_amount', p_max_amount, 'asset', p_asset,
                       'counterparty_ref', p_counterparty_ref, 'task_ref', p_task_ref)
  );
  insert into kernel.grant_limits (grant_id, max_amount, asset, counterparty_ref, task_ref, event_id)
  values (v_grant, p_max_amount::numeric, p_asset, p_counterparty_ref, p_task_ref, v_event);
  return v_grant;
end;
$$;

------------------------------------------------------------------------------------------------
-- Policies and decisions
------------------------------------------------------------------------------------------------

create table kernel.action_policies (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope = '*' or kernel.is_scope(scope)),
  capability text not null check (kernel.is_capability(capability)),
  version integer not null check (version >= 1),
  requirement text not null check (requirement in (
    'allow', 'second_authority', 'quorum', 'multisig', 'delay', 'challenge_window', 'deny'
  )),
  -- Approvers (second authority, quorum) or challengers (challenge window) must hold this.
  approver_capability text check (approver_capability is null or kernel.is_capability(approver_capability)),
  threshold integer check (threshold between 1 and 50),
  signers uuid[],
  delay_seconds integer check (delay_seconds between 0 and 31536000),
  distinct_by text not null default 'party' check (distinct_by in ('party', 'actor')),
  event_id uuid not null unique references kernel.events (id),
  created_at timestamptz not null default now(),
  unique (scope, capability, version)
);

-- The current policy most specific to a capability on a scope.
create function kernel.match_policy(p_capability text, p_scope text) returns kernel.action_policies
language sql stable set search_path = '' as $$
  select p.* from kernel.action_policies p
  where kernel.scope_covers(p.scope, p_scope)
    and kernel.capability_covers(p.capability, p_capability)
    and not exists (
      select 1 from kernel.action_policies newer
      where newer.scope = p.scope and newer.capability = p.capability and newer.version > p.version
    )
  order by case when p.scope = '*' then -1 else length(p.scope) end desc,
           case when p.capability = p_capability then 1000 when p.capability = '*' then 0 else length(p.capability) end desc
  limit 1;
$$;

create type kernel.decision as (
  decision text,
  grant_id uuid,
  policy_id uuid,
  threshold integer,
  delay_seconds integer,
  reasons text[]
);

-- The deterministic authority decision. The same inputs always give the same answer; nothing
-- about the actor's kind enters it.
create function kernel.decide(p_actor uuid, p_capability text, p_scope text, p_amount numeric default null,
                              p_asset text default null, p_counterparty text default null, p_task text default null)
returns kernel.decision
language plpgsql stable set search_path = '' as $$
declare
  d kernel.decision;
  g record;
  v_problem text;
  v_problems text[] := '{}';
  p kernel.action_policies;
begin
  for g in
    select gr.id from kernel.grants gr
    where gr.grantee_id = p_actor
      and kernel.capability_covers(gr.capability, p_capability)
      and kernel.scope_covers(gr.scope, p_scope)
      and kernel.grant_is_active(gr.id)
    order by gr.created_at, gr.id
  loop
    v_problem := kernel.limits_permit(g.id, p_amount, p_asset, p_counterparty, p_task);
    if v_problem is null then
      d.grant_id := g.id;
      exit;
    end if;
    v_problems := v_problems || v_problem;
  end loop;
  if d.grant_id is null then
    d.decision := 'DENY';
    d.reasons := case when cardinality(v_problems) > 0 then v_problems
                      else array[format('no active grant for %s on %s', p_capability, p_scope)] end;
    return d;
  end if;

  p := kernel.match_policy(p_capability, p_scope);
  d.policy_id := p.id;
  d.reasons := '{}';
  if p.id is null or p.requirement = 'allow' then
    d.decision := 'ALLOW';
  elsif p.requirement = 'deny' then
    d.decision := 'DENY';
    d.reasons := array[format('policy on %s denies %s', p.scope, p.capability)];
  elsif p.requirement = 'second_authority' then
    d.decision := 'REQUIRE_SECOND_AUTHORITY';
    d.threshold := 2;
  elsif p.requirement = 'quorum' then
    d.decision := 'REQUIRE_QUORUM';
    d.threshold := p.threshold;
  elsif p.requirement = 'multisig' then
    d.decision := 'REQUIRE_MULTISIG';
    d.threshold := p.threshold;
  elsif p.requirement = 'delay' then
    d.decision := 'REQUIRE_DELAY';
  elsif p.requirement = 'challenge_window' then
    d.decision := 'REQUIRE_CHALLENGE_WINDOW';
  end if;
  d.delay_seconds := coalesce(p.delay_seconds, 0);
  return d;
end;
$$;

-- Direct kernel writes are allowed only when policy says ALLOW; anything governed goes through
-- an action. Returns the authorizing grant.
create function kernel.require_allowed(p_actor uuid, p_capability text, p_scope text) returns uuid
language plpgsql stable set search_path = '' as $$
declare
  d kernel.decision := kernel.decide(p_actor, p_capability, p_scope);
begin
  if d.decision = 'DENY' then
    raise exception using errcode = 'KA002', message = array_to_string(d.reasons, '; ');
  end if;
  if d.decision <> 'ALLOW' then
    raise exception using errcode = 'KA002',
      message = format('%s on %s is governed (%s): propose it as an action', p_capability, p_scope, d.decision);
  end if;
  return d.grant_id;
end;
$$;

create function kernel_api.authorize(
  p_capability text,
  p_scope text,
  p_amount text default null,
  p_asset text default null,
  p_counterparty_ref text default null,
  p_task_ref text default null,
  p_as_actor uuid default null
) returns table (decision text, grant_id uuid, policy_id uuid, threshold integer, delay_seconds integer, reasons text[])
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  d kernel.decision;
begin
  if not kernel.is_capability(p_capability) then
    raise exception using errcode = 'KA003', message = 'invalid capability';
  end if;
  perform kernel.require_scope(p_scope);
  if p_amount is not null and p_amount !~ '^[1-9][0-9]{0,37}$' then
    raise exception using errcode = 'KA003', message = 'amount must be a positive integer in minor units';
  end if;
  d := kernel.decide(c.actor_id, p_capability, p_scope, p_amount::numeric, p_asset, p_counterparty_ref, p_task_ref);
  return query select d.decision, d.grant_id, d.policy_id, d.threshold, d.delay_seconds, d.reasons;
end;
$$;

create function kernel.do_set_policy(c kernel.caller, p_authority uuid, p_scope text, p_capability text,
                                     p_requirement text, p_approver_capability text, p_threshold integer,
                                     p_signers uuid[], p_delay_seconds integer, p_distinct_by text)
returns integer
language plpgsql set search_path = '' as $$
declare
  v_version integer;
  v_threshold integer := p_threshold;
  v_event uuid;
begin
  if not kernel.is_capability(p_capability) then
    raise exception using errcode = 'KA003', message = 'invalid capability';
  end if;
  if p_requirement is null or p_requirement not in ('allow', 'second_authority', 'quorum', 'multisig', 'delay', 'challenge_window', 'deny') then
    raise exception using errcode = 'KA003', message = 'unknown policy requirement';
  end if;
  if p_requirement = 'second_authority' then
    v_threshold := 2;
  elsif p_requirement = 'quorum' and coalesce(v_threshold, 0) < 2 then
    raise exception using errcode = 'KA003', message = 'a quorum needs a threshold of at least 2';
  elsif p_requirement = 'multisig' and (p_signers is null or cardinality(p_signers) = 0
        or coalesce(v_threshold, 0) < 1 or v_threshold > cardinality(p_signers)) then
    raise exception using errcode = 'KA003', message = 'multisig needs signers and a threshold no larger than their number';
  elsif p_requirement in ('delay', 'challenge_window') and coalesce(p_delay_seconds, 0) <= 0 then
    raise exception using errcode = 'KA003', message = 'a delay or challenge window needs a positive number of seconds';
  elsif p_requirement = 'challenge_window' and p_approver_capability is null then
    raise exception using errcode = 'KA003', message = 'a challenge window names the capability challengers must hold';
  end if;
  if p_signers is not null and exists (select 1 from unnest(p_signers) s where not exists (select 1 from kernel.actors a where a.id = s)) then
    raise exception using errcode = 'KA007', message = 'unknown signer';
  end if;

  select coalesce(max(p.version), 0) + 1 into v_version from kernel.action_policies p
  where p.scope = p_scope and p.capability = p_capability;
  v_event := kernel.append_event(
    c, 'kernel.policy.set', case when p_scope = '*' then 'system' else p_scope end, p_authority,
    jsonb_build_object('scope', p_scope, 'capability', p_capability, 'version', v_version, 'requirement', p_requirement,
                       'approver_capability', p_approver_capability, 'threshold', v_threshold,
                       'signers', to_jsonb(p_signers), 'delay_seconds', p_delay_seconds,
                       'distinct_by', coalesce(p_distinct_by, 'party'))
  );
  insert into kernel.action_policies (scope, capability, version, requirement, approver_capability, threshold, signers,
                                      delay_seconds, distinct_by, event_id)
  values (p_scope, p_capability, v_version, p_requirement, p_approver_capability, v_threshold, p_signers,
          p_delay_seconds, coalesce(p_distinct_by, 'party'), v_event);
  return v_version;
end;
$$;

-- Sets the policy for a capability on a scope. Needs kernel.policy.set there; when policy changes
-- are themselves governed, propose a policy.set action instead.
create function kernel_api.set_action_policy(
  p_scope text,
  p_capability text,
  p_requirement text,
  p_approver_capability text default null,
  p_threshold integer default null,
  p_signers uuid[] default null,
  p_delay_seconds integer default null,
  p_distinct_by text default 'party',
  p_as_actor uuid default null
) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  v_authority uuid;
begin
  if p_scope is distinct from '*' then
    perform kernel.require_scope(p_scope);
  end if;
  perform kernel.lock_chain();
  v_authority := kernel.require_allowed(c.actor_id, 'kernel.policy.set', p_scope);
  return kernel.do_set_policy(c, v_authority, p_scope, p_capability, p_requirement, p_approver_capability, p_threshold,
                              p_signers, p_delay_seconds, p_distinct_by);
end;
$$;

------------------------------------------------------------------------------------------------
-- One gate: direct writes from v1/v2 now pass the same policy decision. Bodies are unchanged
-- except that require_grant becomes require_allowed; governed writes go through actions.
------------------------------------------------------------------------------------------------

-- Validates ledger entries for a posting in a scope and normalizes them.
create function kernel.validated_entries(p_scope text, p_entries jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  v_entry jsonb;
  v_entries jsonb := '[]'::jsonb;
  v_account text;
  v_amount text;
begin
  if p_entries is null or jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) not between 2 and 100 then
    raise exception using errcode = 'KA003', message = 'entries must be an array of 2 to 100 items';
  end if;
  for v_entry in select value from jsonb_array_elements(p_entries) loop
    v_account := v_entry ->> 'account_id';
    v_amount := v_entry ->> 'amount';
    if coalesce(v_account, '') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
      raise exception using errcode = 'KA003', message = 'each entry needs an account_id uuid';
    end if;
    if coalesce(v_amount, '') !~ '^-?[1-9][0-9]{0,37}$' then
      raise exception using errcode = 'KA003', message = 'each amount must be a non-zero integer in minor units';
    end if;
    v_entries := v_entries || jsonb_build_object('account_id', v_account::uuid, 'amount', v_amount);
  end loop;
  if exists (
    select 1 from jsonb_array_elements(v_entries) x
    join kernel.accounts a on a.id = (x ->> 'account_id')::uuid
    where (x ->> 'amount')::numeric < 0 and not kernel.scope_covers(p_scope, a.scope)
  ) then
    raise exception using errcode = 'KA002', message = 'cannot credit an account outside the posting scope';
  end if;
  return v_entries;
end;
$$;

create or replace function kernel_api.issue_grant(
  p_grantee uuid,
  p_capability text,
  p_scope text,
  p_expires_at timestamptz default null,
  p_idempotency_key text default null,
  p_as_actor uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  event_scope text := case when p_scope = '*' then 'system' else p_scope end;
  authority uuid;
  parent uuid;
  replayed uuid;
  new_grant uuid := gen_random_uuid();
  event_id uuid;
begin
  if not kernel.is_capability(p_capability) then
    raise exception using errcode = 'KA003', message = format('invalid capability: %s', coalesce(p_capability, 'null'));
  end if;
  if p_scope is distinct from '*' then
    perform kernel.require_scope(p_scope);
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception using errcode = 'KA003', message = 'expires_at must be in the future';
  end if;
  if not exists (select 1 from kernel.actors a where a.id = p_grantee) then
    raise exception using errcode = 'KA007', message = 'grantee not found';
  end if;

  perform kernel.lock_chain();
  replayed := kernel.replay(c.actor_id, p_idempotency_key, 'kernel.grant.issued', event_scope);
  if replayed is not null then
    return (select g.id from kernel.grants g where g.event_id = replayed);
  end if;

  authority := kernel.require_allowed(c.actor_id, 'kernel.grant.issue', p_scope);
  parent := kernel.find_delegable_grant(c.actor_id, p_capability, p_scope);
  if parent is null then
    raise exception using errcode = 'KA002', message = 'cannot grant authority the issuer does not hold';
  end if;

  event_id := kernel.append_event(
    c, 'kernel.grant.issued', event_scope, authority,
    jsonb_build_object(
      'grant_id', new_grant, 'grantee_id', p_grantee, 'capability', p_capability, 'scope', p_scope,
      'parent_grant_id', parent, 'expires_at', p_expires_at, 'basis', 'delegation'
    ),
    null, p_idempotency_key
  );
  insert into kernel.grants (id, grantee_id, capability, scope, issued_by, parent_grant_id, expires_at, event_id)
  values (new_grant, p_grantee, p_capability, p_scope, c.actor_id, parent, p_expires_at, event_id);
  return new_grant;
end;
$$;

create or replace function kernel_api.record_event(
  p_type text,
  p_scope text,
  p_payload jsonb default '{}'::jsonb,
  p_evidence jsonb default '[]'::jsonb,
  p_corrects uuid default null,
  p_idempotency_key text default null,
  p_correlation_id uuid default null,
  p_as_actor uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  v_authority uuid;
  v_corrected kernel.events;
  v_event uuid;
begin
  if not kernel.is_event_type(p_type) then
    raise exception using errcode = 'KA003', message = format('invalid event type: %s', coalesce(p_type, 'null'));
  end if;
  if p_type like 'kernel.%' then
    raise exception using errcode = 'KA003', message = 'kernel.* events are written only by kernel functions';
  end if;
  perform kernel.require_scope(p_scope);
  if p_payload is not null and jsonb_typeof(p_payload) <> 'object' then
    raise exception using errcode = 'KA003', message = 'payload must be a JSON object';
  end if;

  perform kernel.lock_chain();
  v_event := kernel.replay_exact(c.actor_id, p_idempotency_key, p_type, p_scope, coalesce(p_payload, '{}'::jsonb));
  if v_event is not null then
    return v_event;
  end if;
  v_authority := kernel.require_allowed(c.actor_id, p_type, p_scope);

  if p_corrects is not null then
    select * into v_corrected from kernel.events e where e.id = p_corrects;
    if not found then
      raise exception using errcode = 'KA007', message = 'corrected event not found';
    end if;
    if v_corrected.type like 'kernel.%' then
      raise exception using errcode = 'KA003', message = 'kernel events are corrected through their own functions';
    end if;
    if v_corrected.scope <> p_scope then
      raise exception using errcode = 'KA003', message = 'a correction must be recorded in the scope of the event it corrects';
    end if;
  end if;

  v_event := kernel.append_event(
    c, p_type, p_scope, v_authority, p_payload, p_corrects, p_idempotency_key, p_correlation_id
  );
  perform kernel.attach(c, v_event, coalesce(p_evidence, '[]'::jsonb), v_authority);
  return v_event;
end;
$$;

create or replace function kernel_api.post_transaction(
  p_scope text,
  p_entries jsonb,
  p_memo text default '',
  p_evidence jsonb default '[]'::jsonb,
  p_idempotency_key text default null,
  p_correlation_id uuid default null,
  p_as_actor uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  v_authority uuid;
  v_entries jsonb;
  v_event uuid;
begin
  perform kernel.require_scope(p_scope);
  if length(coalesce(p_memo, '')) > 500 then
    raise exception using errcode = 'KA003', message = 'memo is limited to 500 characters';
  end if;
  if p_entries is null or jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) not between 2 and 100 then
    raise exception using errcode = 'KA003', message = 'entries must be an array of 2 to 100 items';
  end if;

  perform kernel.lock_chain();
  v_event := kernel.replay(c.actor_id, p_idempotency_key, 'kernel.ledger.posted', p_scope);
  if v_event is not null then
    return v_event;
  end if;
  v_entries := kernel.validated_entries(p_scope, p_entries);
  v_authority := kernel.require_allowed(c.actor_id, 'kernel.ledger.post', p_scope);

  v_event := kernel.post_entries(c, p_scope, v_authority, v_entries, p_memo, p_idempotency_key, p_correlation_id);
  perform kernel.attach(c, v_event, coalesce(p_evidence, '[]'::jsonb), v_authority);
  return v_event;
end;
$$;

------------------------------------------------------------------------------------------------
-- World Graph
------------------------------------------------------------------------------------------------

create table kernel.entities (
  id uuid primary key,
  kind text not null check (kind in (
    'world', 'place', 'organization', 'resource', 'need', 'capability', 'asset', 'milestone',
    'agreement', 'offer', 'document'
  )),
  scope text not null check (kernel.is_scope(scope)),
  event_id uuid not null unique references kernel.events (id),
  created_at timestamptz not null default now()
);

create index entities_scope on kernel.entities (scope);

create table kernel.entity_versions (
  entity_id uuid not null references kernel.entities (id),
  version integer not null check (version >= 1),
  title text not null check (length(title) between 1 and 200),
  summary text not null default '' check (length(summary) <= 2000),
  attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object' and length(attributes::text) <= 16000),
  latitude numeric(9, 6) check (latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude between -180 and 180),
  altitude_m numeric(10, 2),
  location_truth text check (location_truth in ('declared', 'device_observed', 'provider_derived', 'legal_address', 'estimated')),
  visibility text not null check (visibility in ('public', 'members', 'private')),
  importance smallint not null default 50 check (importance between 0 and 100),
  event_id uuid not null unique references kernel.events (id),
  created_at timestamptz not null default now(),
  primary key (entity_id, version),
  check ((latitude is null) = (longitude is null) and (latitude is null) = (location_truth is null))
);

create table kernel.relations (
  id uuid primary key,
  kind text not null check (kind in (
    'owns', 'controls', 'member_of', 'located_in', 'supplies', 'requires', 'blocks', 'produces',
    'verifies', 'represents', 'assists', 'offers', 'needs', 'part_of', 'challenges', 'replaces', 'escalates_to'
  )),
  from_ref text not null check (kernel.is_ref(from_ref)),
  to_ref text not null check (kernel.is_ref(to_ref)),
  scope text not null check (kernel.is_scope(scope)),
  attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object' and length(attributes::text) <= 8000),
  event_id uuid not null unique references kernel.events (id),
  created_at timestamptz not null default now(),
  check (from_ref <> to_ref)
);

create index relations_scope on kernel.relations (scope);
create index relations_from on kernel.relations (from_ref);
create index relations_to on kernel.relations (to_ref);

create table kernel.relation_endings (
  relation_id uuid primary key references kernel.relations (id),
  reason text not null default '' check (length(reason) <= 500),
  event_id uuid not null unique references kernel.events (id),
  created_at timestamptz not null default now()
);

-- Tasks are defined here so refs can be checked; their functions follow below.
create table kernel.tasks (
  id uuid primary key,
  scope text not null check (kernel.is_scope(scope)),
  title text not null check (length(title) between 1 and 200),
  objective text not null default '' check (length(objective) <= 2000),
  cause_ref text check (cause_ref is null or kernel.is_ref(cause_ref)),
  -- What the worker starts from (refs, identifiers), set by the creator, never by the worker.
  inputs jsonb not null default '{}'::jsonb check (jsonb_typeof(inputs) = 'object' and length(inputs::text) <= 8000),
  required_capability text not null check (kernel.is_capability(required_capability)),
  risk text not null default 'low' check (risk in ('low', 'medium', 'high', 'critical')),
  reversible boolean not null default true,
  budget_amount numeric(38, 0) check (budget_amount > 0),
  budget_asset text references kernel.assets (code),
  evidence_bases text[] not null default '{}' check (
    evidence_bases <@ array['self_reported', 'witnessed', 'artifact', 'system_observed', 'externally_verified']::text[]
  ),
  verification text not null default 'none' check (verification in ('none', 'distinct_actor', 'distinct_party')),
  created_by uuid not null references kernel.actors (id),
  event_id uuid not null unique references kernel.events (id),
  created_at timestamptz not null default now(),
  check ((budget_amount is null) = (budget_asset is null))
);

create index tasks_scope on kernel.tasks (scope);

-- Whether a ref names something that exists.
create function kernel.ref_exists(r text) returns boolean
language plpgsql stable set search_path = '' as $$
declare
  v_type text := split_part(r, ':', 1);
  v_id text := kernel.ref_id(r);
begin
  if not kernel.is_ref(r) then
    return false;
  end if;
  return case v_type
    when 'actor' then exists (select 1 from kernel.actors a where a.id = v_id::uuid)
    when 'entity' then exists (select 1 from kernel.entities e where e.id = v_id::uuid)
    when 'task' then exists (select 1 from kernel.tasks t where t.id = v_id::uuid)
    when 'event' then exists (select 1 from kernel.events e where e.id = v_id::uuid)
    when 'relation' then exists (select 1 from kernel.relations x where x.id = v_id::uuid)
    when 'action' then exists (select 1 from kernel.actions x where x.id = v_id::uuid)
    when 'payment' then exists (select 1 from kernel.payment_intents p where p.payment_id = v_id)
    when 'settlement' then exists (select 1 from kernel.settlements s where s.settlement_id = v_id)
    else false
  end;
end;
$$;

create function kernel.do_upsert_entity(
  c kernel.caller, p_authority uuid, p_entity_id uuid, p_kind text, p_scope text, p_title text, p_summary text,
  p_attributes jsonb, p_latitude numeric, p_longitude numeric, p_altitude_m numeric, p_location_truth text,
  p_visibility text, p_importance integer, p_idempotency_key text
) returns uuid
language plpgsql set search_path = '' as $$
declare
  v_request jsonb := jsonb_build_object(
    'entity_id', p_entity_id, 'kind', p_kind, 'scope', p_scope, 'title', p_title, 'summary', coalesce(p_summary, ''),
    'attributes', coalesce(p_attributes, '{}'::jsonb), 'latitude', p_latitude, 'longitude', p_longitude,
    'altitude_m', p_altitude_m, 'location_truth', p_location_truth, 'visibility', p_visibility,
    'importance', coalesce(p_importance, 50));
  v_replay jsonb;
  v_existing kernel.entities;
  v_id uuid := coalesce(p_entity_id, gen_random_uuid());
  v_version integer;
  v_event uuid;
begin
  v_replay := kernel.replay_request(c.actor_id, p_idempotency_key,
                                    case when p_entity_id is null then 'kernel.entity.created' else 'kernel.entity.updated' end,
                                    v_request);
  if v_replay is not null then
    return (v_replay ->> 'entity_id')::uuid;
  end if;
  if p_entity_id is not null then
    select * into v_existing from kernel.entities e where e.id = p_entity_id;
    if not found then
      raise exception using errcode = 'KA007', message = 'entity not found';
    end if;
    if v_existing.scope <> p_scope or v_existing.kind <> p_kind then
      raise exception using errcode = 'KA003', message = 'an entity keeps its kind and scope';
    end if;
  end if;
  select coalesce(max(v.version), 0) + 1 into v_version from kernel.entity_versions v where v.entity_id = v_id;

  v_event := kernel.append_event(
    c, case when p_entity_id is null then 'kernel.entity.created' else 'kernel.entity.updated' end, p_scope, p_authority,
    jsonb_build_object('request', v_request, 'entity_id', v_id, 'version', v_version),
    null, p_idempotency_key
  );
  if p_entity_id is null then
    insert into kernel.entities (id, kind, scope, event_id) values (v_id, p_kind, p_scope, v_event);
  end if;
  insert into kernel.entity_versions (entity_id, version, title, summary, attributes, latitude, longitude, altitude_m,
                                      location_truth, visibility, importance, event_id)
  values (v_id, v_version, p_title, coalesce(p_summary, ''), coalesce(p_attributes, '{}'::jsonb), p_latitude, p_longitude,
          p_altitude_m, p_location_truth, p_visibility, coalesce(p_importance, 50), v_event);
  return v_id;
end;
$$;

-- Creates an entity (p_entity_id null) or records its next version.
create function kernel_api.upsert_entity(
  p_kind text,
  p_scope text,
  p_title text,
  p_summary text default '',
  p_attributes jsonb default '{}'::jsonb,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_altitude_m numeric default null,
  p_location_truth text default null,
  p_visibility text default 'members',
  p_importance integer default 50,
  p_entity_id uuid default null,
  p_idempotency_key text default null,
  p_as_actor uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
begin
  perform kernel.require_scope(p_scope);
  perform kernel.lock_chain();
  return kernel.do_upsert_entity(c, kernel.require_allowed(c.actor_id, 'world.entity.write', p_scope), p_entity_id,
                                 p_kind, p_scope, p_title, p_summary, p_attributes, p_latitude, p_longitude,
                                 p_altitude_m, p_location_truth, p_visibility, p_importance, p_idempotency_key);
end;
$$;

create function kernel.do_relate(c kernel.caller, p_authority uuid, p_kind text, p_from_ref text, p_to_ref text,
                                 p_scope text, p_attributes jsonb, p_idempotency_key text) returns uuid
language plpgsql set search_path = '' as $$
declare
  v_request jsonb := jsonb_build_object('kind', p_kind, 'from_ref', p_from_ref, 'to_ref', p_to_ref, 'scope', p_scope,
                                        'attributes', coalesce(p_attributes, '{}'::jsonb));
  v_replay jsonb;
  v_id uuid := gen_random_uuid();
  v_event uuid;
begin
  v_replay := kernel.replay_request(c.actor_id, p_idempotency_key, 'kernel.relation.created', v_request);
  if v_replay is not null then
    return (v_replay ->> 'relation_id')::uuid;
  end if;
  if not kernel.ref_exists(p_from_ref) or not kernel.ref_exists(p_to_ref) then
    raise exception using errcode = 'KA007', message = 'a relation connects things that exist';
  end if;
  v_event := kernel.append_event(
    c, 'kernel.relation.created', p_scope, p_authority,
    jsonb_build_object('request', v_request, 'relation_id', v_id), null, p_idempotency_key
  );
  insert into kernel.relations (id, kind, from_ref, to_ref, scope, attributes, event_id)
  values (v_id, p_kind, p_from_ref, p_to_ref, p_scope, coalesce(p_attributes, '{}'::jsonb), v_event);
  return v_id;
end;
$$;

create function kernel_api.relate(
  p_kind text,
  p_from_ref text,
  p_to_ref text,
  p_scope text,
  p_attributes jsonb default '{}'::jsonb,
  p_idempotency_key text default null,
  p_as_actor uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
begin
  perform kernel.require_scope(p_scope);
  perform kernel.lock_chain();
  return kernel.do_relate(c, kernel.require_allowed(c.actor_id, 'world.relation.write', p_scope), p_kind, p_from_ref,
                          p_to_ref, p_scope, p_attributes, p_idempotency_key);
end;
$$;

create function kernel.do_end_relation(c kernel.caller, p_authority uuid, p_relation_id uuid, p_reason text) returns uuid
language plpgsql set search_path = '' as $$
declare
  v_relation kernel.relations;
  v_event uuid;
begin
  select * into v_relation from kernel.relations r where r.id = p_relation_id;
  if not found then
    raise exception using errcode = 'KA007', message = 'relation not found';
  end if;
  select e.event_id into v_event from kernel.relation_endings e where e.relation_id = p_relation_id;
  if v_event is not null then
    return v_event;
  end if;
  v_event := kernel.append_event(
    c, 'kernel.relation.ended', v_relation.scope, p_authority,
    jsonb_build_object('relation_id', p_relation_id, 'reason', coalesce(p_reason, ''))
  );
  insert into kernel.relation_endings (relation_id, reason, event_id) values (p_relation_id, coalesce(p_reason, ''), v_event);
  return v_event;
end;
$$;

create function kernel_api.end_relation(p_relation_id uuid, p_reason text default '', p_as_actor uuid default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  v_scope text;
begin
  select r.scope into v_scope from kernel.relations r where r.id = p_relation_id;
  if v_scope is null then
    raise exception using errcode = 'KA007', message = 'relation not found';
  end if;
  perform kernel.lock_chain();
  return kernel.do_end_relation(c, kernel.require_allowed(c.actor_id, 'world.relation.write', v_scope), p_relation_id, p_reason);
end;
$$;

-- Current entities in a scope and the scopes nested under it. Members-visibility needs kernel.read
-- on the scope; private entities also need world.private.read on theirs.
create function kernel_api.read_world(p_scope text, p_as_actor uuid default null)
returns table (
  entity_id uuid, kind text, scope text, version integer, title text, summary text, attributes jsonb,
  latitude numeric, longitude numeric, altitude_m numeric, location_truth text, visibility text, importance smallint,
  created_at timestamptz, updated_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
begin
  perform kernel.require_scope(p_scope);
  perform kernel.require_grant(c.actor_id, 'kernel.read', p_scope);
  return query
    select e.id, e.kind, e.scope, v.version, v.title, v.summary, v.attributes, v.latitude, v.longitude, v.altitude_m,
           v.location_truth, v.visibility, v.importance, e.created_at, v.created_at
    from kernel.entities e
    join lateral (
      select * from kernel.entity_versions ev where ev.entity_id = e.id order by ev.version desc limit 1
    ) v on true
    where (e.scope = p_scope or starts_with(e.scope, p_scope || '/'))
      and (v.visibility <> 'private' or kernel.find_grant(c.actor_id, 'world.private.read', e.scope) is not null)
    order by v.importance desc, e.created_at, e.id;
end;
$$;

-- Public entities across every scope, for the Earth view. Any registered principal.
create function kernel_api.public_world(p_as_actor uuid default null)
returns table (
  entity_id uuid, kind text, scope text, version integer, title text, summary text, attributes jsonb,
  latitude numeric, longitude numeric, location_truth text, importance smallint, updated_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
begin
  return query
    select e.id, e.kind, e.scope, v.version, v.title, v.summary, v.attributes, v.latitude, v.longitude,
           v.location_truth, v.importance, v.created_at
    from kernel.entities e
    join lateral (
      select * from kernel.entity_versions ev where ev.entity_id = e.id order by ev.version desc limit 1
    ) v on true
    where v.visibility = 'public'
    order by v.importance desc, e.created_at, e.id
    limit 2000;
end;
$$;

-- Relations in a scope and the scopes nested under it.
create function kernel_api.read_relations(p_scope text, p_include_ended boolean default false, p_as_actor uuid default null)
returns table (relation_id uuid, kind text, from_ref text, to_ref text, scope text, attributes jsonb, created_at timestamptz,
               ended_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
begin
  perform kernel.require_scope(p_scope);
  perform kernel.require_grant(c.actor_id, 'kernel.read', p_scope);
  return query
    select r.id, r.kind, r.from_ref, r.to_ref, r.scope, r.attributes, r.created_at, x.created_at
    from kernel.relations r
    left join kernel.relation_endings x on x.relation_id = r.id
    where (r.scope = p_scope or starts_with(r.scope, p_scope || '/'))
      and (p_include_ended or x.relation_id is null)
    order by r.created_at, r.id;
end;
$$;

------------------------------------------------------------------------------------------------
-- Operational tasks
------------------------------------------------------------------------------------------------

create table kernel.task_transitions (
  id bigint generated always as identity primary key,
  task_id uuid not null references kernel.tasks (id),
  status text not null check (status in (
    'created', 'ready', 'claimed', 'in_progress', 'blocked', 'waiting_external', 'verifying', 'escalated',
    'completed', 'failed', 'needs_reconciliation', 'cancelled'
  )),
  actor_id uuid not null references kernel.actors (id),
  worker_id uuid references kernel.actors (id),
  detail text not null default '' check (length(detail) <= 2000),
  result jsonb check (result is null or (jsonb_typeof(result) = 'object' and length(result::text) <= 16000)),
  event_id uuid not null unique references kernel.events (id),
  created_at timestamptz not null default now()
);

create index task_transitions_task on kernel.task_transitions (task_id, id);
create unique index task_completed_once on kernel.task_transitions (task_id) where status = 'completed';

create function kernel.task_transition_allowed(p_from text, p_to text) returns boolean
language sql immutable set search_path = '' as $$
  select (p_from, p_to) in (
    ('created', 'ready'), ('created', 'cancelled'),
    ('ready', 'claimed'), ('ready', 'blocked'), ('ready', 'cancelled'),
    ('claimed', 'in_progress'), ('claimed', 'ready'), ('claimed', 'blocked'), ('claimed', 'cancelled'),
    ('in_progress', 'blocked'), ('in_progress', 'waiting_external'), ('in_progress', 'verifying'),
    ('in_progress', 'completed'), ('in_progress', 'failed'), ('in_progress', 'escalated'),
    ('in_progress', 'needs_reconciliation'),
    ('blocked', 'ready'), ('blocked', 'in_progress'), ('blocked', 'cancelled'),
    ('waiting_external', 'in_progress'), ('waiting_external', 'verifying'), ('waiting_external', 'failed'),
    ('waiting_external', 'needs_reconciliation'),
    ('verifying', 'completed'), ('verifying', 'in_progress'), ('verifying', 'failed'),
    ('escalated', 'in_progress'), ('escalated', 'cancelled'), ('escalated', 'failed'),
    ('needs_reconciliation', 'completed'), ('needs_reconciliation', 'failed'), ('needs_reconciliation', 'in_progress')
  );
$$;

create function kernel.do_create_task(
  c kernel.caller, p_authority uuid, p_scope text, p_title text, p_objective text, p_cause_ref text,
  p_required_capability text, p_risk text, p_reversible boolean, p_budget_amount numeric, p_budget_asset text,
  p_evidence_bases text[], p_verification text, p_idempotency_key text, p_inputs jsonb default '{}'::jsonb
) returns uuid
language plpgsql set search_path = '' as $$
declare
  v_request jsonb := jsonb_build_object(
    'scope', p_scope, 'title', p_title, 'objective', coalesce(p_objective, ''), 'cause_ref', p_cause_ref,
    'inputs', coalesce(p_inputs, '{}'::jsonb),
    'required_capability', p_required_capability, 'risk', coalesce(p_risk, 'low'), 'reversible', coalesce(p_reversible, true),
    'budget_amount', p_budget_amount::text, 'budget_asset', p_budget_asset,
    'evidence_bases', to_jsonb(coalesce(p_evidence_bases, '{}'::text[])), 'verification', coalesce(p_verification, 'none'));
  v_replay jsonb;
  v_id uuid := gen_random_uuid();
  v_event uuid;
begin
  v_replay := kernel.replay_request(c.actor_id, p_idempotency_key, 'kernel.task.created', v_request);
  if v_replay is not null then
    return (v_replay ->> 'task_id')::uuid;
  end if;
  if not kernel.is_capability(p_required_capability) then
    raise exception using errcode = 'KA003', message = 'invalid required capability';
  end if;
  if p_cause_ref is not null and not kernel.ref_exists(p_cause_ref) then
    raise exception using errcode = 'KA007', message = 'the cause of a task must exist';
  end if;
  v_event := kernel.append_event(
    c, 'kernel.task.created', p_scope, p_authority,
    jsonb_build_object('request', v_request, 'task_id', v_id), null, p_idempotency_key
  );
  if jsonb_typeof(coalesce(p_inputs, '{}'::jsonb)) <> 'object' then
    raise exception using errcode = 'KA003', message = 'task inputs must be an object';
  end if;
  insert into kernel.tasks (id, scope, title, objective, cause_ref, inputs, required_capability, risk, reversible,
                            budget_amount, budget_asset, evidence_bases, verification, created_by, event_id)
  values (v_id, p_scope, p_title, coalesce(p_objective, ''), p_cause_ref, coalesce(p_inputs, '{}'::jsonb),
          p_required_capability, coalesce(p_risk, 'low'),
          coalesce(p_reversible, true), p_budget_amount, p_budget_asset, coalesce(p_evidence_bases, '{}'),
          coalesce(p_verification, 'none'), c.actor_id, v_event);
  insert into kernel.task_transitions (task_id, status, actor_id, event_id) values (v_id, 'created', c.actor_id, v_event);
  return v_id;
end;
$$;

create function kernel_api.create_task(
  p_scope text,
  p_title text,
  p_required_capability text,
  p_objective text default '',
  p_cause_ref text default null,
  p_risk text default 'low',
  p_reversible boolean default true,
  p_budget_amount text default null,
  p_budget_asset text default null,
  p_evidence_bases text[] default '{}',
  p_verification text default 'none',
  p_idempotency_key text default null,
  p_as_actor uuid default null,
  p_inputs jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
begin
  perform kernel.require_scope(p_scope);
  if p_budget_amount is not null and p_budget_amount !~ '^[1-9][0-9]{0,37}$' then
    raise exception using errcode = 'KA003', message = 'budget must be a positive integer in minor units';
  end if;
  perform kernel.lock_chain();
  return kernel.do_create_task(c, kernel.require_allowed(c.actor_id, 'task.create', p_scope), p_scope, p_title, p_objective,
                               p_cause_ref, p_required_capability, p_risk, p_reversible, p_budget_amount::numeric,
                               p_budget_asset, p_evidence_bases, p_verification, p_idempotency_key, p_inputs);
end;
$$;

create function kernel.task_status(p_task_id uuid) returns kernel.task_transitions
language sql stable set search_path = '' as $$
  select t.* from kernel.task_transitions t where t.task_id = p_task_id order by t.id desc limit 1;
$$;

-- The current worker: carried on every transition, cleared when the task is released.
create function kernel.task_worker(p_task_id uuid) returns uuid
language sql stable set search_path = '' as $$
  select t.worker_id from kernel.task_transitions t where t.task_id = p_task_id order by t.id desc limit 1;
$$;

-- Moves a task. Claiming needs a lease covering the task's capability; work states belong to the
-- worker (or a task.manage holder); verified completion needs a distinct verifier with task.verify
-- and the declared evidence across the worker's result and the verification.
create function kernel_api.transition_task(
  p_task_id uuid,
  p_status text,
  p_detail text default '',
  p_result jsonb default null,
  p_evidence jsonb default '[]'::jsonb,
  p_as_actor uuid default null
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  v_task kernel.tasks;
  v_last kernel.task_transitions;
  v_worker uuid;
  v_authority uuid;
  v_manage uuid;
  v_decision kernel.decision;
  v_event uuid;
  v_missing text[];
begin
  perform kernel.lock_chain();
  select * into v_task from kernel.tasks t where t.id = p_task_id;
  if not found then
    raise exception using errcode = 'KA007', message = 'task not found';
  end if;
  v_last := kernel.task_status(p_task_id);
  v_worker := kernel.task_worker(p_task_id);
  if not kernel.task_transition_allowed(v_last.status, p_status) then
    raise exception using errcode = 'KA003', message = format('a task cannot move from %s to %s', v_last.status, p_status);
  end if;
  v_manage := kernel.find_permitted_grant(c.actor_id, 'task.manage', v_task.scope, null, null, null, 'task:' || p_task_id);

  if p_status = 'claimed' then
    v_decision := kernel.decide(c.actor_id, v_task.required_capability, v_task.scope, v_task.budget_amount,
                                v_task.budget_asset, null, 'task:' || p_task_id);
    if v_decision.decision = 'DENY' then
      raise exception using errcode = 'KA002', message = 'cannot claim: ' || array_to_string(v_decision.reasons, '; ');
    end if;
    v_authority := v_decision.grant_id;
    v_worker := c.actor_id;
  elsif p_status in ('ready', 'cancelled') and v_last.status in ('created', 'ready', 'blocked', 'escalated') and v_worker is null then
    if c.actor_id <> v_task.created_by and v_manage is null then
      raise exception using errcode = 'KA002', message = 'only the task creator or a task.manage holder can do that';
    end if;
    v_authority := coalesce(v_manage, kernel.find_permitted_grant(c.actor_id, 'task.create', v_task.scope, null, null, null,
                                                                  'task:' || p_task_id));
  elsif p_status = 'completed' and v_task.verification <> 'none' then
    if v_last.status <> 'verifying' then
      raise exception using errcode = 'KA003', message = 'this task needs verification before it completes';
    end if;
    v_authority := kernel.find_permitted_grant(c.actor_id, 'task.verify', v_task.scope, null, null, null, 'task:' || p_task_id);
    if v_authority is null then
      raise exception using errcode = 'KA002', message = 'verification needs task.verify on the task scope';
    end if;
    if c.actor_id = v_worker or (v_task.verification = 'distinct_party' and kernel.party_of(c.actor_id) = kernel.party_of(v_worker)) then
      raise exception using errcode = 'KA002', message = 'a worker cannot verify its own work';
    end if;
  else
    if c.actor_id is distinct from v_worker and v_manage is null then
      raise exception using errcode = 'KA002', message = 'only the worker or a task.manage holder can move this task';
    end if;
    v_authority := coalesce(v_manage, (kernel.decide(c.actor_id, v_task.required_capability, v_task.scope, v_task.budget_amount,
                                                     v_task.budget_asset, null, 'task:' || p_task_id)).grant_id);
    if v_authority is null then
      raise exception using errcode = 'KA002', message = 'the worker no longer holds authority for this task';
    end if;
    if p_status = 'ready' then
      v_worker := null;
    end if;
  end if;

  v_event := kernel.append_event(
    c, 'kernel.task.' || p_status, v_task.scope, v_authority,
    jsonb_build_object('task_id', p_task_id, 'from', v_last.status, 'status', p_status, 'worker_id', v_worker,
                       'detail', coalesce(p_detail, ''), 'result', p_result)
  );
  insert into kernel.task_transitions (task_id, status, actor_id, worker_id, detail, result, event_id)
  values (p_task_id, p_status, c.actor_id, v_worker, coalesce(p_detail, ''), p_result, v_event);
  perform kernel.attach(c, v_event, coalesce(p_evidence, '[]'::jsonb), v_authority);

  if p_status = 'completed' and cardinality(v_task.evidence_bases) > 0 then
    select array_agg(b) into v_missing from unnest(v_task.evidence_bases) b
    where not exists (
      select 1 from kernel.evidence ev
      join kernel.task_transitions t on t.event_id = ev.event_id
      where t.task_id = p_task_id and ev.basis = b
    );
    if v_missing is not null then
      raise exception using errcode = 'KA003', message = format('completion needs %s evidence', array_to_string(v_missing, ', '));
    end if;
  end if;
  return p_status;
end;
$$;

create function kernel_api.read_tasks(p_scope text, p_as_actor uuid default null)
returns table (
  task_id uuid, scope text, title text, objective text, cause_ref text, inputs jsonb, required_capability text, risk text,
  reversible boolean, budget_amount text, budget_asset text, evidence_bases text[], verification text,
  created_by uuid, status text, worker_id uuid, detail text, result jsonb, created_at timestamptz, updated_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
begin
  perform kernel.require_scope(p_scope);
  perform kernel.require_grant(c.actor_id, 'kernel.read', p_scope);
  return query
    select t.id, t.scope, t.title, t.objective, t.cause_ref, t.inputs, t.required_capability, t.risk, t.reversible,
           t.budget_amount::text, t.budget_asset, t.evidence_bases, t.verification, t.created_by,
           s.status, kernel.task_worker(t.id), s.detail, s.result, t.created_at, s.created_at
    from kernel.tasks t
    cross join lateral kernel.task_status(t.id) s
    where t.scope = p_scope or starts_with(t.scope, p_scope || '/')
    order by t.created_at, t.id;
end;
$$;

------------------------------------------------------------------------------------------------
-- Actions
------------------------------------------------------------------------------------------------

create table kernel.actions (
  id uuid primary key,
  action_key text unique check (action_key ~ '^[0-9a-f]{64}$'),
  kind text not null check (kind ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  capability text not null check (kernel.is_capability(capability)),
  scope text not null check (kernel.is_scope(scope)),
  proposer_id uuid not null references kernel.actors (id),
  on_behalf_of uuid references kernel.actors (id),
  target_ref text check (target_ref is null or kernel.is_ref(target_ref)),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object' and length(payload::text) <= 16000),
  amount numeric(38, 0) check (amount > 0),
  asset text references kernel.assets (code),
  counterparty_ref text check (counterparty_ref is null or kernel.is_ref(counterparty_ref)),
  task_ref text check (task_ref is null or task_ref ~ '^task:'),
  in_reply_to uuid references kernel.actions (id),
  reply_depth integer not null default 0 check (reply_depth between 0 and 20),
  grant_id uuid references kernel.grants (id),
  policy_id uuid references kernel.action_policies (id),
  decision text not null check (decision in (
    'ALLOW', 'REQUIRE_SECOND_AUTHORITY', 'REQUIRE_QUORUM', 'REQUIRE_MULTISIG', 'REQUIRE_DELAY',
    'REQUIRE_CHALLENGE_WINDOW', 'DENY'
  )),
  threshold integer,
  delay_seconds integer,
  reasons text[] not null default '{}',
  event_id uuid not null unique references kernel.events (id),
  created_at timestamptz not null default now(),
  check ((amount is null) = (asset is null))
);

create index actions_scope on kernel.actions (scope, created_at);
create index actions_target on kernel.actions (target_ref);

create table kernel.action_approvals (
  id bigint generated always as identity primary key,
  action_id uuid not null references kernel.actions (id),
  approver_id uuid not null references kernel.actors (id),
  party_id uuid not null references kernel.actors (id),
  grant_id uuid references kernel.grants (id),
  event_id uuid not null unique references kernel.events (id),
  created_at timestamptz not null default now(),
  unique (action_id, approver_id)
);

create table kernel.action_transitions (
  id bigint generated always as identity primary key,
  action_id uuid not null references kernel.actions (id),
  status text not null check (status in (
    'proposed', 'authorized', 'enacting', 'completed', 'failed', 'needs_reconciliation', 'rejected', 'cancelled'
  )),
  actor_id uuid not null references kernel.actors (id),
  detail text not null default '' check (length(detail) <= 2000),
  result jsonb check (result is null or (jsonb_typeof(result) = 'object' and length(result::text) <= 16000)),
  enact_after timestamptz,
  event_id uuid not null unique references kernel.events (id),
  created_at timestamptz not null default now()
);

create index action_transitions_action on kernel.action_transitions (action_id, id);
create unique index action_completed_once on kernel.action_transitions (action_id) where status = 'completed';

create function kernel.action_state(p_action_id uuid) returns kernel.action_transitions
language sql stable set search_path = '' as $$
  select t.* from kernel.action_transitions t where t.action_id = p_action_id order by t.id desc limit 1;
$$;

create function kernel.action_enact_after(p_action_id uuid) returns timestamptz
language sql stable set search_path = '' as $$
  select t.enact_after from kernel.action_transitions t
  where t.action_id = p_action_id and t.status = 'authorized' order by t.id desc limit 1;
$$;

-- Kinds the kernel enacts itself, atomically, and the capability each one requires. event.record
-- requires the recorded event type itself; messages that commit (proposal, counterproposal,
-- acceptance) require commitment.make, so contacting someone never implies committing.
create function kernel.native_capability(p_kind text, p_payload jsonb) returns text
language sql immutable set search_path = '' as $$
  select case p_kind
    when 'entity.upsert' then 'world.entity.write'
    when 'relation.create' then 'world.relation.write'
    when 'relation.end' then 'world.relation.write'
    when 'task.create' then 'task.create'
    when 'policy.set' then 'kernel.policy.set'
    when 'agent.spawn' then 'kernel.actor.create'
    when 'grant.issue' then 'kernel.grant.issue'
    when 'message.send' then case when p_payload ->> 'type' in ('PROPOSAL', 'COUNTERPROPOSAL', 'ACCEPTANCE')
                                  then 'commitment.make' else 'message.send' end
    when 'ledger.post' then 'kernel.ledger.post'
    when 'event.record' then p_payload ->> 'type'
  end;
$$;

create function kernel.native_action_kind(p_kind text) returns boolean
language sql immutable set search_path = '' as $$
  select kernel.native_capability(p_kind, '{}'::jsonb) is not null or p_kind = 'event.record';
$$;

create function kernel.message_type_valid(p_type text) returns boolean
language sql immutable set search_path = '' as $$
  select p_type in ('DISCOVERY_REQUEST', 'CAPABILITY_QUERY', 'PROOF_REQUEST', 'PROOF_RESPONSE', 'PROPOSAL',
                    'COUNTERPROPOSAL', 'INFORMATION_REQUEST', 'INFORMATION_RESPONSE', 'DECLINE',
                    'HUMAN_ATTENTION_REQUIRED', 'ACCEPTANCE');
$$;

create function kernel.record_action_transition(c kernel.caller, p_authority uuid, p_action kernel.actions, p_status text,
                                                p_detail text, p_result jsonb, p_enact_after timestamptz,
                                                p_evidence jsonb default '[]'::jsonb) returns uuid
language plpgsql set search_path = '' as $$
declare
  v_event uuid;
begin
  v_event := kernel.append_event(
    c, 'kernel.action.' || p_status, p_action.scope, p_authority,
    jsonb_build_object('action_id', p_action.id, 'kind', p_action.kind, 'status', p_status,
                       'detail', coalesce(p_detail, ''), 'result', p_result, 'enact_after', p_enact_after)
  );
  insert into kernel.action_transitions (action_id, status, actor_id, detail, result, enact_after, event_id)
  values (p_action.id, p_status, c.actor_id, coalesce(p_detail, ''), p_result, p_enact_after, v_event);
  perform kernel.attach(c, v_event, coalesce(p_evidence, '[]'::jsonb), p_authority);
  return v_event;
end;
$$;

-- Whether an actor may approve (or, for challenge windows, challenge) an action.
create function kernel.approval_grant(p_action kernel.actions, p_actor uuid) returns uuid
language plpgsql stable set search_path = '' as $$
declare
  p kernel.action_policies;
begin
  select * into p from kernel.action_policies x where x.id = p_action.policy_id;
  if p_action.decision = 'REQUIRE_MULTISIG' then
    if not (p_actor = any (p.signers)) then
      return null;
    end if;
    return coalesce(kernel.find_grant(p_actor, p_action.capability, p_action.scope),
                    kernel.find_grant(p_actor, 'kernel.read', p_action.scope),
                    p_action.grant_id);
  end if;
  return kernel.find_permitted_grant(p_actor, coalesce(p.approver_capability, p_action.capability), p_action.scope,
                                     p_action.amount, p_action.asset, p_action.counterparty_ref, p_action.task_ref);
end;
$$;

create function kernel.authorize_if_ready(c kernel.caller, p_action kernel.actions) returns text
language plpgsql set search_path = '' as $$
declare
  p kernel.action_policies;
  v_count integer;
begin
  select * into p from kernel.action_policies x where x.id = p_action.policy_id;
  if p.distinct_by = 'actor' then
    select count(distinct a.approver_id) into v_count from kernel.action_approvals a where a.action_id = p_action.id;
  else
    select count(distinct a.party_id) into v_count from kernel.action_approvals a where a.action_id = p_action.id;
  end if;
  if v_count >= p_action.threshold then
    perform kernel.record_action_transition(c, p_action.grant_id, p_action, 'authorized',
                                            format('%s of %s approvals', v_count, p_action.threshold), null,
                                            now() + make_interval(secs => coalesce(p_action.delay_seconds, 0)));
    return 'authorized';
  end if;
  return 'proposed';
end;
$$;

-- Proposes an action. The decision is made now from the proposer's grants, leases and policy:
-- DENY is recorded as rejected (an auditable attempt), ALLOW authorizes immediately, delays and
-- challenge windows authorize with an earliest enactment time, approvals wait for distinct holders.
create function kernel_api.propose_action(
  p_kind text,
  p_capability text,
  p_scope text,
  p_payload jsonb default '{}'::jsonb,
  p_target_ref text default null,
  p_amount text default null,
  p_asset text default null,
  p_counterparty_ref text default null,
  p_task_ref text default null,
  p_in_reply_to uuid default null,
  p_idempotency_key text default null,
  p_as_actor uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  v_key text;
  v_existing kernel.actions;
  v_parent kernel.actions;
  v_depth integer := 0;
  d kernel.decision;
  v_id uuid := gen_random_uuid();
  v_action kernel.actions;
  v_event uuid;
  v_approval uuid;
begin
  if p_kind is null or p_kind !~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$' then
    raise exception using errcode = 'KA003', message = 'invalid action kind';
  end if;
  if not kernel.is_capability(p_capability) then
    raise exception using errcode = 'KA003', message = 'invalid capability';
  end if;
  perform kernel.require_scope(p_scope);
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or length(p_payload::text) > 16000 then
    raise exception using errcode = 'KA003', message = 'payload must be a JSON object of at most 16000 characters';
  end if;
  if p_amount is not null and p_amount !~ '^[1-9][0-9]{0,37}$' then
    raise exception using errcode = 'KA003', message = 'amount must be a positive integer in minor units';
  end if;
  if (p_amount is null) <> (p_asset is null) then
    raise exception using errcode = 'KA003', message = 'an amount needs an asset';
  end if;
  if p_target_ref is not null and not kernel.ref_exists(p_target_ref) then
    raise exception using errcode = 'KA007', message = 'the target does not exist';
  end if;
  if kernel.native_action_kind(p_kind) and p_capability is distinct from kernel.native_capability(p_kind, p_payload) then
    raise exception using errcode = 'KA003',
      message = format('%s actions require the %s capability', p_kind, coalesce(kernel.native_capability(p_kind, p_payload), 'event type'));
  end if;
  if p_kind = 'event.record' and (not kernel.is_event_type(p_payload ->> 'type') or p_payload ->> 'type' like 'kernel.%') then
    raise exception using errcode = 'KA003', message = 'event.record needs a non-kernel event type';
  end if;
  if p_kind = 'message.send' then
    if not kernel.message_type_valid(p_payload ->> 'type') then
      raise exception using errcode = 'KA003', message = 'unknown message type';
    end if;
    if p_target_ref is null or p_target_ref !~ '^actor:' then
      raise exception using errcode = 'KA003', message = 'a message is addressed to an actor';
    end if;
  end if;

  perform kernel.lock_chain();
  if p_idempotency_key is not null then
    v_key := encode(sha256(convert_to('solve:action:v1|' || c.actor_id || '|' || p_idempotency_key, 'UTF8')), 'hex');
    select * into v_existing from kernel.actions a where a.action_key = v_key;
    if found then
      if v_existing.kind = p_kind and v_existing.capability = p_capability and v_existing.scope = p_scope
         and v_existing.payload = p_payload and v_existing.target_ref is not distinct from p_target_ref
         and v_existing.amount is not distinct from p_amount::numeric and v_existing.asset is not distinct from p_asset
         and v_existing.counterparty_ref is not distinct from p_counterparty_ref
         and v_existing.task_ref is not distinct from p_task_ref
         and v_existing.in_reply_to is not distinct from p_in_reply_to then
        return v_existing.id;
      end if;
      raise exception using errcode = 'KA004', message = 'idempotency key already used for a different action';
    end if;
  end if;
  if p_in_reply_to is not null then
    select * into v_parent from kernel.actions a where a.id = p_in_reply_to;
    if not found then
      raise exception using errcode = 'KA007', message = 'the action replied to does not exist';
    end if;
    v_depth := v_parent.reply_depth + 1;
    if v_depth > 20 then
      raise exception using errcode = 'KA003', message = 'reply chain too long: agent loop stopped';
    end if;
  end if;

  d := kernel.decide(c.actor_id, p_capability, p_scope, p_amount::numeric, p_asset, p_counterparty_ref, p_task_ref);
  v_event := kernel.append_event(
    c, 'kernel.action.proposed', p_scope, d.grant_id,
    jsonb_build_object('action_id', v_id, 'kind', p_kind, 'capability', p_capability, 'payload', p_payload,
                       'target_ref', p_target_ref, 'amount', p_amount, 'asset', p_asset,
                       'counterparty_ref', p_counterparty_ref, 'task_ref', p_task_ref, 'in_reply_to', p_in_reply_to,
                       'decision', d.decision, 'reasons', to_jsonb(d.reasons), 'policy_id', d.policy_id),
    null, p_idempotency_key
  );
  insert into kernel.actions (id, action_key, kind, capability, scope, proposer_id, on_behalf_of, target_ref, payload, amount,
                              asset, counterparty_ref, task_ref, in_reply_to, reply_depth, grant_id, policy_id, decision,
                              threshold, delay_seconds, reasons, event_id)
  values (v_id, v_key, p_kind, p_capability, p_scope, c.actor_id, c.principal_id, p_target_ref, p_payload, p_amount::numeric,
          p_asset, p_counterparty_ref, p_task_ref, p_in_reply_to, v_depth, d.grant_id, d.policy_id, d.decision, d.threshold,
          d.delay_seconds, d.reasons, v_event)
  returning * into v_action;

  if d.decision = 'DENY' then
    perform kernel.record_action_transition(c, null, v_action, 'rejected', array_to_string(d.reasons, '; '), null, null);
  elsif d.decision = 'ALLOW' then
    perform kernel.record_action_transition(c, d.grant_id, v_action, 'authorized', '', null, now());
  elsif d.decision in ('REQUIRE_DELAY', 'REQUIRE_CHALLENGE_WINDOW') then
    perform kernel.record_action_transition(c, d.grant_id, v_action, 'authorized', d.decision, null,
                                            now() + make_interval(secs => d.delay_seconds));
  else
    perform kernel.record_action_transition(c, d.grant_id, v_action, 'proposed', d.decision, null, null);
    -- The proposer exercising its own grant is the first authority for a second-authority rule;
    -- for quorum and multisig it counts only when it is itself an eligible approver.
    v_approval := case when d.decision = 'REQUIRE_SECOND_AUTHORITY' then d.grant_id
                       else kernel.approval_grant(v_action, c.actor_id) end;
    if v_approval is not null then
      v_event := kernel.append_event(c, 'kernel.action.approved', p_scope, v_approval,
                                     jsonb_build_object('action_id', v_id, 'approver_id', c.actor_id));
      insert into kernel.action_approvals (action_id, approver_id, party_id, grant_id, event_id)
      values (v_id, c.actor_id, kernel.party_of(c.actor_id), v_approval, v_event);
      perform kernel.authorize_if_ready(c, v_action);
    end if;
  end if;
  return v_id;
end;
$$;

-- Approves an action awaiting a second authority, quorum or multisig. Approvers must hold the
-- approver capability (or be named signers) and be distinct from earlier approvers.
create function kernel_api.approve_action(p_action_id uuid, p_as_actor uuid default null) returns text
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  v_action kernel.actions;
  v_policy kernel.action_policies;
  v_state kernel.action_transitions;
  v_grant uuid;
  v_party uuid := kernel.party_of(c.actor_id);
  v_event uuid;
begin
  perform kernel.lock_chain();
  select * into v_action from kernel.actions a where a.id = p_action_id;
  if not found then
    raise exception using errcode = 'KA007', message = 'action not found';
  end if;
  v_state := kernel.action_state(p_action_id);
  if exists (select 1 from kernel.action_approvals a where a.action_id = p_action_id and a.approver_id = c.actor_id) then
    return v_state.status;
  end if;
  if v_state.status <> 'proposed' then
    raise exception using errcode = 'KA003', message = format('the action is %s, not awaiting approval', v_state.status);
  end if;
  v_grant := kernel.approval_grant(v_action, c.actor_id);
  if v_grant is null then
    raise exception using errcode = 'KA002', message = 'no authority to approve this action';
  end if;
  select * into v_policy from kernel.action_policies p where p.id = v_action.policy_id;
  if v_policy.distinct_by = 'party'
     and exists (select 1 from kernel.action_approvals a where a.action_id = p_action_id and a.party_id = v_party) then
    raise exception using errcode = 'KA002', message = 'that party has already approved; approval must come from a distinct party';
  end if;
  v_event := kernel.append_event(c, 'kernel.action.approved', v_action.scope, v_grant,
                                 jsonb_build_object('action_id', p_action_id, 'approver_id', c.actor_id));
  insert into kernel.action_approvals (action_id, approver_id, party_id, grant_id, event_id)
  values (p_action_id, c.actor_id, v_party, v_grant, v_event);
  return kernel.authorize_if_ready(c, v_action);
end;
$$;

-- Stops an action during its challenge window.
create function kernel_api.challenge_action(p_action_id uuid, p_reason text, p_as_actor uuid default null) returns text
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  v_action kernel.actions;
  v_state kernel.action_transitions;
  v_grant uuid;
begin
  perform kernel.lock_chain();
  select * into v_action from kernel.actions a where a.id = p_action_id;
  if not found then
    raise exception using errcode = 'KA007', message = 'action not found';
  end if;
  v_state := kernel.action_state(p_action_id);
  if v_action.decision <> 'REQUIRE_CHALLENGE_WINDOW' or v_state.status <> 'authorized' or now() >= v_state.enact_after then
    raise exception using errcode = 'KA003', message = 'the action is not in an open challenge window';
  end if;
  v_grant := kernel.approval_grant(v_action, c.actor_id);
  if v_grant is null then
    raise exception using errcode = 'KA002', message = 'no authority to challenge this action';
  end if;
  if kernel.party_of(c.actor_id) = kernel.party_of(v_action.proposer_id) then
    raise exception using errcode = 'KA002', message = 'a party cannot challenge its own action';
  end if;
  perform kernel.record_action_transition(c, v_grant, v_action, 'rejected', 'challenged: ' || coalesce(p_reason, ''), null, null);
  return 'rejected';
end;
$$;

create function kernel_api.cancel_action(p_action_id uuid, p_reason text default '', p_as_actor uuid default null) returns text
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  v_action kernel.actions;
  v_state kernel.action_transitions;
begin
  perform kernel.lock_chain();
  select * into v_action from kernel.actions a where a.id = p_action_id;
  if not found then
    raise exception using errcode = 'KA007', message = 'action not found';
  end if;
  if c.actor_id <> v_action.proposer_id and kernel.party_of(c.actor_id) <> kernel.party_of(v_action.proposer_id) then
    raise exception using errcode = 'KA002', message = 'only the proposer or its party can cancel an action';
  end if;
  v_state := kernel.action_state(p_action_id);
  if v_state.status not in ('proposed', 'authorized') then
    raise exception using errcode = 'KA003', message = format('the action is %s and cannot be cancelled', v_state.status);
  end if;
  perform kernel.record_action_transition(c, null, v_action, 'cancelled', coalesce(p_reason, ''), null, null);
  return 'cancelled';
end;
$$;

-- Checks that an action may be enacted now by this actor; returns the enactor's grant.
create function kernel.enactment_grant(c kernel.caller, p_action kernel.actions) returns uuid
language plpgsql stable set search_path = '' as $$
declare
  v_state kernel.action_transitions := kernel.action_state(p_action.id);
  d kernel.decision;
begin
  if v_state.status <> 'authorized' then
    raise exception using errcode = 'KA003', message = format('the action is %s, not authorized', v_state.status);
  end if;
  if now() < v_state.enact_after then
    raise exception using errcode = 'KA003', message = format('the action cannot be enacted before %s', v_state.enact_after);
  end if;
  if c.actor_id <> p_action.proposer_id then
    raise exception using errcode = 'KA002', message = 'only the proposer enacts its action';
  end if;
  -- Authority is re-checked at enactment: a revoked or expired grant stops the action here.
  d := kernel.decide(c.actor_id, p_action.capability, p_action.scope, p_action.amount, p_action.asset,
                     p_action.counterparty_ref, p_action.task_ref);
  if d.decision = 'DENY' then
    raise exception using errcode = 'KA002', message = 'authority lapsed before enactment: ' || array_to_string(d.reasons, '; ');
  end if;
  return d.grant_id;
end;
$$;

-- Enacts a kernel-native action atomically and completes it.
create function kernel_api.enact_action(p_action_id uuid, p_as_actor uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  v_action kernel.actions;
  v_state kernel.action_transitions;
  v_grant uuid;
  p jsonb;
  v_result jsonb;
  v_id uuid;
begin
  perform kernel.lock_chain();
  select * into v_action from kernel.actions a where a.id = p_action_id;
  if not found then
    raise exception using errcode = 'KA007', message = 'action not found';
  end if;
  v_state := kernel.action_state(p_action_id);
  if v_state.status = 'completed' then
    return v_state.result;
  end if;
  if not kernel.native_action_kind(v_action.kind) then
    raise exception using errcode = 'KA003', message = 'external actions are enacted with begin_action and complete_action';
  end if;
  v_grant := kernel.enactment_grant(c, v_action);
  p := v_action.payload;

  if v_action.kind = 'entity.upsert' then
    v_id := kernel.do_upsert_entity(c, v_grant, (p ->> 'entity_id')::uuid, p ->> 'kind', v_action.scope, p ->> 'title',
                                    p ->> 'summary', coalesce(p -> 'attributes', '{}'::jsonb), (p ->> 'latitude')::numeric,
                                    (p ->> 'longitude')::numeric, (p ->> 'altitude_m')::numeric, p ->> 'location_truth',
                                    coalesce(p ->> 'visibility', 'members'), coalesce((p ->> 'importance')::integer, 50), null);
    v_result := jsonb_build_object('entity_id', v_id);
  elsif v_action.kind = 'relation.create' then
    v_id := kernel.do_relate(c, v_grant, p ->> 'kind', p ->> 'from_ref', p ->> 'to_ref', v_action.scope,
                             coalesce(p -> 'attributes', '{}'::jsonb), null);
    v_result := jsonb_build_object('relation_id', v_id);
  elsif v_action.kind = 'relation.end' then
    perform kernel.do_end_relation(c, v_grant, (p ->> 'relation_id')::uuid, p ->> 'reason');
    v_result := jsonb_build_object('relation_id', p ->> 'relation_id');
  elsif v_action.kind = 'task.create' then
    v_id := kernel.do_create_task(c, v_grant, v_action.scope, p ->> 'title', p ->> 'objective', p ->> 'cause_ref',
                                  p ->> 'required_capability', p ->> 'risk', (p ->> 'reversible')::boolean,
                                  (p ->> 'budget_amount')::numeric, p ->> 'budget_asset',
                                  array(select jsonb_array_elements_text(coalesce(p -> 'evidence_bases', '[]'::jsonb))),
                                  p ->> 'verification', null, coalesce(p -> 'inputs', '{}'::jsonb));
    v_result := jsonb_build_object('task_id', v_id);
  elsif v_action.kind = 'policy.set' then
    v_result := jsonb_build_object('version', kernel.do_set_policy(
      c, v_grant, v_action.scope, p ->> 'capability', p ->> 'requirement', p ->> 'approver_capability',
      (p ->> 'threshold')::integer,
      case when p ? 'signers' then array(select (jsonb_array_elements_text(p -> 'signers'))::uuid) end,
      (p ->> 'delay_seconds')::integer, coalesce(p ->> 'distinct_by', 'party')));
  elsif v_action.kind = 'agent.spawn' then
    v_id := kernel.do_spawn_agent(c, p ->> 'label', p ->> 'role', v_action.scope, null);
    v_result := jsonb_build_object('actor_id', v_id);
  elsif v_action.kind = 'grant.issue' then
    -- Governance can approve a grant but the grant still comes from the proposer's own authority.
    v_id := kernel.delegate(c, (p ->> 'grantee_id')::uuid, p ->> 'capability', v_action.scope,
                            (p ->> 'expires_at')::timestamptz, 'action:' || v_action.id);
    v_result := jsonb_build_object('grant_id', v_id);
  elsif v_action.kind = 'message.send' then
    v_result := jsonb_build_object('delivered_to', v_action.target_ref, 'type', p ->> 'type');
  elsif v_action.kind = 'event.record' then
    v_id := kernel.append_event(c, p ->> 'type', v_action.scope, v_grant, coalesce(p -> 'payload', '{}'::jsonb));
    perform kernel.attach(c, v_id, coalesce(p -> 'evidence', '[]'::jsonb), v_grant);
    v_result := jsonb_build_object('event_id', v_id);
  elsif v_action.kind = 'ledger.post' then
    v_id := kernel.post_entries(c, v_action.scope, v_grant, kernel.validated_entries(v_action.scope, p -> 'entries'),
                                p ->> 'memo', null, v_action.id);
    v_result := jsonb_build_object('posting_event_id', v_id);
  end if;

  perform kernel.record_action_transition(c, v_grant, v_action, 'completed', 'enacted by the kernel', v_result, null);
  return v_result;
end;
$$;

-- Records that an external action is being enacted (before the outside call).
create function kernel_api.begin_action(p_action_id uuid, p_detail text default '', p_as_actor uuid default null) returns text
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  v_action kernel.actions;
begin
  perform kernel.lock_chain();
  select * into v_action from kernel.actions a where a.id = p_action_id;
  if not found then
    raise exception using errcode = 'KA007', message = 'action not found';
  end if;
  if kernel.native_action_kind(v_action.kind) then
    raise exception using errcode = 'KA003', message = 'kernel-native actions are enacted with enact_action';
  end if;
  if (kernel.action_state(p_action_id)).status = 'enacting' then
    return 'enacting';
  end if;
  perform kernel.record_action_transition(c, kernel.enactment_grant(c, v_action), v_action, 'enacting',
                                          coalesce(p_detail, ''), null, null);
  return 'enacting';
end;
$$;

-- Records the outcome of an external action: completed (with evidence), failed, or
-- needs_reconciliation when the outcome is unknown.
create function kernel_api.settle_action(
  p_action_id uuid,
  p_status text,
  p_result jsonb default null,
  p_detail text default '',
  p_evidence jsonb default '[]'::jsonb,
  p_as_actor uuid default null
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  v_action kernel.actions;
  v_state kernel.action_transitions;
  v_grant uuid;
begin
  perform kernel.lock_chain();
  select * into v_action from kernel.actions a where a.id = p_action_id;
  if not found then
    raise exception using errcode = 'KA007', message = 'action not found';
  end if;
  if p_status is null or p_status not in ('completed', 'failed', 'needs_reconciliation') then
    raise exception using errcode = 'KA003', message = 'unknown outcome';
  end if;
  v_state := kernel.action_state(p_action_id);
  if v_state.status = p_status then
    return p_status;
  end if;
  if v_state.status not in ('enacting', 'needs_reconciliation') then
    raise exception using errcode = 'KA003', message = format('the action is %s, not being enacted', v_state.status);
  end if;
  if c.actor_id <> v_action.proposer_id then
    raise exception using errcode = 'KA002', message = 'only the enactor records the outcome';
  end if;
  if p_status = 'completed' and jsonb_array_length(coalesce(p_evidence, '[]'::jsonb)) = 0 then
    raise exception using errcode = 'KA003', message = 'completing an external action requires evidence';
  end if;
  v_grant := coalesce((kernel.decide(c.actor_id, v_action.capability, v_action.scope, v_action.amount, v_action.asset,
                                     v_action.counterparty_ref, v_action.task_ref)).grant_id, v_action.grant_id);
  perform kernel.record_action_transition(c, v_grant, v_action, p_status, p_detail, p_result, null, p_evidence);
  return p_status;
end;
$$;

-- One action with its state, for its proposer's party, its target, its approvers and readers of
-- its scope.
create function kernel_api.read_action(p_action_id uuid, p_as_actor uuid default null)
returns table (
  action_id uuid, kind text, capability text, scope text, proposer_id uuid, on_behalf_of uuid, target_ref text,
  payload jsonb, amount text, asset text, counterparty_ref text, task_ref text, decision text, reasons text[],
  threshold integer, approvals integer, status text, detail text, result jsonb, enact_after timestamptz, in_reply_to uuid,
  created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  v_action kernel.actions;
  v_state kernel.action_transitions;
begin
  select * into v_action from kernel.actions a where a.id = p_action_id;
  if not found then
    raise exception using errcode = 'KA007', message = 'action not found';
  end if;
  if kernel.party_of(c.actor_id) <> kernel.party_of(v_action.proposer_id)
     and v_action.target_ref is distinct from 'actor:' || c.actor_id
     and not exists (select 1 from kernel.action_approvals a where a.action_id = p_action_id and a.approver_id = c.actor_id) then
    perform kernel.require_grant(c.actor_id, 'kernel.read', v_action.scope);
  end if;
  v_state := kernel.action_state(p_action_id);
  return query select v_action.id, v_action.kind, v_action.capability, v_action.scope, v_action.proposer_id,
    v_action.on_behalf_of, v_action.target_ref, v_action.payload, v_action.amount::text, v_action.asset,
    v_action.counterparty_ref, v_action.task_ref, v_action.decision,
    v_action.reasons, v_action.threshold,
    (select count(*)::integer from kernel.action_approvals a where a.action_id = p_action_id),
    v_state.status, v_state.detail, v_state.result, kernel.action_enact_after(p_action_id), v_action.in_reply_to,
    v_action.created_at;
end;
$$;

-- Actions in a scope (and nested scopes), newest first.
create function kernel_api.read_actions(p_scope text, p_limit integer default 100, p_as_actor uuid default null)
returns table (
  action_id uuid, kind text, proposer_id uuid, on_behalf_of uuid, target_ref text, task_ref text, payload jsonb,
  decision text, status text, created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
begin
  perform kernel.require_scope(p_scope);
  perform kernel.require_grant(c.actor_id, 'kernel.read', p_scope);
  return query
    select a.id, a.kind, a.proposer_id, a.on_behalf_of, a.target_ref, a.task_ref, a.payload, a.decision,
           (kernel.action_state(a.id)).status, a.created_at
    from kernel.actions a
    where a.scope = p_scope or starts_with(a.scope, p_scope || '/')
    order by a.created_at desc, a.id
    limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$$;

-- Delivered messages addressed to the caller, with provenance.
create function kernel_api.inbox(p_as_actor uuid default null)
returns table (
  action_id uuid, sender_id uuid, sender_kind text, on_behalf_of uuid, scope text, message_type text, payload jsonb,
  in_reply_to uuid, delivered_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
begin
  return query
    select a.id, a.proposer_id, s.kind, a.on_behalf_of, a.scope, a.payload ->> 'type', a.payload, a.in_reply_to, t.created_at
    from kernel.actions a
    join kernel.actors s on s.id = a.proposer_id
    join kernel.action_transitions t on t.action_id = a.id and t.status = 'completed'
    where a.kind = 'message.send' and a.target_ref = 'actor:' || c.actor_id
    order by t.created_at, a.id;
end;
$$;

------------------------------------------------------------------------------------------------
-- Avatars
------------------------------------------------------------------------------------------------

create table kernel.avatars (
  id uuid primary key,
  owner_id uuid not null references kernel.actors (id),
  agent_id uuid not null unique references kernel.actors (id),
  avatar_type text not null check (avatar_type in ('digital_self', 'ai_companion', 'abstract')),
  name text not null check (length(name) between 1 and 80),
  relationship text not null check (relationship in ('represent', 'assist', 'guide', 'create_with')),
  event_id uuid not null unique references kernel.events (id),
  created_at timestamptz not null default now(),
  unique (owner_id, avatar_type)
);

create table kernel.avatar_identity_seeds (
  avatar_id uuid not null references kernel.avatars (id),
  version integer not null check (version >= 1),
  seed jsonb not null check (jsonb_typeof(seed) = 'object' and length(seed::text) <= 8000),
  event_id uuid not null unique references kernel.events (id),
  created_at timestamptz not null default now(),
  primary key (avatar_id, version)
);

create table kernel.avatar_representations (
  id uuid primary key,
  seq bigint generated always as identity unique,
  avatar_id uuid not null references kernel.avatars (id),
  kind text not null check (kind in ('abstract', 'pixel', 'cartoon', 'stylized_3d', 'realistic', 'voice_only')),
  identity_seed_version integer not null,
  renderer_version text not null check (length(renderer_version) between 1 and 40),
  asset_ref text check (asset_ref is null or length(asset_ref) <= 500),
  event_id uuid not null unique references kernel.events (id),
  created_at timestamptz not null default now(),
  foreign key (avatar_id, identity_seed_version) references kernel.avatar_identity_seeds (avatar_id, version)
);

-- Creates the caller's avatar of a type, backed by an agent the caller owns. Retrying returns the
-- same avatar; one avatar per owner and type. The agent starts with observe-level authority
-- delegated from its owner; anything consequential needs explicit delegation.
create function kernel_api.create_avatar(
  p_avatar_type text,
  p_name text,
  p_relationship text default 'assist',
  p_seed jsonb default '{}'::jsonb,
  p_representation text default 'abstract',
  p_as_actor uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  v_existing uuid;
  v_agent uuid;
  v_id uuid := gen_random_uuid();
  v_scope text := 'actor:' || c.actor_id;
  v_authority uuid;
  v_event uuid;
  v_role text;
begin
  if p_avatar_type is null or p_avatar_type not in ('digital_self', 'ai_companion', 'abstract') then
    raise exception using errcode = 'KA003', message = 'unknown avatar type';
  end if;
  if p_relationship is null or p_relationship not in ('represent', 'assist', 'guide', 'create_with') then
    raise exception using errcode = 'KA003', message = 'unknown relationship';
  end if;
  if p_representation is null or p_representation not in ('abstract', 'pixel', 'cartoon', 'stylized_3d', 'realistic', 'voice_only') then
    raise exception using errcode = 'KA003', message = 'unknown representation';
  end if;
  if p_seed is null or jsonb_typeof(p_seed) <> 'object' then
    raise exception using errcode = 'KA003', message = 'the identity seed is a JSON object';
  end if;
  perform kernel.lock_chain();
  select a.id into v_existing from kernel.avatars a where a.owner_id = c.actor_id and a.avatar_type = p_avatar_type;
  if v_existing is not null then
    return v_existing;
  end if;
  v_authority := kernel.require_allowed(c.actor_id, 'kernel.actor.create', v_scope);
  v_role := case p_avatar_type when 'ai_companion' then 'ai_companion' else 'personal_avatar' end;
  v_agent := kernel.do_spawn_agent(c, p_name, v_role, v_scope, null);

  v_event := kernel.append_event(
    c, 'kernel.avatar.created', v_scope, v_authority,
    jsonb_build_object('avatar_id', v_id, 'agent_id', v_agent, 'avatar_type', p_avatar_type, 'name', p_name,
                       'relationship', p_relationship, 'seed', p_seed, 'representation', p_representation)
  );
  insert into kernel.avatars (id, owner_id, agent_id, avatar_type, name, relationship, event_id)
  values (v_id, c.actor_id, v_agent, p_avatar_type, p_name, p_relationship, v_event);
  insert into kernel.avatar_identity_seeds (avatar_id, version, seed, event_id) values (v_id, 1, p_seed, v_event);
  insert into kernel.avatar_representations (id, avatar_id, kind, identity_seed_version, renderer_version, event_id)
  values (gen_random_uuid(), v_id, p_representation, 1, 'sov-1', v_event);

  -- Safe early authority: observe what its owner can see in the owner's own scope.
  perform kernel.delegate(c, v_agent, 'kernel.read', v_scope, null, 'avatar_default');
  return v_id;
end;
$$;

-- Records a new representation for an avatar. Identity, authority, memory and history are untouched.
create function kernel_api.set_avatar_representation(
  p_avatar_id uuid,
  p_kind text,
  p_renderer_version text default 'sov-1',
  p_asset_ref text default null,
  p_as_actor uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  v_avatar kernel.avatars;
  v_seed integer;
  v_id uuid := gen_random_uuid();
  v_event uuid;
begin
  perform kernel.lock_chain();
  select * into v_avatar from kernel.avatars a where a.id = p_avatar_id;
  if not found then
    raise exception using errcode = 'KA007', message = 'avatar not found';
  end if;
  if p_kind is null or p_kind not in ('abstract', 'pixel', 'cartoon', 'stylized_3d', 'realistic', 'voice_only') then
    raise exception using errcode = 'KA003', message = 'unknown representation';
  end if;
  select max(s.version) into v_seed from kernel.avatar_identity_seeds s where s.avatar_id = p_avatar_id;
  v_event := kernel.append_event(
    c, 'kernel.avatar.represented', 'actor:' || v_avatar.owner_id,
    kernel.require_allowed(c.actor_id, 'avatar.manage', 'actor:' || v_avatar.owner_id),
    jsonb_build_object('avatar_id', p_avatar_id, 'representation_id', v_id, 'kind', p_kind,
                       'identity_seed_version', v_seed, 'renderer_version', p_renderer_version, 'asset_ref', p_asset_ref)
  );
  insert into kernel.avatar_representations (id, avatar_id, kind, identity_seed_version, renderer_version, asset_ref, event_id)
  values (v_id, p_avatar_id, p_kind, v_seed, coalesce(p_renderer_version, 'sov-1'), p_asset_ref, v_event);
  return v_id;
end;
$$;

-- The caller's avatars, with their current representation of each kind.
create function kernel_api.my_avatars(p_as_actor uuid default null)
returns table (
  avatar_id uuid, agent_id uuid, avatar_type text, name text, relationship text, seed_version integer, seed jsonb,
  representation text, representations text[], created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
begin
  return query
    select a.id, a.agent_id, a.avatar_type, a.name, a.relationship, s.version, s.seed,
           (select r.kind from kernel.avatar_representations r where r.avatar_id = a.id order by r.seq desc limit 1),
           array(select distinct r.kind from kernel.avatar_representations r where r.avatar_id = a.id order by 1),
           a.created_at
    from kernel.avatars a
    join lateral (
      select * from kernel.avatar_identity_seeds x where x.avatar_id = a.id order by x.version desc limit 1
    ) s on true
    where a.owner_id = c.actor_id or a.agent_id = c.actor_id
    order by a.created_at, a.id;
end;
$$;

------------------------------------------------------------------------------------------------
-- Principals: names and kinds
------------------------------------------------------------------------------------------------

-- Display facts about actors (kind, label, owner, agent role) for any registered caller. Identity
-- links, grants and history stay behind their own gates.
create function kernel_api.read_actors(p_actor_ids uuid[], p_as_actor uuid default null)
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
    select a.id, a.kind, a.label, a.owner_id, kernel.party_of(a.id), r.role
    from kernel.actors a left join kernel.agent_roles r on r.actor_id = a.id
    where a.id = any (p_actor_ids)
    order by a.created_at, a.id;
end;
$$;

------------------------------------------------------------------------------------------------
-- Append-only and privileges
------------------------------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'agent_roles', 'grant_limits', 'action_policies', 'entities', 'entity_versions', 'relations', 'relation_endings',
    'tasks', 'task_transitions', 'actions', 'action_approvals', 'action_transitions', 'avatars', 'avatar_identity_seeds',
    'avatar_representations'
  ] loop
    execute format('alter table kernel.%I enable row level security', t);
    execute format(
      'create trigger %I before update or delete on kernel.%I for each row execute function kernel.forbid_mutation()',
      t || '_append_only', t
    );
    execute format(
      'create trigger %I before truncate on kernel.%I for each statement execute function kernel.forbid_mutation()',
      t || '_no_truncate', t
    );
  end loop;
end;
$$;

revoke all on all tables in schema kernel from public, anon, authenticated, service_role;
revoke all on all sequences in schema kernel from public, anon, authenticated, service_role;
revoke all on all functions in schema kernel from public, anon, authenticated, service_role;
revoke all on all functions in schema kernel_api from public, anon;
grant execute on all functions in schema kernel_api to authenticated, service_role;
revoke execute on function kernel_api.verify_chain() from authenticated;
