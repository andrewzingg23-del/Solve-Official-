# Production database state — read-only forensics (2026-10-31)

Investigated with the founder's `SUPABASE_ACCESS_TOKEN` (via the Supabase MCP), **read-only only — no writes, no migrations applied.** Supersedes the plan's assumption ("first 3 of 14 applied, history empty").

## What's actually true

**Production `Solve-Official-` (dupgybzkkbddsbaykrae): ACTIVE_HEALTHY, Postgres 17.**
- Migration history table records **only** the first 3: `memory_kernel`, `monetary_proof_of_life`, `payment_router`.
- **Zero rows** across all 21 `kernel` tables and 2 `kernel_keys` tables. No application data to protect.
- But the schema is a **partial, non-contiguous, hand-assembled state** that does not match any clean prefix of the migrations:

| Migration | Functions present? | Tables present? |
|---|---|---|
| #1–#3 (in history) | yes | yes (21 kernel tables) |
| #4 `actions_and_world` | **partial** — `party_of` yes | **no** — `agent_roles`, `actions` missing |
| #5 `erasable_content` (kernel v5) | yes — `seal_key`/`unseal_keys`/`destroy_key` | **yes** — `kernel_keys.event_keys`, `destroyed_keys` |
| #7 `world_live_collaboration` | yes — `broadcast_world_event` | — |
| #9 `shared_idea_space` | — | **no** — `room_replies` missing |
| #10 `world_invites_and_revisions` | — | **no** — `world_invitations` missing |
| #12 `private_room_sources` | **no** — `update_document_version` missing | — |
| #13 `room_boundary_guards` | **no** — `create_world_invitation` missing | — |
| #14 `person_profile` | **no** | **no** — `person_profile` missing |

Pattern: **functions** (defined `create or replace`, idempotent) from several later migrations leaked in; **tables** (defined plain `create table`, not idempotent) from #4/#9/#10/#14 never got created. Likely a hand-run concatenation of selected function bodies, not the ordered migrations.

**`solve-staging` (taeikshnbcsjlgbattyp): INACTIVE (paused).** Cannot be inspected or migrated until resumed.

## Why a plain `supabase db push` is unsafe here
Pushing migrations #4–#14 would **fail**: migration #5 runs `create table kernel_keys.event_keys` (plain, not `if not exists`), but that table already exists → error. Earlier/later plain `create table`s and `create function` (non-replace) collisions would do the same. The push would abort partway, leaving an even messier state. **This is exactly why the plan says never push without verifying first.**

## Options (founder decides — nothing done without your word)

**Recommended — clean rebuild (safe because zero rows).**
Drop the `kernel` and `kernel_keys` schemas (and reset the migration history), then apply all 14 migrations **in order** → a consistent schema that exactly matches the repo and the history. No data is lost (there is none). **This requires your explicit OK to override the standing "never db reset" rule** — which exists to protect data; here there is none.
1. **Resume `solve-staging`** and do the clean rebuild there first; verify with `npm run test:postgres`.
2. On your "go," repeat on production.

**Alternative — surgical reconcile (not recommended).** Drop only the stray objects (the `kernel_keys` schema + the leaked later functions) to get back to a true "first-3" state, then `db push` the 11. More fragile, more steps, easy to miss one, and it leaves the question of how the stray objects got there.

## Blockers for the founder
1. **Approve the clean rebuild** (overriding "never db reset" — safe at zero rows), or choose the surgical path.
2. **Resume `solve-staging`** (paused) so the rebuild is rehearsed there before production.
3. The Vercel keys (`OPENROUTER_API_KEY`, `SUPABASE_SECRET_KEY`) and the Auth redirect URL remain needed for the live app regardless of which DB path.

Runbook for the mechanics once a path is chosen: `docs/plans/2026-10-31-step2-db-runbook.md` (will be revised for the clean-rebuild path if chosen).
