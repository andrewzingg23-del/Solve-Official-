# solve — Monetary Constitution

Draft 3 · 2026-10-03 · for founder ratification · source specification for implementation

SOLVE is the scarce, interoperable reserve beneath a network of Worlds and Network States. The system is infrastructure, not a token app: it carries one causal chain from reality to money and back into the record.

```
REALITY → EVENT → EVIDENCE → AUTHORITY → VERIFICATION → ECONOMIC ENTITLEMENT
→ CRYPTOGRAPHIC SETTLEMENT AUTHORIZATION → ON-CHAIN MONEY → OWNERSHIP
→ TRANSFER · TRADE · SPEND · SAVE · INVEST · CASH OUT
```

The person sees almost none of it. They say *Pay Sarah $200*, *Pay everyone who completed milestone 4*, *Cash out $1,000*, *Create an economy for our community*. The system finds a safe path.

Status: the monetary proof-of-life and the payment router run end to end on DEV-SOLVE and test assets (Part XIV). Mainnet SOLVE, cards, credit, convertibility, cash-out and any public token activity stay gated by BUILD-BOOK §11 and the founder's explicit word. Draft 3 folds in the founder's monetary-OS design and build directive of 2026-10-03.

---

## Part I — Three truths

| Truth | Decided by | Answers |
|---|---|---|
| **Reality** | The kernel | What happened, who acted, under which authority, with what evidence, under which policy, what obligation resulted, what is already settled. |
| **Money** | The blockchain | How much SOLVE exists, where, who controls it, whether a transfer or vault release occurred, whether an entitlement already settled. |
| **Market** | Markets | SOLVE's price, State-currency prices, exchange rates, liquidity, execution price, slippage. |

None may impersonate another. **The kernel cannot create money. The blockchain cannot tell whether a house was built. The protocol cannot declare a price.**

1. The kernel records intents, authorizations and observations of chain events. A kernel balance for a chain asset is *kernel accounting*, never *you own*.
2. The chain records commitments and proofs about kernel state, never the causal record itself.
3. Every crossing is an evidenced event: kernel → chain is an authorized settlement executed by a key holder (later, a proof); chain → kernel is an observation by a service actor carrying the transaction signature as `externally_verified` evidence.
4. One asset unit lives in one layer at a time. Crossings are lock-and-mint or burn-and-release, both recorded.
5. Precedence: the chain wins for ownership and supply; the kernel wins for causation, authority and constitutional compliance; markets win for price. A disagreement opens a reconciliation case, never a silent overwrite.

---

## Part II — System laws (frozen)

1. Reality is not created by blockchain. Money is not created by database fields.
2. SOLVE supply is finite. Market prices are discovered, not declared.
3. Economic obligations settle once. Every monetary movement has causality. Every consequential action has authority.
4. History is append-only. Evidence and claims stay distinct.
5. State monetary sovereignty cannot debase SOLVE. A State cannot manufacture an unfunded SOLVE claim.
6. Users may leave, self-custody, send, trade, and use external rails. Fiat providers are replaceable edges.
7. AI may not expand its own authority.
8. Privacy means selective disclosure, not fake invisibility.
9. Liquidity determines executable value.
10. SOLVE earns reserve status through utility, not coercion.

---

## Part III — Supply

- Exactly **1,000,000,000 SOLVE** are created once, at genesis.
- Future minting = 0. The mint authority is removed in the same transaction that mints, so no later mint is possible by any key.
- Burns are permanent and never restore mint capacity: Supply(t) = 1,000,000,000 − PermanentBurns(t) ≤ 1,000,000,000.
- No peg, no floor, no redemption promise from SOV Inc., no protocol price defense, no guaranteed SOLVE/USD or State-coin/SOLVE rate.
- One canonical supply domain (Solana). No Ethereum/Base/wrapped/bridged SOLVE until scale requires it, and never as competing canonical supplies. External assets such as USDC travel at the edges first.

---

## Part IV — Genesis domains

| Domain | SOLVE | Share | Powers |
|---|---:|---:|---|
| Earn Vault | 450,000,000 | 45% | Releases only against a canonical economic entitlement, once per settlement identity, within bounded release capacity. |
| Treasury Vault | 200,000,000 | 20% | Separately authorized, budget-linked, bounded, observable, timelock-compatible. Never an indirect mint. |
| Team Vesting Vault | 150,000,000 | 15% | Deterministic schedule: nothing before a 12-month cliff, linear by month to 72 months. No price acceleration, no discretionary release. |
| Liquidity Vault | 100,000,000 | 10% | Controlled deployment into useful markets (SOLVE/USDC, SOLVE/SOL, SOLVE/State coins), tracking deployed amount, pair, venue, position, fees, realized changes and authorization. Never price defense or a founder trading wallet. |
| Community Vault | 100,000,000 | 10% | Distinct domain. Release policy disabled until defined. Disabled is acceptable; ambiguous authority is not. |

