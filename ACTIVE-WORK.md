# ACTIVE-WORK

One writer per architectural surface. Update this file when work starts, changes owner or finishes.

| Owner | Task | Branch | Owned paths | Protected paths (do not edit without the owner) | Done when |
|---|---|---|---|---|---|
| Claude (primary continuity) | Make the governed World useful for real human and AI-agent work: finish the delivery-woken inquiry loop; unblock the live kernel v4 and sign-in path through founder-approved operations; then run a narrow real-use pilot and grow from observed outcomes. | `claude/keen-cerf-tpd7io` | `supabase/migrations/` (new files only), `lib/`, `app/`, `tests/`, `scripts/`, root docs | applied migrations (never edited), `DIRECTIVES.md` (founder only), `docs/MONETARY-CONSTITUTION.md` Parts I–III | A signed-in person and explicitly delegated agent can pursue one useful goal through the live World loop, exchange a real provider response, and see the evidenced outcome persist; the pilot captures a concrete friction signal to guide the next small improvement. No simulated result is presented as live use. |

Shared contracts: `DOMAIN-CONTRACTS.md`, `lib/kernel/client.ts` (typed `kernel_api`), `lib/kernel/local.ts` (embedded kernel), `lib/sandbox/pglite.ts` (browser database boundary).

Open for a second worker (Codex), isolated, review-only until assigned: security/RLS review of `supabase/migrations/20261003110000_actions_and_world.sql`, concurrency tests against real Postgres, idempotency fuzzing of `kernel_api`.
