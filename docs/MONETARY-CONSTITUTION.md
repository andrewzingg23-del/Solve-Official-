# solve — Monetary Constitution

Draft 2 · 2026-10-03 · for founder ratification

SOLVE is a monetary operating system: one fabric where money, identity, proof, privacy, AI agents, credit and real-world payment rails interoperate but stay separable. SOLVE itself is the scarce neutral reserve that every economy can understand. Each State designs its own economy under shared physics. The kernel establishes causal truth. The blockchain establishes portable ownership and settlement. Neither may impersonate the other.

The person sees almost none of this. They say *Send Sarah $200*, *Buy this*, *Pay everyone who completed milestone 4*, or *Move $50,000 from State A's treasury to State B's supplier*. The system finds the path.

Status: design. Nothing here is live. Mainnet, cards, credit, convertibility and any public token activity stay gated by BUILD-BOOK §11 and the founder's explicit word. Draft 2 folds in the founder's 2026-10-03 monetary-OS design.

---

## Part I — The stack

```
                 HUMAN / AI INTENT
                        │
                     SOV ID              passkey · wallet · credentials
                        │
                   WAYFINDER             "what do you want done?"
              ┌─────────┴─────────┐
           REALITY             ECONOMY
         Proof Kernel       Intent Router
       events · evidence    best settlement path
              └─────────┬─────────┘
                 NETWORK STATES          constitutions · money · credit · treasury · agents
                        │
                      SOLVE              scarce neutral reserve
               ┌────────┼────────┐
              DEX      USDC    State FX
               └────────┼────────┘
                 REAL-WORLD EDGE         card · bank · merchant · API
```

The loop: **Intent → Contract → Action → Evidence → Proof → Value → Settlement → History → Credit → More agency.**

---

## Part II — The two truths

| | **Kernel** (causal truth) | **Chain** (ownership and settlement) |
|---|---|---|
| Records | Why value moved. Who intended it, who authorized it, under which rule, with what evidence. | That value moved. Who holds what, transferable without solve's permission. |
| Nature | Private by default. Append-only. Hash-chained. Gated by identity and grants. | Public verification. Bearer. Final once confirmed. Self-custodied. |
| Authority comes from | Grants held by actors (humans, agents, services). | Signatures by key holders. |
| Answers | "Was this authorized?" "Was this earned?" "Did this State follow its constitution?" | "Who owns this now?" "Did settlement finalize?" "What is total supply?" |

### Non-impersonation articles

1. **The kernel never asserts ownership or settlement of a chain asset.** It records intents, authorizations and observations. A kernel balance for a chain asset is labelled *kernel accounting*, never *you own*.
2. **The chain never asserts causation.** What reaches the chain is commitments and proofs about kernel state, not the record itself.
3. **Every crossing is an evidenced event.** Kernel → chain is an authorized intent executed by a key holder, or a proof (Part VIII). Chain → kernel is an observation by a service actor, carrying the transaction signature and finality as `externally_verified` evidence.
4. **One asset unit lives in one layer at a time.** Moving between layers is an explicit lock-and-mint or burn-and-release, both recorded.
5. **Precedence is fixed.** For ownership of chain assets, the chain wins. For causation, authority and constitutional compliance, the kernel wins. A disagreement opens a reconciliation case, never a silent overwrite.

---

## Part III — Shared physics

Every economy inherits these. No State can amend them.

1. **Conservation.** Double-entry everywhere. Value is created only by declared issuance under issuer authority, including credit created by authorized lenders. Every unit traces to an issuance event.
2. **Consent.** No unit moves without authority from its holder: a grant in the kernel, a signature on chain. Debits into an account need no consent; credits out of it always do.
3. **Provenance.** Every issuance, transfer, loan and burn is an event with an actor, a grant and the kernel clock.
4. **Permanence.** History is append-only and hash-chained. Corrections are new events.
5. **Idempotency.** A retried instruction never moves value twice.
6. **Bounded agents.** An AI agent starts with zero authority, spends only inside its policy (Part VI), and can never exceed its owner.
7. **Executable law.** Monetary rules a State declares as enforceable are enforced by code, not by promise.
8. **Public aggregates, private individuals.** Every economy's supply, issuance, credit totals, reserves and rules are public and provable. Individual balances and terms are private by default and disclosable by choice.
9. **Exit and fork.** A member can leave with what they own. A State can leave with everything it is (Part IX).
10. **No impersonation of SOLVE.** No State unit may be presented as SOLVE, or as redeemable for SOLVE, unless fully backed by SOLVE held on chain with reserves verifiable at any time.

