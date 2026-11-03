# Foundation decision — 2026-11-03 (Milestone 0)

Asked: retain, selectively rebuild, or start a clean repository. Decided from measurements
taken today against the live staging project, not from status reports.

## Verdict: Option B — keep the kernel and infrastructure, rebuild the application layer

Not Option C (clean repo). The part that is hardest to build correctly is the part that is
already verifiably correct. The problems that cost a full session today were all in the
application layer or in configuration — none were architectural.

## A. Evidence for keeping the foundation

**The authority boundary is real and server-enforced.** In the staging project:

| schema | anon USAGE | authenticated USAGE | service_role USAGE |
|---|---|---|---|
| `kernel` | false | false | **false** |
| `kernel_api` | false | true | true |
| `public` | true | true | true |

The `kernel` schema is unreachable by every API role *including `service_role`*. Even a leaked
service key cannot read or write kernel tables directly; it must go through `kernel_api`. That
gateway is uniform: **79 functions, all 79 SECURITY DEFINER, zero SECURITY INVOKER.** There is no
side door to keep closed by convention.

**Migrations are reproducible, and proven so on every test run.** `tests/kernel/harness.ts` applies
the real `supabase/migrations/*.sql` (13 of them) into an embedded Postgres (PGlite), and
`npm run test:postgres` runs the same migrations and the same tests against a real Postgres server.
Reproducibility is asserted by the suite, not claimed in a document.

**The tree is disciplined, not sprawling.** ~59k lines (app 21.5k / lib 18.1k / supabase 6.4k /
tests 12.8k), 22 runtime dependencies, 13 devDependencies. 448 tests pass from a clean checkout;
typecheck, lint (0 errors) and `next build` all green today.

**Work persists without any AI provider.** Persistence is kernel events plus a guest device path;
no model call sits on the write path.

**The governed loop works end to end, verified today.** Approving MCP consent provisioned a
companion through `kernel_api.create_avatar` under the person's own authority: one `ai_companion`
avatar ("Nova") and one `bot.persona.set` event, 11:36:04Z. `whoami` and `get_context` return real
data over the live connection.

Rebuilding this would mean re-earning the role grants, 79 definer functions, 13 migrations and 448
tests — months — while risking the one thing that is currently provable.

## B. What should not be carried forward

**The user-facing information architecture.** 37 pages and 20 API routes, including venture-specific
surfaces (`/zuber-pen`, `/money`, `/studio`, `/sov-id`, `/command`). This is the layer the
reconstruction directive targets, and replacing it does not disturb anything above.

**The branch and PR topology — the largest real risk, and it is process, not code.** 10 open PRs,
most drafts, #33 and #37 already CONFLICTING. The trunk `claude/keen-cerf-tpd7io` sits 33 commits
behind `claude/community-projects` and 6 ahead. There is no single trusted baseline, which is why a
cherry-pick was needed today to get one fix onto staging. A clean repository would not fix this; the
same habits would re-fragment it within weeks.

## C. Risks and what protects against them

Cutover risk is contained because the kernel is reached only through `kernel_api`: a new application
layer is a new caller of a stable contract, not a migration. No destructive operation is implied by
this decision. Existing data is untouched.

## D. Verified blocker (founder action required)

Every World-read path over MCP fails with `Invalid API key` — confirmed on both `list_worlds` and
`read_world` against a real world id. `lib/bot/connector.ts` reads Worlds as the bot's agent via
`botAs`, which needs a service key; `lib/supabase/config.ts:24-26` resolves that to the branch-scoped
`SUPABASE_SECRET_KEY`. Supabase rejects the stored value, so it no longer matches project
`taeikshnbcsjlgbattyp` — most likely a legacy `service_role` JWT left behind when the project moved
to `sb_publishable_`/`sb_secret_` keys (the publishable key is already the new format). The value was
not decrypted or modified. Fix: replace that one Vercel preview env var with a current secret key from
the staging project and redeploy. Until then, `whoami` and `get_context` work; Worlds do not.

## E. Next smallest fully functional outcome

Establish one trusted baseline before building on it: reconcile the trunk with the 33 commits (or
declare `claude/community-projects` the trunk), and close or land the conflicting PRs. Then Milestone 1
— a person creates a World, edits a native object, leaves, returns, and finds it intact, with no AI
involved — on top of the kernel contract that already holds.
