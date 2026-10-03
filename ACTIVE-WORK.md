# ACTIVE-WORK

One writer per architectural surface. Update this file when work starts, changes owner or finishes.

| Owner | Task | Branch | Owned paths | Protected paths (do not edit without the owner) | Done when |
|---|---|---|---|---|---|
| Claude (primary continuity) | Smallest complete SOV: kernel v4, Arcadia sandbox, World shell, Horizon, lenses, car-company slice, self-operation proof | `claude/keen-cerf-tpd7io` | `supabase/migrations/` (new files only), `lib/`, `app/`, `tests/`, `scripts/`, root docs | applied migrations (never edited), `DIRECTIVES.md` (founder only), `docs/MONETARY-CONSTITUTION.md` Parts I–III | DOMAIN-CONTRACTS §60 loop runs end to end in the deployed app; tests, browser kernel tests, typecheck, lint, build green |

Shared contracts: `DOMAIN-CONTRACTS.md`, `lib/kernel/client.ts` (typed `kernel_api`), `lib/kernel/local.ts` (embedded kernel), `lib/sandbox/pglite.ts` (browser database boundary).

Open for a second worker (Codex), isolated, review-only until assigned: security/RLS review of `supabase/migrations/20261003110000_actions_and_world.sql`, concurrency tests against real Postgres, idempotency fuzzing of `kernel_api`.
