-- solve memory kernel v1
--
-- DIRECTIVES.md (2026-10-03): build the memory kernel first.
--
-- Invariants this migration enforces in the database itself:
--   1. Every write is an event with provenance: who acted, for whom, under which grant, on the kernel clock.
--   2. History is append-only. UPDATE, DELETE and TRUNCATE fail on every kernel table.
--      Corrections are new events that point at the event they correct.
--   3. Events form one SHA-256 hash chain. kernel_api.verify_chain() detects any edit to stored history.
--   4. The ledger is double-entry. Every posting balances per asset. Balances are sums of entries, never stored.
--      Only an asset's issuer scope can hold accounts able to create supply.
--   5. Evidence attaches to events and carries its basis. The kernel limits who may claim which basis.
--   6. Identity and authority gate every write. API roles have no table access at all. They call kernel_api
--      functions, which resolve the caller from the verified JWT and require an active, unrevoked grant.
--      Revoking a grant immediately voids every grant delegated from it.

create schema kernel;
create schema kernel_api;

comment on schema kernel is 'solve memory kernel: private storage and internals. Never expose through the API.';
comment on schema kernel_api is 'solve memory kernel: the only gated interface to kernel memory.';

revoke all on schema kernel from public;
revoke all on schema kernel_api from public;
alter default privileges in schema kernel revoke execute on functions from public;
alter default privileges in schema kernel_api revoke execute on functions from public;

-- Error codes raised by the kernel (SQLSTATE class KA):
--   KA001 unauthenticated or unregistered caller
--   KA002 forbidden: no authority for this action
--   KA003 invalid input
--   KA004 conflict: already exists, or idempotency key reused for a different action
--   KA005 insufficient balance
--   KA006 append-only violation
--   KA007 not found

------------------------------------------------------------------------------------------------
-- Vocabulary
------------------------------------------------------------------------------------------------

-- Scopes name where an action happens: 'system', 'actor:<id>', 'world:<id>/room:<id>'.
-- A scope covers itself and every scope nested under it with '/'.
create function kernel.is_scope(s text) returns boolean
language sql immutable set search_path = '' as $$
  select s is not null
     and length(s) <= 512
     and s ~ '^[a-z][a-z0-9_]*(:[A-Za-z0-9_.-]{1,128})?(/[a-z][a-z0-9_]*(:[A-Za-z0-9_.-]{1,128})?)*$';
$$;

-- Capabilities are dotted names. A trailing '.*' covers a namespace; '*' covers everything.
create function kernel.is_capability(c text) returns boolean
language sql immutable set search_path = '' as $$
  select c is not null
     and length(c) <= 200
     and (c = '*' or c ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*(\.\*)?$');
$$;

-- Event types are dotted names with at least two segments: 'note.created', 'kernel.grant.issued'.
create function kernel.is_event_type(t text) returns boolean
language sql immutable set search_path = '' as $$
  select t is not null
     and length(t) <= 200
     and t ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$';
$$;

create function kernel.capability_covers(held text, wanted text) returns boolean
language sql immutable set search_path = '' as $$
  select held = '*'
      or held = wanted
      or (right(held, 2) = '.*' and left(wanted, length(held) - 1) = left(held, length(held) - 1));
$$;

create function kernel.scope_covers(held text, wanted text) returns boolean
language sql immutable set search_path = '' as $$
  select held = '*'
      or held = wanted
      or left(wanted, length(held) + 1) = held || '/';
$$;

create function kernel.kernel_actor_id() returns uuid
language sql immutable set search_path = '' as $$
  select '00000000-0000-4000-8000-000000000001'::uuid;
$$;

------------------------------------------------------------------------------------------------
-- Storage. Every table is append-only.
------------------------------------------------------------------------------------------------

-- Humans, AI agents and services are distinct actors. An agent always has an accountable owner.
create table kernel.actors (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('human', 'agent', 'service')),
  owner_id uuid references kernel.actors (id),
  label text not null default '' check (length(label) <= 200),
  created_at timestamptz not null default now(),
  check (kind <> 'agent' or owner_id is not null),
  check (kind <> 'human' or owner_id is null)
);

create table kernel.events (
  -- Assigned by the chain trigger under the chain lock: gapless and equal to chain order.
  seq bigint primary key,
  id uuid not null unique default gen_random_uuid(),
  -- Kernel clock. Callers cannot supply it.
  occurred_at timestamptz not null,
  type text not null check (kernel.is_event_type(type)),
  scope text not null check (kernel.is_scope(scope)),
  actor_id uuid not null references kernel.actors (id),
  -- The accountable human when an agent acts.
  on_behalf_of uuid references kernel.actors (id),
  -- The grant that authorized this event. Only kernel-policy events may omit it.
  grant_id uuid,
  auth_method text not null check (auth_method in ('user_jwt', 'service_role', 'kernel')),
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 65536),
  corrects uuid references kernel.events (id),
  idempotency_key text check (length(idempotency_key) between 1 and 200),
  correlation_id uuid,
  prev_hash bytea unique,
  hash bytea not null unique,
  unique (actor_id, idempotency_key),
  check (on_behalf_of is null or on_behalf_of <> actor_id),
  check (grant_id is not null or type like 'kernel.%')
);

-- Exactly one genesis event: the only row without a predecessor.
create unique index events_single_genesis on kernel.events ((prev_hash is null)) where prev_hash is null;
create index events_scope_seq on kernel.events (scope, seq);
create index events_corrects on kernel.events (corrects) where corrects is not null;

create table kernel.grants (
  id uuid primary key default gen_random_uuid(),
  grantee_id uuid not null references kernel.actors (id),
  capability text not null check (kernel.is_capability(capability)),
  scope text not null check (scope = '*' or kernel.is_scope(scope)),
  issued_by uuid not null references kernel.actors (id),
  -- The issuer's own grant this one was delegated from. Null only for kernel-policy grants.
  parent_grant_id uuid references kernel.grants (id),
  expires_at timestamptz,
  event_id uuid not null unique references kernel.events (id),
  created_at timestamptz not null default now()
);

