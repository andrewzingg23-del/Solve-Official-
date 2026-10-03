# BUILD_STATUS

Updated 2026-10-03. Branch `claude/keen-cerf-tpd7io`.

## DONE

- **Memory kernel (directive 1), code and tests.** `supabase/migrations/20261003064603_memory_kernel.sql`: events with provenance, append-only tables, SHA-256 hash chain, double-entry ledger with issuer-scoped supply, evidence with basis rules, identity-gated writes, cascading grant revocation, AI agents bounded by their owner.
- **Kernel installed on the store (directive 2).** Supabase project `Solve-Official-` (`dupgybzkkbddsbaykrae`): migrations `20261003064603_memory_kernel`, `20261003072025_monetary_proof_of_life` and `20261003080203_payment_router` (function bodies verified identical to the repo). Live checks: `verify_chain` ok, `anon` has no access, API roles reach only `kernel_api`, only the service role can verify the chain.
- **Monetary proof-of-life (local).** The 16-step causal chain runs end to end: sign-in → actor → World → obligation → evidence → entitlement → balanced ledger → obligation-derived settlement id → DEV-SOLVE Earn Vault release → chain balance → P2P transfer → reload with kernel and chain reconciled. `npx tsx scripts/proof-of-life.ts` prints it. Kernel: the real migrations in PGlite. Chain: LiteSVM executing the real SPL Token/ATA/System/Memo programs.
  - Fixed 1B supply sealed at genesis; five separately owned vaults; bounded Earn release capacity.
  - Exactly-once settlement: obligation-derived id, one entitlement per obligation, one confirmation per settlement, on-chain seed marker.
  - Settlement worker survives retries, concurrent workers, lost responses and RPC outages; a failed release is never recorded as completed.
- **Payment router on test assets.** "Send Bob $10": intent → quote → route → atomic execution → settlement → reconciliation. `npx tsx scripts/send-bob.ts` prints it. Plan: `docs/plans/2026-10-03-payment-router.md`.
  - Venues (constant-product AMMs, a State market, a price-ladder order book) quote spot, TWAP, executable amounts, depth and timestamps; no protocol price.
  - Every route compared and ranked by cost in the denomination; NetOutput = Gross − NetworkCost − TradingFees − ProviderFees − Slippage holds exactly; SOLVE is an intermediary only when cheaper.
  - One transaction per attempt with a payment marker: a failed leg rolls back the route; retries, lost responses, outages, concurrent workers and replays pay once.
  - Kernel v3 pins the recipient's published address and accepted assets, rejects stale quotes, recipient mismatch and inputs beyond the slippage bound, and records one confirmation per payment.
  - Venues co-sign only after checking their own flows against live inventory.
- **Tests:** 101 pass (`npm test`): kernel 35, money 13, payments 10, router 15, chain 11, end-to-end 17.
- **App shell and live preview.** `solve-git-claude-keen-cerf-tpd7io-sovigrn.vercel.app`, connected to the store. Email sign-in is switched off for now (founder, 2026-10-03): Enter opens `/money`, which runs the proof-of-life and Send Bob $10 live on the server in a fresh in-memory kernel and chain per click (test assets, nothing saved). `/login` and `/account` still exist, unlinked.
- **Specs.** `docs/MONETARY-CONSTITUTION.md` draft 3 (source spec for money; Part XIV lists what is enforced). `docs/plans/2026-10-03-monetary-proof-of-life.md`, `docs/plans/2026-10-03-payment-router.md`. Queued: `docs/specs/2026-10-03-world-interface.md` and `docs/specs/2026-10-03-avatar-world-integration.md`.

## DOING

- Nothing in flight.

## BLOCKED

- **Sign-in on the live preview (founder).** The account exists and the link was opened, but Supabase never received the app's code exchange: the link redirected away from the app. Add `https://solve-git-claude-keen-cerf-tpd7io-sovigrn.vercel.app/**` under Authentication → URL Configuration → Redirect URLs, and set the Site URL to the same host. Also add `kernel_api` under Data API → Exposed schemas. The built-in mailer allows only a few emails per hour (429s seen); wait or add custom SMTP.
- **Devnet.** This build sandbox's network policy blocks `api.devnet.solana.com`, so DEV-SOLVE genesis has not run on devnet. Allow the host in the environment's network settings, or run genesis from a machine with access. The RPC gateway (`lib/chain/rpc-gateway.ts`) is written but unverified.
- **Live settlement.** The deployed app needs the Supabase secret (service-role) key, a funded devnet sponsor key and the settlement key in Vercel before it can settle on devnet.
- **Directive 1 not moved to DONE.** Stays ACTIVE until sign-in → SOV ID → history runs on the live store. Only the founder edits directives.

## NEXT

1. World Interface with the Avatar layer built into it (`docs/specs/2026-10-03-world-interface.md`, `docs/specs/2026-10-03-avatar-world-integration.md`): persistent Cesium shell, semantic zoom, entity registry, Horizon, lenses, one shared interaction context, Digital Me / AI Companion / Abstract on one canonical Avatar identity, presence, deixis, presentation commands, authority engine on kernel grants, scoped memory.
2. Devnet genesis and rail bootstrap once devnet is reachable; then live settlement and payments on devnet.
3. First Network State, State market, privacy, real-world exit, State credit, AI economic agents (constitution order).
4. Payment router: an on-chain AMM venue (audited program) in place of RFQ makers; external aggregator adapter.
5. Concurrency test against real Postgres; vesting and treasury programs.
6. Whop bridge Pack (directive 3) once sign-in runs on the store.

## Decisions waiting on the founder

- Naming: SOLVE (reserve) vs SOV (identity, card); the legacy game's virtual SOV collides.
- First real reward policy and evidence thresholds; Earn release capacity and who holds the Earn cold key.
- Vesting/treasury programs: build or adopt audited ones. Anchor cadence. Governance path.
