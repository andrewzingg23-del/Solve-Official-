# Building SOLVE — Shared Mission
**Mission ID:** `SOLVE-MVP-001`  
**Last reconciled:** 2026-11-03  
**Status:** planning checkpoint committed for review; **not** a live Mission implementation  
**Canonical repository:** `andrewzingg23-del/Solve-Official-`  
**Integration branch:** `main`  
**Baseline observed:** `5529d1c7382eac1d598f7797fe1f2456cb55b5b8`  
**Work branch:** `strategy/building-solve-mission-20261103`

> **Operating objective:** A new user enters SOLVE, states an intention, and receives a *real, AI-assisted, editable, persistent World* that can produce a working result outside SOLVE. Their work remains usable when AI is unavailable. The same Mission, evidence, and context contract must coordinate SOLVE's own development across people and AI systems.

## Sources of authority, not a competing canon
- Founder vision and later clarifications: [VISION-CANON.md](../../VISION-CANON.md) (especially the 2026-11-03 amendments).
- Durable engineering constraints: [BUILD-CHARTER.md](../../BUILD-CHARTER.md), [SECURITY-INVARIANTS.md](../../SECURITY-INVARIANTS.md), [DIRECTIVES.md](../../DIRECTIVES.md).
- Founder decisions and branch precedence: [DECISIONS.md](../../DECISIONS.md), specifically 2026-10-31 ("One Solve is built on main"; "SOV ID is sovereign-passport").
- Brand: [docs/brand/BRAND.md](../brand/BRAND.md) — "Everything here is real."
- **Claude's foundation audit (unmerged)**: [foundation decision, commit 51f7b55](https://github.com/andrewzingg23-del/Solve-Official-/commit/51f7b55e63570c3c95c7432c0ac2ef19dd27c1a8); its verification claims require targeted independent checks.
- This file is an **execution checkpoint**, not permission to silently rewrite founder canon or change production.

## Reconciled decisions
1. **Foundation: selective rebuild (Option B).** Preserve existing kernel, tests, migrations and other components that survive verification; rebuild unsuitable app information architecture. No fresh repo or kernel rewrite by default. No production cutover authorization.
2. **Single trunk: `main`.** Development is via narrowly scoped branches and reviewed PRs. Do not reset 33 commits, adopt a feature branch as trunk, or blindly merge divergent work.
3. **AI-native first use; optional customer AI accounts.** SOLVE provides a budgeted default AI experience during onboarding. Users need **no personal provider key**. When inference is unavailable, existing Worlds, edits, saved state and collaboration still work. Hosted AI availability, budget and provider are implementation work, **not yet a verified release capability**.
4. **One composable engine.** SOV ID (with separate `sovereign-passport` system), Personal Space, Worlds, native typed objects/actions, intelligence, Mission collaboration, external pages/forms and sanitized reuse. No separate vertical products for recruiting, communities, events or development.
5. **Source-backed cross-AI continuity.** Claude, ChatGPT, Muse and others participate only through supported integrations or explicit handoffs. The Mission record is authoritative for approved work state; provider conversation histories are not. Claims, verified facts and unknown live session state must stay distinct.
6. **Policy before agency.** SOLVE evaluates identity, scope, policy, approvals and evidence outside the model. AI proposes structured changes; the application validates and commits authorized changes. Never grant direct privileged database access to the model.

