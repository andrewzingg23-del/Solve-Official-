# Collaboration Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Replace the trading-derived public app with a coherent collaboration product for people and their AIs.

**Architecture:** Keep canonical Worlds, actors, bot personas, events and grants. Replace entry/navigation and core pages; use one route policy to exclude experiments, preserve local idea drafts through sign-in and explicitly save a reviewed identity into the verified account.

**Tech Stack:** Next 16, React 19, TypeScript, Tailwind, Supabase, kernel_api, existing Playwright and PGlite.

**Spec:** `docs/superpowers/specs/2026-10-08-collaboration-rebuild-design.md`

## Global Constraints

- No new product dependencies, no database reset, no edits to applied migrations or founder-only canon.
- Existing World/project and invitation URLs keep their identity and permission checks.
- All stored/shared writes use verified identity; local drafts are clearly local.
- No invented activity, financial actions, automatic history-sync claims or experimental tools in default navigation.
- Use the existing dark blue-black, ice text and cyan accent with 44px minimum controls and reduced-motion support.

## Review Focus

- A direct legacy URL or POST must not bypass the launch route policy.
- An expired sign-in or different account must not inherit a local identity without review.
- A provider or database failure must preserve a person's draft and display a recoverable state.
- A narrow phone or keyboard-only visit must reach all core navigation and work controls.
- Existing member data and invitation links must remain usable after the experience changes.

### Task 1: Launch surface policy

**Files:** `lib/product/routes.ts`, `proxy.ts`, `tests/product/routes.test.ts`, optional tool links in `app/world/[worldId]/page.tsx`, `app/route-actions.ts`.

**Interfaces:** Produce `launchRoute(pathname: string, env?: NodeJS.ProcessEnv): { kind: "allow" } | { kind: "redirect"; href: string } | { kind: "deny" }`. Preserve existing financial flags; experiment enablement is opt-in.

- [x] Write and run failing tests for blocked nested financial/experiment routes, POST API denial, allowed OAuth/core routes and boundary-safe prefix matching.
- [x] Implement policy and enforce it before legacy handlers run; keep legitimate session cookie refresh behavior.
- [x] Run `node --import tsx --test tests/product/routes.test.ts`, expect all pass; commit with stream update.

### Task 2: Entry, navigation and projects

**Files:** `app/layout.tsx`, `app/nav.tsx`, `app/product/*`, `app/page.tsx`, `app/worlds/page.tsx`, `app/worlds/new/page.tsx`, `lib/product/draft.ts`, `tests/product/draft.test.ts`.

**Interfaces:** Produce a shared app shell, project cards and `ProjectComposer({ signedIn, worldId })`; consume existing `createWorldAction` and `listCreativeWorlds`.

- [x] Write failing draft checks for malformed storage, length limits, sign-in preservation and clearing only after successful creation.
- [x] Implement landing/dashboard, sidebar/mobile navigation, real project listing and recoverable draft composer.
- [x] Exercise actual browser anonymous navigation, reload preservation, sign-in intent and mobile overflow; commit with stream update.

### Task 3: Identity and AI continuity

**Files:** `lib/product/identity.ts`, `app/account/*`, `app/bot/page.tsx`, `app/bot/connections.tsx`, `tests/product/identity.test.ts`, additive profile migration/client method if required.

**Interfaces:** Explicitly save current-user profile and bot persona using existing scoped services; derive account identity server-side. Local draft preview is opt-in and never imported automatically.

- [x] Test validation, unauthorized writes, other-account isolation, repeat saves and preserving existing bot state.
- [x] Implement focused profile editing/local draft review and AI sections using existing persona/import/connection components.
- [x] Run affected product/kernel/bot tests and browser profile continuity checks; commit with stream update.

### Task 4: Shared workspace and communities

**Files:** `app/world/[worldId]/room/view.tsx`, `app/world/[worldId]/room/conversation.tsx`, `app/world/[worldId]/page.tsx`, `app/communities/page.tsx`, `app/community/[communityId]/view.tsx`, `scripts/test-shared-room.mts`.

**Interfaces:** Consume existing `RoomData`, shared conversation, source publication, invites and access panels. Add focused accessible room sections without changing server authorization or document versions.

- [x] Make shared conversation the main workspace; present documents and people/access clearly, with optional tools behind progressive disclosure.
- [x] Remove pack/practice/promotional detours from community and project surfaces.
- [x] Run real-SQL two-person browser checks with labelled external-service fixtures; commit with stream update.

### Task 5: Verification and integration

**Files:** `scripts/test-product.mjs`, `BUILD_STATUS.md`, `BUILD-STREAM.md`, `ACTIVE-WORK.md`, `docs/handoff/COLLABORATION-REBUILD.md`.

- [x] Run desktop/mobile core workflow checks, full `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` and production HTTP policy checks. Save logs and screenshots.
- [x] Obtain one independent whole-branch review; reproduce and fix material findings, then rerun affected checks and required final suite.
- [ ] Integrate into main using existing ship authorization when checks pass; verify the remote hash and report any live activation/CI visibility limitations accurately.