---

## Part IV — SOLVE, the neutral reserve

SOLVE is the scarce asset every economy can hold and settle in. It is not the currency anyone is required to use.

| Article | Rule |
|---|---|
| Supply | 1,000,000,000, created once. No future mint. Allocation: ecosystem 45%, treasury 20%, team 15% (vested), liquidity 10%, community 10%. |
| Entry | Earned through verified action. No ICO, no presale, no buy-in. Ever. |
| Price | Discovered by the market. No peg, no defense. |
| Role | Neutral reserve and cross-economy settlement asset. Coffee does not have to be priced in SOLVE. |
| Routing | Never mandatory. The router compares every path; SOLVE carries the flow only where it is cheapest or most liquid. Dominance is earned, not coded. |
| Domain | Canonical on one chain (Solana). No wrapped or bridged SOLVE until scale demands it. External money such as USDC travels at the edges instead. |
| Demand | Use before trade: verification fees, settlement, State reserves, marketplace transactions. |

### How "earned" works

1. An actor does something. The kernel records it with evidence.
2. A published, versioned reward policy decides eligibility, citing the evidence and the rule version. That decision is a causal fact.
3. The ecosystem vault releases SOLVE on chain, within its program's rate limits. That release is settlement. Later, a proof replaces trust in the releasing key (Part VIII).
4. The chain observer records finalized settlement. Only then does kernel accounting move.

---

## Part V — State economies

A State doesn't get "create token". It gets "design an economy", written as a monetary constitution that is part human-readable and part machine-enforced.

### The monetary constitution

| Field | Example (Arcadia) | Other choices |
|---|---|---|
| Base currency | ARC | — |
| Supply model | Elastic | Fixed (100M), commodity-backed, revenue-backed, algorithmically bounded |
| Issuance authority | State treasury | Elected council, formula only |
| Expansion limit | 0–4% per year, enforced | Any declared bound, or none |
| Credit creation | Authorized State lenders | None |
| Reserve assets | SOLVE, USDC, BTC | Any mix, or none |
| Treasury control | Multisig plus constitution | Program-owned |
| External settlement | Router's choice; SOLVE where cheapest | — |
| Privacy | Confidential amounts | Public amounts |
| Policy changes | 67% vote plus 30-day timelock | Any declared rule |
| Exit terms | What a departing member keeps | — |

### Executable monetary law

Declared limits become program constraints, enforced in the kernel and, for chain assets, in the asset's program:

- annual issuance ≤ declared bound × supply
- treasury spend ≤ approved budget
- policy change ⇒ recorded vote + elapsed timelock

### Credit

Base money is not total money. A State may authorize lenders, inside its scope, to create loans and deposit claims in its currency. Base money of 100M A plus 250M of lender credit is a 350M economy, settling externally in whatever the router finds best.

The State publishes provable aggregates, never individual books:

```
Total base money        100M A
Total deposits          212M A
Total loans             198M A
Reserves                 31M A
SOLVE reserves          4.2M SOLVE
Bad-debt ratio             1.7%
```

### Settling between States

The router compares direct (A → B), via SOLVE (A → SOLVE → B), via USDC, and any other liquid path, then executes the one that satisfies the payer's constraints. The kernel records the intent and authority. The chain settles. The kernel records the observation.

---

## Part VI — Wallets, agents and the router

### The SOV ID is the wallet

People see balances by asset, not addresses, gas, seed phrases or chains:

```
Andrew  @andrew
SOLVE      14,822
USD        $4,102
ARC         8,410
State-A     2,300
```