create index grants_grantee on kernel.grants (grantee_id);
create index grants_parent on kernel.grants (parent_grant_id) where parent_grant_id is not null;

alter table kernel.events
  add constraint events_grant_id_fkey foreign key (grant_id) references kernel.grants (id);

create table kernel.grant_revocations (
  grant_id uuid primary key references kernel.grants (id),
  revoked_by uuid not null references kernel.actors (id),
  event_id uuid not null unique references kernel.events (id),
  created_at timestamptz not null default now()
);

-- Maps a verified identity-provider subject to its canonical actor.
-- Provider identifiers never become the actor's identity.
create table kernel.identity_links (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references kernel.actors (id),
  provider text not null check (provider ~ '^[a-z][a-z0-9_.-]{0,63}$'),
  subject text not null check (length(subject) between 1 and 255),
  event_id uuid not null unique references kernel.events (id),
  created_at timestamptz not null default now(),
  unique (provider, subject)
);

create index identity_links_actor on kernel.identity_links (actor_id);

-- First claimant of a new top-level scope (a World, a Room, a Pack) holds full authority over it.
create table kernel.scope_claims (
  scope text primary key check (kernel.is_scope(scope) and position('/' in scope) = 0),
  claimed_by uuid not null references kernel.actors (id),
  event_id uuid not null unique references kernel.events (id),
  created_at timestamptz not null default now()
);

create table kernel.evidence (
  id uuid primary key default gen_random_uuid(),
  -- The event this evidence supports.
  event_id uuid not null references kernel.events (id),
  -- The kernel.evidence.attached event that recorded it.
  attached_by_event uuid not null references kernel.events (id),
  basis text not null check (basis in (
    'self_reported', 'witnessed', 'artifact', 'system_observed', 'externally_verified'
  )),
  -- Digest of the proof itself. The content lives in storage outside the kernel.
  content_hash text not null check (content_hash ~ '^sha256:[0-9a-f]{64}$'),
  media_type text check (length(media_type) <= 255),
  uri text check (length(uri) <= 2048),
  description text not null default '' check (length(description) <= 1000),
  created_at timestamptz not null default now()
);

create index evidence_event on kernel.evidence (event_id);
create index evidence_attached_by on kernel.evidence (attached_by_event);

-- A unit of account. Supply can only be created by accounts inside the issuer scope.
create table kernel.assets (
  code text primary key check (code ~ '^[A-Z][A-Z0-9_]{1,15}$'),
  issuer_scope text not null check (kernel.is_scope(issuer_scope)),
  decimals integer not null check (decimals between 0 and 18),
  label text not null default '' check (length(label) <= 200),
  event_id uuid not null unique references kernel.events (id),
  created_at timestamptz not null default now()
);

create table kernel.accounts (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (kernel.is_scope(scope)),
  asset text not null references kernel.assets (code),
  normal_balance text not null check (normal_balance in ('debit', 'credit')),
  allow_negative boolean not null default false,
  label text not null default '' check (length(label) <= 200),
  event_id uuid not null unique references kernel.events (id),
  created_at timestamptz not null default now(),
  unique (id, asset)
);

create index accounts_scope on kernel.accounts (scope);

-- Signed minor units: positive is a debit, negative is a credit.
create table kernel.ledger_entries (
  id bigint generated always as identity primary key,
  event_id uuid not null references kernel.events (id),
  account_id uuid not null,
  asset text not null,
  amount numeric(38, 0) not null check (amount <> 0),
  foreign key (account_id, asset) references kernel.accounts (id, asset)
);

create index ledger_entries_account on kernel.ledger_entries (account_id);
create index ledger_entries_event on kernel.ledger_entries (event_id);

------------------------------------------------------------------------------------------------
-- Append-only enforcement, hash chain, ledger balance
------------------------------------------------------------------------------------------------

create function kernel.forbid_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception using
    errcode = 'KA006',
    message = format('kernel memory is append-only: %s on %I.%I is not allowed', tg_op, tg_table_schema, tg_table_name),
    hint = 'Record a correcting event instead.';
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'actors', 'events', 'grants', 'grant_revocations', 'identity_links',
    'scope_claims', 'evidence', 'assets', 'accounts', 'ledger_entries'
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

-- Serializes every event write so the chain stays linear and seq is gapless.
create function kernel.lock_chain() returns void
language sql set search_path = '' as $$
  select pg_catalog.pg_advisory_xact_lock(4242004201);
$$;

-- The exact bytes each event hash commits to (jsonb text output is canonical).
create function kernel.event_canonical(e kernel.events) returns text
language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'seq', e.seq,
    'id', e.id,
    'occurred_at_us', (extract(epoch from e.occurred_at) * 1000000)::bigint,
    'type', e.type,
    'scope', e.scope,
    'actor_id', e.actor_id,
    'on_behalf_of', e.on_behalf_of,
    'grant_id', e.grant_id,
    'auth_method', e.auth_method,
    'payload', e.payload,
    'corrects', e.corrects,
    'idempotency_key', e.idempotency_key,
    'correlation_id', e.correlation_id
  )::text;
$$;

create function kernel.event_hash(prev bytea, e kernel.events) returns bytea
language sql immutable set search_path = '' as $$
  select pg_catalog.sha256(coalesce(prev, '\x'::bytea) || pg_catalog.convert_to(kernel.event_canonical(e), 'UTF8'));
$$;

create function kernel.chain_event() returns trigger
language plpgsql set search_path = '' as $$
declare
  last_seq bigint;
  last_hash bytea;
begin
  perform kernel.lock_chain();
  select e.seq, e.hash into last_seq, last_hash from kernel.events e order by e.seq desc limit 1;

  new.seq := coalesce(last_seq, 0) + 1;
  new.prev_hash := last_hash;
  new.occurred_at := pg_catalog.clock_timestamp();
  new.hash := kernel.event_hash(new.prev_hash, new);
  return new;
end;
$$;

