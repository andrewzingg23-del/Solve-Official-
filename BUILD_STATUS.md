# BUILD_STATUS

## Travel pack — 2026-10-30 (branch claude/travel-pack)

- `/travel`, a `travel` pack, and the bot tool `plan_travel`: one-tap links that open Uber with the ride filled in and Airbnb on a search for the place, dates and guests. Booking and payment happen in Uber or Airbnb; neither offers an API that lets solve book. Full suite 452/452, typecheck and lint ok.

## Main integration — 2026-10-08 21:23 EDT

- Founder: "add it and ship", followed by "fix it". Fast-forwarded main from `661dfb7` to reviewed code `96c9908`; push and remote main hash confirmed. Integrated source matches the previously verified 421-test release exactly; no implementation changes or repeat of unaffected suites.
- Prepared a source-hashed five-migration staging package. Local atomic upgrade preserved existing event IDs/hashes and the World, supported invitation acceptance and posting, and rejected repeated whole-package application without data changes.
- Live activation remains blocked: Supabase management and Vercel admin credentials are missing; GitHub status/check API requests return Forbidden even outside the filesystem sandbox. Added the three specific API domains and secure admin credential requirements to the cloud draft. Saved draft revision 6 is confirmed; it requires settings review/save and publication, and does not change the current runtime.
- No remote migration was applied. CI/deployment status and live Auth/provider behavior are unconfirmed. The main push can be picked up by the project's existing Git deployment integration; it is not evidence of a working deployed shared room.

## Branch checkpoint — 2026-10-09 (shared idea space, codex/shared-idea-space)

- First collaboration release: owner-managed expiring invitations, authenticated acceptance, persistent room messages, attributed human decisions, shared AI context with source versions, retries after reload, external MCP room tools, conflict-aware document editing, and a component cost worksheet with saved assumptions.
- Extends existing Worlds, documents, actors and grants. Private documents are excluded from shared inference even for a private-read owner; revisions preserve disclosure level. Five additive migrations are listed in `docs/handoff/SHARED-IDEA-SPACE.md`.
- Local checks: 421 tests passed, no failures/skips; typecheck and production build passed; lint reported 0 errors and 5 pre-existing warnings. The two-context Chromium journey passed with real SQL persistence/permissions and labelled Auth/inference fixtures, including duplicate submissions, refresh history retention and legacy source rendering. Fresh production HTTP smoke checks confirmed anonymous API denial, room sign-in redirect and private invitation landing.
- Independent branch review complete: all four Important findings fixed with regressions; no Critical or Minor findings, no waivers. The invitation RPC now hashes the original token internally; stored digests cannot grant access. Source fields are checked before saving; acknowledged composer IDs retire; displayed history survives refresh.
- No remote migration or deployment command and no live Auth/provider test. Supabase/OpenRouter settings remain missing; their requirements were saved in the cloud configuration draft. GitHub Actions status could not be read: GitHub API returned Forbidden. This is local verification, not a CI/deployment success claim. Real-Postgres concurrency and live integration remain staging checks.

## Current checkpoint — 2026-10-08 (ARGUS canvas v4, main @ 7e48454)

- ARGUS canvas rebuilt as three.js + custom GLSL (commit 7e48454): fbm domain-warped plasma background, fresnel volumetric core + UnrealBloom, 5,200 GPU particles in 4 vortex bands, 9 energy beams as shader ribbons with comet pulses, dashed orbital rings, grid floor, ghost typography, starfield. 9 info clouds unchanged (Oct 7 FOMO snapshot) as HTML overlays projected from 3D anchors. Canvas-2D v3 kept as WebGL fallback (argus-canvas-2d.tsx). page.tsx untouched.
- Checks: eslint clean, tsc clean, next build ok. CI + Vercel status verified after push (see stream).
- Also fixed this session: /packs/trading 500 (commit 6018f5d — CountUp format prop was a function passed server→client; now a serializable key).

## Previous checkpoint — 2026-10-08 (whole-site quality upgrade, main @ 394dcfd)

- Whole-site award-level pass across all routes (commits 7631e47 + 394dcfd): /start full step choreography (ambient canvas, TraceBeam progress, staggered entrances, radar pings, scan sweeps); trading pack aurora hero, real-value count-ups, animated sparkline draw-in, border-beam Intel cards; avatar presence canvas + premium card reveal (3D tilt, tracing beam, holographic glint); 21 long-tail surfaces converted to dark cinematic law; deleted dead app/claim/claim-flow.tsx.
- Theme law enforced app-wide: abyssal blue-black, cyan #22d3ee single accent, ice-white text. The saved-receipt "white floor" was retired — tests/bot/receipt.test.ts updated to assert the dark floor (BRAND.md still documents the white floor; needs Drew's ruling).
- Checks: eslint 0 errors, tsc clean, next build ok, 378/378 tests pass in CI. GitHub Actions 37715641041 success. Vercel dpl_5L3da64RxJmsnBvTaURMLqAWpFHG READY.
- Known pre-existing: tests/e2e/reasoning-oidc.test.ts hangs locally (excluded from CI too? no — CI ran 378; the hang is local-only parallel-runner flake).

## Previous checkpoint — 2026-10-07 (ARGUS canvas rebuild, main)

- `app/packs/trading/argus/argus-canvas.tsx` rebuilt: quarter-res bloom post-processing, additive particle vortex bands with pseudo-perspective depth, bezier tentacle data packets with spring-overshoot core flash, noise-driven organic motion, parallax starfield + slow camera drift. Same 9 info clouds and snapshot labels; DPR cap 2, reduced-motion static frame, canvas 2D only.
- Checks: eslint clean, `tsc --noEmit` clean, focused `tests/packs/` 8/8 pass, `npm run build` succeeds (routes `/packs/trading/argus`, `/packs/trading/watchlist` in output). Full suite not run (pre-existing hang on `tests/e2e/reasoning-oidc.test.ts`, unrelated — no test files touched).
- Pushed to `main`; Vercel auto-deploy. CI/deploy status verified after push.

Updated 2026-10-04. Branch `codex/need-to-route-network-state-spec`.

## Current checkpoint — 2026-10-04

- The resource-coordination principle is now in `VISION-CANON.md`: SOV organizes project time, skill, ideas, capital, labor, tools, materials, and information with explicit identity, authority, provenance, and outcome evidence.
- The private World Resource Map is implemented. People can record and revise offers and needs; connected bots can read those structured entries and, when asked, map the person’s exact statement through `map_world_resource`. Entries remain self-reported, nonbinding, and unassigned.
- Resource authorship and latest edits come from append-only kernel events. Bot-created entries display the bot and the owner it acted for; that owner can correct the entry. Editable entity fields cannot forge the recorded reporter. The bot’s combined World context is capped at 12,000 characters and identifies shortened fields.
- GitHub Actions run `37202067170` passed on code commit `9c51f71a9b39a16148acb6860fa1a73b53dbe393`: 212/212 tests, typecheck, lint, and build all succeeded.
- Vercel did not build a preview for the latest commit: its check reports the project build-rate limit with an upgrade-to-Pro prompt. The latest READY staging preview is `https://solve-9v7jxs767-sovigrn.vercel.app` at commit `e855f672c45e8944c69590eddbae45bd0a792ec4`; it contains the resource-map UI and bot read path, but predates `map_world_resource`.
- The latest code changes are on branch `codex/need-to-route-network-state-spec`. Production deployment and database were not changed.
- Family caregiving and independent repair shops remain research candidates, not selected markets. The research notes below describe their sources and limitations.

### Next sequence

- Make inviting a specific person and authorizing their bot clear and reversible using SOV IDs.
- Then design owner-approved resource matches and explicit commitments. Keep delivery evidence separate from self-reported offers.
- Choose a narrow market only after interviewing the people who would use the first workflow.

## Current Checkpoint — 2026-10-04