Keys stay with the person, unlocked by passkey (Face ID, Touch ID), with an optional recovery network and hardware keys for advanced users. Network fees are sponsored, or recovered invisibly where appropriate. Blockchain is infrastructure, not interface.

### Agent wallets

Every AI agent can hold a wallet under a spending policy its owner sets:

```
Andrew's Procurement AI
  Can:     pay approved suppliers · ≤ $500 per transaction · ≤ $2,000 per day
           only in World #391 · only against approved purchase orders
  Cannot:  pay itself · buy arbitrary assets · withdraw · raise its own limits
  Expires: 2026-12-31 · Owner: Andrew
```

Agents can also pay machines directly (HTTP 402-style metered payments) for data, compute, logistics or design, inside the same policy. Every payment is an agent-attributed event with the owner recorded.

### The intent router

You state the outcome; the router picks the path:

```
"Bob receives $500"
  Bob accepts: USD, USDC, SOLVE      Andrew holds: ARC, SOLVE
  ARC → SOLVE → USDC → Bob    $1.18
  SOLVE → USDC → Bob          $0.62
  SOLVE → Bob                 $0.02   ← chosen
```

### One card

The card is a SOV Card, not a SOLVE card. A funding engine spends whatever the holder allows, in their order of preference (for example ARC first, then USD, USDC, SOLVE), converting at the edge to card settlement.

---

## Part VII — Privacy and proof-of-fact

Privacy is selective, not binary.

| Public | Private | Disclosable on the holder's choice |
|---|---|---|
| SOLVE supply, State rules, proof validity, economy aggregates | Personal balances, payment amounts, commercial terms | Tax authority: required history · Auditor: a subset · Lender: proof of assets · Merchant: proof of payment · State: proof of membership |

Proof-of-fact credentials let a person prove *income over 12 months > $100,000*, *age ≥ 21* or *member of State A* without revealing the underlying numbers or activity. Underwriting then asks *what have you actually done?*, from proofs the person chooses to share, instead of a credit score.

---

## Part VIII — Proving truth

### ZK epochs

The kernel's history is private. The chain should not have to trust the kernel's word either. For each epoch, a deterministic verification program runs over the kernel's events, and a zero-knowledge proof attests that it ran correctly. The chain receives only:

```
previous state root · new state root · policy hash · eligible releases · proof
```

ZK proves the rules were applied correctly to the evidence supplied. It cannot prove the house was built. That needs evidence.

### The evidence mesh

Consequential outcomes require independent evidence, scaled to risk:

| Risk | Evidence |
|---|---|
| Low value | 1–2 sources |
| High value | 3+ independent sources |
| System-critical | Quorum plus a challenge period |

A $100,000 construction milestone might combine the contract milestone, contractor signature, customer acceptance, invoice, payment confirmation, inspection, and an optional external verifier. Truth decentralizes progressively, not just the token.

---

## Part IX — Forkable States

A State owns its constitution, membership registry, currency rules, treasury, contracts and economic history. If solve the company disappears, the State does not. It can export its state root, constitution, member credentials, treasury, ledger, proof history and currency programs, and any compatible client can reconstruct it.

---

## Part X — The crossing protocol

Every movement of a chain asset follows the same steps:

1. **Intent.** Kernel event `settlement.intended`: payer, payee, asset, amount, quote and expiry, correlation id.
2. **Authorization.** The payer's grant, the agent's spending policy where an agent pays, and approvals where policy demands them.
3. **Route.** The router selects the path that satisfies the payer's constraints.
4. **Execution.** The key holder signs, or the treasury program executes. solve never holds user keys.
5. **Observation.** The chain observer records `settlement.observed` once finalized, with signature, slot and commitment level.
6. **Reconciliation.** Kernel accounting moves only on observation. Expired intents close by event. Mismatches open a case.

Kernel-only units skip 4–5. Their posting is the settlement.

---

## Part XI — How this maps onto the memory kernel

Built and tested in `supabase/migrations/20261003064603_memory_kernel.sql`, now installed on the store:

