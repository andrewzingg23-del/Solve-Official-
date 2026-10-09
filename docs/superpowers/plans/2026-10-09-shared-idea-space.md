# Shared idea space Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a persistent, authorized shared project room for the founder and a collaborator.

**Architecture:** Extend the existing World and kernel. Dedicated API functions enforce invitation and conversation rules; typed domain functions assemble shared AI context and preserve partial outcomes. Existing World documents remain the source and artifact home.

**Tech Stack:** Next.js 16, React 19, TypeScript, Postgres, existing PGlite test harness, OpenRouter.

**Spec:** `docs/superpowers/specs/2026-10-09-shared-idea-space.md`

## Global Constraints

- No new dependencies or applied-migration edits.
- No remote migrations, deployment, financial operations, or founder canon edits.
- Authenticated canonical actors and existing World-scoped grants govern shared state.
- Model input contains authorized shared work only; outputs are drafts.

## Review Focus

- Direct RPC callers cannot manufacture a human decision or an invitation acceptance with forged attribution.
- Retries, expired leases, provider failure, and permission changes leave an intelligible persisted conversation.
- Invitation cancellation/expiry and delegation policy are enforced inside the authoritative database boundary.
- Long histories and unrelated activity do not hide messages or current presence.
- Stale edits retain typed user input and expose the newer saved revision.

### Task 1: Persistent room records and shared context

**Files:** New migration `supabase/migrations/20261009010000_shared_idea_space.sql`; additive `lib/kernel/client.ts`; new `lib/world/room.ts`; tests `tests/e2e/shared-room.test.ts`.

**Interfaces:** Produces `kernel.postRoomMessage`, `kernel.readRoomMessages`, `kernel.claimRoomReply`, `kernel.finishRoomReply`, `kernel.failRoomReply`; `readRoomConversation(kernel, worldId, beforeSeq?)`; `loadRoomContext(kernel, worldId)`; `submitRoomTurn(kernel, input, complete?)`.

- [ ] Write real-kernel failing tests for two-user persistence, viewer and outsider denial, pagination, agent attribution and human-only decisions, retry safety, private-context exclusion, inference failure, and revocation while inference runs.
- [ ] Run `node --import tsx --test --test-force-exit tests/e2e/shared-room.test.ts`; expect missing RPC/module failures before implementation.
- [ ] Implement typed records, permission checks, bounded shared context and leased inference with partial outcome reporting.
- [ ] Run the focused test file; expect every test to pass.
- [ ] Commit the tested coherent slice with a stream checkpoint.

### Task 2: Invitations, presence, and document conflicts

**Files:** New migration `supabase/migrations/20261009020000_world_invites_and_revisions.sql`; additive `lib/kernel/client.ts`; `lib/world/collaboration.ts`, `lib/world/creative.ts`, `lib/world/presence.ts`; new `lib/world/invitations.ts`; tests `tests/e2e/world-invitations.test.ts`, `tests/e2e/shared-revisions.test.ts`; existing presence tests.

**Interfaces:** Produces `createWorldInvitation(kernel, worldId, role, requestId)` returning `{token, invitationId, expiresAt}`; `acceptWorldInvitation(kernel, token)` returning World ID; `cancelWorldInvitation(kernel, invitationId)`; `kernel.updateDocument` with `expectedVersion`; `readPresence` retaining its existing public signature.

- [ ] Write failing tests for single-use, expired/cancelled links, owner-only creation, membership/revocation, spoofed invitation events, stale updates/idempotent retries and presence beyond 200 unrelated events.
- [ ] Run the three focused test files and existing collaboration tests; verify expected failures.
- [ ] Implement invitation projection with authenticated acceptance and grant parentage, atomic version checks, and indexed heartbeat retrieval.
- [ ] Run the focused tests; expect all to pass.
- [ ] Commit the tested coherent slice with a stream checkpoint.

### Task 3: Usable shared room and bounded cost worksheet

**Files:** `app/world/[worldId]/room/{page,view}.tsx`, new conversation component; new `app/api/worlds/[worldId]/conversation/route.ts`; invitation actions/panel and `app/world-invite/[token]/page.tsx`; existing World artifact editor; new `lib/world/cost-model.ts` and worksheet component; relevant tests and browser harness.

**Interfaces:** Room conversation API accepts `{requestId, text, intent: message|ask_ai|decision}`; GET accepts `beforeSeq`. UI uses persisted records and cursor, publishes selected knowledge through existing documents, and records decisions explicitly. Worksheet computes per-unit and batch totals from user-entered values; it can save its assumptions/output as a shared document.

- [ ] Write failing input/cost tests for malformed requests, finite bounded amounts, currency/units and rounding; add a browser scenario covering persistence, history, source disclosure, invitations and visible stale-edit retention.
- [ ] Run the focused tests; verify expected failures.
- [ ] Implement routes and accessible responsive UI using existing patterns. Preserve personal chat. Bind new accounts to canonical actors before invitation acceptance using authenticated registration.
- [ ] Run focused tests and browser checks, then full suite, typecheck, lint and build; record actual live-service limitations.
- [ ] Update build status/stream and commit.

### Task 4: Final review and delivery

- [ ] Prepare the branch diff, spec, plan, test evidence and ledger for one fresh whole-branch reviewer.
- [ ] Fix important findings with failing regression tests and rerun affected checks/full suite as warranted.
- [ ] Record final evidence and integration status. Keep the branch reviewable and report the exact prerequisite for live use.