## Evidence snapshot (2026-11-03; distinguish inspected data from reported tests)
| Item | Status | Evidence / qualification |
| --- | --- | --- |
| `main` baseline | **Connector-verified** | SHA above, from GitHub compare main...main. |
| Option B audit | **Committed, not integrated** | Claude's [51f7b55](https://github.com/andrewzingg23-del/Solve-Official-/commit/51f7b55e63570c3c95c7432c0ac2ef19dd27c1a8) on `claude/foundation-decision`. Audit reports 13 migrations, 79 `SECURITY DEFINER` functions, 448 green tests and live consent. Those are **author-reported results**, not independently rerun in this checkpoint. |
| Branch divergence | **Connector-verified** | `claude/foundation-decision` was 9 commits ahead and 33 behind `main` when compared. Reconcile work file-by-file. |
| AI connection requirement | **Open design conflict** | [PR #42](https://github.com/andrewzingg23-del/Solve-Official-/pull/42) requires a user's own connected AI for work; this violates the founder's optional-connection decision. Do not merge as written. |
| Quality gates | **Draft, not implemented** | [PR #43](https://github.com/andrewzingg23-del/Solve-Official-/pull/43) documents release requirements; do not report them as passed. |
| Staging World read | **Blocked, author-reported** | Claude reports `Invalid API key` for MCP World reads using the Preview `SUPABASE_SECRET_KEY` associated with project `taeikshnbcsjlgbattyp`. Verify actual binding, auth paths and grants. Do not reveal or embed secrets. |
| Passport | **Designated identity boundary, integration unverified** | `DECISIONS.md` identifies independent `sovereign-passport`. Verify access/location before changing it. |
| Shared Mission files | **New documentation only** | No live World/Mission persistence or AI-session integration is proven by this PR. |

## Universal product contract (MVP)
- **AI-powered start:** natural-language intention → governed structured proposal → native functional World → direct editing → AI-guided modification → persistence → meaningful real output. No fake pages, forms or results.
- **Native floor:** pages, customizable records, forms with submissions, tasks, relationships, views, permissions, event history; safe to open/edit without AI.
- **Identity and external utility:** private personal home; configurable public SOV presentation and opportunity intake; shared link usable by a nonmember; actual submission routed to authorized private work.
- **Mission / coordination:** objective, tasks, owners, bounded authority, status, decisions, artifacts, evidence, source-backed handoffs and next actions.
- **Reuse:** sanitized versioned World/Blueprint export that does not copy private records, credentials, grants or private conversations.
- **First user journeys:** founder's Building SOLVE; separate commercial-project collaborator; unrelated person creating an event/community; insurance recruiting and Members Only as domain-transfer tests. No hardcoded verticals.
- **Operational costs:** observe provider/model, tokens when reported, cache usage when reported, cost (provider-reported vs estimated), budgets, time and verified outcome. Never promise control of third-party subscription quotas.
- **Experience:** first useful result quickly; real progress and contributions over artificial engagement loops. Calm, premium, clear on mobile.

## Work queue — bounded, dependency-aware
| ID | Owner | State | Next deliverable | Acceptance evidence |
| --- | --- | --- | --- | --- |
| F0 | Unassigned engineering agent | **ready** | On `main`, inspect current native World create/edit/save/reopen path and AI route; isolate the *smallest missing link* for AI-native onboarding, with no code duplication. | File/function map, concrete failing/passing tests, one runnable reproduction. |
| F1 | Unassigned engineering agent | **depends on F0** | Implement one complete intention → AI structured World proposal → validated native objects → preview/change → persist/reopen slice; usable without a personal provider key. | Actual browser run on phone/desktop, persistence and authority tests, usage/cost cap; failure states explicit. |
| F2 | Unassigned engineering agent | **depends on F1** | Publish working public page and form, accept nonmember submission, create private record/task. | Real cross-account/nonmember E2E, privacy checks and external URL. |
| C0 | Integration reviewer | **parallel** | Validate stale Preview key mismatch without exposing it; distinguish MCP bot credential path from native user World read. | Safe test of authorized and unauthorized World access; no policy bypass. |
| R0 | Repo maintainer | **parallel** | Reconcile divergent branches/open PRs into reviewable, main-based slices; correct stale trunk guidance only in appropriate reviewed docs. | Compare summary, no force-push/reset, tests for changed behavior. |
| H0 | Mission operator | **ready** | Use this MD+JSON checkpoint for copyable Claude/Muse/ChatGPT task handoffs. After a verified implementation, persist corresponding tasks in a real Building SOLVE World. | Second contributor can resume exact next task with source links, report a real commit/test, and maintain status without transcript replay. |

**Recommended first implementation:** F0 → F1. Do not build a standalone agent dashboard ahead of useful World creation. C0/R0 can proceed separately.

## Agent protocol
1. **Read only what the assigned task needs:** this checkpoint, structured JSON, linked canonical decisions and relevant code. Do not repeatedly ingest the entire project.
2. **Claim one work item with an owner and branch.** Treat assigned roles as proposals until accepted; no two agents modify the same architectural surface concurrently.
3. **Before action:** verify actual branch SHA, available tools, permissions and usage/cost budget. Use a fresh `main`-based review branch; don't overwrite another agent's work.
4. **Record results:** `claimed | in_progress | blocked | proposed | implemented_unverified | verified | rejected`, exact commit and relevant test/source links, actual costs only if observable. An agent's "done" is never proof.
5. **Handoff:** export mission ID, task ID, intent, accepted decisions, relevant source links, file scope, authority constraints, last verified state, next action and criteria. Never paste tokens, secrets, unrelated personal information or whole chat transcripts.
6. **Boundaries:** no merges, destructive migrations, production releases, financial actions, or sensitive external communications without explicit authorization.
7. **Source precedence:** founder's most recent explicit instructions > canonical accepted decisions (when not superseded) > verified current implementation > this checkpoint > unverified agent notes. Escalate unresolved contradictions.

## First acceptance test for continuity
Give a second AI **only** the Mission ID, this checkpoint and a bounded task ID. It should identify the canonical source, reproduce the relevant behavior, make or propose a narrow change, return commit/test evidence, and leave a concise next-step handoff. If it cannot do that without a raw chat transcript, tighten the contract before adding automation.

## Stop conditions
Do **not** mark the MVP complete until a fresh user can obtain a real AI-assisted working World, edit and reopen it, publish a functional public output, and obtain an external interaction; independent checks confirm permissions. This document is not implementation evidence.
