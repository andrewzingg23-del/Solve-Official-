# solve — Monetary Constitution

Draft 1 · 2026-10-03 · for founder ratification

A network of sovereign economies. SOLVE is the common settlement asset. Each State may run its own economy under shared physics. The kernel establishes causal truth. The blockchain establishes portable ownership and settlement. Neither may impersonate the other.

Status: design. Nothing here is live. Mainnet, convertibility and any public token activity stay gated by BUILD-BOOK §11 and the founder's explicit word.

---

## Part I — The two truths

Two systems, two jobs. Each answers questions the other must never answer.

| | **Kernel** (causal truth) | **Chain** (ownership and settlement) |
|---|---|---|
| Records | Why value moved. Who intended it, who authorized it, under which rule, with what evidence. | That value moved. Who holds what, transferable without solve's permission. |
| Nature | Private by default. Append-only. Hash-chained. Gated by identity and grants. | Public. Bearer. Final once confirmed. Self-custodied. |
| Authority comes from | Grants held by actors (humans, agents, services). | Signatures by key holders. |
| Answers | "Was this authorized?" "Was this earned?" "Did this State follow its charter?" | "Who owns this now?" "Did settlement finalize?" "What is total supply?" |

### Non-impersonation articles

1. **The kernel never asserts ownership or settlement of a chain asset.** It records intents, authorizations and observations. A kernel balance for a chain asset is labelled *kernel accounting*, never *you own*.
2. **The chain never asserts causation.** On-chain memos and anchors are commitments to kernel state, not the record. A transfer proves value moved, not why or with whose consent.
3. **Every crossing is an evidenced event.** Kernel → chain is an authorized intent executed by a key holder. Chain → kernel is an observation by a service actor, carrying the transaction signature and finality as `externally_verified` evidence.
4. **One asset unit lives in one layer at a time.** Moving between layers is an explicit lock-and-mint or burn-and-release, both recorded.
5. **Precedence is fixed.** For ownership of chain assets, the chain wins. For causation, authority and charter compliance, the kernel wins. A disagreement is a reconciliation event, never a silent overwrite.

---

## Part II — Shared physics

Every economy in the network inherits these laws. No State can amend them. The kernel enforces 1–6 today (see Part VI).

1. **Conservation.** Double-entry everywhere. Value is created only by declared issuance under issuer authority. Every unit traces back to an issuance event.
2. **Consent.** No unit moves without authority from its holder: a grant in the kernel, a signature on chain. Debits into an account need no consent; credits out of it always do.
3. **Provenance.** Every issuance, transfer and burn is an event with an actor, a grant and the kernel clock.
4. **Permanence.** History is append-only and hash-chained. Corrections are new events.
5. **Idempotency.** A retried instruction never moves value twice.
6. **Bounded agents.** An AI agent starts with zero authority and can never exceed its owner's. Spending caps default to zero.
7. **Public anchoring.** The kernel's chain head is committed to the blockchain on a fixed cadence. Anyone can prove history was not rewritten without seeing its contents.
8. **Aggregate transparency, individual privacy.** Every economy's total supply, issuance and treasury are public. Individual balances are private by default.
9. **Exit.** A member can always leave with what they own. Chain assets are self-custodied. Kernel units follow their State's charter, which must disclose exit terms before anyone joins.
10. **No impersonation of SOLVE.** No State unit may be presented as SOLVE, or as redeemable for SOLVE, unless it is fully backed by SOLVE held on chain and its reserves can be verified at any time.

---

## Part III — SOLVE, the common settlement asset

SOLVE is the unit States use to settle with each other and with the network. Its rules come from BUILD-BOOK §11 and are restated here as constitutional law.

| Article | Rule |
|---|---|
| Supply | 1,000,000,000 fixed. Allocation: ecosystem 45%, treasury 20%, team 15% (vested), liquidity 10%, community 10%. |
| Entry | Earned through verified action. No ICO, no presale, no buy-in. Ever. |
| Price | Discovered by the market. No peg, no defense. |
| Demand | Use before trade: verification fees, cross-State settlement tolls, marketplace transactions. |
| Layer | SPL token on Solana. Devnet mint approved. Mainnet only on the founder's explicit word. |

### How "earned" works without either layer impersonating the other

1. An actor does something. The kernel records it as an event with evidence.
2. A reward policy, versioned and published, decides eligibility. The policy's service actor records `reward.awarded` in the kernel, citing the evidence and the rule version. That is a causal fact.
3. A distributor key releases SOLVE from the ecosystem vault on chain. The vault program enforces rate limits. That is settlement.
4. The chain observer records `settlement.observed` with the transaction signature at finalized commitment. Only then does kernel accounting for that SOLVE move.

The kernel decides what was earned. The chain decides who holds it. Neither does the other's job.

---

## Part IV — State economies

A State is a sovereign community economy with its own scope (`state:<id>`), its own members, roles and treasury, and optionally its own unit.

### Charter

A State is admitted by ratifying a charter, recorded as a kernel event. The charter must declare:

| Field | Meaning |
|---|---|
| Unit | Code, decimals, label. |
| Class | Closed-loop, backed, or floating (below). |
| Layer | Kernel-only or chain. |
| Issuance rule | Fixed, scheduled, earned against evidence, or minted against SOLVE reserves. |
| Issuer authority | Which roles in `state:<id>` hold issuance and treasury authority, and the approval threshold. |
| Sinks | How units leave circulation. |
| Convertibility | Whether and how the unit exchanges with SOLVE. |
| Exit terms | What a departing member keeps. |
| Amendment | Who may amend the charter, and the notice period for members. |

