# One staging AI integration

Current review target: `codex/ai-staging-integration-20261111` → `solve/space-presentation`.
The approved shell remains the base. No merge to `main`, production deployment, production-user query, or deployment-secret retrieval
is part of this work. The reviewed meter was applied to solve-staging only after the user asked
for the least-effort working test.

## Source audit

| PR | Exact source head | Relationship | Observed source check |
|---|---|---|---|
| #97 | `926214be3e30229e7c2e93c964afdccadfc5b262` | OpenAI adapter, based on approved shell | Vercel success |
| #98 | `c82657cf2a65a9a9eb23d583898980bfa90c67df` | Parallel meter | Vercel failed: internal helper inherited PUBLIC execute |
| #99 | `f30450e49d362343e97e82fa23e4de65e524114e` | Console stacked on #97 | Vercel failed: stale AI-link assertion |
| #100 | `3b9e9713a3ee9f0efb08facd7fa3d832914f27bd` | Parallel MCP attribution, platform inventory, adapters | Vercel success |
| #101 | `39cbb7fb5f0d8dd0d115cabe70ee93b52d8ca3af` | Dual-provider route stacked on #99 | Vercel READY at this SHA; not a live-reply test |

Sources: [#97](https://github.com/andrewzingg23-del/Solve-Official-/pull/97),
[#98](https://github.com/andrewzingg23-del/Solve-Official-/pull/98),
[#99](https://github.com/andrewzingg23-del/Solve-Official-/pull/99),
[#100](https://github.com/andrewzingg23-del/Solve-Official-/pull/100),
[#101](https://github.com/andrewzingg23-del/Solve-Official-/pull/101).
Failure evidence: [meter migration build](https://vercel.com/sovigrn/solve/2D8ts6573mF6QAkbBonbrcezUC8v) and [meter head](https://vercel.com/sovigrn/solve/4ia9YCEGQfZrRD7G8qL2QDB4TRrT),
[console](https://vercel.com/sovigrn/solve/DTYzVpKk5D5QF7ctj1PcUaLcBb2q).
The pre-existing GitHub build workflow ran only on `main`, so these PR heads had no Actions runs.
This integration enables that workflow for its own branch, including browser screenshots.

The #101 stack is incorporated once. #100's MCP attribution and inventory are added independently;
its identical provider files are not duplicated. #98's SQL and typed client are retained; the meter SQL plus its helper correction form one canonical applied migration.
The unused provider-choice code and the `verify:ai:local` deployment-secret-pull shortcut are removed.

## Current behavior and boundaries

The shell's existing AI button opens one conversation panel. Space, People, Apps, Control,
publication, layout and Space presentation retain their existing homes.

A turn requires Vercel **preview**, verified non-anonymous Auth, an exact operator allowlist match,
and a human actor resolved through the user's own kernel client. A connected OAuth app is an agent,
even when Auth identifies its owner; it is denied. Production is refused before identity lookup.
Same-origin JSON is required and its byte size is bounded. The client never chooses a model or key.

Before a Space title/summary can leave SOLVE, `loadCreativeWorld` must read it with that person's
current authority. Revocation is rechecked on every turn. No contents, file bytes, tools, commands,
capability grants, resource writes, invitations, publication or purchases are exposed to the model.
Client-supplied history and Space metadata remain untrusted data. The model receives the conversation
and only the bounded authorized title/summary, not the whole page or an account's private memory.

Each successful reply identifies its actual provider and returned model (configured model when
not reported), token counts, and estimated or unknown cost. Missing usage and unknown models never
become zero-dollar claims. Cached Anthropic usage is included in the meter; when cache pricing is
not fully represented, cost is unknown. Provider errors expose only allowlisted categories and no
provider diagnostic body. Errors/declines/empty replies do not claim completion.

History remains in component memory across navigation; it resets on account change or refresh.
Every request includes the panel's expected viewer identity, which must match verified Auth before
any history is transferred. A stale tab receives 409 and discards its history; auth events and focus
checks reload changed sessions, covering account changes in another tab.
History sent on the next turn is bounded to the server's limits, even after a long reply.

MCP reads preserve role attribution without disclosing other apps' names. Attribution follows the
latest available writer, rather than letting an app edit inherit a human creator's label. The newest
200 events are used; anything outside that bounded window remains `someone`. Piece text and titles are JSON-encoded to keep malicious line breaks/author markers inside their
own record. Attribution never
confers authority or makes stored text executable instructions.

## Meter assessment

Include #98 as **usage accounting for this private preview**, not as public billing protection.
Its original SQL is preserved and followed by the helper-execute revoke in one atomic canonical migration:
`20261111101221_ai_spend_meter_with_boundary.sql`, matching staging's actual migration version/name.
The two never-applied source filenames are removed so a later push cannot apply the meter twice.
The applied SQL's SHA-256 is `e35655dfec3311a8cd8832932c23e1a869fe3175291468bca6bca2010aa0e283`;
the repository file was compared byte-for-byte with the submitted migration and matches.
It does not collide with the approved branch's legacy-token lockdown migration.
Connected-app writes, cross-actor impersonation, role grants, validation, windows and replay are tested.

The handler refuses to call a provider if the meter cannot be read. Recorded usage of 20,000 tokens
or eight completed calls within an hour stops subsequent turns. A process-local eight-attempt floor
also remains. This is **read-before-call**, not an atomic reservation: concurrent instances can pass
together. Reported usage is recorded even for charged empty/refused responses. Provider errors with no
usable usage may still incur charges not recorded here.
A failed post-call recording preserves the already-paid reply and visibly says usage was not recorded.

Therefore this is not a hard token/dollar cap, not a billing ledger, and not ready for general users
or autonomous actions. Access is restricted to the designated existing staging account. The already-configured Preview
Anthropic credential is used by the server in place; no value was decrypted, copied or changed.
Its metadata also lists Production, so an account-wide provider spending change is not made here.
An isolated Preview-only credential is preferable before expanding beyond this one-account test. Public rollout requires trusted atomic admission,
usage reconciliation and consent/retention decisions; no new foundational budget system is invented here.

## Least-effort test and remaining live gate

Setup is complete in staging:

- The actual staging `resolve_caller` definition was inspected and matches the connected-app identity
  boundary. The meter was absent before applying the exact reviewed SQL atomically as
  `20261111101221_ai_spend_meter_with_boundary` in project `taeikshnbcsjlgbattyp` only.
- Real Postgres privilege queries confirm anon/authenticated/service roles have no kernel schema/table
  access or helper execute; anon cannot call either meter API; authenticated/service can call only
  the typed meter APIs as intended. No production migration was applied.
- The existing non-anonymous account matching the project owner's email was identified in **staging only**.
  No production users were queried; no token was issued or impersonated to bypass sign-in.
- Vercel environment metadata was inspected with `decrypt=false`. `ANTHROPIC_API_KEY` is already configured
  for Preview (also listed for Production/Development); its value was never retrieved or copied.
- `SOLVE_AI_INTERNAL_PREVIEW=1`, the designated staging user's allowlist, `SOLVE_AI_ENGINE=anthropic`, and
  `ANTHROPIC_MODEL=claude-haiku-5-5` are scoped to **Preview + this integration branch only**.
  No production environment variable or credential was edited.
- Configured test deployment: `solve-ngyuvd255-sovigrn.vercel.app`, code SHA
  `5a0ab20b2000805d4de38bcfc2f293551347c794`. Its explicit Vercel target is `staging`, not production.
  The final PR/evidence report records build readiness and the unauthenticated boundary check.

The person's remaining steps are: open that test link, sign in with the existing account, open AI,
and ask a short question. No terminal command, key copy or UUID handoff is required. If the configured
provider credential is rejected or lacks model access, an operator must replace it **for Preview only**
through the provider/Vercel UI; never retrieve an existing production key.

A real signed-in reply, its provider/usage/cost, a second turn, navigation, and a revoked/unauthorized
Space still need live confirmation. The automated component and transport fixtures do not establish that.
`npm run verify:ai` remains an optional adapter-only check with a separately supplied local staging
credential; it never pulls a deployment key and is unnecessary for this browser test.

**No create-resource action is designed or implemented yet.** Its prerequisites are a verified live
signed-in conversation and the user's approval of exactly one proposed action, with preview/review,
permission enforcement, idempotency, provenance and read-back evidence. Fixture success is insufficient.

## Verification record

- Combined pre-final run: **301/301** tests; typecheck, lint and local build passed.
- Final full suite including independent-review regressions: **307/307**, zero failures. Typecheck and lint passed. Final build/browser/CI results are also recorded in the PR and BUILD-STREAM.
- Security regression: the original #98 fails the existing anonymous-function test and the explicit
  helper-grant test; the additive correction passes both without weakening either test.
- Real local kernel + provider transport fixtures test production/guest/nonallowlist/app denial,
  unauthorized/revoked Space, no-key, body/origin, meter failure, engine provenance, usage/cost,
  provider errors, cache usage and sequential limits. These are **simulated provider** results.
- `test:product`: approved shell and panel reachability/keyboard at 320/390/1440 passed without a database.
- `test:ai-ui`: actual component with labelled simulated transport passed provider labels, estimated/unknown
  cost, bounded long-history follow-up, navigation, account reset, light/dark at 320/390/1440.
- Final reviewed-tree staging acceptance `acc-202611111004-urwf`: **101/101**, scenarios `home,present,second`.
  This proves ordinary Space presentation and connected-app flows, not a live internal model reply.
- `verify:ai` with no key exits **2**, names missing provider configuration and makes no API call.
- Remote meter application and role privileges are verified on staging. Live signed-in AI, actual provider cost and resource creation remain **unverified**.

Provider schema/pricing references checked 2026-11-11:
[OpenAI Responses](https://developers.openai.com/api/reference/resources/responses/methods/create),
[Anthropic model IDs](https://platform.claude.com/docs/en/models/overview),
[Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing).