create trigger events_chain before insert on kernel.events
for each row execute function kernel.chain_event();

-- Checked at commit: every ledger event's entries sum to zero per asset.
create function kernel.check_entries_balance() returns trigger
language plpgsql set search_path = '' as $$
begin
  if exists (
    select 1 from kernel.ledger_entries le
    where le.event_id = new.event_id
    group by le.asset
    having sum(le.amount) <> 0
  ) then
    raise exception using errcode = 'KA003',
      message = format('ledger posting %s does not balance', new.event_id);
  end if;
  return null;
end;
$$;

create constraint trigger ledger_entries_balanced
after insert on kernel.ledger_entries
deferrable initially deferred
for each row execute function kernel.check_entries_balance();

------------------------------------------------------------------------------------------------
-- Internals
------------------------------------------------------------------------------------------------

create type kernel.caller as (
  actor_id uuid,
  -- The accountable human for agents; null otherwise.
  principal_id uuid,
  kind text,
  auth_method text
);

-- Resolves who is calling from the verified JWT claims PostgREST sets for the request.
-- End users act only as themselves. The service key may act only as an agent or service actor.
create function kernel.resolve_caller(p_as_actor uuid) returns kernel.caller
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
    select a.id, a.kind, case when a.kind = 'agent' then a.owner_id end
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

create function kernel.kernel_caller() returns kernel.caller
language sql immutable set search_path = '' as $$
  select row(kernel.kernel_actor_id(), null::uuid, 'service', 'kernel')::kernel.caller;
$$;

-- A grant is active while it and every grant it was delegated from are unexpired and unrevoked.
create function kernel.grant_is_active(p_grant uuid) returns boolean
language sql stable set search_path = '' as $$
  with recursive chain as (
    select g.id, g.parent_grant_id, g.expires_at from kernel.grants g where g.id = p_grant
    union all
    select p.id, p.parent_grant_id, p.expires_at
    from kernel.grants p join chain c on p.id = c.parent_grant_id
  )
  select exists (select 1 from chain)
     and not exists (
       select 1 from chain c
       where (c.expires_at is not null and c.expires_at <= now())
          or exists (select 1 from kernel.grant_revocations r where r.grant_id = c.id)
     );
$$;

create function kernel.find_grant(p_actor uuid, p_capability text, p_scope text) returns uuid
language sql stable set search_path = '' as $$
  select g.id
  from kernel.grants g
  where g.grantee_id = p_actor
    and kernel.capability_covers(g.capability, p_capability)
    and kernel.scope_covers(g.scope, p_scope)
    and kernel.grant_is_active(g.id)
  order by g.created_at, g.id
  limit 1;
$$;

create function kernel.require_grant(p_actor uuid, p_capability text, p_scope text) returns uuid
language plpgsql stable set search_path = '' as $$
declare
  found_grant uuid := kernel.find_grant(p_actor, p_capability, p_scope);
begin
  if found_grant is null then
    raise exception using errcode = 'KA002',
      message = format('no active grant for %s on %s', p_capability, p_scope);
  end if;
  return found_grant;
end;
$$;

create function kernel.require_scope(p_scope text) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if not kernel.is_scope(p_scope) then
    raise exception using errcode = 'KA003', message = format('invalid scope: %s', coalesce(p_scope, 'null'));
  end if;
end;
$$;

-- Returns the original event when an actor retries with the same idempotency key.
create function kernel.replay(p_actor uuid, p_key text, p_type text, p_scope text) returns uuid
language plpgsql stable set search_path = '' as $$
declare
  original record;
begin
  if p_key is null then
    return null;
  end if;
  select e.id, e.type, e.scope into original
  from kernel.events e where e.actor_id = p_actor and e.idempotency_key = p_key;
  if not found then
    return null;
  end if;
  if original.type <> p_type or original.scope <> p_scope then
    raise exception using errcode = 'KA004', message = 'idempotency key already used for a different action';
  end if;
  return original.id;
end;
$$;

create function kernel.append_event(
  p_caller kernel.caller,
  p_type text,
  p_scope text,
  p_grant uuid,
  p_payload jsonb,
  p_corrects uuid default null,
  p_idempotency_key text default null,
  p_correlation_id uuid default null
) returns uuid
language plpgsql set search_path = '' as $$
declare
  new_id uuid;
begin
  insert into kernel.events (
    type, scope, actor_id, on_behalf_of, grant_id, auth_method,
    payload, corrects, idempotency_key, correlation_id
  ) values (
    p_type, p_scope, p_caller.actor_id, p_caller.principal_id, p_grant, p_caller.auth_method,
    coalesce(p_payload, '{}'::jsonb), p_corrects, p_idempotency_key, p_correlation_id
  )
  returning id into new_id;
  return new_id;
end;
$$;

-- Issues a grant under kernel policy (registration, scope claims, bootstrap).
create function kernel.issue_policy_grant(p_grantee uuid, p_capability text, p_scope text, p_basis text)
returns uuid
language plpgsql set search_path = '' as $$
declare
  new_grant uuid := gen_random_uuid();
  event_id uuid;
begin
  event_id := kernel.append_event(
    kernel.kernel_caller(),
    'kernel.grant.issued',
    case when p_scope = '*' then 'system' else p_scope end,
    null,
    jsonb_build_object(
      'grant_id', new_grant, 'grantee_id', p_grantee, 'capability', p_capability,
      'scope', p_scope, 'parent_grant_id', null, 'expires_at', null, 'basis', p_basis
    )
  );
  insert into kernel.grants (id, grantee_id, capability, scope, issued_by, parent_grant_id, event_id)
  values (new_grant, p_grantee, p_capability, p_scope, kernel.kernel_actor_id(), null, event_id);
  return new_grant;
end;
$$;

-- The party behind an actor: an agent's owner, otherwise the actor itself.
create function kernel.party_of(p_actor uuid) returns uuid
language sql stable set search_path = '' as $$
  select case when a.kind = 'agent' then a.owner_id else a.id end from kernel.actors a where a.id = p_actor;
$$;

