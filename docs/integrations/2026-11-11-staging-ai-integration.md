# One staging AI integration

Current review target: `codex/ai-staging-integration-20261111` → `solve/space-presentation`.
The approved shell remains the base. No merge to `main`, production deployment, remote schema
application, production-user query, or deployment-secret retrieval is part of this work.

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
its identical provider files are not duplicated. #98's migration and typed client are retained.
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
Its original migration is unchanged, including its version `20261111010000`; one additive follow-up
`20261111095128_ai_meter_boundary.sql` revokes the helper's unintended execute privileges. Neither
migration collides with the approved branch's `20261111000000_legacy_app_tokens_refused.sql`.
Connected-app writes, cross-actor impersonation, role grants, validation, windows and replay are tested.

The handler refuses to call a provider if the meter cannot be read. Recorded usage of 20,000 tokens
or eight completed calls within an hour stops subsequent turns. A process-local eight-attempt floor
also remains. This is **read-before-call**, not an atomic reservation: concurrent instances can pass
together. Reported usage is recorded even for charged empty/refused responses. Provider errors with no
usable usage may still incur charges not recorded here.
A failed post-call recording preserves the already-paid reply and visibly says usage was not recorded.

Therefore this is not a hard token/dollar cap, not a billing ledger, and not ready for general users
or autonomous actions. A designated preview account and a NEW provider credential with an operator-set
provider-side spending limit remain necessary. Public rollout requires trusted atomic admission,
usage reconciliation and consent/retention decisions; no new foundational budget system is invented here.

## Human-only setup and remaining live gate

No local provider key is present. No existing Vercel/production secret was read, pulled, decrypted,
copied or logged. The staging migration list was read only for project `taeikshnbcsjlgbattyp`;
the meter is absent. Historical staging migration version numbers also differ from repository file
versions, so do not blindly run a blanket database push.

An authorized staging operator must:

1. Review/apply the two meter SQL files to **solve-staging only**, reconciling its existing migration
   history and applying the helper correction immediately. Verify the same privilege checks afterward.
2. Create or designate a **non-anonymous staging test account** and provide its staging Auth UUID,
   without looking up production users. No service-role key is required by the AI turn route.
3. In Vercel Preview scoped to this integration branch, enter `SOLVE_AI_INTERNAL_PREVIEW=1` and
   `SOLVE_AI_PREVIEW_USER_IDS=<designated staging UUID>`. Keep the gate off elsewhere.
4. Add a **new staging-only** `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` through the provider/Vercel UI;
   do not reuse or pull existing production credentials. Set a provider-side spending limit.
   Set `SOLVE_AI_ENGINE=openai|anthropic` and the matching `OPENAI_MODEL` or `ANTHROPIC_MODEL` if
   desired. `claude-haiku-5-5` is a documented low-cost Anthropic option, not proof of this account's access.
5. Rebuild this branch's preview, verify its exact commit SHA and staging target, sign in, open AI,
   and get one real reply. Confirm provider/model, unknown-vs-estimated cost and independently read
   usage. Test a second follow-up, navigation, unauthorized Space, revocation, sign-out and account change.

`npm run verify:ai -- openai` (or `anthropic`) is an optional adapter-only check with a newly supplied
staging environment credential; it is not a signed-in product test. Never put credentials in a chat,
command argument, shell-history assignment, repository, screenshot, or report.

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
- Real staging acceptance `acc-202611110954-nlze`: **101/101**, scenarios `home,present,second`.
  This proves ordinary Space presentation and connected-app flows, not a live internal model reply.
- `verify:ai` with no key exits **2**, names missing provider configuration and makes no API call.
- Live signed-in AI, actual provider cost, remote meter application and resource creation remain **unverified**.

Provider schema/pricing references checked 2026-11-11:
[OpenAI Responses](https://developers.openai.com/api/reference/resources/responses/methods/create),
[Anthropic model IDs](https://platform.claude.com/docs/en/models/overview),
[Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing).
