# ADR-0002 — The same SOLVE action primitive for everyone

**Status:** Implementation proposal (2026-11-07), as an additive vertical slice. **Not a production release or a migration.**

## First principles

**SOLVE means solve.** The product does not begin with a model selection, API key, developer console, crypto ledger, or chat transcript. It begins when **a person wants something to happen**.

A person must be able to:
1. Describe an **intended outcome** in their language.
2. Preserve it in their own **World** with people, context, assets, history and conversation.
3. Decide who (human, AI, provider) may attempt each unit of **Work**.
4. Observe actual execution and failures, approve consequential actions, and inspect **evidence**.
5. Return later, revoke access, undo reversible actions, and **reuse** what worked.

The same primitives apply to:
- A family organizing a school event.
- A contractor coordinating a job.
- Someone building a business.
- Claude, ChatGPT, and Muse collaborating to develop SOLVE itself.

The difference is the *work and authorized capabilities*, not a separate data model or another interface for developers.

## Canonical core

```text
Human intention
    → World (scope + persistent context)
    → Task (outcome + required capability + idempotency + review policy)
    → Authorized actor (human or verified agent, leased permission)
    → Attempt (bounded execution, failures, provider receipts)
    → Kernel event / evidence / independent verification
    → Human-readable result → reusable workflow/pattern
```

**SOLVE kernel owns** actors, scopes, grants, task statuses, events, evidence and final authoritative state. It already exposes `kernel_api.create_task`, `read_tasks`, `authorize`, `issue_lease` and `transition_task`. No migration or duplicate task database is needed to prove intake. These functions enforce authorization server-side, independent of interface controls.

**UI owns** a simple way to request, inspect and control the same work. The approved SOLVE graphite/silver design language and personal Space customization remain consistent, but presentation never expands authority or fabricates completion.

**Workers own** an attempt to perform approved work. OpenClaw, Claude Code, Muse, ChatGPT or other runtimes are replaceable adapters; they don't own user identity, Worlds, finances, memory grants or task truth.

**Dev workflow is a consumer of SOLVE**, not a separate meta-system. GitHub issues and Actions provide interim developer coordination and checks while in-app delegation is incomplete. Later they should be projections/adapters **from a kernel task**, returning commit/PR/build evidence to the same task. A GitHub issue, model transcript or `@claude` message is not a kernel lease.

## First vertical slice — /world/[worldId]/work

The new Work page reuses the existing World, kernel and appearance tokens.

- Person enters an outcome and optional success criteria.
- Optional **independent review required** before completed state.
- Server reloads World from kernel, checks `task.create` in that scope, and creates a conservatively classified, not-yet-assessed medium-risk task with reversibility **not assumed**, requiring `task.perform`. It grants nobody `task.perform`.
- A stable user request ID makes retries idempotent.
- Readback uses `read_tasks`, displaying actual statuses and assigned-worker presence only when recorded.
- The interface distinguishes `no tasks` from `unable to read tasks`, and errors do not pretend a successful write.
- New tasks are **not** automatically assigned, sent to a provider, published, or executed. Free-text intent has `riskAssessment=unclassified` and `aiDispatch=off` until the owner separately authorizes an assessed capability. A user's saved intention is not a completed outcome.
- Signed-out and unauthorized people cannot create tasks through the server action. Server-side `kernel_api` remains the security gate.

This is the same intake needed for consumer projects and the SOLVE build team. It is a first slice, not a complete autonomous agent team.

## Visual + technical contract

| Intent / interface state | Actual mechanics |
| --- | --- |
| "What needs to happen?" title | `task.title` validated 3–160 chars |
| "What would success look like?" | `task.objective` validated up to 2000 chars |
| "Requires another reviewer" | `verification=distinct_actor` (else `none`) |
| "Save this work" | authenticated scoped `task.create` in `kernel_api` |
| "Proposed" / "Ready" / "In progress" / "Blocked" | `read_tasks` real task transition status |
| "No worker assigned" | `worker_id = null` — no simulated agent presence |
| "Unavailable" or "No permission" | explicit failure / denied states, no silent empty list |
| "Recorded complete" | kernel task completed, not a claim of separate independent verification unless policy required it |

**Accessibility / visual:** consistent SOLVE shell; narrow-phone single-column layout, desktop split composition, labelled inputs, 44px targets, keyboard focus, no fabricated metrics, meaningful empty/denied/loading states.

## Progressive architecture — not premature microservices

1. **Intake/readback (this PR):** simple common World task UI and kernel authority, tests.
2. **Human delegation:** user explicitly grants a scoped capability to a real actor for a specific task, with duration/revoke. Test unauthorized and revoked attempts.
3. **Agent execution:** SOLVE's `solve-agents` service reads a kernel-leased task, executes one bounded capability, returns evidence and failure states; optional OpenClaw as isolated adapter.
4. **Independent verification:** kernel checks provenance and approval policy, then transitions task; UI shows precise verified vs pending or disputed states.
5. **Capability reuse:** a validated workflow can be copied into another World with newly approved scope and actors, never carrying grants or secrets over.

There must not be two task stores, two permission systems, or automatic external side effects from UI text.

## Contract with the new repositories

- [solve-kernel](https://github.com/andrewzingg23-del/solve-kernel): owns eventual typed/versioned kernel interfaces and independent contract tests. The current live DB remains authoritative until staged extraction is explicitly approved.
- [solve-agents](https://github.com/andrewzingg23-del/solve-agents): a work packet is a **view over a kernel task** and current verified source code, not another source of authority. Its recent CI-backed prompt validator is an engineering adapter.
- [solve-design](https://github.com/andrewzingg23-del/solve-design): versions tokens, accessible UI components and visual/error/permission states, not customer data or model output truth.
- [Solve-Official-](https://github.com/andrewzingg23-del/Solve-Official-): composes the consumer journeys and initially hosts the authoritative kernel implementation.

The code extraction follows contracts, independently passing tests, and safe deployment gates. Four repositories do **not** imply four databases or four mandatory deployments.

## Acceptance and honest status

Automated input tests and static integration guards accompany this first slice. They **do not** prove a user can create/read a task against the staging DB until the genuine World-scoped, signed-in acceptance is executed.

Future end-to-end gate: account owner creates World → saves a task → reloads with matching ID/status → other member without `task.create` cannot create → owner authorizes worker for **only** that task → worker executes and records evidence → independent reviewer verifies when required → owner revokes and future attempts are denied.

Do not call this complete until the real kernel, worker and device/browser paths are verified.

**Decision thesis:** *One person, one trusted World, one governable way of turning intention into action — infinitely many replaceable workers and interfaces.*