| Constitutional need | Kernel primitive today |
|---|---|
| SOLVE defined once by the network | `define_asset('SOLVE', issuer 'system', 9 decimals)`, root authority only |
| A State and its founding authority | `claim_scope('state:<id>')` |
| A State currency with its own issuer | `define_asset(code, issuer 'state:<id>')` |
| Lenders creating credit inside a State | Credit-normal accounts allowed anywhere under the issuer scope, e.g. `state:<id>/lender:<id>` |
| Only issuers create supply | Supply-creating accounts refused outside the issuer scope |
| Consent on every movement | Credits require `kernel.ledger.post` covering the account's scope |
| Agents start at zero, never exceed owner | Agents hold no grants until issued; delegated grants die with their parent |
| Chain observations as evidence | `externally_verified` evidence only from service actors |
| Tamper evidence | Hash chain plus `verify_chain()` |

### Next kernel work, in order

1. **Spending policies on grants.** Per-posting cap, rolling daily cap, allowed assets, allowed counterparty scopes, purpose reference (e.g. purchase order), and a rule that an agent cannot pay itself. Enforced in `post_transaction`. This makes agent wallets real.
2. **Issuance policies on assets.** Declared supply model and an enforced issuance bound per period; policy changes only through a recorded vote event plus timelock.
3. **Asset layer and class.** `kernel` or `chain:solana`; closed-loop, backed or floating.
4. **Epoch commitments.** Periodic state roots over the event chain, published by an anchor service: the prerequisite for ZK epochs.
5. **Evidence thresholds.** Required evidence count and independence per event type and value tier, with challenge windows.
6. **Settlement and constitution event types.** `state.constituted`, `state.policy_changed`, `settlement.intended`, `settlement.observed`, `settlement.expired`, `anchor.published`.

Router, wallet, card, confidential balances, ZK proving and cross-chain edges are services around the kernel, built after these primitives.

---

## Part XII — Failure modes

| Failure | Containment |
|---|---|
| Kernel database compromised | Anchored state roots expose rewritten history. Chain assets stay with their holders. |
| Chain reorg or stalled finality | The kernel records only finalized settlement. |
| Observer lies or fails | Its evidence carries a checkable signature. Multi-observer quorum before mainnet. |
| State over-issues | The kernel refuses issuance outside the declared bound. The network can suspend convertibility; it cannot seize members' assets. |
| Lender over-extends | Public aggregates and reserve proofs make it visible; State policy sets reserve rules. |
| Run on a backed unit | 100% SOLVE reserve, verifiable on chain. |
| Agent overspends | Spending policy enforced per posting and per day; limits cannot be raised by the agent. |
| Double spend across layers | One layer per unit; crossings are lock-and-mint or burn-and-release. |

---

## Part XIII — Gates and open decisions

**Gates.** None of the following happens without the founder's explicit approval and legal review. This document is not legal advice. Lending, deposits, cards, custody, exchange, convertibility, confidential transfers and cross-border settlement can trigger banking, money-transmission, securities, commodities and tax rules.

- SOLVE mainnet mint.
- Any State currency on chain, any credit creation, any convertibility.
- Cards, deposits, custody, cash-out, yield (forbidden by BUILD-BOOK §11 today).

**Building blocks.** The founder's research (2026-10-03) identifies existing components: Solana fee sponsorship, passkey/MPC embedded wallets, confidential token balances with optional auditor keys, general-purpose zkVMs, native cross-chain USDC transfer, HTTP 402 machine payments, and stablecoin-linked card programs. Verify each against current documentation before committing to it.

**Open decisions for the founder.**

1. **Name.** BUILD-BOOK §11 says SOV; this draft says SOLVE for the reserve and SOV for identity and the card. The legacy game's virtual SOV still collides. Settle naming before any mint.
2. **Reward policy v1.** Which verified actions earn SOLVE first.
3. **Anchor and epoch cadence.**
4. **First State.** Which community writes the first monetary constitution: the founder's agency, the family World, or a launch-wedge seller community.
5. **Governance path.** Today the founder holds root. When, and to whom, amendment authority moves.
