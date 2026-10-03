-- solve kernel v3: payments between actors, routed across venues.
-- docs/plans/2026-10-03-payment-router.md
--
-- The chain holds the money; the kernel holds why it moved. A payment is recorded as:
--   intent  (payer, recipient, amount in a denomination asset, slippage bound)
--   route   (the executable quote the payer chose, per attempt)
--   transitions (routed -> submitted -> confirmed | failed | needs_reconciliation)
--
-- Laws enforced here:
--   1. A payment pays the recipient's published receiving address, pinned when the intent is
--      created. A route to any other address is rejected (recipient mismatch).
--   2. A route delivers only an asset the recipient accepts, and delivers the full amount when it
--      pays in the denomination asset.
--   3. A route's quote must be live: expired quotes are rejected, and quotes live at most 120 s.
--   4. The input a payment may consume is bounded by the intent's slippage tolerance, at
--      selection and again at submission.
--   5. One transaction per attempt. A new route may be chosen only after the previous attempt
--      definitively failed. A payment is confirmed at most once, with chain evidence.
--   6. payment_id = sha256('solve:payment:v1|' || intent_id) names the on-chain marker that makes
--      a second execution impossible.
--   7. The kernel holds no balances for payments and no prices. Balances are read from the chain;
--      quotes are recorded as the venues gave them.

------------------------------------------------------------------------------------------------
-- Storage (append-only)
------------------------------------------------------------------------------------------------

