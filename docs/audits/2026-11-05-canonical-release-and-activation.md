# ONE SOLVE — Canonical release and activation audit (2026-11-05)

**Scope:** Read-only audit of connected GitHub, Vercel and Supabase infrastructure. No production changes, migrations, key extraction, or project archiving. Statuses below distinguish **observed**, **recorded in source**, and **not yet verified**.

## Founder decisions (DO NOT OVERRIDE)

- `DECISIONS.md` (2026-10-31): ONE SOLVE source-of-truth branch is **`main`**, superseding the old trunk note in `AGENTS.md`. Production `solve-sage.vercel.app` deploys from `main`.
- `DECISIONS.md` (2026-10-31): **SOV ID is sovereign-passport**, a deliberately separate application/repository and **Neon Postgres** service. ONE SOLVE integrates with Passport via OAuth 2.1 + MCP. **Do not merge Passport into a Supabase database**.
- Legacy repositories are harvested then archived only on explicit founder approval; no deletion/archival here.
- One product and policy engine, with differing room policy profiles; no duplicate core product.

## Canonical service topology

| System | Canonical reference | Verified / interpretation |
|---|---|---|
| Main source | `andrewzingg23-del/Solve-Official-`, `main` | Founder-approved ONE SOLVE trunk |
| Primary Vercel project | `solve` — `prj_ixFlofTzirRDmWaMEzHVfNevfyyI` | `solve-sage.vercel.app`, `solve-sovigrn.vercel.app`, and `solve-git-main-sovigrn.vercel.app` point to this Vercel project |
| Production build observed | `dpl_9WotHEC9eiNQ9bBXZiTwQRA3mS5A` | READY, branch `main`, SHA `5529d1c7382eac1d598f7797fe1f2456cb55b5b8`; endpoint/user-journey tests separate |
| Production Supabase | `dupgybzkkbddsbaykrae` (`Solve-Official-`) | ACTIVE_HEALTHY; runtime use configured by Vercel env; verify OAuth settings through authenticated journey |
| Staging Supabase | `taeikshnbcsjlgbattyp` (`solve-staging`) | ACTIVE_HEALTHY; code `lib/supabase/config.ts` selects this for preview |
| SOV ID / Passport | separate `sovereign-passport` GitHub and Vercel project `prj_B3usUhccCUBy6lKSlYu522FTq5fN`; `sovereign-passport.vercel.app` | Founder-approved independent identity service, Neon-backed per `DECISIONS.md`; independent deployment, latest preview READY, live interoperability unverified |
| Legacy game | `sovereign-game` Vercel project `prj_tXHpBeAtH3w4erdrieXKPqiqcIaU`; `sovereign-game-six.vercel.app` | Separate READY legacy/experimental deployment; preserve until harvest decision |
| Inactive Supabase projects | `eipzbaurzfksehzctlfu` and `ivaivdhlwjimbynzeahh` | Both INACTIVE; do not delete on audit alone |
| External AI | `https://solve-sage.vercel.app/mcp` | Implementation includes OAuth discovery, consent, and MCP tools; Claude end-to-end `whoami`/`get_context` **not yet verified** |

### Important preview differences

New READY preview deployments observed from branches:
- `codex/sov-shared-visual-language`, SHA `c73598c0fc3327035f06806120d9eb926aaaa847` (visual language).
- `codex/pressure-provenance`, SHA `546ee93981f4b51ddac6d7e53b6be4a880f5d0c5`.
- `codex/sov-step-one`, SHA `7d34454f46535acca3d64ea20ab7c29e40db073a`.
- `feature/optional-onboarding-integrations-20261104`, SHA `ad15a746bcc7f15360936fe87c5aaac85644c55a`.

A READY preview does not equal merged, production-ready, or real-authenticated verification. Preview and production use distinct Supabase projects. **Do not promote a preview by URL or merge branches as a shortcut**; review changes, environment bindings, migrations and required tests first.

## Feature inventory and verification boundaries

Source/docs contain kernel API, append-only events, hash verification, grants, SOV actor/agent records, Worlds, shared rooms and revisions, AI/bot MCP connector, project/community surfaces, studio/3D views, and experimental money/chain tools. `BUILD_STATUS.md` reports substantial local and CI tests. Verify each *actual deployed interaction* separately: UI presence or code coverage alone does not demonstrate working third-party identity, external AI, financial settlement, or live multi-user collaboration.

### Read-only RLS investigation (2026-11-05)

Both active Supabase projects have `kernel.room_replies` and `kernel.world_invitations` with `relrowsecurity=false`. **Direct SELECT and INSERT privileges are FALSE for database roles `anon` and `authenticated` on both tables in both projects.** Thus the automated RLS advisor's statement of public exposure is not demonstrated by these checked grants. This does **not** establish complete safety: inspect other privilege types, schema exposure, RPCs/security-definer functions and any service-key paths. Track in issue #55. No RLS mutation until policies and positive/negative path tests are prepared.

## Release 1: ordered gates, not feature expansion

**Gate 0 — Identity/topology and security (read-only):** Verify the current production site, Passport's identity trust path, main vs preview routes, and the two unprotected-kernel-table access paths. Confirm which identities/databases receive Claude OAuth redirect and consent. Never copy Supabase keys across environments.

**Gate 1 — Recover the founder's useful product:** In staging, verify one existing Building SOLVE World can load, persist one authorized note, reload and display history. Reproduce known P0 AI reply failure (issue #47) and fix at the smallest testable boundary; track #46 for activation. No fake provider responses counted as end-to-end.

**Gate 2 — Connect an outside assistant read-only:** MCP resource and authorization-server metadata; Supabase dynamic registration; consent under correct production/staging identity; Claude `whoami` and `get_context` tool calls with recorded evidence. Issue #54. User consent occurs in Claude/SOLVE; do not bypass it.

**Gate 3 — Reconcile approved interface:** Compare design preview with production, review PR and CI, merge approved changes into `main`, run real phone/browser product acceptance, then separately verify released production environment. Preserve designed Passport separation and canonical links.

**Gate 4 — Shared multi-actor proof:** Two independent people and separately authorized AIs see the same World and task, act under scoped grants, show attribution/history after reload and revocation. Reassess financial features only after identity, authority and settlement-specific safety tests.

## Explicit non-actions

- Do not delete/archive repos, Vercel projects, Supabase/Neon databases or branches.
- Do not merge Supabase production with staging or Passport's Neon store.
- Do not enable broad table access, disable authorization, publish API keys or silently elevate agent permissions.
- Do not merge design previews without provenance/CI/acceptance evidence.
- Do not claim OAuth, external model, multi-user, or crypto live success from a READY deployment.

## Pointers

- `DECISIONS.md` — founder's newest authoritative product decisions.
- `AGENTS.md` and `ACTIVE-WORK.md` — builder coordination; **old trunk reference in AGENTS.md conflicts with later decision**. Propose targeted correction in separate reviewed change.
- `docs/plans/2026-10-31-one-solve.md` — Passport relationship.
- Issues [#46](https://github.com/andrewzingg23-del/Solve-Official-/issues/46), [#47](https://github.com/andrewzingg23-del/Solve-Official-/issues/47), [#54](https://github.com/andrewzingg23-del/Solve-Official-/issues/54), [#55](https://github.com/andrewzingg23-del/Solve-Official-/issues/55).

**Next small engineering slice:** fix or verify the production/staging login and OAuth identity handoff, and unblock the real Building SOLVE room AI reply, with regression tests and a reviewable PR.