- Baseline code commit fd09d67 had green GitHub Actions CI. World wayfinding commit 2d94a60 passed its Vercel check, but its preview used the shared production Supabase environment and must not be used for sign-in. Branch-specific Preview overrides now target solve-staging; the latest pre-creative preview for commit 812153d is READY at https://solve-r7zx4k89o-sovigrn.vercel.app. Auth redirect settings still need verification; no sign-in was attempted.
- Supabase staging project solve-staging is active on Postgres 17. All four kernel migrations, including v4, are recorded. kernel_api.verify_chain() returned ok=true across 35 events.
- Staging rehearsal record (Claude, finished 00:58Z, before the handoff): before v4, solve-staging equaled live in function, column, constraint and ACL fingerprints. After v4 it equals the local Postgres 17 rehearsal, and `tests/staging/v4-rehearsal.test.ts` now asserts those fingerprints. Sign-in plus 12 refusal checks hold through the API roles. The answer-service kernel path (`scripts/staging/service-path.sql`) behaves the same as locally. A ledger posting committed as `authenticated` succeeds. The 35 events are those test runs: test actors, a market World, an asset and one posting. One test actor (auth subject `00000000-0000-4000-8000-000000000001`, not a real user) holds the staging root grant, so `kernel.grant_root` for a real actor will refuse until that grant is revoked. The scratch schema `rehearsal_load` remains (migration text only, no API access). Details and the live runbook: `docs/plans/2026-10-03-kernel-v4-rollout.md`.
- Read-only grants check: anon lacks kernel_api usage; authenticated has kernel_api usage but no kernel schema usage or direct kernel.events SELECT; service_role also has no direct events-table SELECT.
- Production has not received v4; no production database changes were made. Existing Vercel production Supabase variables still match the production project; staging overrides are scoped to Preview on this build branch only.
- The local code snapshot at fd09d67 was blob-verified before this slice. A new kernel-backed creative slice now creates a private World scope and owner relation, opens the World at `/world/[worldId]`, and creates, moves, revises, reloads, and lists text artifacts through kernel_api. The same form retry uses a stable idempotency key; History displays recorded events and identifies an agent's accountable owner.
- One earlier npm test invocation run concurrently with typecheck/lint exited nonzero at file level (10 of 23 files). The isolated kernel test passes; that local full-suite attempt is not reported green. Baseline fd09d67 had green GitHub Actions CI; the current UI slice has local build checks plus a successful Vercel check.
- Product gap: the real creative path has durable single-World text authoring, but staging sign-in is not demonstrated. Invitation UI, realtime sync and presence, conflict behavior, and a provider-neutral route for outside agents to contribute remain unbuilt.
- Staging Preview configuration: branch-specific `NEXT_PUBLIC_SUPABASE_URL` and publishable key were added for `claude/keen-cerf-tpd7io`; read-only comparison confirms they match solve-staging. The existing shared variables and Production targets remain unchanged.
- World-shell wayfinding slice: the existing eight lenses are grouped into four primary views (`World`, `Path`, `People`, `History`) and four specialist views under `More`; the sandbox label is visible on mobile. This reorganizes existing views only and does not add real-time presence or shared authoring.
- Checks for this UI slice: `npm run lint`, `npm run typecheck`, and `npm run build` passed locally. The sandbox initially blocked the build's `tsx` IPC socket; a permitted retry passed.
- Creative World slice checks: `node --import tsx --test --test-force-exit --test-reporter=tap tests/e2e/creative-world.test.ts` passed (1/1); `npm run lint`, `npm run typecheck`, and `npm run build` passed. The first build attempt hit the sandbox's `tsx` IPC socket restriction; the same build passed with execution permission. Full suite and browser lanes were not rerun locally; push CI is the broad regression gate.
- Plan and page outline: docs/plans/2026-10-04-open-creative-world.md.
- Reasoning model through Vercel AI Gateway: `/api/reason` prefers `ANTHROPIC_API_KEY`, then `AI_GATEWAY_API_KEY`, then Vercel's request-scoped OIDC token (`x-vercel-oidc-token` at runtime; `VERCEL_OIDC_TOKEN` for build/local). The Vercel project uses the team issuer; no shared API key was added. The READY preview at https://solve-owq94a6ee-sovigrn.vercel.app returned the expected sign-in gate from an anonymous availability check. No paid model call was made. CI run 70 passed 214 tests, typecheck, lint and build.
- Master bot, slice A (Claude, founder direction, 2026-10-04; plan `docs/plans/2026-10-04-master-bot.md`): the creator at `/bot`. A person designs their bot like a game character: 5 bodies and mix-and-match eyes, mouth, top, accessory, aura and colors, plus personality (name, relationship, four temperament sliders, a voice line, who it is, values). It previews live as an animated character in six moods; motion stops for reduced-motion settings. Saving creates the person's AI-companion avatar (its agent can only observe the owner's scope) and records a versioned `bot.persona.set` event in `actor:<owner>/bot:persona`. No migration. The bot's agent can read the persona and cannot change it; others are refused. Signed out, the creator is a labeled try-out that saves nothing. Not yet exercised through staging sign-in.
- Master bot, slice B (Claude): the connector. `/mcp` is a remote MCP server (Streamable HTTP, JSON-RPC) that Claude, ChatGPT (Developer Mode) and Meta Muse (custom connector) add by URL. It returns 401 with RFC 9728 metadata at `/.well-known/oauth-protected-resource[/mcp]`, and passes Supabase's authorization-server metadata through for older clients. Tokens come from Supabase Auth's OAuth 2.1 server. `/oauth/consent` shows the person's bot and lets them approve read-only or read-and-remember, recorded as `bot.connection.approved` in `actor:<owner>/bot:links`. Tools: `whoami`, `get_context`, `search`, `fetch` (ChatGPT's shapes) and `remember`. Reads run as the person; `remember` runs as the bot (service key acting as its agent, needing `bot.memory.*` that the person delegates when allowing it). Each memory records the client that added it, set from the token, never by the model. Read-only cannot write; there's a per-assistant rate limit; disconnecting stops it at once and revokes the Supabase grant. `/bot` shows the connector URL, setup steps, connected assistants and memories (add, forget). Not yet exercised against real assistants: staging needs the OAuth server enabled and `SUPABASE_SECRET_KEY` in the preview.
- Master bot, slice C (Claude): alive. On `/bot`, "<name> right now" shows the bot in a mood that follows real records, refreshed every 15 s while the page is visible:
  - working when an assistant just added a memory;
  - happy after your own change;
  - listening while a connected assistant was recently active;
  - resting after a quiet three days;
  - otherwise idle.

  It says one line in its own voice from templates over those facts (no model call). Its relationship numbers (days together, memories kept, assistants connected, looks) are kernel record counts, not game stats.
- Master bot, hardening (Claude, 2026-10-04): the founder's forecast problems, fixed in code.
  - **Erasable memory (kernel v5, `supabase/migrations/20261004040000_erasable_content.sql`).** Each memory's words, title and link are sealed with AES-256-GCM under a random key of their own (`lib/bot/seal.ts`, WebCrypto). The ciphertext goes into the append-only history; the key goes into `kernel_keys`, a separate mutable store no API role can reach. `kernel_api.seal_key` (only the recording actor, once), `unseal_keys` (same gate as reading the event) and `destroy_key` (needs `kernel.key.destroy`, which an owner holds through `*` and a bot does not; recorded as `kernel.key.destroyed`; never re-sealable). "Erase" on `/bot` destroys the key, so the words are gone for good while history keeps that a memory existed. Memories from before sealing can only be hidden, and the UI says so. Retries are deduplicated in the app (same words, same assistant, within an hour), because a sealed write cannot be byte-identical.
  - **Live presence (`lib/bot/presence.ts`, guarded policy `20261004040100_bot_presence.sql`).** Each connector tool call sends a private Realtime broadcast on `bot-live:<auth user id>` saying which assistant used which tool, never content. `/bot` shows "Claude is reading Nova's context…" with the thinking or working animation for 8 s. The Realtime policy lets only that signed-in person receive it; the migration skips itself where Realtime doesn't exist.
  - **Search over everything.** `search` and `fetch` page through the whole memory history (500 events a page, capped at 10,000 events, and they say when the cap is hit) instead of the newest 200.
  - **Injection guards.** Stored text loses invisible and direction characters (zero-width, bidi controls, word joiners, BOM, Unicode tag characters). `get_context` wraps memories in a marked block with `<`, `>` and `&` escaped, and caps the context at 12,000 characters.
  - Tests: `tests/bot/` 20 (new `erasure.test.ts`: sealing, readers, owner-only erasure, no direct key-store access, paging; `presence.test.ts`; an injection test). Kernel and bot suites pass on Postgres 17 (94/94).
  - Not yet on staging: the Supabase connector timed out twice applying v5 (it waits for a confirmation this session cannot give), and nothing changed. Not on live: v4 first, then v5 and the presence policy, each with the founder's go-ahead (`docs/plans/2026-10-03-kernel-v4-rollout.md`).
- Master bot, plugged into Worlds (Claude, 2026-10-04, founder direction: no freeze; keep building Worlds that solve real-world things and that people plug into). A connected assistant now has four more tools:
  - `list_worlds`: the person's Worlds and Worlds others let the bot into, each with the bot's access.
  - `read_world`: as the bot, inert and capped.
  - `start_world`: a private World for a goal, created with the person's own sign-in, since an agent can never claim a scope. Their bot is let in to add, and the goal becomes the first piece. A retry returns the same World, and there are at most 50 Worlds per person.
  - `add_to_world`: adds or revises a text piece as the bot. A retry is one change.

  On `/bot`, "Where <name> works" lists the person's Worlds with Out, Read and Add. Each choice issues or revokes kernel grants to the bot's agent on that World (`kernel.read`, `world.entity.write`, 30 days), visible in the World's history (`lib/bot/worlds.ts`). The connection mode "read and remember" is now labeled "read and add", with the same stored value. A World's owner can let someone else's bot in (the brother case); a member with read and add cannot pass that on, because the kernel refuses. Tests: `tests/bot/worlds.test.ts` (3), bot suite 23/23, and Postgres 17 28/28 together with Codex's creative-World and client tests. Codex's side is still open: choosing another person's bot from inside the World, and bot attribution in History.