Five program- or key-controlled domains, each with its own owner. No administrator can drain more than one.

### The Earn Vault

It never mints, never transfers arbitrarily, never releases against a duplicate obligation or above capacity, never accepts unauthenticated claims, and never accepts self-attestation alone for a consequential release. A compromised verifier cannot drain it: the settlement key holds only a bounded allowance that the vault's cold owner sets.

```
EconomicEntitlement {
  entitlement_id · actor_id · world_id · source_event_id (obligation) · outcome_event_id
  evidence_root · policy_version · attribution_bps · amount · asset · created_at · settlement_status
}
```

---

## Part V — What earns

**Never rewarded:** logins, clicks, views, messages, posts, likes, referrals by themselves, recruitment, token trading, token holding, capital deposits, circular transactions, self-transfers, meaningless activity.

**Rewarded:** need / contract / bounty → authorized work → observable outcome → evidence → verification → entitlement.

- **Attribution conserves.** Shares of one outcome sum to at most 100%. Splitting it across twenty identities divides it; it never multiplies it.
- **Referrals.** Recruitment alone earns nothing. If a referred actor later helps create verified value, policy may allocate part of that existing outcome's attribution to the referrer. No multi-level cascade, no new value.
- **Evidence.** The policy names the required evidence bases and the number of independent parties. Evidence from the beneficiary's own party never counts. Risk sets the threshold: 1–2 sources for low value, 3+ independent sources for high value, quorum plus a challenge period for system-critical outcomes.

---

## Part VI — Settlement identity and exactly-once

- Every monetary consequence has one canonical `settlement_id`, derived from the obligation, not from any request: `sha256("solve:settlement:v1|" ‖ obligation ‖ "|" ‖ beneficiary ‖ "|" ‖ policy_key)`.
- One obligation settles exactly once. Exact retries return the original result. A reused idempotency key with a changed payload fails. A different request id for the same obligation cannot settle it again. Concurrent attempts produce one settlement.
- On chain, each release atomically creates a marker account derived from the settlement id; a replay fails and moves nothing. The marker also proves execution after a timeout.
- External side effects use an outbox with explicit states: prepared → submitted → confirmed | failed | needs_reconciliation (reversed reserved). The worker records *submitted* before sending, never infers an outcome from a timeout, and never trusts a rejected send while the marker shows the release happened. Reconciliation is a first-class system.

---

## Part VII — Ownership and accounting

- SOLVE ownership is on chain. The database may cache balances for display; the canonical balance and supply are the chain's. If they disagree, the chain wins for ownership.
- The kernel ledger stays double-entry for causes and obligations: pending settlements, provider activity, State and fiat accounting, State currencies, internal claims and chain observations. Every transaction balances within its asset; assets are never netted against each other.
- Earn accounting (asset per rail, scope `system/chain:<cluster>/vault:earn`):

| Event | Debit | Credit |
|---|---|---|
| Chain genesis observed | Earn on-chain mirror | Earn unallocated |
| Entitlement verified | Earn unallocated | Earn payable |
| Settlement confirmed | Earn payable | Earn on-chain mirror |

Earn unallocated can never go negative, so entitlements can never exceed the allocation the chain observer actually saw. The on-chain mirror must equal the chain's Earn Vault balance; a mismatch is a reconciliation case.

---

## Part VIII — Markets and routing

- No protocol price field is monetary truth. Keep spot quote, TWAP, executable quote, liquidity depth, route and quote timestamp, and distinguish spot value from executable value at a quantity. A thin market's last price is never shown as realizable wealth.
- Users state intents (*Pay Bob $500*); the router compares routes across sender assets, recipient-accepted assets, liquidity, network and provider costs, slippage, speed and user constraints, then picks the best route by net output = gross − network cost − trading fees − provider fees − slippage.
- SOLVE routing is never forced. State A → USDC → State B wins when it is better. SOLVE becomes a bridge asset by being liquid, accepted, scarce, credible, cheap and connected.
- The exchange layer abstracts AMMs, order books, aggregators, State markets and future SOV venues, and returns enough execution metadata to audit each route. No single routing server becomes monetary truth.

---

## Part IX — Network States

A Network State is a persistent sovereign World on shared physics: constitution, membership, roles, treasury, currency, markets, businesses, contracts, agents, governance, credit, debt, assets, history. SOV supplies primitives; the State supplies policy.