-- Records evidence for p_target as one kernel.evidence.attached event.
-- Basis rules: self_reported only by the event's own party; witnessed only by a different party;
-- system_observed and externally_verified only by service actors; artifact by anyone.
create function kernel.attach(p_caller kernel.caller, p_target uuid, p_items jsonb, p_grant uuid,
                              p_idempotency_key text default null) returns uuid
language plpgsql set search_path = '' as $$
declare
  target kernel.events;
  item jsonb;
  items jsonb := '[]'::jsonb;
  basis text;
  caller_party uuid := coalesce(p_caller.principal_id, p_caller.actor_id);
  target_party uuid;
  attach_event uuid;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception using errcode = 'KA003', message = 'evidence must be a JSON array';
  end if;
  if jsonb_array_length(p_items) = 0 then
    return null;
  end if;
  if jsonb_array_length(p_items) > 20 then
    raise exception using errcode = 'KA003', message = 'at most 20 evidence items per attachment';
  end if;

  select * into target from kernel.events e where e.id = p_target;
  if not found then
    raise exception using errcode = 'KA007', message = 'event not found';
  end if;
  target_party := coalesce(target.on_behalf_of, kernel.party_of(target.actor_id));

  for item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(item) <> 'object' then
      raise exception using errcode = 'KA003', message = 'each evidence item must be an object';
    end if;
    basis := item ->> 'basis';
    if basis = 'self_reported' and caller_party is distinct from target_party then
      raise exception using errcode = 'KA002', message = 'only the acting party can self-report on an event';
    elsif basis = 'witnessed' and caller_party = target_party then
      raise exception using errcode = 'KA002', message = 'a party cannot witness its own event';
    elsif basis in ('system_observed', 'externally_verified') and p_caller.kind <> 'service' then
      raise exception using errcode = 'KA002', message = format('only service actors can attach %s evidence', basis);
    elsif basis is null or basis not in ('self_reported', 'witnessed', 'artifact', 'system_observed', 'externally_verified') then
      raise exception using errcode = 'KA003', message = format('invalid evidence basis: %s', coalesce(basis, 'null'));
    end if;
    if coalesce(item ->> 'content_hash', '') !~ '^sha256:[0-9a-f]{64}$' then
      raise exception using errcode = 'KA003', message = 'content_hash must look like sha256:<64 lowercase hex>';
    end if;
    items := items || jsonb_build_object(
      'evidence_id', gen_random_uuid(),
      'basis', basis,
      'content_hash', item ->> 'content_hash',
      'media_type', item ->> 'media_type',
      'uri', item ->> 'uri',
      'description', coalesce(item ->> 'description', '')
    );
  end loop;

  attach_event := kernel.append_event(
    p_caller, 'kernel.evidence.attached', target.scope, p_grant,
    jsonb_build_object('event_id', p_target, 'items', items),
    null, p_idempotency_key
  );

  insert into kernel.evidence (id, event_id, attached_by_event, basis, content_hash, media_type, uri, description)
  select (i ->> 'evidence_id')::uuid, p_target, attach_event, i ->> 'basis', i ->> 'content_hash',
         i ->> 'media_type', i ->> 'uri', i ->> 'description'
  from jsonb_array_elements(items) i;

  return attach_event;
end;
$$;

-- Natural balance: positive means the account holds value on its normal side.
create function kernel.natural_balance(p_account uuid) returns numeric
language sql stable set search_path = '' as $$
  select coalesce(sum(le.amount), 0) * case a.normal_balance when 'debit' then 1 else -1 end
  from kernel.accounts a
  left join kernel.ledger_entries le on le.account_id = a.id
  where a.id = p_account
  group by a.normal_balance;
$$;

------------------------------------------------------------------------------------------------
-- kernel_api: identity
------------------------------------------------------------------------------------------------

-- Links the signed-in Supabase Auth user to a canonical human actor. Safe to call on every sign-in.
-- The new actor receives full authority over its own scope, actor:<id>.
create function kernel_api.register(p_label text default '') returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  claims jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
  session_role text := nullif(current_setting('role', true), 'none');
  token_subject text := claims ->> 'sub';
  existing uuid;
  new_actor uuid := gen_random_uuid();
  self kernel.caller;
  event_id uuid;
begin
  if claims ->> 'role' is distinct from 'authenticated' or coalesce(session_role, 'authenticated') <> 'authenticated' then
    raise exception using errcode = 'KA001', message = 'register requires a signed-in user';
  end if;
  if coalesce((claims ->> 'is_anonymous')::boolean, false) then
    raise exception using errcode = 'KA001', message = 'anonymous sessions cannot register';
  end if;
  if token_subject is null or length(token_subject) = 0 then
    raise exception using errcode = 'KA001', message = 'token has no subject';
  end if;

  perform kernel.lock_chain();

  select l.actor_id into existing from kernel.identity_links l
  where l.provider = 'supabase_auth' and l.subject = token_subject;
  if existing is not null then
    return existing;
  end if;

  insert into kernel.actors (id, kind, label) values (new_actor, 'human', coalesce(p_label, ''));
  self := row(new_actor, null::uuid, 'human', 'user_jwt')::kernel.caller;

  event_id := kernel.append_event(
    self, 'kernel.actor.registered', 'actor:' || new_actor, null,
    jsonb_build_object('actor_id', new_actor, 'kind', 'human', 'label', coalesce(p_label, ''),
                       'provider', 'supabase_auth', 'subject', token_subject)
  );
  insert into kernel.identity_links (actor_id, provider, subject, event_id)
  values (new_actor, 'supabase_auth', token_subject, event_id);

  perform kernel.issue_policy_grant(new_actor, '*', 'actor:' || new_actor, 'self');
  return new_actor;
end;
$$;

create function kernel_api.whoami(p_as_actor uuid default null)
returns table (actor_id uuid, kind text, label text, owner_id uuid)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
begin
  return query select a.id, a.kind, a.label, a.owner_id from kernel.actors a where a.id = c.actor_id;
end;
$$;

