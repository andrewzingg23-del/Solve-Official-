# Plan — Monetary Proof-of-Life

2026-10-03 · branch `claude/keen-cerf-tpd7io` · spec: [`docs/MONETARY-CONSTITUTION.md`](../MONETARY-CONSTITUTION.md)

Goal: one causal path, adversarially tested, before any wider scope.

```
identity → World → obligation → outcome → evidence → verification → entitlement
→ balanced ledger → deterministic settlement → DEV-SOLVE Earn Vault release
→ on-chain ownership → P2P transfer → reconciliation
```

## Environments

| Layer | Executable now | Production target |
|---|---|---|
| Kernel | PGlite running the real migrations (tests); Supabase `Solve-Official-` (schema only) | Supabase `Solve-Official-` |
| Chain | LiteSVM: in-process Solana runtime executing the real SPL Token, ATA, System and Memo programs | Solana devnet (`DEV-SOLVE`), then mainnet `SOLVE` on the founder's word |

The sandbox cannot reach Solana devnet (network policy). The chain layer talks to a `ChainGateway`; LiteSVM and RPC (devnet) gateways implement it, so the same transactions run in both.

## On-chain design (no custom program)

| Law | Enforcement |
|---|---|
| 1B created once, no future mint | Mint 1B in one transaction that also sets the mint authority to none. The SPL Token program then rejects every `MintTo`. No freeze authority. |
| Five separate vault domains | Five token accounts, each owned by a distinct key. No key controls more than one vault. |
| Bounded Earn releases | The Earn owner (cold) approves the settlement authority (hot) as delegate for a release capacity. The hot key can never move more than the remaining allowance. |
| Exactly-once settlement | Each release transaction atomically creates a marker account at `createAddressWithSeed(settlementAuthority, settlementId[0..32], System)`. A replay fails because the marker exists; no transfer happens. |
| Reconciliation | Marker present ⇔ the release executed (atomicity). Used after timeouts and outages. |
| Gas abstraction | A sponsor key pays fees and rent. Users never need SOL. |

Known limit: team vesting (12-month cliff, 72-month horizon) and treasury timelocks need a vesting/governance program. Until then the team, treasury, liquidity and community vaults have no delegate and their owner keys are cold; the vesting schedule is computed deterministically in code.

## Kernel v2 (new migration; the applied v1 file is never edited)

- `kernel.reward_policies` — versioned, append-only. Required evidence bases must include a non-self basis. Policy caps.
- `kernel.wallet_links` — actor ↔ chain address.
- `kernel.entitlements` — keyed by obligation + beneficiary + policy key. `settlement_id = sha256("solve:settlement:v1|" obligation | beneficiary | policy_key)`. Attribution per obligation ≤ 10,000 bps. Stale policy versions rejected. Evidence root over distinct evidence hashes.
- `kernel.settlements` + `kernel.settlement_transitions` — prepared → submitted → confirmed | failed | needs_reconciliation. At most one `confirmed` per settlement (unique index).
- Ledger, asset `DEV_SOLVE`, scope `system/chain:<cluster>/vault:earn`:
  - chain genesis observed: Dr `earn_onchain` / Cr `earn_unallocated`
  - entitlement: Dr `earn_unallocated` / Cr `earn_payable` (cannot over-commit: `earn_unallocated` may not go negative)
  - settlement confirmed: Dr `earn_payable` / Cr `earn_onchain`
- `record_event` replays now compare the payload; a reused key with a changed payload fails.

## Files

| File | Purpose |
|---|---|
| `lib/chain/gateway.ts` | `ChainGateway` interface, send outcomes |
| `lib/chain/rpc-gateway.ts` | Devnet/mainnet RPC gateway with signature-status polling |
| `lib/chain/solve.ts` | Supply constants, genesis, release, transfer, reads, markers, vesting |
| `tests/support/litesvm-gateway.ts` | LiteSVM gateway |
| `tests/chain/solve.test.ts` | Supply, vault, release, replay, capacity, transfer tests |
| `supabase/migrations/*_monetary_proof_of_life.sql` | Kernel v2 |
| `tests/kernel/money.test.ts` | Entitlement and settlement adversarial tests |
| `lib/money/settlement.ts` | Settlement worker (outbox) |
| `tests/e2e/proof-of-life.test.ts` | The 16-step scenario plus adversarial cases, PGlite + LiteSVM |
| `scripts/proof-of-life.ts` | Same scenario as a runnable script that prints the causal chain |

## Commands

```bash
npm test
npm run typecheck
npm run lint
npm run build
npx tsx scripts/proof-of-life.ts
```

## Then, in order

Payment router → first Network State → State market → privacy → real-world exit → State credit → AI economic agents.