- **Design Economy, not Create Token.** The economy compiler captures identity, currency name and symbol, monetary model, maximum supply or issuance rule, monetary and treasury authority, reserve policy, privacy policy, governance, policy-change rule, credit permissions and settlement preferences, and compiles them into a human-readable constitution plus machine-enforced configuration.
- Allowed models: fixed supply, capped inflation, elastic issuance, revenue-linked, commodity- or reserve-backed, governance-controlled, or other explicitly bounded designs. Sovereignty is allowed; arithmetic fraud is not. Every issuance has authority, policy and accounting; every transition is attributable; every obligation settles once.
- **No automatic SOLVE claim.** State-coin creation, market cap or failure never creates a SOLVE entitlement, collateral or bailout. A State may promise conversion to SOLVE only when that promise is funded with existing SOLVE.
- **No required pegs.** State currencies float unless the State chooses a backed or pegged design. Cross-State exchange runs on market liquidity, with no protocol conversion guarantee.
- **Credit.** Base money ≠ total economic money. Loans, deposit claims, credit, bonds and obligations stay separate primitives from base money, debt, securities and assets. Debt is never base money unless the State's constitution says so.
- **Provable balance sheets.** States publish verifiable aggregates (base money, deposits, loans, reserves, SOLVE reserves, debt, treasury assets, delinquency) with individual privacy preserved. Accounting roots and proof interfaces exist before full ZK aggregation.
- **Forkable.** Constitution, state root, membership credentials, currency references, treasury, ledger, proof history and governance rules are exportable so a compatible client can carry on without SOV Inc.

---

## Part X — Wallets, agents, cards, exit

