# Collaboration rebuild

Founder ordered a complete collaboration-first experience and removal of unready public features. This rebuild starts from main `fda0e7a` and preserves existing projects, invitations, actors, bot personas, documents, history, grants and studio source. The public product is now Projects, Communities, Your AI and Profile.

## Integration record

Source commit `0ad1dc474d51b38ee0bc846988b88d2cf6995b0f` was pushed on `codex/collaboration-rebuild`, fast-forwarded into main and pushed to origin. The remote main hash was verified at 2026-10-10 02:15 UTC. Main matches the locally verified implementation exactly. This record is a subsequent documentation-only checkpoint; CI/deployment results remain unconfirmed.

## Delivered behavior

- Projects replaces the trading/studio entry point. People can draft an idea locally, continue through sign-in, and explicitly create a real private project. Drafts are scoped to the displayed account and clear only on confirmed creation.
- Shared rooms lead with attributed conversation, decisions and selected AI context. Documents and People have stable links. Repository, estimates, resources and history are optional sections.
- Communities keep real membership requests, owner review, notes and explicit AI permissions. Empty states and provider/read failures are honest; pack and solar desk controls are absent.
- Your AI has Persona, Connections and Knowledge sections. A local persona requires explicit review before account import. MCP connections and manual reviewed imports remain; connecting does not automatically sync an assistant's chat history.
- Profile edits name, AI name and preset portrait. Account names follow the same canonical Solve ID through append-only events. Local saves check actual storage before claiming persistence.
- Displayed-account guards reject stale Profile/project/persona submissions after another-tab account switches. Recoverable text forms retain drafts and request identity on failure, create a new request for changed text, and clear only acknowledged saves.
- Default GETs to trading, money, cards, studio/map, promotional ventures and old launch experiments redirect to the core product; hidden POSTs/APIs return 404 with no-store. Identity aliases converge on Profile/Your AI. Studio source is retained for explicit `ENABLE_EXPERIMENTAL_FEATURES=true`; financial surfaces still require their own financial flags. The unowned sandbox card remains hidden even with experiments enabled.

## Verification

Node 22. Full suite: 456 tests passed, zero failures/skips. Typecheck, lint and production build passed; lint retains eight existing image warnings. Shared-room Chromium checks used real migrated SQL for authority/persistence and explicitly labelled Auth/model fixtures. They cover two people, invitation lifecycle, shared source and AI retry, stale document retention, history, cost assumptions, mobile layout and recoverable form failures/retries. The actual-action regression harness uses real SQL with labelled Auth/Next adapters, including stale-account refusals and positive current-account saves.

The production product browser script passed real anonymous desktop/phone navigation, idea reload and sign-in return, local profile/persona continuity, keyboard access, hidden GET/POST/API routes, and storage denial without false success. It does not simulate or claim live sign-in delivery. `npm run test:studio` passed with its server opted into experiments, verifying the preserved studio at `/studio` rather than the new root. The final account portrait images and 320/390px layouts were checked in Chromium; screenshots are under `test-results/product`.

Required checks: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:product`, `npm run test:shared-room`, `npm run test:studio`. Browser commands need Chromium; set `CHROMIUM_PATH` when using a system browser. Product browser workflow now runs on main and this build branch, saving screenshots.

## Independent review and decisions

Fresh whole-branch review found no Critical issues. All four Important findings were reproduced and fixed: stale-account writes, failed Knowledge reset, failed document/community draft loss and escaped-draft size rejection. The missing People fragment was promoted from Minor because it broke an advertised core destination for ordinary members; a real viewer test now verifies the read-only roster. Cost of that decision: a small additional roster implementation. No minors are deferred.

The review's document-editor loss claim was narrowed to creation: ArtifactEditor already uses controlled state and conflict-aware PATCH, which the shared-room fixture verifies. Cost if that ruling is wrong: a different editor failure case could remain untested. A suspected cross-path legacy Server Action bypass was not confirmed by the reviewer; its anonymous probe returned 404 and it was excluded as speculative.

## Live activation boundary

No remote migration or manual deployment was performed. The confirmed main push can trigger existing Git/Vercel integration; it does not establish a working live rollout. GitHub status/deployment APIs and Supabase/Vercel administrative credentials were unavailable in this cloud environment. No secret values belong in chat.

Apply only missing migrations after inspecting the destination's migration history. Preserve the five earlier shared-room migrations (`20261009010000` through `20261009050000`) and add `20261009060000_person_profile.sql` for authenticated profile-name editing. Do not reapply an entire migration bundle or reset any database. The new migration preserves immutable actors and existing reader authority checks; API roles gain no direct kernel access.

Before calling the release live, confirm deployment environment bindings, migration application, real Auth email/callback return, two real accounts inviting/joining/revoking, external AI consent/provider failure behavior and real Postgres concurrency. Paid/card integrations, automatic external-history synthesis, end-to-end encrypted communication and experimental 3D creation are outside this launch surface.

## Activation follow-up

GitHub check/status access became available after the initial integration. Vercel reports successful deployments for `0ad1dc4` and `a69a224`; main product-browser run `38016262633` passed. Main Build run `38016262639` failed in Test and skipped typecheck/lint/build. Detailed log hosts are blocked by the cloud allowlist. Branch `codex/release-activation` adds failure diagnostics to the Checks API while preserving the actual test exit status. Instrumented run `38017300634` identified all seven failures as the action harness's missing `.browser-tests` parent directory. They were reproduced in a clean working directory, fixed with recursive directory creation, and all seven checks passed there. Lint/typecheck passed; full-suite/CI reruns follow. This is not yet a green CI claim.

Real Postgres 17.10 rehearsal passed 60 checks: 46 existing kernel/room/revision/profile tests plus 14 invitation, concurrency and upgrade cases. Six-connection retries persist once, two acceptors consume one invitation, simultaneous document edits save one winner, one AI worker acquires a lease and profile collisions retain immutable identity. The guarded six-migration upgrade preserves existing event IDs/hashes and project contents, a profile-only upgrade preserves existing invitations/conversation, and repeated or partial full-package application is refused without data changes. Local Auth claims/model output are fixtures, and this is not a staging load or live integration result.

Current-session release files are under `/workspace/solve-release/0ad1dc4`: `manifest.json`, read-only `inspect.sql`, guarded atomic `activation.sql`, `concurrency.test.mts` and `upgrade.test.mts`. All six source migration hashes were checked. The full package is only for a destination with none of these six migrations; inspect actual history first and apply only missing source files to partially upgraded destinations. An authorized runner must record each applied version. No database reset or remote migration occurred.

Reusable Postgres installation/startup instructions and the observed deployed-site/GitHub-log domains are saved in the cloud configuration draft. Saving a draft does not publish it or provide credentials. `SUPABASE_ACCESS_TOKEN` remains absent and is the immediate prerequisite for inspecting/applying staging migrations through the supported management API. Server/model credentials and real Auth/provider tests remain outstanding. Enter credentials through secure environment settings, not chat.