-- Which mint carries a kernel asset on a chain.
create table kernel.chain_assets (
  chain text not null check (chain in ('litesvm', 'solana-devnet', 'solana-mainnet')),
  asset text not null references kernel.assets (code),
  mint_address text not null check (mint_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  event_id uuid not null unique references kernel.events (id),
  created_at timestamptz not null default now(),
  primary key (chain, asset),
  unique (chain, mint_address)
);

-- What an actor accepts and where, per chain. Versioned; the latest version is current.
create table kernel.payment_profiles (
  actor_id uuid not null references kernel.actors (id),
  chain text not null check (chain in ('litesvm', 'solana-devnet', 'solana-mainnet')),
  version integer not null check (version >= 1),
  receive_address text not null check (receive_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  accept_assets text[] not null check (cardinality(accept_assets) between 1 and 16),
  event_id uuid not null unique references kernel.events (id),
  created_at timestamptz not null default now(),
  primary key (actor_id, chain, version)
);

create table kernel.payment_intents (
  id uuid primary key,
  payment_id text not null unique check (payment_id ~ '^[0-9a-f]{64}$'),
  payer_id uuid not null references kernel.actors (id),
  recipient_id uuid not null references kernel.actors (id),
  chain text not null,
  asset text not null,
  amount numeric(38, 0) not null check (amount > 0),
  max_slippage_bps integer not null check (max_slippage_bps between 0 and 1000),
  recipient_profile_version integer not null,
  recipient_address text not null,
  accept_assets text[] not null,
  memo text not null default '' check (length(memo) <= 200),
  event_id uuid not null unique references kernel.events (id),
  created_at timestamptz not null default now(),
  check (payer_id <> recipient_id),
  foreign key (chain, asset) references kernel.chain_assets (chain, asset),
  foreign key (recipient_id, chain, recipient_profile_version) references kernel.payment_profiles (actor_id, chain, version)
);

create index payment_intents_payer on kernel.payment_intents (payer_id);
create index payment_intents_recipient on kernel.payment_intents (recipient_id);

-- The route chosen for each attempt, with the executable quote it came from.
create table kernel.payment_routes (
  payment_id text not null references kernel.payment_intents (payment_id),
  attempt integer not null check (attempt >= 1),
  route jsonb not null check (jsonb_typeof(route) = 'object' and length(route::text) <= 32000),
  payer_address text not null check (payer_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  recipient_address text not null,
  input_asset text not null references kernel.assets (code),
  input_amount numeric(38, 0) not null check (input_amount > 0),
  max_input numeric(38, 0) not null check (max_input >= input_amount),
  deliver_asset text not null references kernel.assets (code),
  deliver_amount numeric(38, 0) not null check (deliver_amount > 0),
  quoted_at timestamptz not null,
  expires_at timestamptz not null check (expires_at > quoted_at),
  event_id uuid not null unique references kernel.events (id),
  created_at timestamptz not null default now(),
  primary key (payment_id, attempt)
);

create table kernel.payment_transitions (
  id bigint generated always as identity primary key,
  payment_id text not null,
  attempt integer not null,
  status text not null check (status in ('routed', 'submitted', 'confirmed', 'failed', 'needs_reconciliation')),
  tx_signature text check (tx_signature ~ '^[1-9A-HJ-NP-Za-km-z]{64,90}$'),
  input_amount numeric(38, 0) check (input_amount > 0),
  -- The signed transaction as submitted (base64), so it can be resent byte for byte.
  wire_transaction text check (wire_transaction ~ '^[A-Za-z0-9+/]+={0,2}$' and length(wire_transaction) <= 2400),
  slot bigint check (slot >= 0),
  detail text not null default '' check (length(detail) <= 2000),
  event_id uuid not null references kernel.events (id),
  created_at timestamptz not null default now(),
  foreign key (payment_id, attempt) references kernel.payment_routes (payment_id, attempt),
  check (status <> 'submitted' or (tx_signature is not null and input_amount is not null and wire_transaction is not null)),
  check (status <> 'confirmed' or tx_signature is not null)
);

create index payment_transitions_payment on kernel.payment_transitions (payment_id, id);
create unique index payment_transitions_event on kernel.payment_transitions (event_id);
create unique index payment_confirmed_once on kernel.payment_transitions (payment_id) where status = 'confirmed';

do $$
declare
  t text;
begin
  foreach t in array array['chain_assets', 'payment_profiles', 'payment_intents', 'payment_routes', 'payment_transitions'] loop
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

------------------------------------------------------------------------------------------------
-- Internals
------------------------------------------------------------------------------------------------

create function kernel.payment_status(p_payment_id text) returns text
language sql stable set search_path = '' as $$
  select coalesce(
    (select t.status from kernel.payment_transitions t where t.payment_id = p_payment_id order by t.id desc limit 1),
    'created'
  );
$$;

create function kernel.payment_attempt(p_payment_id text) returns integer
language sql stable set search_path = '' as $$
  select coalesce(max(r.attempt), 0) from kernel.payment_routes r where r.payment_id = p_payment_id;
$$;

-- The transaction submitted for an attempt (one per attempt).
create function kernel.payment_submission(p_payment_id text, p_attempt integer) returns kernel.payment_transitions
language sql stable set search_path = '' as $$
  select t.* from kernel.payment_transitions t
  where t.payment_id = p_payment_id and t.attempt = p_attempt and t.status = 'submitted'
  order by t.id limit 1;
$$;

create function kernel.payment_transition_allowed(p_from text, p_to text) returns boolean
language sql immutable set search_path = '' as $$
  select (p_from, p_to) in (
    ('routed', 'submitted'), ('routed', 'failed'),
    ('submitted', 'confirmed'), ('submitted', 'failed'), ('submitted', 'needs_reconciliation'),
    ('needs_reconciliation', 'confirmed'), ('needs_reconciliation', 'failed'), ('needs_reconciliation', 'submitted')
  );
$$;

create function kernel.latest_payment_profile(p_actor uuid, p_chain text) returns kernel.payment_profiles
language sql stable set search_path = '' as $$
  select p.* from kernel.payment_profiles p
  where p.actor_id = p_actor and p.chain = p_chain
  order by p.version desc limit 1;
$$;

------------------------------------------------------------------------------------------------
-- kernel_api: assets on chains (system authority)
------------------------------------------------------------------------------------------------

create function kernel_api.register_chain_asset(p_chain text, p_asset text, p_mint_address text, p_as_actor uuid default null)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  v_scope text := 'system/chain:' || p_chain;
  v_existing kernel.chain_assets;
  v_rail kernel.settlement_rails;
  v_authority uuid;
  v_event uuid;
begin
  if p_chain is null or p_chain not in ('litesvm', 'solana-devnet', 'solana-mainnet') then
    raise exception using errcode = 'KA003', message = 'unknown chain';
  end if;
  if coalesce(p_mint_address, '') !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' then
    raise exception using errcode = 'KA003', message = 'invalid mint address';
  end if;
  if not exists (select 1 from kernel.assets a where a.code = p_asset) then
    raise exception using errcode = 'KA007', message = 'asset not found';
  end if;
  perform kernel.lock_chain();
  v_authority := kernel.require_grant(c.actor_id, 'kernel.rail.register', v_scope);

  select * into v_existing from kernel.chain_assets x where x.chain = p_chain and x.asset = p_asset;
  if found then
    if v_existing.mint_address = p_mint_address then
      return p_asset;
    end if;
    raise exception using errcode = 'KA004', message = format('%s already has a mint on %s', p_asset, p_chain);
  end if;
  if exists (select 1 from kernel.chain_assets x where x.chain = p_chain and x.mint_address = p_mint_address) then
    raise exception using errcode = 'KA004', message = 'that mint already carries another asset';
  end if;
  select * into v_rail from kernel.settlement_rails r where r.chain = p_chain and r.asset = p_asset;
  if found and v_rail.mint_address <> p_mint_address then
    raise exception using errcode = 'KA003', message = 'the settlement rail names a different mint for this asset';
  end if;

  v_event := kernel.append_event(
    c, 'kernel.chain_asset.registered', v_scope, v_authority,
    jsonb_build_object('chain', p_chain, 'asset', p_asset, 'mint_address', p_mint_address)
  );
  insert into kernel.chain_assets (chain, asset, mint_address, event_id) values (p_chain, p_asset, p_mint_address, v_event);
  return p_asset;
end;
$$;

create function kernel_api.read_chain_assets(p_chain text)
returns table (asset text, mint_address text, decimals integer, label text)
language sql stable security definer set search_path = '' as $$
  select x.asset, x.mint_address, a.decimals, a.label
  from kernel.chain_assets x join kernel.assets a on a.code = x.asset
  where x.chain = p_chain
  order by x.asset;
$$;

------------------------------------------------------------------------------------------------
-- kernel_api: payment profiles
------------------------------------------------------------------------------------------------

-- Publishes where the caller receives payments on a chain and which assets it accepts.
create function kernel_api.set_payment_profile(
  p_chain text,
  p_receive_address text,
  p_accept_assets text[],
  p_as_actor uuid default null
) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  v_scope text := 'actor:' || c.actor_id;
  v_current kernel.payment_profiles;
  v_authority uuid;
  v_version integer;
  v_event uuid;
begin
  if p_accept_assets is null or cardinality(p_accept_assets) not between 1 and 16
     or (select count(distinct x) from unnest(p_accept_assets) x) <> cardinality(p_accept_assets) then
    raise exception using errcode = 'KA003', message = 'accept 1 to 16 distinct assets';
  end if;
  if exists (
    select 1 from unnest(p_accept_assets) x
    where not exists (select 1 from kernel.chain_assets ca where ca.chain = p_chain and ca.asset = x)
  ) then
    raise exception using errcode = 'KA003', message = 'every accepted asset must be registered on that chain';
  end if;
  perform kernel.lock_chain();
  v_authority := kernel.require_grant(c.actor_id, 'kernel.payment.profile', v_scope);
  if not exists (
    select 1 from kernel.wallet_links w where w.actor_id = c.actor_id and w.chain = p_chain and w.address = p_receive_address
  ) then
    raise exception using errcode = 'KA003', message = 'the receiving address must be one of your linked wallets';
  end if;

  v_current := kernel.latest_payment_profile(c.actor_id, p_chain);
  if v_current.version is not null and v_current.receive_address = p_receive_address
     and v_current.accept_assets = p_accept_assets then
    return v_current.version;
  end if;
  v_version := coalesce(v_current.version, 0) + 1;

  v_event := kernel.append_event(
    c, 'kernel.payment.profile_set', v_scope, v_authority,
    jsonb_build_object('chain', p_chain, 'version', v_version, 'receive_address', p_receive_address,
                       'accept_assets', to_jsonb(p_accept_assets))
  );
  insert into kernel.payment_profiles (actor_id, chain, version, receive_address, accept_assets, event_id)
  values (c.actor_id, p_chain, v_version, p_receive_address, p_accept_assets, v_event);
  return v_version;
end;
$$;

-- Any registered actor may look up where another actor receives payments.
create function kernel_api.read_payment_profile(p_actor_id uuid, p_chain text, p_as_actor uuid default null)
returns table (actor_id uuid, chain text, version integer, receive_address text, accept_assets text[])
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  v_profile kernel.payment_profiles := kernel.latest_payment_profile(p_actor_id, p_chain);
begin
  if v_profile.version is null then
    raise exception using errcode = 'KA007', message = 'that actor receives no payments on this chain';
  end if;
  return query select v_profile.actor_id, v_profile.chain, v_profile.version, v_profile.receive_address, v_profile.accept_assets;
end;
$$;

------------------------------------------------------------------------------------------------
-- kernel_api: payments
------------------------------------------------------------------------------------------------

-- Records the intent to pay an actor an amount of a denomination asset. Returns the payment id.
-- Exact retries with the same idempotency key return the same payment.
create function kernel_api.create_payment_intent(
  p_recipient_id uuid,
  p_chain text,
  p_asset text,
  p_amount text,
  p_max_slippage_bps integer default 100,
  p_memo text default '',
  p_idempotency_key text default null,
  p_as_actor uuid default null
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  v_scope text := 'actor:' || c.actor_id;
  v_request jsonb;
  v_original kernel.events;
  v_authority uuid;
  v_profile kernel.payment_profiles;
  v_id uuid := gen_random_uuid();
  v_payment text;
  v_event uuid;
begin
  if coalesce(p_amount, '') !~ '^[1-9][0-9]{0,37}$' then
    raise exception using errcode = 'KA003', message = 'amount must be a positive integer in minor units';
  end if;
  if p_max_slippage_bps is null or p_max_slippage_bps not between 0 and 1000 then
    raise exception using errcode = 'KA003', message = 'slippage tolerance must be 0 to 1000 bps';
  end if;
  if length(coalesce(p_memo, '')) > 200 then
    raise exception using errcode = 'KA003', message = 'memo is limited to 200 characters';
  end if;
  v_request := jsonb_build_object('recipient_id', p_recipient_id, 'chain', p_chain, 'asset', p_asset, 'amount', p_amount,
                                  'max_slippage_bps', p_max_slippage_bps, 'memo', coalesce(p_memo, ''));

  perform kernel.lock_chain();
  if p_idempotency_key is not null then
    select * into v_original from kernel.events e where e.actor_id = c.actor_id and e.idempotency_key = p_idempotency_key;
    if found then
      if v_original.type = 'kernel.payment.intended' and v_original.payload -> 'request' = v_request then
        return v_original.payload ->> 'payment_id';
      end if;
      raise exception using errcode = 'KA004', message = 'idempotency key already used for a different request';
    end if;
  end if;
  v_authority := kernel.require_grant(c.actor_id, 'kernel.payment.create', v_scope);

  if p_recipient_id is null or not exists (select 1 from kernel.actors a where a.id = p_recipient_id) then
    raise exception using errcode = 'KA007', message = 'recipient not found';
  end if;
  if p_recipient_id = c.actor_id then
    raise exception using errcode = 'KA003', message = 'a payment needs a different recipient';
  end if;
  if not exists (select 1 from kernel.chain_assets x where x.chain = p_chain and x.asset = p_asset) then
    raise exception using errcode = 'KA003', message = 'that asset is not registered on that chain';
  end if;
  v_profile := kernel.latest_payment_profile(p_recipient_id, p_chain);
  if v_profile.version is null then
    raise exception using errcode = 'KA003', message = 'the recipient receives no payments on that chain';
  end if;

  v_payment := encode(sha256(convert_to('solve:payment:v1|' || v_id, 'UTF8')), 'hex');
  v_event := kernel.append_event(
    c, 'kernel.payment.intended', v_scope, v_authority,
    jsonb_build_object('intent_id', v_id, 'payment_id', v_payment, 'request', v_request,
                       'recipient_profile_version', v_profile.version, 'recipient_address', v_profile.receive_address,
                       'accept_assets', to_jsonb(v_profile.accept_assets)),
    null, p_idempotency_key
  );
  insert into kernel.payment_intents (id, payment_id, payer_id, recipient_id, chain, asset, amount, max_slippage_bps,
                                      recipient_profile_version, recipient_address, accept_assets, memo, event_id)
  values (v_id, v_payment, c.actor_id, p_recipient_id, p_chain, p_asset, p_amount::numeric, p_max_slippage_bps,
          v_profile.version, v_profile.receive_address, v_profile.accept_assets, coalesce(p_memo, ''), v_event);
  return v_payment;
end;
$$;

-- The payer records the route it chose. Returns the attempt number.
create function kernel_api.select_payment_route(
  p_payment_id text,
  p_route jsonb,
  p_payer_address text,
  p_recipient_address text,
  p_input_asset text,
  p_input_amount text,
  p_max_input text,
  p_deliver_asset text,
  p_deliver_amount text,
  p_quoted_at timestamptz,
  p_expires_at timestamptz,
  p_as_actor uuid default null
) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  v_intent kernel.payment_intents;
  v_status text;
  v_last kernel.payment_routes;
  v_authority uuid;
  v_attempt integer;
  v_event uuid;
begin
  perform kernel.lock_chain();
  select * into v_intent from kernel.payment_intents i where i.payment_id = p_payment_id;
  if not found then
    raise exception using errcode = 'KA007', message = 'payment not found';
  end if;
  if c.actor_id <> v_intent.payer_id then
    raise exception using errcode = 'KA002', message = 'only the payer chooses the route';
  end if;
  v_authority := kernel.require_grant(c.actor_id, 'kernel.payment.route', 'actor:' || c.actor_id);

  v_status := kernel.payment_status(p_payment_id);
  select * into v_last from kernel.payment_routes r where r.payment_id = p_payment_id order by r.attempt desc limit 1;
  -- Exact retry of the current selection returns it.
  if v_status = 'routed' and v_last.route = p_route and v_last.payer_address = p_payer_address
     and v_last.recipient_address = p_recipient_address and v_last.input_asset = p_input_asset
     and v_last.input_amount::text = p_input_amount and v_last.max_input::text = p_max_input
     and v_last.deliver_asset = p_deliver_asset and v_last.deliver_amount::text = p_deliver_amount
     and v_last.quoted_at = p_quoted_at and v_last.expires_at = p_expires_at then
    return v_last.attempt;
  end if;
  if v_status not in ('created', 'failed') then
    raise exception using errcode = 'KA003', message = format('the payment is %s and cannot take a new route', v_status);
  end if;

  if p_quoted_at is null or p_expires_at is null or p_expires_at <= now() then
    raise exception using errcode = 'KA003', message = 'stale quote: it has expired';
  end if;
  if p_quoted_at > now() + interval '5 seconds' or p_expires_at - p_quoted_at > interval '120 seconds'
     or p_expires_at <= p_quoted_at then
    raise exception using errcode = 'KA003', message = 'quotes live at most 120 seconds from when they were made';
  end if;
  if p_recipient_address is distinct from v_intent.recipient_address then
    raise exception using errcode = 'KA003', message = 'recipient mismatch: the route pays an address the recipient did not publish';
  end if;
  if not exists (
    select 1 from kernel.wallet_links w
    where w.actor_id = c.actor_id and w.chain = v_intent.chain and w.address = p_payer_address
  ) then
    raise exception using errcode = 'KA003', message = 'the paying address must be one of your linked wallets';
  end if;
  if not (p_deliver_asset = any (v_intent.accept_assets)) then
    raise exception using errcode = 'KA003', message = 'the recipient does not accept that asset';
  end if;
  if not exists (select 1 from kernel.chain_assets x where x.chain = v_intent.chain and x.asset = p_input_asset) then
    raise exception using errcode = 'KA003', message = 'the input asset is not registered on that chain';
  end if;
  if coalesce(p_input_amount, '') !~ '^[1-9][0-9]{0,37}$' or coalesce(p_max_input, '') !~ '^[1-9][0-9]{0,37}$'
     or coalesce(p_deliver_amount, '') !~ '^[1-9][0-9]{0,37}$' then
    raise exception using errcode = 'KA003', message = 'amounts must be positive integers in minor units';
  end if;
  if p_max_input::numeric < p_input_amount::numeric
     or p_max_input::numeric > p_input_amount::numeric + div(p_input_amount::numeric * v_intent.max_slippage_bps + 9999, 10000) then
    raise exception using errcode = 'KA003', message = 'the input limit exceeds the slippage tolerance of the intent';
  end if;
  if p_deliver_asset = v_intent.asset and p_deliver_amount::numeric < v_intent.amount then
    raise exception using errcode = 'KA003', message = 'the route delivers less than the amount';
  end if;
  if p_route is null or jsonb_typeof(p_route) <> 'object' or length(p_route::text) > 32000 then
    raise exception using errcode = 'KA003', message = 'route must be a JSON object of at most 32000 characters';
  end if;

  v_attempt := kernel.payment_attempt(p_payment_id) + 1;
  v_event := kernel.append_event(
    c, 'kernel.payment.routed', 'actor:' || c.actor_id, v_authority,
    jsonb_build_object('payment_id', p_payment_id, 'attempt', v_attempt, 'payer_address', p_payer_address,
                       'recipient_address', p_recipient_address, 'input_asset', p_input_asset,
                       'input_amount', p_input_amount, 'max_input', p_max_input, 'deliver_asset', p_deliver_asset,
                       'deliver_amount', p_deliver_amount, 'quoted_at', p_quoted_at, 'expires_at', p_expires_at,
                       'route', p_route)
  );
  insert into kernel.payment_routes (payment_id, attempt, route, payer_address, recipient_address, input_asset, input_amount,
                                     max_input, deliver_asset, deliver_amount, quoted_at, expires_at, event_id)
  values (p_payment_id, v_attempt, p_route, p_payer_address, p_recipient_address, p_input_asset, p_input_amount::numeric,
          p_max_input::numeric, p_deliver_asset, p_deliver_amount::numeric, p_quoted_at, p_expires_at, v_event);
  insert into kernel.payment_transitions (payment_id, attempt, status, event_id)
  values (p_payment_id, v_attempt, 'routed', v_event);
  return v_attempt;
end;
$$;

-- Records what happened on chain, for the payment service.
create function kernel_api.record_payment(
  p_payment_id text,
  p_attempt integer,
  p_status text,
  p_tx_signature text default null,
  p_input_amount text default null,
  p_wire_transaction text default null,
  p_slot bigint default null,
  p_detail text default '',
  p_evidence jsonb default '[]'::jsonb,
  p_as_actor uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  v_intent kernel.payment_intents;
  v_route kernel.payment_routes;
  v_last kernel.payment_transitions;
  v_submitted kernel.payment_transitions;
  v_scope text;
  v_authority uuid;
  v_event uuid;
begin
  perform kernel.lock_chain();
  select * into v_intent from kernel.payment_intents i where i.payment_id = p_payment_id;
  if not found then
    raise exception using errcode = 'KA007', message = 'payment not found';
  end if;
  v_scope := 'system/chain:' || v_intent.chain;
  v_authority := kernel.require_grant(c.actor_id, 'kernel.payment.record', v_scope);
  if p_status is null or p_status not in ('submitted', 'confirmed', 'failed', 'needs_reconciliation') then
    raise exception using errcode = 'KA003', message = 'unknown payment status';
  end if;
  if kernel.payment_attempt(p_payment_id) = 0 then
    raise exception using errcode = 'KA003', message = 'the payment has no route yet';
  end if;
  if p_attempt is distinct from kernel.payment_attempt(p_payment_id) then
    raise exception using errcode = 'KA003', message = 'that is not the current attempt';
  end if;
  select * into v_route from kernel.payment_routes r where r.payment_id = p_payment_id and r.attempt = p_attempt;
  v_submitted := kernel.payment_submission(p_payment_id, p_attempt);

  select * into v_last from kernel.payment_transitions t where t.payment_id = p_payment_id order by t.id desc limit 1;
  if v_last.status = p_status and v_last.attempt = p_attempt
     and v_last.tx_signature is not distinct from coalesce(p_tx_signature, v_submitted.tx_signature) then
    return v_last.event_id;
  end if;
  if not coalesce(kernel.payment_transition_allowed(v_last.status, p_status), false) then
    raise exception using errcode = 'KA003', message = format('payment cannot move from %s to %s', v_last.status, p_status);
  end if;
  if p_status = 'submitted' then
    if p_tx_signature is null or p_wire_transaction is null or coalesce(p_input_amount, '') !~ '^[1-9][0-9]{0,37}$' then
      raise exception using errcode = 'KA003', message = 'a submission needs the signature, the input amount and the signed transaction';
    end if;
    if p_input_amount::numeric > v_route.max_input then
      raise exception using errcode = 'KA003', message = 'the input exceeds the slippage bound of the route';
    end if;
  end if;
  if v_submitted.id is not null and p_tx_signature is not null and p_tx_signature <> v_submitted.tx_signature then
    raise exception using errcode = 'KA003', message = 'one transaction per attempt: the signature differs from the submitted one';
  end if;
  if p_status = 'confirmed' then
    if v_submitted.id is null or p_tx_signature is distinct from v_submitted.tx_signature then
      raise exception using errcode = 'KA003', message = 'only the submitted transaction can confirm the payment';
    end if;
    if jsonb_array_length(coalesce(p_evidence, '[]'::jsonb)) = 0 then
      raise exception using errcode = 'KA003', message = 'confirmation requires chain evidence';
    end if;
  end if;

  v_event := kernel.append_event(
    c, 'kernel.payment.' || p_status, v_scope, v_authority,
    jsonb_build_object('payment_id', p_payment_id, 'attempt', p_attempt, 'status', p_status,
                       'tx_signature', coalesce(p_tx_signature, v_submitted.tx_signature),
                       'input_amount', coalesce(p_input_amount, v_submitted.input_amount::text),
                       'slot', p_slot, 'detail', coalesce(p_detail, ''))
  );
  insert into kernel.payment_transitions (payment_id, attempt, status, tx_signature, input_amount, wire_transaction, slot,
                                          detail, event_id)
  values (p_payment_id, p_attempt, p_status, coalesce(p_tx_signature, v_submitted.tx_signature),
          coalesce(p_input_amount::numeric, v_submitted.input_amount),
          case when p_status = 'submitted' then p_wire_transaction end, p_slot, coalesce(p_detail, ''), v_event);
  perform kernel.attach(c, v_event, coalesce(p_evidence, '[]'::jsonb), v_authority);
  return v_event;
end;
$$;

------------------------------------------------------------------------------------------------
-- kernel_api: payment reads
------------------------------------------------------------------------------------------------

-- One payment, for its payer, its recipient or the payment service.
create function kernel_api.read_payment(p_payment_id text, p_as_actor uuid default null)
returns table (
  payment_id text, intent_id uuid, payer_id uuid, recipient_id uuid, chain text, asset text, amount text,
  max_slippage_bps integer, recipient_address text, accept_assets text[], memo text, status text, attempt integer,
  payer_address text, input_asset text, input_amount text, max_input text, deliver_asset text, deliver_amount text,
  expires_at timestamptz, tx_signature text, executed_input text, wire_transaction text, created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
  v_intent kernel.payment_intents;
  v_route kernel.payment_routes;
  v_attempt integer;
  v_submitted kernel.payment_transitions;
begin
  select * into v_intent from kernel.payment_intents i where i.payment_id = p_payment_id;
  if not found then
    raise exception using errcode = 'KA007', message = 'payment not found';
  end if;
  if c.actor_id not in (v_intent.payer_id, v_intent.recipient_id) then
    perform kernel.require_grant(c.actor_id, 'kernel.payment.record', 'system/chain:' || v_intent.chain);
  end if;
  v_attempt := kernel.payment_attempt(p_payment_id);
  select * into v_route from kernel.payment_routes r where r.payment_id = p_payment_id and r.attempt = v_attempt;
  v_submitted := kernel.payment_submission(p_payment_id, v_attempt);
  return query select
    v_intent.payment_id, v_intent.id, v_intent.payer_id, v_intent.recipient_id, v_intent.chain, v_intent.asset,
    v_intent.amount::text, v_intent.max_slippage_bps, v_intent.recipient_address, v_intent.accept_assets, v_intent.memo,
    kernel.payment_status(p_payment_id), v_attempt, v_route.payer_address, v_route.input_asset, v_route.input_amount::text,
    v_route.max_input::text, v_route.deliver_asset, v_route.deliver_amount::text, v_route.expires_at,
    v_submitted.tx_signature, v_submitted.input_amount::text, v_submitted.wire_transaction, v_intent.created_at;
end;
$$;

-- Payments the caller sent or received.
create function kernel_api.my_payments(p_as_actor uuid default null)
returns table (
  payment_id text, direction text, counterparty_id uuid, chain text, asset text, amount text, status text,
  deliver_asset text, deliver_amount text, tx_signature text, created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  c kernel.caller := kernel.resolve_caller(p_as_actor);
begin
  return query
    select i.payment_id,
           case when i.payer_id = c.actor_id then 'sent' else 'received' end,
           case when i.payer_id = c.actor_id then i.recipient_id else i.payer_id end,
           i.chain, i.asset, i.amount::text, kernel.payment_status(i.payment_id),
           r.deliver_asset, r.deliver_amount::text,
           (kernel.payment_submission(i.payment_id, r.attempt)).tx_signature,
           i.created_at
    from kernel.payment_intents i
    left join kernel.payment_routes r on r.payment_id = i.payment_id and r.attempt = kernel.payment_attempt(i.payment_id)
    where i.payer_id = c.actor_id or i.recipient_id = c.actor_id
    order by i.created_at, i.payment_id;
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