- Strategy and the bot–World contract (Claude, proposals): `docs/plans/2026-10-04-critical-mass.md` covers competition, the build-real-things loop, fun without fake stats, architecture limits (the global chain lock holds to roughly 50k–100k daily actives, *estimate*), costs (bring-your-own AI keeps model cost at $0; infrastructure ≈ $45 a month for the pilot and ≈ $150–400 at 10k daily actives, *estimates*), and critical-mass phases with gates. `docs/plans/2026-10-04-bot-world-bridge.md` is the proposed contract with Codex for bots working in Worlds (grants only, no migration).

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
- **Kernel v4 — authority, actions, World Graph.** Applied to isolated Supabase staging and verified there. Still unapplied to the production store; see the current checkpoint and rollout runbook.
- **Arcadia sandbox.** A reproducible fictional test civilization (current build Arcadia/8: 389 events, 8 organizations) is generated through the real kernel into a snapshot and booted in the browser. This proves mechanics, not live user collaboration.
- **The Arcadia World sample.** Signed-out `/` and `/arcadia` open Cesium Earth, Horizon, eight lenses, one World Graph, shared interaction context, validated presentation commands, and avatar onboarding. The deterministic Arcadia scenario exercises the car-company loop. A remote Claude reasoning provider is implemented behind the validated interface, but sign-in and its deployment API key are not active; the sample remains labeled fictional data.
- **Private creative World, first durable slice.** Signed-in `/` redirects to `/worlds`; people can create/open a private World at `/world/[worldId]`, add/move/revise text artifacts, reload them, and see append-only World history. Root ownership, scoped reads/writes, actor attribution, and retry-safe form keys use kernel_api. This is persisted single-World work; realtime sync, invitations, undo, generic media/3D artifacts, and external-agent editing are still open.
- **SOV operates SOV (first self-operation proof).** `npx tsx scripts/self-operation.ts` prints it. A payment's chain response is lost → the payment service's monitor opens an operational task (cause, inputs, risk, evidence, distinct-party verification) → its worker agent claims it under a lease limited to that task and proposes the reconciliation as a governed action (REQUIRE_SECOND_AUTHORITY) → the trust service's verifier agent re-derives the facts and authorizes → the payment service reconciles only for that authorized action, recording chain evidence → the verifier confirms the consequence and closes the task. A crash mid-enactment resumes without a second record; a revoked lease stops the worker before the consequence; a false finding is never authorized; task-limited authority ends with the task. After two such failures the operations service records a learning event and a Class A build proposal (computed class, reuse analysis, rollback). Code: `lib/ops/`.
- **Kernel v4 hardening.** Limited leases are invisible to capability-only checks (previously a task-limited lease would have passed `record_payment` or `read_events`); task-limited authority ends when the task closes; tasks carry creator-set inputs; actions expose their task ref.
- **Arcadia runtime foundations.** Reproducible generation (`arcadia/2`, seeded keys, semantic digest in `lib/sandbox/digest.ts`, provenance in the manifest, natural `arcadia_key`s); the snapshot is reloaded and must reproduce the digest before it ships. Spatial view model (`lib/world/spatial.ts`) and a replaceable SceneController (`lib/world/scene.ts`, Cesium in `app/world/cesium-scene.ts`) with semantic camera operations and zoom bands; selection resolves to canonical refs (shift adds to a set); no invented geography (the venture World is listed off Earth); a recorded refusal marks a supplier not reachable and an agreement turns its real logistics route emerald, each playing once from its kernel event. `npm run test:world` proves it in Chromium against the built app and records performance against `perf/world-baseline.json`.
- **Steward projection and Arcadia scenarios.** Arcadia `arcadia/3` runs the `lost-payment-responses` scenario by default: SOV's operating collective (`lib/ops/collective.ts`) works two lost payment replies to closure and records a learning event and a Class A proposal, so the sandbox carries real operations history. The World's Steward view reads it with the steward's authority: what needs a human, each task's worker, verifier, kernel decision and consequence, what was learned, proposals with their class and promotion rule, and what is not built yet. You cannot read these records.
- **First Class A creation loop (SOV improving SOV).** `lib/ops/creation.ts`: a recorded Class A proposal becomes an engineering task; an engineering agent (deterministic generator, the least-powerful builder that suffices) writes a read-only diagnostic in an isolated workspace and proposes promotion under the capability its actual diff requires; CI (a service) runs it against a fresh Arcadia simulation and records system-observed evidence; a reviewer of another party re-derives class, paths, hash, read-only rule and CI result and authorizes; promotion applies exactly the reviewed change; the promoted diagnostic runs against the live kernel and the observation is compared with the proposal's expectation; the reviewer closes the task. Agents hold only `engineering.promote.a`, so a Class C or D diff is refused by the kernel and escalates to a human; a change edited after CI is never promoted; a diagnostic that writes fails CI. Arcadia `arcadia/4` runs this loop as its `creation-loop` scenario, and the Steward view shows the proposal promoted and observed.
- **The SOLVE loop is real (one primitive).** `lib/causal`: canonical World state per actor with truth statuses and provenance; Horizon of reachable routes with performer, kernel decision, provider capability, expected evidence, failure states, uncertainty and declared consequences per step; replaceable providers whose responses are evidence; one pipeline from proposal to atomic consequence; actor-scoped context for humans and agents. Kernel v4 actions declare their consequences and the kernel applies them with completion. The car-company flow runs on it (no bespoke consequence code), the CAUSE lens shows the live Horizon with a "Do this" for the next step, and the World survives reload with identical canonical state.
- **Transition registry and kernel guards.** Transitions are declared (requires/produces/consequences/guards over fact patterns) and the Horizon is a backward-chaining planner over the registry; any World can extend it. Two goal kinds run through the same pipeline: securing supply and getting a claim verified (Arcadia's Kestrel service attaches the evidence, unless its audit challenged the claim). Kernel v4 actions may declare guards, re-checked at enactment; a stale route cannot agree a second supplier. A step's terms are fixed from the World at proposal time.
- **Money as a transition.** `supplier.deposit` pays the agreed supplier through the existing router (`lib/causal/money.ts`): the amount rides on the action so lease budgets decide, guards stop a second deposit, a lost chain reply leaves the action awaiting reconciliation with no consequence, and the next run settles it from the chain marker with the recipient paid exactly once. Arcadia/7 gives organization owners wallets and payment profiles. The World's Horizon shows the deposit as the next goal once supply is reached, blocked in the browser because no chain is connected to it.
- **An organization's agent on its own authority.** Arcadia/8 makes organization owners market members who delegate reading, verification requests and planning to their agents. Orrin's agent builds its context from that authority alone (sees the market, nothing private, no ventures), plans its organization's verification, selects the route in its own scope, runs it alone through Kestrel, and the verified claim becomes canonical for everyone who may read the market; provenance names the agent and its principal. It cannot spawn agents, commit, or grant itself anything. Route selections now live in the selector's actor scope.
- **Real providers behind the same capabilities.** Providers are idempotent per action and re-performable: ask, then look; `unknown` leaves the step awaiting reconciliation with nothing canonical, and the next run asks again under the same key. The kernel-messaging providers are the real ones (`lib/causal/providers.ts`: the counterparty's agent answers from its own session under its own authority; a verifier attaches its own finding before a claim counts as verified), and Arcadia's are those providers with the other side also running on this device. `lib/causal/http.ts` reaches an organization that is not on SOLVE at the endpoint its record publishes (TLS or loopback, never a payload's URL), with the action id as `Idempotency-Key` on every run; 200 answers, 202 queues, 4xx fails, the body as received is the hashed evidence. `tests/e2e/providers.test.ts` runs the same route through all of them against a real local HTTP counterparty that queues first and answers later.
- **The counterparty's side as a transition.** A delivered inquiry is a fact of the recipient's World (`inquiry:open` / `inquiry:answered`, from its inbox and the kernel's reply link; v4 `read_actions` exposes `in_reply_to`). `inquiry.answer` is a kernel-native transition: an organization's agent derives one goal per open inquiry, plans it through its own Horizon, records its selection in its own scope and replies under its own authority in the market, addressed to the asker and bound to the inquiry (`lib/causal/exchange.ts`); the asker's waiting step settles from the reply. Arcadia's counterparties run this same loop on the device; the bespoke responder is gone. `tests/e2e/exchange.test.ts` proves both sides on one kernel.
- **Delivery-woken answer service (step 1 of the path to one real agent task).** `lib/agents/answer-service.ts`: an organization's agent answers delivered inquiries in its own process through the exchange loop; wakes coalesce; a safety-net pass covers lost wakes; failed or unknown passes back off (capped exponential) and claim nothing; refusals are recorded, write nothing and are not retried on a timer. `scripts/answer-service.ts` runs it against a deployed kernel as the named agent (inbox watch; no push channel to a separate process yet). Arcadia's counterparties run the same service. Fixes from the failure tests: a step whose proposal reply was lost is continued on the decided terms; an unreachable inbox fails the pass instead of reading as empty; an agent's steps run through its own session. Retries are bounded (founder, 2026-10-03): an inquiry that spends its attempt budget is held as needing reconciliation and surfaced for review until an operator releases it; a service whose passes keep failing stalls instead of polling. `tests/e2e/answer-service.test.ts` (8 tests): delivery wake, coalescing, lost enactment reply, lost proposal reply with moved terms, outage backoff, budget then review hold, stall and recovery, refusal and restoration.
- **Kernel v4 staging preflight (step 2).** Rehearsed on a local Postgres 17.10 configured like the store (Supabase branching unavailable; this container cannot reach `*.supabase.co`): the staging copy equals the live kernel by fingerprint; v4 applies in one transaction as the non-superuser owner in 0.11 s; sign-in, permissions and chain integrity hold through `authenticator`. Found and fixed before rollout: deferred ledger and attribution triggers failed at commit for API callers on Postgres 17 (v4 now runs them as owner); a stale-read race between concurrent settlement workers (`lib/money/settlement.ts`). `npm run test:postgres` (`scripts/test-postgres.mjs`, `tests/support/postgres.ts`) runs the whole suite on a Supabase-shaped Postgres; `tests/staging/v4-rehearsal.test.ts` is the rehearsal. Report and live runbook: `docs/plans/2026-10-03-kernel-v4-rollout.md`.
- **Task-scoped supplier contact (pilot authority).** The person's explicit consent creates a supplier-contact task and leases the companion `message.send` for that task only (7 days at most): no commitment or payment authority, and it ends when the task closes. Route steps and the provider's delivery message carry the task ref. `tests/e2e/pilot.test.ts` rehearses the pilot through the World engine (refused before consent, granted, asked, answered by the supplier's service, evidenced quote persists across a reload, task completed, authority gone), on PGlite and Postgres 17.
- **Reasoning model behind the provider boundary.** `lib/world/claude.ts` (Claude `claude-opus-5-5`, structured outputs, server-side refusal fallback, cacheable static system prompt), `app/api/reason/route.ts` (signed-in people only, input limits), `lib/world/remote-provider.ts` (browser: model when available, rules otherwise, and says which). It interprets typed goals into the World's intents and suggests among the Horizon's computed routes; it never acts. A model's reading of a consequential intent is a proposal to confirm; buttons act directly. `tests/e2e/reasoning.test.ts` (no network). Needs `ANTHROPIC_API_KEY` in the deployment and sign-in to be live.
- **Tests:** 169 pass (`npm test`; 170 on Postgres 17 with the staging rehearsal); 74 kernel tests pass in Chromium (`npm run test:browser`); 27 World checks pass against the built app (`npm run test:world`); CI (`.github/workflows/build.yml`) runs tests, typecheck, lint and build on every push (runs 3 to 9 green).
- **App shell and staging preview.** Branch preview `https://solve-r7zx4k89o-sovigrn.vercel.app` is READY at pre-creative commit 812153d and uses branch-scoped staging Supabase variables; Auth URL configuration still needs verification. The older `solve-git-claude-keen-cerf-tpd7io-sovigrn.vercel.app` must not be used for sign-in because it had production-scoped Preview variables. Email sign-in remains switched off per founder direction (2026-10-03). Signed-out `/` and `/arcadia` run the browser sandbox; signed-in `/` leads to `/worlds`; `/money` uses fresh in-memory test assets and answers 404 unless `ENABLE_MONEY=true` (2026-10-05, `lib/flags.ts`, master spec §2).
- **Specs.** `docs/MONETARY-CONSTITUTION.md` draft 3 (source spec for money; Part XIV lists what is enforced). `docs/plans/2026-10-03-monetary-proof-of-life.md`, `docs/plans/2026-10-03-payment-router.md`. World: `docs/specs/2026-10-03-world-interface.md`, `docs/specs/2026-10-03-avatar-world-integration.md`. Contracts: `DOMAIN-CONTRACTS.md`, `DECISIONS.md`, `SECURITY-INVARIANTS.md`, `ACTIVE-WORK.md`.

## DOING

- **Open creative World collaboration (Codex takeover).** Built the first durable slice: private blank World creation, a responsive text-artifact board with create/move/revise, kernel history, explicit scope authority, and retry-safe form writes. Next: verify staging sign-in, add an in-app scoped access handoff, then realtime sync and a collaborator's own agent. No social feed, mandatory Room template, payment, or production-store change. See docs/plans/2026-10-04-open-creative-world.md.

## BLOCKED

- **Staging app sign-in is not demonstrated yet.** The branch preview targets the isolated staging project, but Auth redirect configuration, Data API exposure of kernel_api, and a sign-in/callback through the app need verification. Do not use the older preview that had production variables.
- **Real-time shared authoring is partially built.** Text edits persist through the kernel; World presence ("who's here now", kernel-native heartbeats) shipped 2026-10-05. Still open: an in-app grant/invitation flow (currently raw SOV IDs), live change notifications, and understandable concurrent-edit behavior.
- **External-agent joining is not built.** The kernel-mediated inquiry loop and HTTP supplier provider exist; a provider-neutral, scoped way for each collaborator's own agent to create and revise creative artifacts is still required.
- **Production rollout is separately gated.** Do not apply v4 to the production project without a separate founder go-ahead.
- **Devnet and live settlement** are separate future work, not prerequisites for a useful shared creative canvas.

## NEXT

1. Verify staging Auth redirects and kernel_api Data API exposure; sign in through the staging app without using production credentials.
2. Add an in-app person-to-person grant flow with an explicit role and a first permissioned change; keep owner and kernel read/write gates enforced.
3. Add realtime authorized refresh and presence for two people, with reconnect and conflicting edits handled visibly.
4. Expose a provider-neutral scoped artifact API so a collaborator's external agent can make reversible, attributable edits under its own identity.
5. Run one real two-person collaboration on staging, record friction, and ship the smallest reusable improvement with only the affected tests and security boundaries.
6. Expand to richer artifacts, 3D, outer-world integrations, and 10+ participants as creators need them.

## Decisions waiting on the founder

- Naming: SOLVE (reserve) vs SOV (identity, card); the legacy game's virtual SOV collides.
- First real reward policy and evidence thresholds; Earn release capacity and who holds the Earn cold key.
- Vesting/treasury programs: build or adopt audited ones. Anchor cadence. Governance path.


## Development memory slice — 2026-10-04

- Started on isolated branch `codex/development-memory-v1` from the live build branch head. Adds an additive migration for typed Idea Graph relations, a kernel-backed idea domain module, and focused tests for idempotent creation, scoped reads, lineage cycle rejection, and reasoned status changes. No UI, staging application, or production database changes are included in this first code slice.
- Local tests were not run: the attached workspace has no repository checkout and direct clone is blocked. The GitHub Actions workflow is the verification gate; do not treat this slice as verified until its run succeeds. Next: inspect the CI result, then connect the graph to the World UI and real implementation/evidence references.


## AI Ideation — 2026-10-04

- Added a signed-in `/api/ideas/expand` route that reads the selected idea and up to eight related ideas from the authorized World through the kernel. The model returns a schema-validated draft only. The person can edit, accept or discard; acceptance records a proposed idea, source-model metadata and a `derived_from` relation. It performs no code execution, branch creation, or promotion. Real model availability depends on server configuration; no live model call has been verified.
## 2026-10-04 checkpoint — World bot access and attribution

- The World owner can grant a collaborator's identified bot Read or Add access from the World, review active bot name, owner, role and expiry, and remove the grant. The bot owner can copy the Bot SOV ID from `/bot` to share it with the World owner.
- World History labels AI companions as “bot for [owner]” using the kernel actor profile and accountable party. Other agents retain the “agent for [owner]” label.
- Verification: CI run 37 passed tests, typecheck, lint and build. Run 35 was the expected red before implementation; run 36 passed tests and exposed one query-parameter narrowing issue fixed in run 37.
- Uses existing scoped grants and kernel actor profiles. No migration, staging database change, or production change.
- Staging remains unverified for real assistant use. The Preview secret key was added by Claude after the user supplied it; Auth Site URL/redirect, `kernel_api` Data API exposure, OAuth Server, and staging application of kernel v5 plus the bot-presence policy remain open.
\n\n## 2026-10-04 checkpoint — Business learning and pixel-art tools\n\n- MCP `learn_business` stores owner-approved sections in the bot's sealed memory with connection provenance; it supports business workflows, team, systems/equipment, economics, goals, and evidence/risks.\n- `propose_capability` writes a structured draft in a World the bot may add to. It is explicitly non-executable.\n- `create_pixel_art` validates a bounded grid and six-digit palette, then writes/revises a versioned World artifact attributed to the bot. The World canvas renders it as a pixel image. The connected assistant produces the grid; no image-provider API key or external provider call is involved.\n- Collaborator bot access remains scoped through the owner's Add grant, so the bot acts with its own attributable identity.\n- Verification: the current feature preview is READY at https://solve-mchx5ujf2-sovigrn.vercel.app. GitHub Actions run 60 passed all 200 tests, typecheck, lint, and build for commit 378719b. Earlier runs caught a missing assistant approval in a test and doubled regular-expression escapes in credential filtering; both were fixed, with regression coverage for credential rejection and invalid section names.\n- No database migration or production change was needed. General sandboxed capability building, model-backed/streaming image generation, and realtime multi-person sync remain open.\n

## Optional Higgsfield portrait slice — 2026-10-04

- Added an optional portrait concept generator to the signed-in bot page, using Higgsfield Soul 2 image generation. It derives an initial visual direction from the saved bot persona; the user can revise it before submitting.
- The API key is entered per session, held temporarily in the page, sent only to an authenticated same-origin server route and forwarded to Higgsfield with its documented `Authorization: Key` scheme. It is not saved in SOV. No automatic generation retry is made after a network error.
- Generated output is a downloadable preview only. It does not replace the persistent vector character, write a persona event, change authority, or enter History.
- Added validation for key/prompt/request ID, safe HTTPS-only image results, normalized provider status and sanitized provider errors.
- Local full-repository checks could not be run because this workspace does not contain the repository checkout. The focused Higgsfield helper tests passed 5/5 under Node 24 type stripping. GitHub Actions run 61 passed the repository tests, typecheck, lint and build. Live Higgsfield account behavior remains unverified. Live Higgsfield account behavior remains unverified.

## 2026-10-04 checkpoint — Agent screen and a richer avatar (Claude)

- **The founder picked** the code-drawn avatar over 3D or Rive: every look stays on brand, costs nothing and runs fast on phones.
- **`/bot` is now the agent screen.**
  - A HUD stage with corner brackets, tick rings, a sweep while active, vignette and grain. It reads out the bot's state, finish, motion and energy.
  - Seven customization tabs: Form, Face, Finish, Color, Gear, Motion and Personality.
  - Previews for all ten states: the Build Book's listening, reasoning, waiting for approval, working, needs input, completed and unavailable, plus idle, happy and resting.
- **The persona gained:**
  - a finish (matte, glass, hologram with scanlines, polished chrome);
  - brows and face marks (blush, stripes, circuit traces);
  - motion: an energy that scales every animation and an idle style (bob, float, drift, still);
  - eight named color sets, none of them gold.

  Older saved bots load with defaults; no migration.
- **"What <name> may do".** The agent contract (Build Book §5) lists the assistants it speaks through and their modes, memory, and World grants with their 30-day expiry. All of it is read from real records. It also states the fixed limits: the connector gives assistants no tool to spend, sign, publish or change access, and real-world actions are proposals only.
- **Layout.** Codex's Higgsfield portrait creator moved below the Worlds panel. The page title is now "Your agent".
- **Checks:**
  - `tests/bot/agent-screen.test.ts` covers old personas, every body × finish × state rendering, the stage readout and the contract's wording.
  - The bot suite passes 38/38; typecheck, lint (one existing warning) and build are clean.
  - Chromium screenshots at desktop and 390-px phone width found a real bug: a non-wrapping chip row stretched the page to about 990 px on phones. It was fixed and re-checked: the page is 390 px wide, with no console errors.
- **Not yet:** onboarding at sign-on, which should build on the World entrance's "Who should represent you" step (Codex), and "let your AI design it".
- **Human | Machine (Claude, founder's inspiration references).** The agent stage has a basement.studio-style Human | Machine toggle. Machine draws the bot as a living particle cloud in its own colors, wired to You, its assistants, its Worlds and its sealed memory. Links it can write through flow; read-only links stay dim and dashed. Below it sit readouts in the spirit of the "bot swarm" dashboard reference:
  - access ledger;
  - blast radius (memory, Worlds add/read, money none, access none);
  - 14-day activity from real memory timestamps;
  - an audit count of the bot's kernel records.

  Every node and number comes from `lib/bot/machine.ts` over real records. Signed out, it shows only You and an empty memory. Tests: machine data, node caps and readouts in `tests/bot/agent-screen.test.ts`; bot suite 39/39. Chromium screenshots at desktop and phone width: no overflow, no console errors (a temporary preview page, deleted before commit).

## 2026-10-04 checkpoint — Brand direction and a calmer bot screen (Claude)

- **Brand direction (proposed):** `docs/brand/2026-10-04-the-construct.md`, from the founder's conversation.
  - **The idea:** stay in your seat; the world builds around you, and every result is real.
  - **Grounding:** vision quotes, 2025–2026 consumer research with sources, lessons from earlier technology revolutions, the ontology as the felt reason worlds assemble, brand rules, the ad's shot list, the production pipeline and Higgsfield prompts per world.
  - **Status:** the Build Book's "Tony Stark HUD" lock stays until the founder changes it.
- **Founder feedback acted on:** the HUD look read as "vibe coded", so `/bot` was stripped back.
  - The stage is a quiet room with a lit floor and horizon (the construct a World assembles on); spinning tick rings, sweep, corner brackets and grain are gone.
  - A plain Character | Reach switch replaces Human | Machine. Reach shows the bot itself at the center with plain lines and labels, no particle cloud, and readouts in plain words: assistants, what it can touch, last 14 days, on the record.
  - The page says "Your bot" again, since the brand rules drop "agents".
- **Checks:** bot suite 39/39 (the stage test now asserts no rings or grain); typecheck, lint (one existing warning) and build ok. Chromium screenshots at desktop and phone: no overflow, no console errors (a temporary preview page, deleted before commit).
- **Brand adopted (founder, 2026-10-04).** `docs/brand/BRAND.md` is the canonical brand: the construct.
  - **Idea:** stay in your seat; the world builds around you; every result real, on the record.
  - **Lines:** *The world builds around you* / *Ask for a way* / *On the record*.
  - **Names:** solve is the master brand, Sovereign the engine and philosophy, SOV identity and the economy.
  - **Also in it:** a manifesto, the ascent (seat → room → network → economy → interface for reality; market only what is real), the identity system (palette unchanged, motion as assembly, a working mark at `public/brand/solve-mark.svg`), voice and the "never" list.

  The Build Book §2 brand lock now points to it (the HUD direction and the market-line intro are retired). Recorded in `DECISIONS.md`; `ACTIVE-WORK.md` tells Codex's surfaces to follow it.
- **Brand v2, research-backed (Claude, pending founder confirmation).** Four sourced research tracks in `docs/brand/research/` (naming, competition, people, precedents). `docs/brand/BRAND.md` v2 lists what changes and why:
  - **Line:** *You decide. The world builds.* replaces "stay in your seat", which three tracks found passive.
  - **Lead:** proof and authority first.
  - **Identity:** the point. The wordmark is `solve.`, the symbol `s.`, plus the record seal and a simulated label. Working SVGs are outlined from Archivo in `public/brand/`.
  - **Imagery:** real places only in paid ads.
  - **Name:** solve holds on conditions. MIT holds an incontestable SOLVE registration, SolveAI raised $50M and Solve Intelligence applied for the bare word. So: a composite mark, a modified domain, and no paid media before counsel clears it.
  - **Token:** choose a ticker other than SOV, which Sovryn already uses.

  Domains checked on Vercel's registrar; nothing bought. The v1 lines in the Build Book hold until the founder confirms.
- **First-principles rethink (Claude, pending the founder).** `docs/brand/2026-10-04-first-principles.md` rebuilds the business from what the app actually does: proof, permission, neutral hands for any AI, execution, verification, settlement, ownership and collaboration.
  - **Thesis:** *everyone wants you to trust their AI; solve removes the need to.* This is the Build Book's own line.
  - **The opposite of the market:** no own AI, consent over autonomy, a portable record, receipts over claims, results over attention, people brought in.
  - **The brand line becomes the product's loop:** **Ask. Allow. Prove.**
  - **Proposed business:** free to bring your AI; paid when an outcome settles; platforms pay to verify; settlement later, gated. Moat: the record graph, neutrality, the authority engine and the human network. North star: verified outcomes per person per month and time to first proof.
  - `BRAND.md` and the construct doc are updated to match.
  - Visual brand book (private artifact): https://claude.ai/artifact/NAtCcEYspQzpPBLoKMdeY3
- **Brand v3: "Everything here is real" (founder approved, 2026-10-05).** The founder found *Ask. Allow. Prove.* generic. `docs/brand/BRAND.md` v3 is the construct, inverted: games gave us worlds that aren't real, AI gave us answers that aren't real, and solve is a world where everything is real.
  - **The game, made real:** the product's game-like structure (World, your character, party, quests, rules, Packs, progression) maps to built functions.
  - **Save points and Practice:** a real result is a save point on the record; simulated activity is Practice, always labeled.
  - **Guardrails:** the game stops at money and voice (no confetti, streaks, points or gamified copy).
  - **Identity:** brand surfaces open on the white floor; the practice label is `public/brand/solve-practice-seal.svg`, replacing `solve-simulated-seal.svg`.
  - **Other docs updated:** Build Book §2, `DECISIONS.md` and the construct film (real places only, the save beat). The first-principles business model still stands, pending the founder.
  - **Brand book page v2:** https://claude.ai/artifact/NAtCcEYspQzpPBLoKMdeY3

## 2026-10-05 checkpoint — Proof becomes a save point (Claude)

- **`add_proof` in the connector.** When something real happens, the person gives their assistant the proof: a link, a tracking or order number, or what a photo shows. The bot saves it on that piece in a World, and it becomes a save point on the record (`lib/bot/proof.ts`).
  - **How it is stored:** kernel evidence on the piece's latest version.
  - **Basis comes from the kernel's own rules:** `self_reported` on the person's own pieces, `witnessed` on someone else's. It never counts as verified.
  - A retry saves once. Only http(s) links are kept.
  - `read_world` shows each piece's saves. The presence line reads "Claude is saving proof with Nova."
- **Access.** Add access now also grants `kernel.evidence.attach`. Bots let in earlier are refused with a clear message until set to Add again.
- **On screen.** `/bot` shows each World's latest saves with the shared `SavePoint` (`app/save-point.tsx`). That file also exports `PracticeLabel` for simulated surfaces (Codex: Arcadia).
- **Checks:**
  - bot suite 43/43, with 4 new proof tests: self-reported and once, witnessed on someone else's piece, every refusal, and the render rules;
  - typecheck ok;
  - lint ok, with one existing warning.

  No browser check: the panel addition is one list rendered by a tested component.
- **Staging is still blocked on v5.** A third `apply_migration` attempt timed out waiting for a confirmation and applied nothing (verified by a read). Without v5, memory writes fail on staging. The founder applies both files from the SQL editor (rollout plan, step 3b).
- **Printable parts (2026-10-05).** The connector's `design_part` lets a person's AI design a simple part: a side outline in millimetres, extruded to a width. That covers stands, brackets, hooks, clips, spacers and shims.
  - **Checking and storage:** `lib/bot/part.ts` cleans the outline onto the bed and refuses crossing, too-small or oversized shapes (a 256 mm build volume). The part is stored as a World piece, like pixel art.
  - **The STL:** `/parts/<world>/<piece>.stl` serves a binary STL to anyone the kernel lets read that World, for Bambu Studio, PrusaSlicer or Cura.
  - **What people see:** `read_world` summarises the part instead of showing its encoding. The World page shows the outline, size, material and a Download STL link (`app/part-preview.tsx`), plus each piece's save points.
  - **The loop:** design, print, `add_proof`, "Saved. No. …".
  - **Tests:** bot suite 47/47, including STL faces that are closed and outward with volume equal to area × width, download access, and the full design → print → save loop.
- **Shareable receipts (2026-10-05).** A person can share one of their own saves from `/bot`. They get a link to a public receipt on the white floor (`/saved/<token>`) showing:
  - "Saved · No. 1042" and what happened;
  - whose word it rests on, the date and the piece;
  - the part outline, if the piece is a part;
  - "Everything here is real."

  **How it stays private:** the server can't read a private World for anyone, since the service key never acts as a person. So the receipt is a snapshot read with the owner's own sign-in, put into the link and signed with a key derived from the server secret (`lib/bot/receipt.ts`). Changing anything in the link breaks it. Only the person who saved something can share it, and the proof's private detail is left out. A receipt can't be withdrawn once sent, like a photo.

  **Tests:** bot suite 53/53, plus one Chromium look at a signed receipt (desktop and phone): no overflow, no console errors, and a tampered link returns 404.
- **Parts with holes, and flat parts (2026-10-05).** `design_part` takes round holes (`[x, z, diameter]`, with at least 0.8 mm of wall around each and no two touching) and `lay: flat` for top-view parts: plates with screw holes, spacers, washers, clips, tags.
  - **How holes are joined:** each hole joins the outline with a straight cut to the first edge it meets, with a point added there. Walls are built from the joined face's real boundary edges, so the solid always closes.
  - **Tests:** a plate with two M4 holes, a washer, a six-hole grid in aligned rows, a bracket with a hole and the stand. Each must be closed, consistently wound, on the bed, and exactly (outline − holes) × width in volume.
  - **Fuzzing:** 600 random plates and L-shapes. 204 valid parts came out closed with the exact volume; the rest were correctly refused.
  - The preview and the receipt draw the holes.
- **Receipt link previews (2026-10-05).** A shared receipt now carries its own preview card (`app/saved/[token]/opengraph-image.tsx`, 1200×630) for iMessage, X and DMs. It shows the solve. wordmark, "Saved · No. 1042", what happened, whose word and the date, and the part's outline, on the white floor. It is drawn from the same signed snapshot as the page. A broken link gets a plain brand card.
- **Print notes (2026-10-05).** Every part says how it will print (`printNotes` in `lib/bot/part.ts`), in the tool's answer and on the World page:
  - "Prints without supports";
  - "Needs supports under 60 mm of overhang" (downward faces under 45°, off the bed, longer than a 5 mm bridge);
  - "add a brim" when under 10 mm touches the bed;
  - a warning that a large sideways hole may sag.

  Flat parts print without supports. Tested on the stand, a T-shaped shelf, a bridged ledge, a flat plate, a thin pin and a large hole.
- **Routes from an ask (2026-10-05).** This is the vision's Wayfinder ("I found 3 ways forward") and the spec's Intent → Task path, built on existing kernel tasks.
  - **Proposing:** the person asks their own assistant for a way to do something. It researches with its own tools, then calls the connector's `propose_routes` with up to three routes. Each route has steps in order and the link each step needs. The routes are saved in a World as a proposal (`lib/bot/routes.ts`).
  - **Taking:** on the World page the person takes one (`app/route-card.tsx`, `app/route-actions.ts`). Each step becomes a kernel task the person created, with `cause_ref` pointing at the routes piece.
  - **Done:** "Mark done" moves the next step to completed, on the person's word, and the record says who.
  - **What the bot sees:** `read_world` shows the route taken, the steps done and the next step with its link.
  - **Limits:** steps need `route.step`, which the World owner holds and a bot or a read-only member does not. A bot can propose and revise routes until one is taken, but it can't take a route or mark a step done.
  - **Route-card fields:** routes carry the fields of Codex's founder-directed route cards: why it fits, what it takes, what is not yet known, and done when. The World card shows them, and "done when" stays on a taken route as the proof to save. This keeps one route object for both designs.
  - **Tests:** `tests/bot/routes.test.ts` covers limits and hand-edited pieces, the bot proposing, the bot and a member refused, idempotent take and done, `read_world`, and the card (the point only on done steps).

## 2026-10-04 checkpoint — Runtime AI Gateway OIDC (Codex)

- `/api/reason` can authenticate to AI Gateway with Vercel's request-scoped OIDC token, so no shared provider key is required on Vercel. A configured Anthropic key or explicit Gateway key still takes precedence.
- Vercel Secure Backend Access is enabled with the team issuer. Reasoning remains available to signed-in people only; the token is never returned to the browser.
- Regression coverage checks runtime request-header and build/local environment token paths, provider precedence, and the no-credential case.
- CI run 70 passed 214 tests, typecheck, lint and build. The preview is READY and its anonymous availability check confirms the sign-in gate; a signed-in model request remains unverified and would use AI Gateway credits. No Supabase schema or production application deployment changes were made.

## Shared World collaboration slice — 2026-10-04

- Added owner-managed human viewer/editor access by SOV ID, with explicit removal of both scoped capabilities and rejection of agent IDs.
- Added private per-person Realtime invalidation. A kernel event trigger checks each recipient’s active `kernel.read` grant and publishes only World ID and event sequence; the browser refreshes the persisted kernel view after updates and reconnect.
- New end-to-end tests cover editor and viewer authority, provenance through the existing kernel path, revocation, delegation refusal, and human-only invitations.
- Validation: test-only CI run #99 failed before implementation as expected; implementation CI and staging Auth/two-person live validation are pending.
- Production was untouched.

## 2026-10-05: Codex's branches merged into the trunk (founder: "merge")

- **What's in:** the AI Gateway OIDC fallback, live collaboration in Worlds (owner-managed collaborators, private content-free Realtime notices, migration `20261004040200_world_live_collaboration.sql`), and goal-first Worlds with the resource map.
- **How they fit with the bot:** `read_world` keeps Codex's length-bounded context and resource list, and also carries the save, part and route notes. The connector's writing tools now include `map_world_resource`.
- **Left out:** the branch's "Project resource coordination" section for `VISION-CANON.md`, until the founder says yes. Also `codex/development-memory-v1` (Idea Graph, draft pull request #2) and its plan (#1), which wait on the founder.
- **Staging needs three SQL files, in order:** v5 (`20261004040000`), presence (`20261004040100`), live collaboration (`20261004040200`).
- **Checks on the merged tree:** full suite 240/240; typecheck ok; lint ok (the one existing warning); `next build` ok.
- **To watch:** the live-collaboration trigger checks every person's read grant on each World event. Fine for a pilot, but it needs an index or a member table before it grows.

## 2026-10-05: Waiting on you (founder-first slice 2)

- `/bot` opens with one list, across the person's Worlds, of what only they can move forward:
  - routes proposed but not yet taken, shown only where they can take one;
  - the next step of each route they took, with its link and how many steps are done.
- Each item links to its World, where they take the route or mark the step done.
- A decision is proposed the same way as a route: each option is a route, so taking one records the choice on the record.
- The list reads the record with the person's own sign-in (`lib/bot/waiting.ts`, `app/bot/waiting.tsx`). It shows nothing when nothing waits.
- **Tests:** `tests/bot/waiting.test.ts` covers choose and next across two Worlds, a read-only member who is not asked to choose, a finished route dropping off, a taken decision becoming its next step, and the rendering.

## 2026-10-05: Command Center (`/command`)

The vision's personal Command Center ("zoom toward their node, then into their personal Command Center"), and the founder's one page. Its sections follow the canon's promise, in order:
- **Where you are:** Worlds, routes underway, recent saves.
- **Waiting on you.**
- **Where you're going:** every ask, proposed, underway (step N of M) or done.
- **With you:** the bot, each connected assistant with its access and since when, and a live line of who is working right now from the private presence signal.
- **What actually happened:** the latest saves across Worlds, with their save points.
- **What's next.**

Everything is read from the record with the person's own sign-in, and empty states say so plainly.
- **Paths:** `app/command/`. `lib/bot/waiting.ts` now does one scan (`journeys`), and both "Waiting on you" and the Command Center read from it.
- **Tests:** `tests/bot/command.test.ts` covers where each ask stands, a read-only member who chooses nothing, empty states, and the point only on saves.
- **Linked from:** `/bot`. Signed-in `/` still goes to `/worlds` (Codex's `app/page.tsx`); sending it to `/command` is proposed to Codex.
- **Noticed (vision: "the world itself should react").** The Command Center points at what the record shows needs attention, without anyone asking:
  - a step of your route with no movement for 3 days or more;
  - a route done with nothing saved on it;
  - routes that have waited 3 days or more for your choice.

  It is worked out from the record on each visit (`noticed` in `lib/bot/waiting.ts`). It only points; it never acts, assigns or tells anyone else. Routes now carry when each step last moved, and an ask knows whether proof is saved on it.
- **What solve can't do yet (the Forge's seed).** The Command Center lists the capability drafts assistants recorded with `propose_capability` when solve couldn't do what was asked. The same need asked again counts once, with how many times and in which Worlds, most repeated first (`lib/bot/gaps.ts`). It is read from the same single scan of each World. Nothing in it runs. Repeated real needs pick the next build, which is the directive's "learn from real friction" in a form the founder can see.

## 2026-10-05: Outreach Room, first slice (Practice channel)

The founder asked for "a ai to business outreach flow ... with meta accounts but build this as an example in app". The plan, with Meta's messaging rules and why cold DMs can't be automated, is in `docs/plans/2026-10-05-business-leverage-outreach.md`.
- **Drafting:** the person's assistant researches real businesses for a goal and calls `propose_outreach` with up to 20, each with why it fits, the public page where it was found (required, http or https), how it can be reached, and a short message (`lib/bot/outreach.ts`).
- **Approving:** the World shows each message exactly as it would go out, with the sender's name and an opt-out line always added (`app/outreach-card.tsx`). Only the person approves, one message at a time. Approval is a kernel task they created, needing `outreach.send`, which a bot or a read-only member does not hold.
- **Practice channel:** approving records the message, its sha256 and `sent_outside_solve: false`. Nothing leaves solve. The card says Practice.
- **Where approvals show:** "Waiting on you" and the Command Center list messages still to approve. `read_world` tells the bot how many were approved.
- **Revising:** a bot can revise drafts until one is approved.
- **Tests:** `tests/bot/outreach.test.ts` (3 tests). Full suite 251/251; lint clean (the old warning in `lib/bot/worlds.ts` is fixed); build ok.
- **Next:** replies and outcomes on each lead; a real email channel; Meta inbound inside its rules. Those need the founder's accounts, and Manus's research on Meta's current rules.

## 2026-10-05: Manus's pull requests, reviewed on the trunk

- **#5 merged:** saving the bot no longer drops the values field when Save is clicked before the field loses focus. The creator shows the persona the server saved, and a reused save key with a different persona reports a conflict (tested).
- **#7 merged:** start a private World from `/bot`, through the same `startWorld` path, landing in the new World.
- **#6 folded in, not merged:** its context ledger repeated "What your bot may do", and its memory count was capped at 50. The useful part (each World the bot was let into, with an Open link, and "Outside services: none connected") is now in `app/bot/contract.tsx`, with a test. Review comment on the pull request.
- **#4 changes requested:** the `/start` page needs to follow brand v3 (white floor, no decorative points or glows, no static fake state, lowercase solve). Review comment on the pull request.
- **Checks:** bot suite 70/70; typecheck ok; lint clean; build ok.

## 2026-10-05: Outreach outcomes, and "said no" enforced

- **Recording what happened:** after a message is approved, the person (on the World page) or their assistant (`record_outcome`, only from what the person said or showed) records replied, meeting booked, won or said no. It is evidence on the approval, `self_reported`, never verified (`recordOutcome` and `outcomesIn` in `lib/bot/outreach.ts`). A retried record is one record. A read-only member records nothing.
- **"Said no" is enforced, not just asked for:** a business that said no, matched by name or by the site it was found on, can't be drafted again (`propose_outreach` refuses) or approved again (`approveAndSend` refuses) in that World. That holds even under a new name on the same site.
- **Where outcomes show:** the outreach card shows the latest outcome per business and a tally (replied, meetings, wins, nos), and offers no more recording after a no. `read_world` numbers each business and lists outcomes, so the assistant knows which number to record.
- **Tests:** `tests/bot/outreach.test.ts` now has 5. Bot suite 72/72; typecheck ok; lint clean; build ok.
- **On the Command Center:** the latest outcome per business (replied, meeting, won, said no) now shows under "What actually happened" next to saves, on the person's word, with its World. `overview` returns `results`.

## 2026-10-05: Win values and "made through solve"

- A won outcome can carry its value (amount and three-letter currency, stored in minor units), on the person's word. Only a win carries one.
- The outreach card and the Command Center show it. The Command Center adds "Made through solve in 2026", the year's total per currency (`madeIn` in `lib/bot/waiting.ts`), marked as from wins the person recorded.
- There is no target bar: the brand never gamifies money. The $10,000 north star is the business's (`DECISIONS.md`).
- **Tests:** outreach suite 7/7 (values, refusals, the yearly total by currency, rendering).

## 2026-10-05: Crypto stage 1, the record anchored on Solana

- **Anchoring** (`lib/chain/anchor.ts`): a World's history (each event's sequence number and chained hash, never content) becomes a Merkle root. A memo writes `solve:anchor:v1:<root>:<count>` on Solana, so no names, amounts or text are ever published.
- **On the record** (`lib/bot/anchor.ts`): the World's owner anchors, and the anchor is saved on the World's record as `artifact` evidence with the transaction's explorer link. The caller's authority is checked before anything is written on chain, so a refusal never spends a fee or leaves an orphan root.
- **Shared receipts** now carry their inclusion proof. `/saved/<token>` checks it against the root and says plainly what it shows: the save was on the record by then and hasn't changed since, never that the thing itself happened (constitution Part XI). A forged proof is shown as not checking out.
- **On the World page** (`app/anchor-panel.tsx`): the last anchor, and a button when this deployment has an anchor key.
- **Devnet only:** `ANCHOR_CLUSTER`, `SOLANA_RPC_URL` and `ANCHOR_PAYER_KEY` (a fee-only keypair) are documented in `.env.example`. Mainnet is refused until the founder decides (Part XV). No money moves.
- **Tests:** `tests/bot/anchor.test.ts` uses LiteSVM with the real Memo program. It covers Merkle proofs for 1 to 9 leaves (forged steps and leaves fail), anchoring, a read-only member refused before any chain write, receipts with proofs surviving the link, a forged proof flagged on the page, saves after an anchor waiting for the next one, and config refusals.
- **Checks:** bot and chain suites 88/88; typecheck ok; lint clean; build ok.

## 2026-10-05: Crypto stage 2, wallets the person controls

- **Linking from the Command Center:** the person links a Solana wallet by signing a short message in their own wallet (Phantom, Solflare or Backpack in the browser). Signing moves nothing and costs nothing, and solve never sees or holds a key.
- **What the server checks** before the kernel links the address (`lib/chain/wallet-proof.ts`, `app/command/wallet-actions.ts`):
  - the challenge is signed by the server (HMAC) and bound to the person, so it can't be reused by someone else or edited;
  - it is at most 10 minutes old;
  - the wallet's ed25519 signature matches.
- **Recorded on devnet** while money runs there. The kernel already refuses an address linked to someone else.
- **Shown:** "With you" on the Command Center shows the linked wallet (shortened), even before a bot exists.
- **Known gap, for Codex:** the kernel's `link_wallet` doesn't itself require proof, so a direct API call could link an address without it and block its real owner. Proposed fix: a new migration that only accepts links carrying a server-verified proof, or verifies the signature in the kernel.
- **Tests:** `tests/bot/wallet.test.ts` covers valid proofs; another person's, an edited, an expired or a forged challenge; another wallet's signature; bad input; one owner per address; and the panel slot without a bot. Bot suite 80/80; typecheck ok; lint clean; build ok.

## 2026-10-05: After Manus's merges of #6 and #8

Both were merged into the trunk by the founder's account while a review asked for changes. CI was green (run 136). Fixed:
- **`/start`** (`app/start/view.tsx`, `page.tsx`) follows brand v3: white floor, no decorative points or glows, no static "Avatar: Not shaped" state, lowercase solve, "Everything here is real". Signed-in people go to `/command`. Manus's content and structure are kept.
- **`/bot`** shows one panel for what the bot may do. The duplicate context ledger is removed; its World list was already folded in.
- **Test:** `tests/bot/start.test.ts` keeps the start page on brand.
- **Process:** a working agreement for Manus is in `docs/handoff/MANUS.md` (never merge with a review open, log every slice, research first), and its `ACTIVE-WORK.md` row is updated.


## 2026-10-05 — The room: a World you work inside (Claude)

- **What it is:** `/world/<id>/room`, an immersive full-screen room for a World (master spec §7, "Real-time Build Rooms"; the canon's "Enter a Room"). Creating a World, the Command Center and `/worlds` now open the room. The panels page is still there as "Details".
  - **Left:** what the World is after, who is here (people and bots, the bot's live line), and its routes with progress.
  - **Center:** the canvas. A World that links a GitHub repository shows **the build**: each builder's station (Claude, Codex, Manus, named by their branches), the trunk with its commits and build results, and the branches in flight with their pull requests. Otherwise it shows the World's pieces where they were placed, around the goal.
  - **Right:** what's waiting on you (including pull requests asking to merge into the trunk), proof, what just happened, and what solve can't do yet.
  - **Bottom:** a command bar that adds a note to the World.
- **The repo as a source** (`lib/github/repo.ts`): read-only, from GitHub's API, refreshed every minute while the room is open. A private repository needs `GITHUB_TOKEN`, and is read only where `GITHUB_ROOMS` pairs it with a World or a sign-in email, so nobody can read it by linking it into a World of their own. Linking a repository adds it to the World's resources (one concept, one home).
- **Tests:** `tests/github/repo.test.ts`, `tests/bot/room.test.ts`.
- **Update, same night ("figure it out"):** the pairing now lives in the repository (`solve.rooms.json`, with the founder's two sign-in emails stored only as fingerprints), so `GITHUB_ROOMS` isn't needed. Without any token, the room shows the deployed trunk's history (who did what, merges) from the deployed code itself. The only remaining step for live builds and pull requests is `GITHUB_TOKEN` in Vercel.
- **Founder steps to see the solve build in its room (original; steps 2's GITHUB_ROOMS no longer needed):**
  1. A fine-grained GitHub token, read-only for Actions, Contents, Metadata and Pull requests on Solve-Official-.
  2. In Vercel, `GITHUB_TOKEN`, plus `GITHUB_ROOMS=<your sign-in email>=andrewzingg23-del/Solve-Official-@claude/keen-cerf-tpd7io`.
  3. Sign in on the staging preview and open the Command Center: "Your build has no room yet", then "Open its room". It makes a private "Build solve" World with the repository linked and opens the build. (Or link `https://github.com/andrewzingg23-del/Solve-Official-/tree/claude/keen-cerf-tpd7io` in any room.)
- **Later the same night:**
  - Every change the bot makes names the assistant it came through ("via Claude").
  - Builders are named by any branch prefix, so Doris shows too.
  - The trunk's latest passed build can be saved as proof. The server reads it from GitHub again first, and saves it as a record linking to the run. It isn't marked "seen by solve", which needs a service actor.

## 2026-10-05 — The ten venture doors, working (Claude, for the founder)

- **On brand:** the ten doors (Doris's #10) are rebuilt on the white floor of brand v3, with ink type and the deep cyan point. Each has one working tool in place of a button to `/start`. `/ventures` lists all ten. A target is shown as "the goal", never as a count.
- **Solar (`/solar`):** a live proposal tool.
  - The homeowner moves their bill (and kWh, if they know it) and sees system size, panels, production, year-one savings, payback and 25-year savings, with their home in 3D carrying that many panels.
  - The numbers use 2026's rules: no 30% federal credit (it ended for homeowner systems installed after 2025), about 16¢ per kWh in Florida, about 1,400 kWh per kW a year, $2.90 per watt.
  - **Aurora:** "Design my roof" (with consent) creates a project in Zest Solar's Aurora account and opens the homeowner's own signed proposal page (`/solar/proposal/<token>`). That page reads the latest Aurora design each time it opens: real size, production and panel count once designed.
  - Needs `AURORA_API_KEY` and `AURORA_TENANT_ID`; until then the form says requests aren't connected.
  - *Superseded the same night: the founder can't get an Aurora API token, so the API path was removed for the solar desk (see "Communities" below).*
- **Real estate (`/real-estate`, removed later that night at the founder's word):** a 3D concept model of the development. Three phases (sixteen homes, offices over retail, the estate on the rise) switch on and off, and there's a fly-through.
- **The others:**
  - Insurance: coverage need, the DIME way.
  - Trading: position size from risk (Practice math).
  - Samantha: what missed calls cost a month.
  - Meta ads: break-even and target return on ad spend.
  - Membership: the oath, to hold before applying.
  - Zuber pen: a 3D render with "Ring it".
  - Vantage: the fleet of doors, linking to the Command Center.
- **Tests:** `tests/ventures/{solar,tools}.test.ts`. The pages were screenshotted in Chromium at desktop and phone sizes with no page errors.

## 2026-10-05 — The doors, round two (Claude, founder's direction)

- **Samantha and Vantage are out** of the doors; they are vertical page ideas inside solve. Eight doors remain.
- **Solar goes all the way to price and qualification**, in four steps on `/solar`:
  1. the bill and the system in 3D;
  2. the price, as cash, a loan (APR, term and down payment shown together, monthly payment beside what's left of the bill) or a lease (no number until the design);
  3. "Do you qualify?": six questions, no credit check, with cash, loan and lease fit and the reasons;
  4. the real design through Aurora, and a live proposal page.
- **Insurance is sales-facing: the agent's dialer** (`/insurance`, in Practice with sample leads).
  - It has a lead queue, power dial, calls only inside 8am–9pm in the lead's time zone, a live script with the family's number, and outcomes that schedule every next step (`lib/insurance/dialer.ts`): retries, consent-only texts, appointment confirmations and reminders, onboarding after a sale, 90-day nurture, and do-not-call stopping everything.
  - Real calling needs a phone line (for example Twilio) and the agency's leads in solve: the next slice.
- **Real estate is residential:** phases of homes, a clubhouse, pool and park, and estate homes on the rise. No commercial.
- **Zuber pen:** finds your phone and your pen, and pairs with a key finder (the 3D shows the tag ringing with the pen).
- **Members Only goes higher-ticket:** the oath, then what sets it apart, then two tiers. **The prices are a proposal awaiting the founder:**
  - founding seat $6,000 a year (or $550 a month), locked for the first fifty;
  - Inner Circle $18,000 a year, ten seats.
- Pages on the white floor render their form controls light.

## 2026-10-05 — Communities, and solar without the Aurora API (Claude, founder's direction)

The founder's words are in `DECISIONS.md`. Nothing here needed a migration.

- **Communities (`/communities`, `/community/<id>`; `lib/community/`):**
  - **Start one:** anyone signed in names it, says what it's for and picks packs. That makes a World (theirs) and a public profile.
    - The profile lives in the owner's own scope, so only they can write it.
    - Its id is derived from the owner and a nonce on the profile, so nobody can publish a look-alike for someone else's community.
  - **Find one:** every community is listed for everyone signed in. The profile is public; everything inside stays with members.
  - **Join:** a person asks, with a note, and can bring their AI. The owner sees the ask and lets them in (they can build) or says not now, and the person sees the answer.
    - The ask is a kernel message from the person's own scope to the owner's inbox.
    - An unanswered ask stands for a week, so asking twice doesn't send two.
    - A member can later ask to bring their AI in.
  - **AI:** a member's bot comes in with them under its own identity, for them (Add, 30 days, renewable as on any World). It reaches the community's room through the connector like any World it's let into.
  - **Connect:** members see who's in, with the AIs they brought, and leave each other notes. A note is a kernel message, on the record with who sent it. Notes only go between people in the community, and only theirs are shown.
  - **Packs** (`lib/community/packs.ts`): the build room, the solar desk, the sales dialer (Practice) and the risk tools. The owner can change them.
  - **Links:** `/ventures` links here. The Command Center has a Communities section with what waits on you in each one you started (`myCommunities`).
- **Solar without an Aurora API key (`lib/solar/desk.ts`, `/solar` step 4, `/solar/mine`):**
  - The homeowner signs in (their numbers come with them) and asks for their design.
    - Their name, address, contact and answers are sealed in their own scope, one scope per request, readable by the desk's owner alone.
    - The owner sees each request on the community page with the estimate and how they pre-qualify. They design it in Aurora by hand and send back the proposal link, with size, panels, production and price if they like.
    - The homeowner's page shows the design: the numbers re-run from it, their price as given, a 3D home with the real panel count, and a link to the full proposal.
    - "Erase my request" destroys its key and revokes the desk's access. The details are gone for good; the record keeps that a request existed.
  - **Which desk:** set by `SOLAR_COMMUNITY` or `solve.communities.json`. Until it's set, step 4 says the desk opens soon.
  - **Removed:** `lib/solar/aurora.ts`, the signed proposal link and `/solar/proposal/<token>`. They are in git history (`e621a68`) if an admin ever issues an API token.
- **Real estate removed** ("Leave out the real estate plan for now"). Seven doors remain.
- **Shared code, additive:**
  - `readWorldMembers` in `lib/world/collaboration.ts`: who's in a World, readable by anyone in it;
  - `requireSealing` exported from `lib/bot/memory.ts`.
- **Tests:** `tests/community/{community,solar-desk}.test.ts` (10, on the embedded kernel), covering:
  - forged profiles refused;
  - only the owner lets people in or answers;
  - the AI comes in only with its own person;
  - notes only between members;
  - homeowner details never in the clear, and unreadable by anyone else;
  - erasing really erases.
- **Checks:** full suite 307/307; lint clean; typecheck ok; build ok. Community views (owner, guest, member on a phone) and the homeowner's page (waiting and designed, desktop and phone) were rendered with sample data in Chromium with no page errors. Fixes from that: a reply box collapsed on phones; the guest view's empty column; "your AI" for your own.
- **Known limits:**
  - Asks and solar requests show on the community page. The Command Center lists the person's communities with what waits on them (people asking, requests still readable), but sends no notification.
  - The directory reads the kernel's public list, which returns at most 2,000 public entities.
  - Open communities, where anyone joins without the owner, would need the owner's agent to admit on their behalf; not built.
- **Founder steps to open Zest Solar's desk:**
  1. Sign in on the preview and start a community, "Zest Solar", with the solar desk pack.
  2. Copy its id from its page and set `SOLAR_COMMUNITY` in Vercel (or send it to Claude to commit).
  3. Requests then land on the community page. Design each in Aurora, then paste the proposal link and the numbers.

## 2026-10-05 — Your AI inside communities (Claude)

- **Connector tools** (`lib/bot/connector.ts`):
  - `list_communities`: the person's communities, with what waits on them, and others they could ask to join.
  - `read_community`: who's in and the AIs they brought, notes for the person, packs, and for an owner who's asking and how many solar requests wait. A homeowner's name, address and contact never go to the AI; they stay on the community page.
  - `send_note`: a note from the bot, for the person.
- **Notes from your AI only with your yes:**
  - The person switches it on under "Your AI" on the community page. That is a 30-day `message.send` grant on their own side of that community only, and they can stop it any time.
  - A note the AI sends shows "from Ben, via Rex, their AI". Replies go to the person.
  - Notes count only when they come from their person's own side of the community.
- **Owners** can let their own AI into the community's room from the same panel.
- **Tests:**
  - `tests/community/connector.test.ts`: refusals, no homeowner details, one note per retried call;
  - a new delegation test in `tests/community/community.test.ts`;
  - the connector's tool list.
- **Checks:** full suite 311/311 before merging the trunk. After the merge: affected tests 34/34, typecheck, lint and build ok. The panel was rendered in Chromium with no page errors.


## 2026-10-08 — Immersive creation preview (Codex)

Branch codex/immersive-world-studio: creation studio, Three.js and interactive projection, real local persistence/history, materials/build path, Rapier drop, JSON/GLB/STL/SVG export, shared revisions, MCP studio tools, on-device SOV ID modules, shortened identity onboarding and flat authorized map.

Verification in progress through CI/preview after local runtime disconnection. Six initial checks passed locally; further regression and browser gates are required before completion. No production data changes. CAD, engineering approval and real-world provider execution are not claimed.

## 2026-10-08 — Studio review and verification checkpoint

Important final review findings are fixed: persisted ancestry, independent creations/history, stale AI proposal checks and consistent storage budgets. Identity export retains unsaved customization. New regressions exercise those boundaries and the existing real kernel constraint. Full CI/browser gates remain pending for this checkpoint after a local runtime outage. Production sharing/provider configuration and live multiuser verification remain separate from embedded-kernel tests.

## 2026-10-08 — Immersive studio delivery

Code checkpoint `d7ac9230cc5c0ed9f6ed0bb290b1eac6b598a4bc`: Build run `37831693148` passed 406/406 tests, TypeScript, lint (zero errors, eight warnings) and production build. Studio browser run `37831693140` passed actual desktop/phone/no-WebGL editing, persistence/history, independent creations, four exports, physics, identity privacy, onboarding and phone/desktop map zoom/frame. Seven browser screenshots are attached to that run. READY preview: https://solve-l1jctbfmb-sovigrn.vercel.app/. All five Important and both Minor final review findings are addressed; none are deferred. Current main's ARGUS and community AI work is preserved. No production merge, deployment, schema or data changes.

Handoff: `docs/handoff/2026-10-08-immersive-studio.md`. This is a concept creation studio; live shared/provider sessions, deep avatar generation, specialist CAD and real-world execution remain follow-ups.

## 2026-10-10 — The avatar's one brain, day-one magic, and a community's shared context (Claude)

Plan: `docs/plans/2026-10-09-ai-avatar.md`; north star: `docs/plans/2026-10-10-avatar-north-star.md`.

- **One brain** (`lib/bot/context.ts`):
  - The context pack picks the memories most relevant to the moment, then the newest. It labels where each came from ("Imported · Solar plan", "Claude", "You"), and stays bounded and inert.
  - Talk now reads it with the person's sign-in, plus the persona brief and soul.md. The prompt has no model in it (`buildTalkSystem`), so every model answers as the same character.
  - Under each reply: how many memories were in mind (tap to see which), and which model spoke.
- **Keep this** (`/api/bot/keep`): any Talk line becomes a sealed, erasable memory. Your own words are labeled "You"; the avatar's are labeled "Talk · <model>".
- **What I already know about you** (`lib/bot/knowing.ts`, `/api/bot/know`, `app/bot/knows-you.tsx`):
  - Imported history and connected assistants are read first.
  - The model must cite the memories each line rests on; lines with invented or missing citations are dropped.
  - Nothing sensitive is inferred, and nothing is cached, so forgetting a memory leaves no paraphrase behind.
  - On the avatar screen it sits right under the hero, before Talk. With few memories it asks for your other AIs ("Bring ChatGPT history" / "Connect another AI"). Otherwise one tap reveals the lines one at a time while the face's ring fills. Each source opens its words and the memory.
  - Signed-in only, on Talk's limits. It shows the model and cost; Sonnet 5.5 for this read.
- **A community's shared context over MCP** (`lib/community/context.ts`):
  - Goals, decisions, facts, how we work and open questions are entries in the community's World.
  - Connector tools: `get_community_context` (members only) and `add_community_context` (only for an AI its owner let into the room).
  - Who added each entry, for whom and via which assistant comes from the record's entity-created events, never from the text.
  - The community page shows them in a "Shared context" panel with an add form. The room and World pages show the entries as plain sentences.
- **Style and ergonomics:**
  - one primary action per card, full width under the thumb on phones;
  - tap targets 44px or larger;
  - a readable measure;
  - motion as assembly, with reduced motion honored;
  - live regions, and focus moves to the reveal;
  - Talk's new rows avoid the classes TalkCinema re-skins.
- **Shared files, additive:**
  - Talk route (`app/api/bot/chat/route.ts`, Doris): context, `inMind`, `modelLabel`;
  - `app/world/[worldId]/room/talk.tsx` (Doris): Keep, memories in mind, model;
  - `app/world/[worldId]/page.tsx` (Codex): shared entries shown as text.
- **Tests:**
  - `tests/bot/context.test.ts`, `tests/bot/knowing.test.ts`, `tests/community/context.test.ts`;
  - connector tool list updated.

  Full suite 445/445; typecheck ok; lint 0 errors (the 8 warnings were already on main); build ok. Rendered in Chromium with mocked APIs (desktop and phone): the reveal, Talk with Keep and memories in mind, the empty state and the shared-context panel, with no page errors.
- **Needs:** `OPENROUTER_API_KEY` where it runs (already used by Talk), a signed-in person with memories, and kernel v5 (staging has it).

