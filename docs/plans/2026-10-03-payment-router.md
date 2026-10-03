# Plan — Payment router (test assets)

2026-10-03 · branch `claude/keen-cerf-tpd7io` · spec: [`docs/MONETARY-CONSTITUTION.md`](../MONETARY-CONSTITUTION.md) Part VIII

Goal: "Send Bob $10" on test assets, through PaymentIntent → Quote → Route → Execution → Settlement → Reconciliation, comparing every available route and never forcing SOLVE.

```
intent (kernel) → quote (venues) → route chosen (kernel) → re-price + co-sign (venues)
→ one atomic transaction (chain) → submitted / confirmed / failed / needs_reconciliation (kernel)
```

## Environments

| Layer | Executable now | Production target |
|---|---|---|
| Kernel | PGlite running the real migrations | Supabase `Solve-Official-` |
| Chain | LiteSVM running the real SPL Token, ATA, System and Memo programs | Solana devnet, then mainnet on the founder's word |
| Assets | DEV-SOLVE (real genesis), DEV-USDC and ARC (test-only mints, 6 decimals, no value) | USDC, State coins once States exist |
| Venues | RFQ makers co-signing from inventory in token accounts | On-chain AMMs, order books, aggregators, State markets behind the same `Venue` interface |

## Quotes without a protocol price

Every leg quote names its venue and carries:

| Field | Meaning |
|---|---|
| `spot` | Marginal output per input before fees and impact (ratio of base units) |
| `twap` | Venue-reported time-weighted spot over its own observations, or none |
| `amountIn`, `amountOut` | Executable amounts at the venue's live state |
| `tradingFee`, `providerFee` | Fees in the input asset; the provider fee goes to a separate account |
| `depth` | Liquidity the venue can draw on for the pair |
| `observedAt` | Quote timestamp |

Inputs are valued at a **mark**: the best composed venue spot from that asset into the denomination. Marks are labelled venue spot, not a price. For every route, in denomination base units:

```
NetOutput = Gross − NetworkCost − TradingFees − ProviderFees − Slippage
Gross      = input × mark (spot value)
NetOutput  = executable value delivered
NetworkCost = 0 for the user (the sponsor pays fees and rent; reported in lamports)
Slippage   = the remainder: price impact plus any path priced worse than the mark
```

Routes are ranked by `Gross − NetOutput`, then sponsor lamports, then hops. No asset is weighted.

## Execution

- **Exact-out, backward.** Each path is quoted from the delivered amount back to the input.
- **Re-price at build.** The executor re-quotes the same path against live state. It refuses if the quote expired (`stale_quote`), if the input now exceeds `maxInput` (`slippage`), if a venue is down (`provider_unavailable`) or if the payer lacks the input.
- **One transaction.** It holds a payment marker (`createAccountWithSeed` from the payer and `payment_id`), a recipient token account, every leg's transfers (payer → venue 1 → venue 2 → … → recipient, with provider fees paid to fee accounts) and a memo. A failed leg rolls back everything.
- **Venues co-sign last.** Each venue decodes the transaction and refuses unless:
  - its only flows are one input and one output,
  - it receives at least the provider fee its curve requires,
  - its output is at most what its curve pays at live inventory,
  - its accounts appear nowhere but plain transfers.

## Kernel v3 (`supabase/migrations/20261003080203_payment_router.sql`)

| Table | Holds |
|---|---|
| `chain_assets` | asset ↔ mint per chain; must match the settlement rail's mint |
| `payment_profiles` | versioned receiving address (a linked wallet) and accepted assets per actor and chain |
| `payment_intents` | payer, recipient, amount, slippage tolerance, pinned recipient address and accepted assets; `payment_id = sha256('solve:payment:v1|' ‖ intent_id)` |
| `payment_routes` | the chosen executable quote per attempt (route JSON, input, limit, delivery, quote times) |
| `payment_transitions` | routed → submitted → confirmed \| failed \| needs_reconciliation, with signature, executed input and the signed bytes |

Functions: `register_chain_asset`, `read_chain_assets`, `set_payment_profile`, `read_payment_profile`, `create_payment_intent`, `select_payment_route`, `record_payment` (payment service only), `read_payment`, `my_payments`.

Rules:

- **Who acts.** Only the payer routes. Only the payment service (`kernel.payment.record` on the chain scope) records outcomes.
- **Route checks.** Quotes must be live and last at most 120 s. The route must pay the pinned address and deliver an accepted asset. Delivery in the denomination is the full amount. The input limit stays within the intent's tolerance.
- **One transaction per attempt.** A submission's input must be within the limit. A new route needs a definite failure first. Confirmation needs chain evidence and the submitted signature, and a payment confirms at most once.
- **No balances or prices.** The kernel keeps neither for payments.

## Worker (`lib/money/payment.ts`)

- **Submit.** `submitPayment` records `submitted` with the signed bytes before sending. On an unknown outcome it records `needs_reconciliation`. On a rejected send it checks the marker before recording `failed`.
- **Reconcile.** `reconcilePayment` confirms if the marker is present. Otherwise it resends the recorded bytes, so the payment can land at most once.
- **Retry loop.** `sendPayment` runs quote → select → build → submit. It re-quotes around the venues that failed, and is safe to call again.

## Files

| File | Purpose |
|---|---|
| `lib/router/math.ts` | Exact constant-product and price-ladder math, fee split, ratios |
| `lib/router/types.ts` | Quote, leg, route, cost breakdown, venue interface |
| `lib/router/venues.ts` | `ConstantProductVenue` (amm, state_market), `LadderVenue` (orderbook), co-sign verification |
| `lib/router/router.ts` | Path search, marks, deliveries, costs, ranking, TWAP guard |
| `lib/router/execute.ts` | Re-price, atomic transaction, payment marker, co-signatures |
| `lib/money/payment.ts` | Worker, reconciliation, retry loop |
| `tests/router/*` | Math, route comparison, liquidity, balance, provider failure, TWAP guard |
| `tests/kernel/payments.test.ts` | Kernel rules |
| `tests/e2e/send-bob.test.ts` | Send Bob $10 and every adversarial case on PGlite + LiteSVM |
| `scripts/send-bob.ts` | The scenario printed step by step |

## Known limits

- **RFQ makers, not on-chain AMM programs.** A maker that co-signs two transactions against the same inventory can be filled at stale terms. An on-chain AMM program enforces its curve itself.
- **No external aggregator.** The router composes venues itself.
- **Unverified non-denomination delivery.** Delivery in a non-denomination accepted asset is sized by the payer's executable quote; the kernel records it but cannot verify it.
- **Gateway semantics decide failure.** "Definitely failed" relies on them: a failed on-chain result, or a resend of the recorded bytes that is rejected while the marker is absent.

## Commands

```bash
npm test
npx tsx scripts/send-bob.ts
```