- **Wallets disappear from ordinary UX.** People see balances by asset. Identity and wallet stay separable: one actor may hold several wallets, an organization multisig/MPC, an agent a constrained wallet. Passkeys, device keys, embedded self-custody, external and hardware wallets, recovery policy. Fees are sponsored so nobody must first acquire SOL.
- **Agent wallets** carry a contract: human owner, World scope, allowed assets, actions and counterparties, per-transaction and daily maximums, expiry, approval threshold. An agent cannot withdraw externally, buy speculative assets, pay itself, modify its limits or add counterparties. Machine commerce (APIs, inference, compute, data, logistics, other agents' work) uses the same authorization and payment intents and is recorded like any economic event.
- **SOV Card** is multi-asset, not a SOLVE card: purchase → funding policy → quote routes → convert if required → card settlement. The merchant never needs to understand SOLVE.
- **Exit.** Users can send SOLVE to any wallet, trade it, swap to stablecoins, use external wallets, off-ramp to banks, spend by card, and use cash access where supported. Cash-out shows an executable quote with fees and slippage, never balance × last price. SOV never presents fiat exit as a guaranteed redemption unless a separate explicit contract backs it.
- **Providers** sit behind one boundary (`quote, swap, onRamp, offRamp, bankTransfer, cardAuthorize, cardSettle, atmWithdraw, reconcile`). A provider failure disables a rail; it never erases identity, SOLVE ownership, State history, contracts or records.

---

## Part XI — Privacy and proof

- Privacy is named by dimension: identity, balance, amount, counterparty, membership, commercial data, audit disclosure, regulatory disclosure. "Private" is never used without saying what is private.
- Selective disclosure: prove *age ≥ threshold*, *member of State*, *income ≥ threshold*, *assets ≥ threshold*, *license valid*, *contract completed*, *reserve ratio ≥ threshold* without exposing the dataset. Identity and evidence objects are built so proofs can reference canonical data.
- ZK architecture: StateRoot(t) + private transitions + verification computation → proof → StateRoot(t+1). The chain verifies that authorized rules executed, without seeing private events. The proving system stays replaceable.
- Cryptographic verification is not real-world attestation. A valid signature is never synonymous with a real-world fact; real outcomes need independent evidence (Part V).

---

## Part XII — Fees

| Fee | Purpose | Source |
|---|---|---|
| Network/security | Spam prevention, execution cost. Tiny. Never price manipulation. | Network |
| Market | Liquidity provision | AMM, DEX, liquidity providers |
| Service | Business services | Marketplace, card, bank transfer, off-ramp |

Burns may exist; SOLVE's value thesis never depends on aggressive burning. Scarcity is one side of value; utility, liquidity, acceptance, credibility, interoperability, depth, network effects, institutional and State reserve demand, and payment demand are the rest. Usefulness comes before speculation.

---

## Part XIII — Immutable versus upgradeable

| Eventually immutable (minimal) | Upgradeable |
|---|---|
| 1B genesis supply; no future SOLVE mint; allocation ceilings; no duplicate vault release; basic ownership semantics | Wallet UX, routers, provider adapters, privacy systems, verification policies, State modules, card integrations, proof systems |

No upgrade key ever holds unlimited power over the monetary constitution.

---

## Part XIV — What is enforced today

Code: `supabase/migrations/20261003064603_memory_kernel.sql`, `supabase/migrations/20261003072025_monetary_proof_of_life.sql`, `supabase/migrations/20261003080203_payment_router.sql`, `lib/chain/`, `lib/money/`, `lib/router/`.

| Law | Enforcement | Verified by |
|---|---|---|
| 1B once, no future mint | Mint authority set to none in the minting transaction (SPL Token) | `tests/chain`: re-mint with the old authority fails |
| Five separate domains | Five token accounts, five owner keys; settlement key has no power over the other four | `tests/chain` |
| Bounded Earn releases | SPL delegate allowance set by the cold Earn owner | `tests/chain`, `tests/e2e`: over-capacity release fails, retries after re-approval |
| Exactly-once settlement | Obligation-derived settlement id; unique entitlement per obligation; one confirmation per settlement; seed marker on chain | `tests/kernel/money`, `tests/e2e`: retries, concurrent workers, lost responses, outages |
| Independent evidence | Policy bases exclude self-report; own-party evidence ignored | `tests/kernel/money` |
| Attribution conserves | Shares fixed by the obligation, ≤ 10,000 bps, deferred check | `tests/kernel/money` |
| Stale policy rejected | Only the current active version verifies | `tests/kernel/money` |
| Kernel cannot create money | Entitlements draw down observed allocation (non-negative); confirmations draw down the mirror | `tests/kernel/money`, `tests/e2e`: mirror equals chain |
| Identity and authority | JWT-resolved actors, grants on every write, service key never a human or the kernel | `tests/kernel`, `tests/e2e` |
| Chain wins for ownership | Balances read from chain; kernel stores only observations | `tests/e2e` |
| No protocol price | Every price is a named venue's spot, TWAP or executable quote with depth and timestamp; inputs are valued at the best venue spot path (a mark, labelled as such); the kernel stores quotes, never prices | `tests/router` |
| Net output identity | NetOutput = Gross − NetworkCost − TradingFees − ProviderFees − Slippage, exact in integer base units for every route; network cost is sponsored | `tests/router` |
| SOLVE never forced | Routes ranked only by cost in the denomination; SOLVE is an intermediary only when its path is cheaper | `tests/router`: direct State-coin pool wins when deep, SOLVE path wins when it is cheaper |
| Payments pay the right person | The kernel pins the recipient's published address and accepted assets at intent; routes to any other address or asset are rejected | `tests/kernel/payments`, `tests/e2e/send-bob` |
| Live quotes, bounded slippage | Quotes expire (≤ 120 s, kernel clock and executor clock); the input limit is fixed by the intent's tolerance and checked at selection, build and submission | `tests/kernel/payments`, `tests/e2e/send-bob` |
| Atomic routes, exactly-once payments | One transaction per attempt holds every leg plus a payment marker derived from the kernel's payment id; a failed leg rolls back the whole route; re-routing only after a definite failure; one confirmation per payment | `tests/e2e/send-bob`: failed leg, lost response, outage, concurrent workers, replay, rebuilt transaction |
| Venues never sign blind | Each venue decodes the transaction and checks its own flows against live inventory before co-signing | `tests/e2e/send-bob`: an underpaying leg is refused |

Payment router limits today: venues are RFQ makers that co-sign from inventory held in ordinary token accounts (constant-product or price-ladder pricing), not on-chain AMM programs, so a maker that co-signs two transactions against the same inventory can be filled at stale terms; no external aggregator is wired; delivery in a non-denomination asset is sized by the payer's executable quote, which the kernel records but cannot verify; test assets only (DEV-USDC and ARC are test mints).

Not yet enforced: team vesting and treasury timelocks on chain (need a vesting/governance program; until then those vaults have no delegate and cold owners), liquidity and community release policies, State economies, credit primitives, confidential amounts, ZK epochs, providers, cards and agent wallet contracts. Devnet genesis has not run yet: the build sandbox cannot reach Solana devnet, so every chain test runs on LiteSVM, which executes the same SPL programs.

---

## Part XV — Gates and open decisions

**Gates.** None of the following without the founder's explicit approval and legal review (this document is not legal advice; lending, deposits, cards, custody, exchange, convertibility, confidential transfers and cross-border settlement can trigger banking, money-transmission, securities, commodities and tax rules): SOLVE mainnet mint; any State currency on chain; credit creation; convertibility; cards, deposits, custody, cash-out or yield (forbidden by BUILD-BOOK §11 today).

**Open decisions.**

1. **Name.** SOLVE for the reserve, SOV for identity and the card; the legacy game's virtual SOV still collides. Settle before any mint.
2. **First real reward policy** and its evidence thresholds.
3. **Release capacity** for the Earn settlement key, and who holds the Earn cold key.
4. **Vesting and treasury programs:** build in-house or adopt an audited program.
5. **Anchor and epoch cadence.**
6. **Governance path** for amending this constitution.
