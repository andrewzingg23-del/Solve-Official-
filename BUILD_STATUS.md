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
- **Kernel in the browser.** The exact kernel migrations run in the visitor's browser: PGlite served untouched from `/public/pglite` and imported natively (no bundler transform), persisted in IndexedDB. `npm run test:browser` runs the kernel tests in Chromium against it.
- **Kernel v4 — authority, actions, World Graph (in the repo, not yet on the store).** `supabase/migrations/20261003110000_actions_and_world.sql`. Authority, not humanness, decides: `decide` returns ALLOW, REQUIRE_SECOND_AUTHORITY, REQUIRE_QUORUM, REQUIRE_DELAY, REQUIRE_CHALLENGE_WINDOW, REQUIRE_MULTISIG or DENY. One action lifecycle (proposed → authorized → enacting → completed / failed / needs_reconciliation) for every consequential write; native kinds bound to their capability; capability leases; agents spawning agents with provenance; self-expansion outside governance denied; messages and commitments with a reply-depth stop; World Graph entities and relations with truth states; tasks; avatars with representations. Kept editable until the World slice stabilizes it, then applied as a new migration.
- **Arcadia sandbox.** A fictional test civilization (you, Bob, eight organizations at real cities with owners and agents, verified / self-reported / challenged claims, two Network States) built through the real kernel into a snapshot (`npm run arcadia`, 179 events) and booted in the browser.
- **The World at `/`.** Cesium Earth (offline imagery, no ion), Horizon ("What do you want to make real?"), lenses SPACE / PEOPLE / POWER / FLOW / CAUSE / PROOF / TIME / SELF over one World Graph, one shared interaction context with deixis, validated presentation commands, ≤ 3 actions per answer, avatar onboarding (Be me / Create my AI / Keep it abstract). The interpreter is rule-based and says so; no AI model is connected. The car-company loop runs in the UI: intent → venture World and route (contract manufacturing ≈ $140M vs own plant ≈ $1.21B, labelled estimates) → candidates on the globe (one challenged) → "Can they make 10,000?" → DENY without a grant → you delegate contact → the supplier's agent answers from verified records → you accept under your own authority → kernel event, visible in POWER / FLOW / PROOF / SELF.
- **Tests:** 117 pass (`npm test`), including the World loop end to end on Arcadia; 71 kernel tests pass in Chromium (`npm run test:browser`).
- **App shell and live preview.** `solve-git-claude-keen-cerf-tpd7io-sovigrn.vercel.app`, connected to the store. Email sign-in is switched off for now (founder, 2026-10-03). `/` is the World (Arcadia sandbox, runs in the browser); `/money` runs the proof-of-life and Send Bob $10 live on the server in a fresh in-memory kernel and chain per click (test assets, nothing saved). `/login` and `/account` still exist, unlinked.
- **Specs.** `docs/MONETARY-CONSTITUTION.md` draft 3 (source spec for money; Part XIV lists what is enforced). `docs/plans/2026-10-03-monetary-proof-of-life.md`, `docs/plans/2026-10-03-payment-router.md`. World: `docs/specs/2026-10-03-world-interface.md`, `docs/specs/2026-10-03-avatar-world-integration.md`. Contracts: `DOMAIN-CONTRACTS.md`, `DECISIONS.md`, `SECURITY-INVARIANTS.md`, `ACTIVE-WORK.md`.

## DOING

- **Self-operation proof.** SOV runs one bounded internal task through its own substrate: signal → task → worker agent under a lease → result → independent verifier agent → enactment → kernel event → closed.

## BLOCKED

- **Sign-in on the live preview (founder).** The account exists and the link was opened, but Supabase never received the app's code exchange: the link redirected away from the app. Add `https://solve-git-claude-keen-cerf-tpd7io-sovigrn.vercel.app/**` under Authentication → URL Configuration → Redirect URLs, and set the Site URL to the same host. Also add `kernel_api` under Data API → Exposed schemas. The built-in mailer allows only a few emails per hour (429s seen); wait or add custom SMTP.
- **Devnet.** This build sandbox's network policy blocks `api.devnet.solana.com`, so DEV-SOLVE genesis has not run on devnet. Allow the host in the environment's network settings, or run genesis from a machine with access. The RPC gateway (`lib/chain/rpc-gateway.ts`) is written but unverified.
- **Live settlement.** The deployed app needs the Supabase secret (service-role) key, a funded devnet sponsor key and the settlement key in Vercel before it can settle on devnet.
- **Directive 1 not moved to DONE.** Stays ACTIVE until sign-in → SOV ID → history runs on the live store. Only the founder edits directives.

## NEXT

1. Apply kernel v4 to the store; then the World runs against the live kernel for signed-in users as well as the sandbox.
2. World and avatar depth: embodiment (workshop scene), scoped and encrypted avatar memory, presence, return experience, a real reasoning provider behind the same validated command interface.
3. Devnet genesis and rail bootstrap once devnet is reachable; then live settlement and payments on devnet.
4. First Network State, State market, privacy, real-world exit, State credit, AI economic agents (constitution order).
5. Payment router: an on-chain AMM venue (audited program) in place of RFQ makers; external aggregator adapter.
6. Concurrency test against real Postgres; vesting and treasury programs.
7. Whop bridge Pack (directive 3) once sign-in runs on the store.

## Decisions waiting on the founder

- Naming: SOLVE (reserve) vs SOV (identity, card); the legacy game's virtual SOV collides.
- First real reward policy and evidence thresholds; Earn release capacity and who holds the Earn cold key.
- Vesting/treasury programs: build or adopt audited ones. Anchor cadence. Governance path.
