-- solve kernel v2: verified outcomes, economic entitlements and settlement.
-- docs/plans/2026-10-03-monetary-proof-of-life.md
--
-- Laws enforced here:
--   1. An entitlement exists only for an obligation recorded in a World and completed by an outcome
--      event, under the current version of an active reward policy, with the independent evidence
--      the policy requires. Evidence from the beneficiary's own party never counts.
--   2. One obligation, one beneficiary, one policy: one entitlement and one settlement id,
--      settlement_id = sha256('solve:settlement:v1|' || obligation || '|' || beneficiary || '|' || policy_key).
--      Request ids play no part, so no request can settle an obligation twice.
--   3. The obligation fixes attribution. Shares across its beneficiaries sum to at most 10,000 bps.
--   4. The kernel cannot create money. Entitlements draw down the Earn allocation the chain
--      observer recorded, which may never go negative; confirmations draw down the on-chain mirror.
--   5. A settlement moves prepared -> submitted -> confirmed | failed | needs_reconciliation and is
--      confirmed at most once.
--   6. Reusing an idempotency key with a different payload fails.

------------------------------------------------------------------------------------------------
-- Storage (append-only, like every kernel table)
------------------------------------------------------------------------------------------------

-- One settlement rail per chain: which asset settles there, the mint and settlement authority on
-- chain, and the kernel accounts that mirror the Earn Vault.
create table kernel.settlement_rails (
  chain text primary key check (chain in ('litesvm', 'solana-devnet', 'solana-mainnet')),
  chain_scope text not null unique check (kernel.is_scope(chain_scope)),
  asset text not null references kernel.assets (code),
  mint_address text not null check (mint_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  settlement_authority text not null check (settlement_authority ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  onchain_account uuid not null references kernel.accounts (id),
  unallocated_account uuid not null references kernel.accounts (id),
  payable_account uuid not null references kernel.accounts (id),
  event_id uuid not null unique references kernel.events (id),
  created_at timestamptz not null default now()
);

-- Versioned reward policies. Required evidence never includes self_reported.
create table kernel.reward_policies (
  policy_key text not null check (policy_key ~ '^[a-z][a-z0-9_.-]{1,63}$'),
  version integer not null check (version >= 1),
  active boolean not null,
  chain text not null references kernel.settlement_rails (chain),
  outcome_type text not null check (kernel.is_event_type(outcome_type)),
  amount numeric(38, 0) not null check (amount > 0),
  max_per_release numeric(38, 0) not null check (max_per_release > 0),
  total_cap numeric(38, 0) not null check (total_cap > 0),
  required_bases text[] not null check (
    cardinality(required_bases) >= 1
    and required_bases <@ array['witnessed', 'artifact', 'system_observed', 'externally_verified']::text[]
  ),
  min_independent_parties integer not null check (min_independent_parties between 1 and 20),
  event_id uuid not null unique references kernel.events (id),
  created_at timestamptz not null default now(),
  primary key (policy_key, version)
);

create table kernel.wallet_links (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references kernel.actors (id),
  chain text not null check (chain in ('litesvm', 'solana-devnet', 'solana-mainnet')),
  address text not null check (address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  event_id uuid not null unique references kernel.events (id),
  created_at timestamptz not null default now(),
  unique (chain, address)
);

create index wallet_links_actor on kernel.wallet_links (actor_id);

create table kernel.entitlements (
  id uuid primary key default gen_random_uuid(),
  settlement_id text not null unique check (settlement_id ~ '^[0-9a-f]{64}$'),
  obligation_event_id uuid not null references kernel.events (id),
  outcome_event_id uuid not null references kernel.events (id),
  beneficiary_id uuid not null references kernel.actors (id),
  world_scope text not null check (kernel.is_scope(world_scope)),
  policy_key text not null,
  policy_version integer not null,
  attribution_bps integer not null check (attribution_bps between 1 and 10000),
  asset text not null references kernel.assets (code),
  amount numeric(38, 0) not null check (amount > 0),
  evidence_root text not null check (evidence_root ~ '^sha256:[0-9a-f]{64}$'),
  event_id uuid not null unique references kernel.events (id),
  created_at timestamptz not null default now(),
  foreign key (policy_key, policy_version) references kernel.reward_policies (policy_key, version),
  unique (obligation_event_id, beneficiary_id, policy_key)
);

create index entitlements_beneficiary on kernel.entitlements (beneficiary_id);
create index entitlements_policy on kernel.entitlements (policy_key);

create table kernel.settlements (
  settlement_id text primary key references kernel.entitlements (settlement_id),
  chain text not null references kernel.settlement_rails (chain),
  recipient_address text not null check (recipient_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  asset text not null references kernel.assets (code),
  amount numeric(38, 0) not null check (amount > 0),
  event_id uuid not null unique references kernel.events (id),
  created_at timestamptz not null default now()
);

create table kernel.settlement_transitions (
  id bigint generated always as identity primary key,
  settlement_id text not null references kernel.settlements (settlement_id),
  status text not null check (status in ('submitted', 'confirmed', 'failed', 'needs_reconciliation')),
  tx_signature text check (tx_signature ~ '^[1-9A-HJ-NP-Za-km-z]{64,90}$'),
  slot bigint check (slot >= 0),
  detail text not null default '' check (length(detail) <= 2000),
  event_id uuid not null unique references kernel.events (id),
  created_at timestamptz not null default now(),
  check (status not in ('submitted', 'confirmed') or tx_signature is not null)
);

create index settlement_transitions_settlement on kernel.settlement_transitions (settlement_id, id);
create unique index settlement_confirmed_once on kernel.settlement_transitions (settlement_id) where status = 'confirmed';

do $$
declare
  t text;
begin
  foreach t in array array[
    'settlement_rails', 'reward_policies', 'wallet_links', 'entitlements', 'settlements', 'settlement_transitions'
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

-- Checked at commit: shares of one obligation under one policy never exceed the whole.
create function kernel.check_attribution() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (
    select sum(e.attribution_bps) from kernel.entitlements e
    where e.obligation_event_id = new.obligation_event_id and e.policy_key = new.policy_key
  ) > 10000 then
    raise exception using errcode = 'KA003', message = 'attribution for one obligation cannot exceed 100%';
  end if;
  return null;
end;
$$;

create constraint trigger entitlements_attribution_conserved
after insert on kernel.entitlements
deferrable initially deferred
for each row execute function kernel.check_attribution();

------------------------------------------------------------------------------------------------
-- Internals
------------------------------------------------------------------------------------------------

-- Idempotent replay that also compares the payload: a reused key with a changed request fails.
create function kernel.replay_exact(p_actor uuid, p_key text, p_type text, p_scope text, p_payload jsonb)
returns uuid
language plpgsql stable set search_path = '' as $$
declare
  v_original record;
begin
  if p_key is null then
    return null;
  end if;
  select e.id, e.type, e.scope, e.payload into v_original
  from kernel.events e where e.actor_id = p_actor and e.idempotency_key = p_key;
  if not found then
    return null;
  end if;
  if v_original.type <> p_type or v_original.scope <> p_scope or v_original.payload is distinct from p_payload then
    raise exception using errcode = 'KA004', message = 'idempotency key already used for a different request';
  end if;
  return v_original.id;
end;
$$;

-- Posts a balanced transaction. Callers have already checked authority. Entries are
-- [{account_id, amount}] with amount as an integer string; positive debits, negative credits.
create function kernel.post_entries(
  p_caller kernel.caller,
  p_scope text,
  p_grant uuid,
  p_entries jsonb,
  p_memo text,
  p_idempotency_key text default null,
  p_correlation_id uuid default null
) returns uuid
language plpgsql set search_path = '' as $$
declare
  v_event uuid;
begin
  perform 1 from kernel.accounts a
  where a.id in (select (x ->> 'account_id')::uuid from jsonb_array_elements(p_entries) x)
  order by a.id
  for update;

  if exists (
    select 1 from jsonb_array_elements(p_entries) x
    left join kernel.accounts a on a.id = (x ->> 'account_id')::uuid
    where a.id is null
  ) then
    raise exception using errcode = 'KA007', message = 'account not found';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_entries) x
    join kernel.accounts a on a.id = (x ->> 'account_id')::uuid
    group by a.asset
    having sum((x ->> 'amount')::numeric) <> 0
  ) then
    raise exception using errcode = 'KA003', message = 'entries must balance per asset';
  end if;

  v_event := kernel.append_event(
    p_caller, 'kernel.ledger.posted', p_scope, p_grant,
    jsonb_build_object('entries', p_entries, 'memo', coalesce(p_memo, '')),
    null, p_idempotency_key, p_correlation_id
  );

  insert into kernel.ledger_entries (event_id, account_id, asset, amount)
  select v_event, (x.value ->> 'account_id')::uuid, a.asset, (x.value ->> 'amount')::numeric
  from jsonb_array_elements(p_entries) with ordinality x(value, ord)
  join kernel.accounts a on a.id = (x.value ->> 'account_id')::uuid
  order by x.ord;

  if exists (
    select 1 from kernel.accounts a
    where a.id in (select (x ->> 'account_id')::uuid from jsonb_array_elements(p_entries) x)
      and not a.allow_negative
      and kernel.natural_balance(a.id) < 0
  ) then
    raise exception using errcode = 'KA005', message = 'insufficient balance';
  end if;

  return v_event;
end;
$$;

create function kernel.settlement_status(p_settlement_id text) returns text
language sql stable set search_path = '' as $$
  select coalesce(
    (select t.status from kernel.settlement_transitions t
     where t.settlement_id = p_settlement_id order by t.id desc limit 1),
    'prepared'
  );
$$;

create function kernel.settlement_signature(p_settlement_id text) returns text
language sql stable set search_path = '' as $$
  select t.tx_signature from kernel.settlement_transitions t
  where t.settlement_id = p_settlement_id and t.tx_signature is not null
  order by t.id desc limit 1;
$$;

create function kernel.settlement_transition_allowed(p_from text, p_to text) returns boolean
language sql immutable set search_path = '' as $$
  select (p_from, p_to) in (
    ('prepared', 'submitted'), ('prepared', 'failed'),
    ('submitted', 'confirmed'), ('submitted', 'failed'), ('submitted', 'needs_reconciliation'),
    ('needs_reconciliation', 'confirmed'), ('needs_reconciliation', 'failed'), ('needs_reconciliation', 'submitted'),
    ('failed', 'submitted')
  );
$$;

------------------------------------------------------------------------------------------------
-- kernel_api: corrections to v1
------------------------------------------------------------------------------------------------

-- record_event now rejects a reused idempotency key whose payload differs (law 6).
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
  v_authority := kernel.require_grant(c.actor_id, p_type, p_scope);

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

-- post_transaction now shares kernel.post_entries with kernel-policy postings.
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
  v_entry jsonb;
  v_entries jsonb := '[]'::jsonb;
  v_account text;
  v_amount text;
  v_event uuid;
begin
  perform kernel.require_scope(p_scope);
  if p_entries is null or jsonb_typeof(p_entries) <> 'array'
     or jsonb_array_length(p_entries) not between 2 and 100 then
    raise exception using errcode = 'KA003', message = 'entries must be an array of 2 to 100 items';
  end if;
  if length(coalesce(p_memo, '')) > 500 then
    raise exception using errcode = 'KA003', message = 'memo is limited to 500 characters';
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

  perform kernel.lock_chain();
  v_event := kernel.replay(c.actor_id, p_idempotency_key, 'kernel.ledger.posted', p_scope);
  if v_event is not null then
    return v_event;
  end if;
  v_authority := kernel.require_grant(c.actor_id, 'kernel.ledger.post', p_scope);

  if exists (
    select 1 from jsonb_array_elements(v_entries) x
    join kernel.accounts a on a.id = (x ->> 'account_id')::uuid
    where (x ->> 'amount')::numeric < 0 and not kernel.scope_covers(p_scope, a.scope)
  ) then
    raise exception using errcode = 'KA002', message = 'cannot credit an account outside the posting scope';
  end if;

  v_event := kernel.post_entries(c, p_scope, v_authority, v_entries, p_memo, p_idempotency_key, p_correlation_id);
  perform kernel.attach(c, v_event, coalesce(p_evidence, '[]'::jsonb), v_authority);
  return v_event;
end;
$$;

------------------------------------------------------------------------------------------------
-- kernel_api: rails and policies (system authority)
------------------------------------------------------------------------------------------------

-- Registers the settlement rail for a chain. The three accounts must mirror the Earn Vault inside
-- the chain scope: on-chain holdings (debit), unallocated allocation (credit), payable (credit).
create function kernel_api.register_rail(
  p_chain text,
  p_mint_address text,
  p_settlement_authority text,
  p_onchain_account uuid,
  p_unallocated_account uuid,
  p_payable_account uuid,
  p_as_actor uuid default null
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  v_scope text := 'system/chain:' || p_chain;
  v_authority uuid;
  v_asset text;
  v_event uuid;
begin
  if p_chain is null or p_chain not in ('litesvm', 'solana-devnet', 'solana-mainnet') then
    raise exception using errcode = 'KA003', message = 'unknown chain';
  end if;
  perform kernel.lock_chain();
  if exists (select 1 from kernel.settlement_rails r where r.chain = p_chain) then
    raise exception using errcode = 'KA004', message = format('a rail for %s already exists', p_chain);
  end if;
  v_authority := kernel.require_grant(c.actor_id, 'kernel.rail.register', v_scope);

  select a.asset into v_asset from kernel.accounts a where a.id = p_onchain_account;
  if v_asset is null
     or not exists (select 1 from kernel.accounts a where a.id = p_onchain_account and a.normal_balance = 'debit'
                    and not a.allow_negative and kernel.scope_covers(v_scope, a.scope))
     or not exists (select 1 from kernel.accounts a where a.id = p_unallocated_account and a.normal_balance = 'credit'
                    and not a.allow_negative and a.asset = v_asset and kernel.scope_covers(v_scope, a.scope))
     or not exists (select 1 from kernel.accounts a where a.id = p_payable_account and a.normal_balance = 'credit'
                    and not a.allow_negative and a.asset = v_asset and kernel.scope_covers(v_scope, a.scope)) then
    raise exception using errcode = 'KA003',
      message = 'rail accounts must be non-negative accounts of one asset inside the chain scope: on-chain debit, unallocated and payable credit';
  end if;

  v_event := kernel.append_event(
    c, 'kernel.rail.registered', v_scope, v_authority,
    jsonb_build_object('chain', p_chain, 'asset', v_asset, 'mint_address', p_mint_address,
                       'settlement_authority', p_settlement_authority, 'onchain_account', p_onchain_account,
                       'unallocated_account', p_unallocated_account, 'payable_account', p_payable_account)
  );
  insert into kernel.settlement_rails (chain, chain_scope, asset, mint_address, settlement_authority,
                                       onchain_account, unallocated_account, payable_account, event_id)
  values (p_chain, v_scope, v_asset, p_mint_address, p_settlement_authority,
          p_onchain_account, p_unallocated_account, p_payable_account, v_event);
  return p_chain;
end;
$$;

-- Defines the next version of a reward policy. Amounts are integer strings in minor units.
create function kernel_api.define_reward_policy(
  p_policy_key text,
  p_chain text,
  p_outcome_type text,
  p_amount text,
  p_max_per_release text,
  p_total_cap text,
  p_required_bases text[],
  p_min_independent_parties integer default 1,
  p_active boolean default true,
  p_as_actor uuid default null
) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  v_rail kernel.settlement_rails;
  v_authority uuid;
  v_version integer;
  v_event uuid;
begin
  select * into v_rail from kernel.settlement_rails r where r.chain = p_chain;
  if not found then
    raise exception using errcode = 'KA007', message = 'no settlement rail for that chain';
  end if;
  if coalesce(p_amount, '') !~ '^[1-9][0-9]{0,37}$' or coalesce(p_max_per_release, '') !~ '^[1-9][0-9]{0,37}$'
     or coalesce(p_total_cap, '') !~ '^[1-9][0-9]{0,37}$' then
    raise exception using errcode = 'KA003', message = 'amounts must be positive integers in minor units';
  end if;
  if not kernel.is_event_type(p_outcome_type) or p_outcome_type like 'kernel.%' then
    raise exception using errcode = 'KA003', message = 'invalid outcome type';
  end if;

  perform kernel.lock_chain();
  v_authority := kernel.require_grant(c.actor_id, 'kernel.policy.define', v_rail.chain_scope);
  select coalesce(max(p.version), 0) + 1 into v_version from kernel.reward_policies p where p.policy_key = p_policy_key;

  v_event := kernel.append_event(
    c, 'kernel.policy.defined', v_rail.chain_scope, v_authority,
    jsonb_build_object('policy_key', p_policy_key, 'version', v_version, 'active', coalesce(p_active, true),
                       'chain', p_chain, 'outcome_type', p_outcome_type, 'amount', p_amount,
                       'max_per_release', p_max_per_release, 'total_cap', p_total_cap,
                       'required_bases', to_jsonb(p_required_bases),
                       'min_independent_parties', p_min_independent_parties)
  );
  insert into kernel.reward_policies (policy_key, version, active, chain, outcome_type, amount, max_per_release,
                                      total_cap, required_bases, min_independent_parties, event_id)
  values (p_policy_key, v_version, coalesce(p_active, true), p_chain, p_outcome_type, p_amount::numeric,
          p_max_per_release::numeric, p_total_cap::numeric, p_required_bases, p_min_independent_parties, v_event);
  return v_version;
end;
$$;

------------------------------------------------------------------------------------------------
-- kernel_api: wallets, entitlements, settlements
------------------------------------------------------------------------------------------------

-- Links a chain address to the calling actor. An address belongs to one actor per chain.
create function kernel_api.link_wallet(p_chain text, p_address text, p_as_actor uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  v_scope text := 'actor:' || c.actor_id;
  v_existing kernel.wallet_links;
  v_authority uuid;
  v_id uuid := gen_random_uuid();
  v_event uuid;
begin
  if p_chain is null or p_chain not in ('litesvm', 'solana-devnet', 'solana-mainnet') then
    raise exception using errcode = 'KA003', message = 'unknown chain';
  end if;
  if coalesce(p_address, '') !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' then
    raise exception using errcode = 'KA003', message = 'invalid address';
  end if;
  perform kernel.lock_chain();
  select * into v_existing from kernel.wallet_links w where w.chain = p_chain and w.address = p_address;
  if found then
    if v_existing.actor_id = c.actor_id then
      return v_existing.id;
    end if;
    raise exception using errcode = 'KA004', message = 'that address is linked to another actor';
  end if;
  v_authority := kernel.require_grant(c.actor_id, 'kernel.wallet.link', v_scope);
  v_event := kernel.append_event(
    c, 'kernel.wallet.linked', v_scope, v_authority,
    jsonb_build_object('wallet_id', v_id, 'chain', p_chain, 'address', p_address)
  );
  insert into kernel.wallet_links (id, actor_id, chain, address, event_id) values (v_id, c.actor_id, p_chain, p_address, v_event);
  return v_id;
end;
$$;

-- Verifies an outcome against the current policy and creates the economic entitlement.
-- Requires entitlement.create on the World. Exact retries return the original entitlement.
create function kernel_api.create_entitlement(
  p_obligation_event_id uuid,
  p_outcome_event_id uuid,
  p_beneficiary_id uuid,
  p_policy_key text,
  p_policy_version integer,
  p_as_actor uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  v_obligation kernel.events;
  v_outcome kernel.events;
  v_policy kernel.reward_policies;
  v_current_version integer;
  v_rail kernel.settlement_rails;
  v_existing kernel.entitlements;
  v_authority uuid;
  v_share integer;
  v_declared integer;
  v_settlement text;
  v_parties integer;
  v_root text;
  v_amount numeric;
  v_issued numeric;
  v_id uuid := gen_random_uuid();
  v_event uuid;
  v_beneficiary_party uuid := kernel.party_of(p_beneficiary_id);
begin
  perform kernel.lock_chain();
  if v_beneficiary_party is null then
    raise exception using errcode = 'KA007', message = 'beneficiary not found';
  end if;

  select * into v_obligation from kernel.events e where e.id = p_obligation_event_id;
  if not found or v_obligation.type <> 'obligation.created' then
    raise exception using errcode = 'KA007', message = 'obligation not found';
  end if;
  if split_part(split_part(v_obligation.scope, '/', 1), ':', 1) <> 'world' then
    raise exception using errcode = 'KA003', message = 'obligations must belong to a World';
  end if;
  v_authority := kernel.require_grant(c.actor_id, 'entitlement.create', v_obligation.scope);

  if v_obligation.payload ->> 'policy_key' is distinct from p_policy_key then
    raise exception using errcode = 'KA003', message = 'the obligation is not governed by that policy';
  end if;

  select sum((b ->> 'attribution_bps')::integer),
         max(case when b ->> 'actor_id' = p_beneficiary_id::text then (b ->> 'attribution_bps')::integer end)
  into v_declared, v_share
  from jsonb_array_elements(coalesce(v_obligation.payload -> 'beneficiaries', '[]'::jsonb)) b;
  if v_share is null then
    raise exception using errcode = 'KA003', message = 'the beneficiary is not named by the obligation';
  end if;
  if v_declared > 10000 or v_share not between 1 and 10000 then
    raise exception using errcode = 'KA003', message = 'obligation attribution must total at most 10000 bps';
  end if;

  select max(p.version) into v_current_version from kernel.reward_policies p where p.policy_key = p_policy_key;
  select * into v_policy from kernel.reward_policies p where p.policy_key = p_policy_key and p.version = p_policy_version;
  if not found or p_policy_version <> v_current_version or not v_policy.active then
    raise exception using errcode = 'KA003', message = 'stale or inactive policy version';
  end if;
  select * into v_rail from kernel.settlement_rails r where r.chain = v_policy.chain;

  select * into v_outcome from kernel.events e where e.id = p_outcome_event_id;
  if not found or v_outcome.type <> v_policy.outcome_type or v_outcome.scope <> v_obligation.scope
     or v_outcome.payload ->> 'obligation_event_id' is distinct from p_obligation_event_id::text then
    raise exception using errcode = 'KA003', message = 'the outcome does not complete this obligation';
  end if;

  v_settlement := encode(sha256(convert_to(
    'solve:settlement:v1|' || p_obligation_event_id || '|' || p_beneficiary_id || '|' || p_policy_key, 'UTF8')), 'hex');

  select * into v_existing from kernel.entitlements x where x.settlement_id = v_settlement;
  if found then
    if v_existing.outcome_event_id = p_outcome_event_id and v_existing.policy_version = p_policy_version then
      return v_existing.id;
    end if;
    raise exception using errcode = 'KA004', message = 'this obligation already has an entitlement for that beneficiary';
  end if;

  -- Independent evidence: distinct parties other than the beneficiary's, with a required basis.
  select count(distinct coalesce(a.on_behalf_of, kernel.party_of(a.actor_id))) into v_parties
  from kernel.evidence ev
  join kernel.events a on a.id = ev.attached_by_event
  where ev.event_id = p_outcome_event_id
    and ev.basis = any (v_policy.required_bases)
    and coalesce(a.on_behalf_of, kernel.party_of(a.actor_id)) is distinct from v_beneficiary_party;
  if v_parties < v_policy.min_independent_parties then
    raise exception using errcode = 'KA003',
      message = format('insufficient independent evidence: %s of %s required parties', v_parties, v_policy.min_independent_parties);
  end if;

  select 'sha256:' || encode(sha256(convert_to(string_agg(h, ',' order by h), 'UTF8')), 'hex') into v_root
  from (select distinct ev.content_hash as h from kernel.evidence ev where ev.event_id = p_outcome_event_id) hashes;

  v_amount := floor(v_policy.amount * v_share / 10000);
  if v_amount <= 0 then
    raise exception using errcode = 'KA003', message = 'attribution too small for a release';
  end if;
  if v_amount > v_policy.max_per_release then
    raise exception using errcode = 'KA003', message = 'release exceeds the policy maximum';
  end if;
  select coalesce(sum(x.amount), 0) into v_issued from kernel.entitlements x where x.policy_key = p_policy_key;
  if v_issued + v_amount > v_policy.total_cap then
    raise exception using errcode = 'KA005', message = 'policy allocation exhausted';
  end if;

  v_event := kernel.append_event(
    c, 'kernel.entitlement.created', v_obligation.scope, v_authority,
    jsonb_build_object(
      'entitlement_id', v_id, 'settlement_id', v_settlement, 'obligation_event_id', p_obligation_event_id,
      'outcome_event_id', p_outcome_event_id, 'beneficiary_id', p_beneficiary_id, 'policy_key', p_policy_key,
      'policy_version', p_policy_version, 'attribution_bps', v_share, 'asset', v_rail.asset,
      'amount', v_amount::text, 'evidence_root', v_root
    )
  );
  insert into kernel.entitlements (id, settlement_id, obligation_event_id, outcome_event_id, beneficiary_id, world_scope,
                                   policy_key, policy_version, attribution_bps, asset, amount, evidence_root, event_id)
  values (v_id, v_settlement, p_obligation_event_id, p_outcome_event_id, p_beneficiary_id, v_obligation.scope,
          p_policy_key, p_policy_version, v_share, v_rail.asset, v_amount, v_root, v_event);

  -- Kernel policy books the obligation against the Earn allocation, which cannot go negative.
  perform kernel.post_entries(
    kernel.kernel_caller(), v_rail.chain_scope, null,
    jsonb_build_array(
      jsonb_build_object('account_id', v_rail.unallocated_account, 'amount', v_amount::text),
      jsonb_build_object('account_id', v_rail.payable_account, 'amount', (-v_amount)::text)
    ),
    'entitlement ' || v_id, null, v_id
  );
  return v_id;
end;
$$;

-- Prepares the settlement of an entitlement to one of the beneficiary's linked wallets.
create function kernel_api.prepare_settlement(p_entitlement_id uuid, p_recipient_address text, p_as_actor uuid default null)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  v_entitlement kernel.entitlements;
  v_chain text;
  v_existing kernel.settlements;
  v_authority uuid;
  v_event uuid;
begin
  perform kernel.lock_chain();
  select * into v_entitlement from kernel.entitlements x where x.id = p_entitlement_id;
  if not found then
    raise exception using errcode = 'KA007', message = 'entitlement not found';
  end if;
  if c.actor_id = v_entitlement.beneficiary_id then
    v_authority := kernel.find_grant(c.actor_id, 'kernel.settlement.prepare', 'actor:' || c.actor_id);
  else
    v_authority := kernel.require_grant(c.actor_id, 'kernel.settlement.prepare', v_entitlement.world_scope);
  end if;

  select p.chain into v_chain from kernel.reward_policies p
  where p.policy_key = v_entitlement.policy_key and p.version = v_entitlement.policy_version;

  select * into v_existing from kernel.settlements s where s.settlement_id = v_entitlement.settlement_id;
  if found then
    if v_existing.recipient_address = p_recipient_address then
      return v_existing.settlement_id;
    end if;
    raise exception using errcode = 'KA004', message = 'this entitlement is already being settled to another wallet';
  end if;

  if not exists (
    select 1 from kernel.wallet_links w
    where w.actor_id = v_entitlement.beneficiary_id and w.chain = v_chain and w.address = p_recipient_address
  ) then
    raise exception using errcode = 'KA003', message = 'the recipient is not a linked wallet of the beneficiary';
  end if;

  v_event := kernel.append_event(
    c, 'kernel.settlement.prepared', v_entitlement.world_scope, v_authority,
    jsonb_build_object('settlement_id', v_entitlement.settlement_id, 'entitlement_id', p_entitlement_id,
                       'chain', v_chain, 'recipient_address', p_recipient_address,
                       'asset', v_entitlement.asset, 'amount', v_entitlement.amount::text)
  );
  insert into kernel.settlements (settlement_id, chain, recipient_address, asset, amount, event_id)
  values (v_entitlement.settlement_id, v_chain, p_recipient_address, v_entitlement.asset, v_entitlement.amount, v_event);
  return v_entitlement.settlement_id;
end;
$$;

-- Records a settlement state change observed by the settlement service. Confirmation requires
-- chain evidence and books the release against the on-chain mirror, exactly once.
create function kernel_api.record_settlement(
  p_settlement_id text,
  p_status text,
  p_tx_signature text default null,
  p_slot bigint default null,
  p_detail text default '',
  p_evidence jsonb default '[]'::jsonb,
  p_as_actor uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  v_settlement kernel.settlements;
  v_rail kernel.settlement_rails;
  v_authority uuid;
  v_current text;
  v_last kernel.settlement_transitions;
  v_event uuid;
  v_entitlement uuid;
begin
  perform kernel.lock_chain();
  select * into v_settlement from kernel.settlements s where s.settlement_id = p_settlement_id;
  if not found then
    raise exception using errcode = 'KA007', message = 'settlement not found';
  end if;
  select * into v_rail from kernel.settlement_rails r where r.chain = v_settlement.chain;
  v_authority := kernel.require_grant(c.actor_id, 'kernel.settlement.record', v_rail.chain_scope);

  select * into v_last from kernel.settlement_transitions t where t.settlement_id = p_settlement_id order by t.id desc limit 1;
  v_current := coalesce(v_last.status, 'prepared');
  -- Exact retry of the last transition returns it.
  if v_last.status = p_status and v_last.tx_signature is not distinct from p_tx_signature then
    return v_last.event_id;
  end if;
  if not kernel.settlement_transition_allowed(v_current, p_status) then
    raise exception using errcode = 'KA003', message = format('settlement cannot move from %s to %s', v_current, p_status);
  end if;
  if p_status = 'confirmed' and jsonb_array_length(coalesce(p_evidence, '[]'::jsonb)) = 0 then
    raise exception using errcode = 'KA003', message = 'confirmation requires chain evidence';
  end if;

  v_event := kernel.append_event(
    c, 'kernel.settlement.' || p_status, v_rail.chain_scope, v_authority,
    jsonb_build_object('settlement_id', p_settlement_id, 'status', p_status, 'tx_signature', p_tx_signature,
                       'slot', p_slot, 'detail', coalesce(p_detail, ''))
  );
  insert into kernel.settlement_transitions (settlement_id, status, tx_signature, slot, detail, event_id)
  values (p_settlement_id, p_status, p_tx_signature, p_slot, coalesce(p_detail, ''), v_event);
  perform kernel.attach(c, v_event, coalesce(p_evidence, '[]'::jsonb), v_authority);

  if p_status = 'confirmed' then
    select x.id into v_entitlement from kernel.entitlements x where x.settlement_id = p_settlement_id;
    perform kernel.post_entries(
      kernel.kernel_caller(), v_rail.chain_scope, null,
      jsonb_build_array(
        jsonb_build_object('account_id', v_rail.payable_account, 'amount', v_settlement.amount::text),
        jsonb_build_object('account_id', v_rail.onchain_account, 'amount', (-v_settlement.amount)::text)
      ),
      'settlement ' || p_settlement_id, null, v_entitlement
    );
  end if;
  return v_event;
end;
$$;

------------------------------------------------------------------------------------------------
-- kernel_api: reads
------------------------------------------------------------------------------------------------

-- Public rail facts (no secrets): which asset settles where.
create function kernel_api.read_rail(p_chain text)
returns table (chain text, asset text, mint_address text, settlement_authority text)
language sql stable security definer set search_path = '' as $$
  select r.chain, r.asset, r.mint_address, r.settlement_authority from kernel.settlement_rails r where r.chain = p_chain;
$$;

create function kernel_api.my_wallets(p_as_actor uuid default null)
returns table (id uuid, chain text, address text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
begin
  return query select w.id, w.chain, w.address, w.created_at from kernel.wallet_links w
    where w.actor_id = c.actor_id order by w.created_at, w.id;
end;
$$;

-- The caller's entitlements with their settlement state.
create function kernel_api.my_entitlements(p_as_actor uuid default null)
returns table (
  entitlement_id uuid, settlement_id text, world_scope text, obligation_event_id uuid, outcome_event_id uuid,
  policy_key text, policy_version integer, attribution_bps integer, asset text, amount text, evidence_root text,
  created_at timestamptz, chain text, recipient_address text, status text, tx_signature text
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
begin
  return query
    select x.id, x.settlement_id, x.world_scope, x.obligation_event_id, x.outcome_event_id, x.policy_key,
           x.policy_version, x.attribution_bps, x.asset, x.amount::text, x.evidence_root, x.created_at,
           s.chain, s.recipient_address,
           case when s.settlement_id is null then 'unsettled' else kernel.settlement_status(x.settlement_id) end,
           kernel.settlement_signature(x.settlement_id)
    from kernel.entitlements x
    left join kernel.settlements s on s.settlement_id = x.settlement_id
    where x.beneficiary_id = c.actor_id
    order by x.created_at, x.id;
end;
$$;

-- One settlement, for its beneficiary or the settlement service.
create function kernel_api.read_settlement(p_settlement_id text, p_as_actor uuid default null)
returns table (
  settlement_id text, entitlement_id uuid, beneficiary_id uuid, chain text, recipient_address text,
  asset text, amount text, status text, tx_signature text
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  v_settlement kernel.settlements;
  v_beneficiary uuid;
  v_scope text;
begin
  select * into v_settlement from kernel.settlements s where s.settlement_id = p_settlement_id;
  if not found then
    raise exception using errcode = 'KA007', message = 'settlement not found';
  end if;
  select x.beneficiary_id into v_beneficiary from kernel.entitlements x where x.settlement_id = p_settlement_id;
  select r.chain_scope into v_scope from kernel.settlement_rails r where r.chain = v_settlement.chain;
  if c.actor_id <> v_beneficiary then
    perform kernel.require_grant(c.actor_id, 'kernel.settlement.record', v_scope);
  end if;
  return query
    select v_settlement.settlement_id, x.id, x.beneficiary_id, v_settlement.chain, v_settlement.recipient_address,
           v_settlement.asset, v_settlement.amount::text, kernel.settlement_status(p_settlement_id),
           kernel.settlement_signature(p_settlement_id)
    from kernel.entitlements x where x.settlement_id = p_settlement_id;
end;
$$;

-- Settlements awaiting work, for the settlement service.
create function kernel_api.pending_settlements(p_chain text, p_limit integer default 50, p_as_actor uuid default null)
returns table (settlement_id text, status text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  v_scope text;
begin
  select r.chain_scope into v_scope from kernel.settlement_rails r where r.chain = p_chain;
  if v_scope is null then
    raise exception using errcode = 'KA007', message = 'no settlement rail for that chain';
  end if;
  perform kernel.require_grant(c.actor_id, 'kernel.settlement.record', v_scope);
  return query
    select s.settlement_id, kernel.settlement_status(s.settlement_id), s.created_at
    from kernel.settlements s
    where s.chain = p_chain and kernel.settlement_status(s.settlement_id) <> 'confirmed'
    order by s.created_at, s.settlement_id
    limit least(greatest(coalesce(p_limit, 50), 1), 500);
end;
$$;

------------------------------------------------------------------------------------------------
-- Privileges
------------------------------------------------------------------------------------------------

revoke all on all tables in schema kernel from public, anon, authenticated, service_role;
revoke all on all sequences in schema kernel from public, anon, authenticated, service_role;
revoke all on all functions in schema kernel from public, anon, authenticated, service_role;
revoke all on all functions in schema kernel_api from public, anon;
grant execute on all functions in schema kernel_api to authenticated, service_role;
revoke execute on function kernel_api.verify_chain() from authenticated;