-- Creates an AI agent owned by the calling human. Agents start with no authority:
-- their owner grants it, and it can never exceed the owner's own.
create function kernel_api.create_agent(p_label text, p_idempotency_key text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(null);
  scope text := 'actor:' || c.actor_id;
  authority uuid;
  replayed uuid;
  new_agent uuid := gen_random_uuid();
begin
  if c.kind <> 'human' then
    raise exception using errcode = 'KA002', message = 'only humans create agents';
  end if;
  perform kernel.lock_chain();
  replayed := kernel.replay(c.actor_id, p_idempotency_key, 'kernel.actor.created', scope);
  if replayed is not null then
    return (select (e.payload ->> 'actor_id')::uuid from kernel.events e where e.id = replayed);
  end if;
  authority := kernel.require_grant(c.actor_id, 'kernel.actor.create', scope);

  insert into kernel.actors (id, kind, owner_id, label) values (new_agent, 'agent', c.actor_id, coalesce(p_label, ''));
  perform kernel.append_event(
    c, 'kernel.actor.created', scope, authority,
    jsonb_build_object('actor_id', new_agent, 'kind', 'agent', 'owner_id', c.actor_id, 'label', coalesce(p_label, '')),
    null, p_idempotency_key
  );
  return new_agent;
end;
$$;

-- Creates a service actor (an integration such as a Whop sync). Requires system authority.
create function kernel_api.create_service_actor(p_label text, p_idempotency_key text default null, p_as_actor uuid default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  authority uuid;
  replayed uuid;
  new_service uuid := gen_random_uuid();
begin
  perform kernel.lock_chain();
  replayed := kernel.replay(c.actor_id, p_idempotency_key, 'kernel.actor.created', 'system');
  if replayed is not null then
    return (select (e.payload ->> 'actor_id')::uuid from kernel.events e where e.id = replayed);
  end if;
  authority := kernel.require_grant(c.actor_id, 'kernel.actor.create', 'system');

  insert into kernel.actors (id, kind, owner_id, label)
  values (new_service, 'service', coalesce(c.principal_id, c.actor_id), coalesce(p_label, ''));
  perform kernel.append_event(
    c, 'kernel.actor.created', 'system', authority,
    jsonb_build_object('actor_id', new_service, 'kind', 'service',
                       'owner_id', coalesce(c.principal_id, c.actor_id), 'label', coalesce(p_label, '')),
    null, p_idempotency_key
  );
  return new_service;
end;
$$;

------------------------------------------------------------------------------------------------
-- kernel_api: events and evidence
------------------------------------------------------------------------------------------------

-- Records an event. The caller needs a grant covering the event type on the scope.
-- p_evidence: [{basis, content_hash, media_type?, uri?, description?}]
create function kernel_api.record_event(
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
  authority uuid;
  corrected kernel.events;
  new_event uuid;
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
  new_event := kernel.replay(c.actor_id, p_idempotency_key, p_type, p_scope);
  if new_event is not null then
    return new_event;
  end if;
  authority := kernel.require_grant(c.actor_id, p_type, p_scope);

  if p_corrects is not null then
    select * into corrected from kernel.events e where e.id = p_corrects;
    if not found then
      raise exception using errcode = 'KA007', message = 'corrected event not found';
    end if;
    if corrected.type like 'kernel.%' then
      raise exception using errcode = 'KA003', message = 'kernel events are corrected through their own functions';
    end if;
    if corrected.scope <> p_scope then
      raise exception using errcode = 'KA003', message = 'a correction must be recorded in the scope of the event it corrects';
    end if;
  end if;

  new_event := kernel.append_event(
    c, p_type, p_scope, authority, p_payload, p_corrects, p_idempotency_key, p_correlation_id
  );
  perform kernel.attach(c, new_event, coalesce(p_evidence, '[]'::jsonb), authority);
  return new_event;
end;
$$;

-- Attaches one piece of evidence to an existing event. Returns the evidence id.
create function kernel_api.attach_evidence(
  p_event_id uuid,
  p_basis text,
  p_content_hash text,
  p_media_type text default null,
  p_uri text default null,
  p_description text default '',
  p_idempotency_key text default null,
  p_as_actor uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  target_scope text;
  authority uuid;
  attach_event uuid;
begin
  select e.scope into target_scope from kernel.events e where e.id = p_event_id;
  if target_scope is null then
    raise exception using errcode = 'KA007', message = 'event not found';
  end if;

  perform kernel.lock_chain();
  attach_event := kernel.replay(c.actor_id, p_idempotency_key, 'kernel.evidence.attached', target_scope);
  if attach_event is null then
    authority := kernel.require_grant(c.actor_id, 'kernel.evidence.attach', target_scope);
    attach_event := kernel.attach(
      c, p_event_id,
      jsonb_build_array(jsonb_build_object(
        'basis', p_basis, 'content_hash', p_content_hash, 'media_type', p_media_type,
        'uri', p_uri, 'description', coalesce(p_description, '')
      )),
      authority, p_idempotency_key
    );
  end if;
  return (select ev.id from kernel.evidence ev where ev.attached_by_event = attach_event order by ev.id limit 1);
end;
$$;

------------------------------------------------------------------------------------------------
-- kernel_api: authority
------------------------------------------------------------------------------------------------

-- Delegates authority. The issuer needs kernel.grant.issue on the scope and must itself hold
-- a grant covering the capability and scope. The new grant dies with that parent grant.
create function kernel_api.issue_grant(
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

  authority := kernel.require_grant(c.actor_id, 'kernel.grant.issue', p_scope);
  parent := kernel.find_grant(c.actor_id, p_capability, p_scope);
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

-- Revokes a grant, effective immediately for it and everything delegated from it.
-- Allowed for the issuer, the grantee (renouncing), or a holder of kernel.grant.revoke on the scope.
create function kernel_api.revoke_grant(
  p_grant_id uuid,
  p_reason text default '',
  p_idempotency_key text default null,
  p_as_actor uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  target kernel.grants;
  event_scope text;
  authority uuid;
  basis text;
  event_id uuid;
begin
  select * into target from kernel.grants g where g.id = p_grant_id;
  if not found then
    raise exception using errcode = 'KA007', message = 'grant not found';
  end if;
  event_scope := case when target.scope = '*' then 'system' else target.scope end;

  perform kernel.lock_chain();
  select r.event_id into event_id from kernel.grant_revocations r where r.grant_id = p_grant_id;
  if event_id is not null then
    return event_id;
  end if;

  if target.issued_by = c.actor_id then
    basis := 'issuer';
  elsif target.grantee_id = c.actor_id then
    basis := 'grantee';
  else
    authority := kernel.require_grant(c.actor_id, 'kernel.grant.revoke', target.scope);
    basis := 'authority';
  end if;

  event_id := kernel.append_event(
    c, 'kernel.grant.revoked', event_scope, authority,
    jsonb_build_object('grant_id', p_grant_id, 'basis', basis, 'reason', coalesce(p_reason, '')),
    null, p_idempotency_key
  );
  insert into kernel.grant_revocations (grant_id, revoked_by, event_id) values (p_grant_id, c.actor_id, event_id);
  return event_id;
end;
$$;

-- Claims a new top-level scope such as world:<id>. The claimant receives full authority over it.
create function kernel_api.claim_scope(p_scope text, p_as_actor uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  scope_type text := split_part(p_scope, ':', 1);
  event_id uuid;
begin
  perform kernel.require_scope(p_scope);
  if position('/' in p_scope) > 0 or position(':' in p_scope) = 0 then
    raise exception using errcode = 'KA003', message = 'only new top-level scopes of the form type:id can be claimed';
  end if;
  if scope_type in ('actor', 'system', 'kernel', 'account', 'asset', 'chain', 'network') then
    raise exception using errcode = 'KA003', message = format('%s scopes cannot be claimed', scope_type);
  end if;
  if c.kind = 'agent' then
    raise exception using errcode = 'KA002', message = 'agents act inside granted scopes and cannot claim new ones';
  end if;

  perform kernel.lock_chain();
  if exists (select 1 from kernel.scope_claims s where s.scope = p_scope) then
    raise exception using errcode = 'KA004', message = format('%s is already claimed', p_scope);
  end if;

  event_id := kernel.append_event(
    c, 'kernel.scope.claimed', p_scope, null,
    jsonb_build_object('scope', p_scope, 'claimed_by', c.actor_id)
  );
  insert into kernel.scope_claims (scope, claimed_by, event_id) values (p_scope, c.actor_id, event_id);
  return kernel.issue_policy_grant(c.actor_id, '*', p_scope, 'scope_claim');
end;
$$;

------------------------------------------------------------------------------------------------
-- kernel_api: ledger
------------------------------------------------------------------------------------------------

-- Defines a unit of account and the scope allowed to issue it. Requires system authority.
create function kernel_api.define_asset(
  p_code text,
  p_issuer_scope text,
  p_decimals integer,
  p_label text default '',
  p_idempotency_key text default null,
  p_as_actor uuid default null
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  authority uuid;
  replayed uuid;
  event_id uuid;
begin
  perform kernel.require_scope(p_issuer_scope);
  if coalesce(p_code, '') !~ '^[A-Z][A-Z0-9_]{1,15}$' then
    raise exception using errcode = 'KA003', message = 'asset code must be 2-16 uppercase letters, digits or underscores';
  end if;
  if p_decimals is null or p_decimals not between 0 and 18 then
    raise exception using errcode = 'KA003', message = 'decimals must be between 0 and 18';
  end if;

  perform kernel.lock_chain();
  replayed := kernel.replay(c.actor_id, p_idempotency_key, 'kernel.asset.defined', 'system');
  if replayed is not null then
    return (select a.code from kernel.assets a where a.event_id = replayed);
  end if;
  authority := kernel.require_grant(c.actor_id, 'kernel.asset.define', 'system');
  if exists (select 1 from kernel.assets a where a.code = p_code) then
    raise exception using errcode = 'KA004', message = format('asset %s already exists', p_code);
  end if;

  event_id := kernel.append_event(
    c, 'kernel.asset.defined', 'system', authority,
    jsonb_build_object('code', p_code, 'issuer_scope', p_issuer_scope, 'decimals', p_decimals,
                       'label', coalesce(p_label, '')),
    null, p_idempotency_key
  );
  insert into kernel.assets (code, issuer_scope, decimals, label, event_id)
  values (p_code, p_issuer_scope, p_decimals, coalesce(p_label, ''), event_id);
  return p_code;
end;
$$;

-- Opens an account. Credit-normal and negative-allowed accounts can create supply,
-- so they may only exist inside the asset's issuer scope.
create function kernel_api.open_account(
  p_scope text,
  p_asset text,
  p_normal_balance text default 'debit',
  p_allow_negative boolean default false,
  p_label text default '',
  p_idempotency_key text default null,
  p_as_actor uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  asset kernel.assets;
  authority uuid;
  replayed uuid;
  new_account uuid := gen_random_uuid();
  event_id uuid;
begin
  perform kernel.require_scope(p_scope);
  if p_normal_balance is null or p_normal_balance not in ('debit', 'credit') then
    raise exception using errcode = 'KA003', message = 'normal_balance must be debit or credit';
  end if;
  select * into asset from kernel.assets a where a.code = p_asset;
  if not found then
    raise exception using errcode = 'KA007', message = format('asset %s not found', coalesce(p_asset, 'null'));
  end if;

  perform kernel.lock_chain();
  replayed := kernel.replay(c.actor_id, p_idempotency_key, 'kernel.account.opened', p_scope);
  if replayed is not null then
    return (select a.id from kernel.accounts a where a.event_id = replayed);
  end if;
  authority := kernel.require_grant(c.actor_id, 'kernel.ledger.open', p_scope);
  if (p_normal_balance = 'credit' or coalesce(p_allow_negative, false))
     and not kernel.scope_covers(asset.issuer_scope, p_scope) then
    raise exception using errcode = 'KA002',
      message = format('only the %s issuer scope (%s) can hold accounts that create supply', asset.code, asset.issuer_scope);
  end if;

  event_id := kernel.append_event(
    c, 'kernel.account.opened', p_scope, authority,
    jsonb_build_object('account_id', new_account, 'asset', asset.code, 'normal_balance', p_normal_balance,
                       'allow_negative', coalesce(p_allow_negative, false), 'label', coalesce(p_label, '')),
    null, p_idempotency_key
  );
  insert into kernel.accounts (id, scope, asset, normal_balance, allow_negative, label, event_id)
  values (new_account, p_scope, asset.code, p_normal_balance, coalesce(p_allow_negative, false),
          coalesce(p_label, ''), event_id);
  return new_account;
end;
$$;

-- Posts a balanced double-entry transaction.
-- p_entries: [{account_id, amount}] with amount as an integer string in minor units,
-- positive for a debit, negative for a credit.
-- Authority: kernel.ledger.post on p_scope, and every credited account must sit inside p_scope.
-- Debits need no authority from the receiving account: anyone may send value in.
create function kernel_api.post_transaction(
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
  authority uuid;
  entry jsonb;
  entries jsonb := '[]'::jsonb;
  account_text text;
  amount_text text;
  new_event uuid;
begin
  perform kernel.require_scope(p_scope);
  if p_entries is null or jsonb_typeof(p_entries) <> 'array'
     or jsonb_array_length(p_entries) not between 2 and 100 then
    raise exception using errcode = 'KA003', message = 'entries must be an array of 2 to 100 items';
  end if;
  if length(coalesce(p_memo, '')) > 500 then
    raise exception using errcode = 'KA003', message = 'memo is limited to 500 characters';
  end if;

  for entry in select value from jsonb_array_elements(p_entries) loop
    account_text := entry ->> 'account_id';
    amount_text := entry ->> 'amount';
    if coalesce(account_text, '') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
      raise exception using errcode = 'KA003', message = 'each entry needs an account_id uuid';
    end if;
    if coalesce(amount_text, '') !~ '^-?[1-9][0-9]{0,37}$' then
      raise exception using errcode = 'KA003', message = 'each amount must be a non-zero integer in minor units';
    end if;
    entries := entries || jsonb_build_object('account_id', account_text::uuid, 'amount', amount_text);
  end loop;

  perform kernel.lock_chain();
  new_event := kernel.replay(c.actor_id, p_idempotency_key, 'kernel.ledger.posted', p_scope);
  if new_event is not null then
    return new_event;
  end if;
  authority := kernel.require_grant(c.actor_id, 'kernel.ledger.post', p_scope);

  -- Lock touched accounts in a fixed order so concurrent postings cannot overdraw.
  perform 1 from kernel.accounts a
  where a.id in (select (x ->> 'account_id')::uuid from jsonb_array_elements(entries) x)
  order by a.id
  for update;

  if exists (
    select 1 from jsonb_array_elements(entries) x
    left join kernel.accounts a on a.id = (x ->> 'account_id')::uuid
    where a.id is null
  ) then
    raise exception using errcode = 'KA007', message = 'account not found';
  end if;

  if exists (
    select 1 from jsonb_array_elements(entries) x
    join kernel.accounts a on a.id = (x ->> 'account_id')::uuid
    group by a.asset
    having sum((x ->> 'amount')::numeric) <> 0
  ) then
    raise exception using errcode = 'KA003', message = 'entries must balance per asset';
  end if;

  if exists (
    select 1 from jsonb_array_elements(entries) x
    join kernel.accounts a on a.id = (x ->> 'account_id')::uuid
    where (x ->> 'amount')::numeric < 0 and not kernel.scope_covers(p_scope, a.scope)
  ) then
    raise exception using errcode = 'KA002', message = 'cannot credit an account outside the posting scope';
  end if;

  new_event := kernel.append_event(
    c, 'kernel.ledger.posted', p_scope, authority,
    jsonb_build_object('entries', entries, 'memo', coalesce(p_memo, '')),
    null, p_idempotency_key, p_correlation_id
  );

  insert into kernel.ledger_entries (event_id, account_id, asset, amount)
  select new_event, (x.value ->> 'account_id')::uuid, a.asset, (x.value ->> 'amount')::numeric
  from jsonb_array_elements(entries) with ordinality x(value, ord)
  join kernel.accounts a on a.id = (x.value ->> 'account_id')::uuid
  order by x.ord;

  if exists (
    select 1 from kernel.accounts a
    where a.id in (select (x ->> 'account_id')::uuid from jsonb_array_elements(entries) x)
      and not a.allow_negative
      and kernel.natural_balance(a.id) < 0
  ) then
    raise exception using errcode = 'KA005', message = 'insufficient balance';
  end if;

  perform kernel.attach(c, new_event, coalesce(p_evidence, '[]'::jsonb), authority);
  return new_event;
end;
$$;

------------------------------------------------------------------------------------------------
-- kernel_api: reads (also gated)
------------------------------------------------------------------------------------------------

-- Events in a scope and its nested scopes. Requires kernel.read on the scope.
create function kernel_api.read_events(
  p_scope text,
  p_after_seq bigint default 0,
  p_limit integer default 50,
  p_newest_first boolean default false,
  p_as_actor uuid default null
) returns table (
  seq bigint, id uuid, occurred_at timestamptz, type text, scope text, actor_id uuid,
  on_behalf_of uuid, grant_id uuid, auth_method text, payload jsonb, corrects uuid,
  correlation_id uuid, hash text
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  page_size integer := least(greatest(coalesce(p_limit, 50), 1), 500);
begin
  perform kernel.require_scope(p_scope);
  perform kernel.require_grant(c.actor_id, 'kernel.read', p_scope);
  return query
    select e.seq, e.id, e.occurred_at, e.type, e.scope, e.actor_id, e.on_behalf_of, e.grant_id,
           e.auth_method, e.payload, e.corrects, e.correlation_id, encode(e.hash, 'hex')
    from kernel.events e
    where (e.scope = p_scope or starts_with(e.scope, p_scope || '/'))
      and e.seq > coalesce(p_after_seq, 0)
    order by case when p_newest_first then -e.seq else e.seq end
    limit page_size;
end;
$$;

create function kernel_api.read_evidence(p_event_id uuid, p_as_actor uuid default null)
returns table (
  id uuid, basis text, content_hash text, media_type text, uri text, description text,
  attached_by uuid, attached_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  target_scope text;
begin
  select e.scope into target_scope from kernel.events e where e.id = p_event_id;
  if target_scope is null then
    raise exception using errcode = 'KA007', message = 'event not found';
  end if;
  perform kernel.require_grant(c.actor_id, 'kernel.read', target_scope);
  return query
    select ev.id, ev.basis, ev.content_hash, ev.media_type, ev.uri, ev.description, a.actor_id, a.occurred_at
    from kernel.evidence ev
    join kernel.events a on a.id = ev.attached_by_event
    where ev.event_id = p_event_id
    order by a.seq, ev.id;
end;
$$;

-- Balance derived from entries, as an integer string in minor units on the account's normal side.
create function kernel_api.account_balance(p_account_id uuid, p_as_actor uuid default null)
returns table (account_id uuid, scope text, asset text, normal_balance text, balance text)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  account kernel.accounts;
begin
  select * into account from kernel.accounts a where a.id = p_account_id;
  if not found then
    raise exception using errcode = 'KA007', message = 'account not found';
  end if;
  perform kernel.require_grant(c.actor_id, 'kernel.read', account.scope);
  return query
    select account.id, account.scope, account.asset, account.normal_balance,
           kernel.natural_balance(account.id)::text;
end;
$$;

-- The caller's own active grants.
create function kernel_api.my_grants(p_as_actor uuid default null)
returns table (id uuid, capability text, scope text, issued_by uuid, expires_at timestamptz, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
begin
  return query
    select g.id, g.capability, g.scope, g.issued_by, g.expires_at, g.created_at
    from kernel.grants g
    where g.grantee_id = c.actor_id and kernel.grant_is_active(g.id)
    order by g.created_at, g.id;
end;
$$;

-- Recomputes the hash chain and cross-checks ledger entries against the events that posted them.
-- Service role only: it reads the whole history.
create function kernel_api.verify_chain()
returns table (ok boolean, events_checked bigint, first_bad_seq bigint, problem text)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  e kernel.events;
  expected_prev bytea := null;
  expected_seq bigint := 1;
  checked bigint := 0;
  bad_seq bigint;
begin
  for e in select * from kernel.events order by seq loop
    if e.seq <> expected_seq then
      return query select false, checked, e.seq, 'sequence gap';
      return;
    end if;
    if e.prev_hash is distinct from expected_prev then
      return query select false, checked, e.seq, 'broken link to previous event';
      return;
    end if;
    if e.hash <> kernel.event_hash(e.prev_hash, e) then
      return query select false, checked, e.seq, 'event content does not match its hash';
      return;
    end if;
    expected_prev := e.hash;
    expected_seq := e.seq + 1;
    checked := checked + 1;
  end loop;

  select min(ev.seq) into bad_seq
  from kernel.events ev
  where (ev.type = 'kernel.ledger.posted' or exists (select 1 from kernel.ledger_entries le where le.event_id = ev.id))
    and (
      select coalesce(jsonb_agg(jsonb_build_object('account_id', le.account_id, 'amount', le.amount::text) order by le.id), '[]'::jsonb)
      from kernel.ledger_entries le where le.event_id = ev.id
    ) is distinct from coalesce(ev.payload -> 'entries', '[]'::jsonb);
  if bad_seq is not null then
    return query select false, checked, bad_seq, 'ledger entries do not match the posting event';
    return;
  end if;

  return query select true, checked, null::bigint, null::text;
end;
$$;

------------------------------------------------------------------------------------------------
-- Bootstrap (database owner only; never exposed through the API)
------------------------------------------------------------------------------------------------

-- Gives one registered human full authority (* on *). Run once from the SQL editor:
--   select kernel.grant_root('<actor id from kernel_api.register()>');
create function kernel.grant_root(p_actor uuid) returns uuid
language plpgsql set search_path = '' as $$
begin
  perform kernel.lock_chain();
  if not exists (select 1 from kernel.actors a where a.id = p_actor and a.kind = 'human') then
    raise exception using errcode = 'KA007', message = 'root must be a registered human actor';
  end if;
  if exists (
    select 1 from kernel.grants g
    where g.capability = '*' and g.scope = '*' and kernel.grant_is_active(g.id)
  ) then
    raise exception using errcode = 'KA004', message = 'an active root grant already exists';
  end if;
  return kernel.issue_policy_grant(p_actor, '*', '*', 'bootstrap');
end;
$$;

------------------------------------------------------------------------------------------------
-- Privileges: API roles get the kernel_api functions and nothing else.
------------------------------------------------------------------------------------------------

revoke all on all tables in schema kernel from public, anon, authenticated, service_role;
revoke all on all sequences in schema kernel from public, anon, authenticated, service_role;
revoke all on all functions in schema kernel from public, anon, authenticated, service_role;
revoke all on all functions in schema kernel_api from public, anon;

grant usage on schema kernel_api to authenticated, service_role;
grant execute on all functions in schema kernel_api to authenticated, service_role;
revoke execute on function kernel_api.verify_chain() from authenticated;

------------------------------------------------------------------------------------------------
-- Genesis
------------------------------------------------------------------------------------------------

insert into kernel.actors (id, kind, label) values (kernel.kernel_actor_id(), 'service', 'kernel');

insert into kernel.events (type, scope, actor_id, auth_method, payload)
values (
  'kernel.genesis', 'system', kernel.kernel_actor_id(), 'kernel',
  jsonb_build_object('kernel_version', 1, 'kernel_actor_id', kernel.kernel_actor_id())
);
