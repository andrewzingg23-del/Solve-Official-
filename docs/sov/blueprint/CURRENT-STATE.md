# Current state — SOV foundation

## Baseline
Isolated codex/sov-step-one from f9985c8; original source checkout and its uncommitted work preserved. origin/main refreshed at 5529d1c. PR #51 remains unmerged; none of its styling imported. Native worktree tool could not target the nested application repository; git worktree was used under the approved workspace.

Staging taeikshnbcsjlgbattyp is healthy. Read-only verification confirmed migrations and existing actor/World/grant/revision APIs. No migration, production write or permission change performed. Two tables without RLS are private kernel tables: anon/authenticated have no schema usage, SELECT or INSERT. The generic public-exposure advisory does not describe their actual privileges.

## Implemented
One shared shell: four destinations, persistent My Agent, semantic graphite/gold materials and architectural asset. Real private Space has no sample Projects/profile/activity. Create explicitly via the existing createProject action. Project routes read canonical World entities; document editing reuses handleRoomArtifact, expectedVersion, request idempotency and caller authorization. Save checks the displayed Auth user before a write and reads the saved artifact back before success. No new kernel/identity/task/ledger model.

Guest claim uses updateUser on the same anonymous Auth identity, separate from existing-account sign-in. Confirmation must occur before claiming recovery complete. The founder's personal claim/recovery test is deferred to final pre-public acceptance. The provided personal email is not used or stored in this repository.

## Verification so far
31 focused baseline checks passed. Full local suite: 509 total, 508 passed, zero failed, one existing skip. Focused new action tests cover actual migrated SQL save/retry/readback, stale version refusal, stale-account refusal and labeled Auth claim adapter behavior. Typecheck passed. Lint passed with nine existing warnings. Standard preview build passed. Latest CSS/navigation adjustments are checked by the preview deployment before acceptance.

Browser against actual staging: guest A intentionally created Development Project c346f83c-0605-4873-a3f0-38ae7e887591, saved Goal revision 2, refreshed and reopened identical content. Guest B in an independent host cookie session was denied that Project and saw zero Projects of its own. Read-only staging SQL confirmed original and revised document versions. These were real staging identities/data, not a browser-local simulation. Permanent account recovery is not claimed from these guest checks.

## Boundaries and next work
No live model, coding runner, usage reservation, publication, public Profile or new integration is implied by this increment. Existing capabilities remain accessible through their original guarded routes. Agent configuration is persistent infrastructure, not a fabricated running model. No production deployment or merge.

Continue the approved implementation plan using dedicated staging identities. Complete integration/cost/execution/publication/collaboration/resilience gates before the founder's full personal acceptance and separate launch decision. Never represent a preview, unit tests or READY metadata as a completed release.