### Unit classes

| Class | What it is | Layer | Gate |
|---|---|---|---|
| **Closed-loop** | Points or credits used only inside the State. No cash value, no transfer out. | Kernel only | Lowest. Can launch with the kernel today. |
| **Backed** | Every unit fully reserved by SOLVE in an on-chain State treasury, redeemable for SOLVE at par. Reserves verifiable at any time. | Chain | Chain gates plus a proof-of-reserves service. |
| **Floating** | Market-priced, on chain. | Chain | Highest. Separately gated legal and economic review. |

A State may move to a higher class only by charter amendment with member notice. It may never move down silently.

### Settling between States

States never trade units directly. They settle in SOLVE.

```
Member in State A pays a member in State B
  kernel   A-unit debit and credit inside state:A           (causal, private)
  chain    State A treasury → State B treasury, in SOLVE     (settlement, public)
  kernel   settlement.observed for both treasuries           (observation)
  kernel   B-unit issued or released to the payee inside state:B
```

Exchange rates between a State's unit and SOLVE come from that State's own exchange facility: a treasury window or a market. The network sets no rates.

---

## Part V — The crossing protocol

Every movement of a chain asset follows the same five steps.

1. **Intent.** Kernel event `settlement.intended`: payer, payee, asset, amount, quote and expiry, correlation id.
2. **Authorization.** Kernel checks the payer's grant and policy. For an agent, the owner's spending cap. Approval events where policy requires them.
3. **Execution.** The key holder signs on chain. solve never holds user keys. State treasuries use a program or multisig governed by the charter's thresholds.
4. **Observation.** The chain observer, a service actor, records `settlement.observed` once the transaction is finalized. The evidence carries the signature, slot and commitment level.
5. **Reconciliation.** Kernel accounting for the chain asset moves only on observation. Intents that expire without observation are closed by an event. Mismatches open a reconciliation case.

Kernel-only units skip steps 3–4. Their posting is the settlement.

---

## Part VI — How this maps onto the memory kernel

Built and tested in `supabase/migrations/20261003064603_memory_kernel.sql`:

| Constitutional need | Kernel primitive |
|---|---|
| SOLVE defined by the network | `define_asset('SOLVE', issuer 'system', 9 decimals)`, root authority only |
| State scope and founding authority | `claim_scope('state:<id>')` gives the founder full authority over the State |
| State unit with its own issuer | `define_asset(code, issuer 'state:<id>')`, network-approved |
| Only issuers create supply | Credit-normal and negative-allowed accounts are refused outside the issuer scope |
| Consent on every movement | Credits require `kernel.ledger.post` covering the account's scope |
| Bounded agents | Agents start with no grants; delegated grants die with their parent |
| Chain observations as evidence | `externally_verified` evidence can be attached only by service actors |
| Mirror accounts only the chain can move | Open them under `system/chain:solana` and grant `kernel.ledger.post` there only to the observer service. `chain` scopes cannot be claimed. |
| Tamper evidence | Hash chain plus `verify_chain()`, which also cross-checks ledger rows against their postings |

Next kernel additions (v1.1), each a new migration:

- `assets.layer` (`kernel` or `chain:solana`) and `assets.class` (closed-loop, backed, floating), set at definition and amendable only by charter event.
- Event types `state.chartered`, `state.charter_amended`, `settlement.intended`, `settlement.observed`, `settlement.expired`, `anchor.published`.
- Delegated asset definition: let the network grant `kernel.asset.define` for a State's own issuer scope, so admission no longer needs root.
- An anchor publisher service that commits the kernel chain head to Solana and records `anchor.published`.

---

## Part VII — Failure modes

| Failure | Containment |
|---|---|
| Kernel database compromised | Public anchors expose rewritten history. Chain assets stay with their holders. |
| Chain reorg or stalled finality | The kernel records only finalized settlement and re-checks before reconciling. |
| Observer lies or fails | Its evidence carries a signature anyone can check. Add a multi-observer quorum before mainnet. |
| State over-issues | The kernel refuses issuance outside the charter. The network can suspend a State's convertibility; it cannot seize members' assets. |
| Run on a backed unit | 100% SOLVE reserve, verifiable on chain at any time. |
| Agent overspends | Spending cap defaults to zero; grants expire and revoke in cascade. |
| Double spend across layers | One layer per unit at a time; crossings are lock-and-mint or burn-and-release. |

---

## Part VIII — Gates and open decisions

**Gates.** Nothing below happens without the founder's explicit approval and a legal review. This document is not legal advice. Token issuance, exchange, custody, convertibility and cross-border settlement can trigger securities, money-transmission, commodities and tax rules.

- SOLVE mainnet mint.
- Any State unit on chain.
- Any convertibility between a State unit and SOLVE.
- Any custody, deposits, cash-out, card or yield (forbidden by BUILD-BOOK §11 today).

**Open decisions for the founder.**

1. **Name.** BUILD-BOOK §11 calls the unit SOV. This draft uses SOLVE, per the founder's 2026-10-03 instruction. The legacy game also has a virtual "SOV" with no cash value. Settle on one name before any mint, to avoid confusion with the game currency.
2. **Settlement toll.** Size of the cross-State toll in SOLVE, and whether any share is burned. A fixed supply with a burn is deflationary; that choice belongs to the founder.
3. **Anchor cadence.** Hourly, daily, or every N events.
4. **Reward policy v1.** Which verified actions earn SOLVE first. The launch playbook suggests verified seller track records.
5. **Governance path.** Today the founder holds root. When, and to whom, root authority over amendments moves.
