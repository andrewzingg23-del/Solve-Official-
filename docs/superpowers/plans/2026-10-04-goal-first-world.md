# Goal-first World Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in person start a private World from a real goal and see that goal saved as the World’s first piece.

**Architecture:** Reuse the existing kernel-backed creative World and artifact path. Extend World creation with an optional goal, validate it with the existing text limits, and write the goal as an idempotent text artifact in the same private scope. Keep blank World creation available.

**Tech Stack:** Next.js 16.3.8 server actions, React 19, TypeScript, existing kernel client and creative World domain.

**Spec:** `docs/superpowers/specs/2026-10-04-need-to-route-network-state-design.md`

## Global Constraints

- Worlds open private; only explicit grants add people or agents.
- A goal remains owner-controlled World content, not a public profile or advertising attribute.
- Human and agent authorship remains attributable in kernel events.
- The first slice captures and preserves a goal; it must not imply research, recommendations, or an AI-generated route that it does not perform.
- Keep the existing title limit at 160 characters and artifact text limit at 7,000 characters.
- Preserve blank-world creation and stable idempotency on retries.

## Review Focus

- Empty or whitespace-only goal still creates a blank World.
- Oversized or control-character goal is rejected before creating a World.
- Repeated goal creation with the same World id creates one artifact and no duplicate events.
- A different actor cannot claim the goal World or read its goal without a grant.
- A kernel failure during artifact creation can be retried without duplicating or exposing the goal.

---

### Task 1: Pin goal-first creation behavior

**Files:**
- Test: `tests/e2e/creative-world.test.ts`

**Interfaces:**
- Consumes: `createCreativeWorld(kernel, { worldId, title, goal? })`
- Produces: a regression proving a non-empty goal becomes one private `Goal` artifact at the starter canvas position and a retry adds no event.

- [ ] Add a focused test that creates a World with a goal, loads it, and checks the first artifact title, body, position, and event count.
- [ ] Run: `node --import tsx --test --test-force-exit tests/e2e/creative-world.test.ts`
- [ ] Expected before implementation: the new assertion fails because creation returns no goal artifact.

### Task 2: Persist the goal through the existing kernel path

**Files:**
- Modify: `lib/world/creative.ts`
- Test: `tests/e2e/creative-world.test.ts`

**Interfaces:**
- Consumes: Task 1’s optional `goal` input.
- Produces: the unchanged `CreativeWorld` result and an optional first artifact written via `createCreativeArtifact`.

- [ ] Extend `CreateCreativeWorldInput` with optional `goal?: string`.
- [ ] Validate the trimmed goal with the existing body validation before claiming the World.
- [ ] Set the World summary from the goal when present; keep the current blank summary otherwise.
- [ ] Create one `Goal` text artifact at `{ x: 50, y: 25 }` with a stable World-derived request id; retries must be idempotent.
- [ ] Re-run the focused creative-World test and confirm it passes.

### Task 3: Make the route visible in the product

**Files:**
- Modify: `app/worlds/actions.ts`
- Modify: `app/worlds/page.tsx`

**Interfaces:**
- Consumes: the submitted World title and optional `goal` textarea.
- Produces: a private goal-first World, redirected to its canvas; blank creation remains supported.

- [ ] Validate title and goal lengths at the server-action boundary.
- [ ] Pass the goal to `createCreativeWorld`; preserve the existing auth check and redirect behavior.
- [ ] Add a mobile-friendly goal textarea, explain that the goal becomes the first piece, and replace “Create blank World” with a clear create action.
- [ ] Give invalid goal input a specific, recoverable error message.
- [ ] Verify no access grant or publication is added by the new form.

### Task 4: Verify and record the slice

**Files:**
- Modify: `BUILD_STATUS.md`
- Modify: `BUILD-STREAM.md`

- [ ] Run the focused creative-World test, full `npm test`, typecheck, lint, and build through the repo’s CI gate.
- [ ] Record actual outcomes only; do not claim the build is green while CI is running.
- [ ] Append the finished slice and next highest-value gap to the build stream.

---