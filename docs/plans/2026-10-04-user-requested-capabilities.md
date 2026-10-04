# User-Requested Capability Growth

Date: 2026-10-04
Branch: `claude/keen-cerf-tpd7io`
Status: proposed product workstream; not implemented as a user-facing feature

## Purpose

When a person asks Sovereign to do something it cannot yet do, Sovereign should help extend the World around that need. It should first use existing capabilities, then let the person shape and test a new World-local capability, and make proven capabilities reusable as Sector Packs.

This implements the Vision Canon's “stable master code + evolving Sector Code” and Forge direction. It follows the founder directive to learn from real friction and propose the smallest reusable improvement.

## Current state

- The vision already describes user-created Sector Packs and Forge discovering recurring gaps and proposing tested mechanics.
- The current creative World supports durable text artifacts and history. Connected bots can start Worlds and add or revise text pieces with scoped, expiring grants.
- The Arcadia self-improvement proof creates and reviews a narrow read-only diagnostic. It validates part of the governance pattern; it is not a general capability builder.
- Users cannot yet ask for a new capability and have Sovereign build, test, install, or share it.

## Product behavior

For each request:

1. **Understand the goal.** The assistant answers directly when it can. If it needs a capability, it names the gap and asks only for information needed to shape a useful result.
2. **Compose before creating.** Try available, permissioned capabilities and propose a route using existing tools.
3. **Prototype in the current World.** If the tools are insufficient, create a clearly marked capability proposal in that World. The first version is declarative and built from approved primitives: forms, schemas, rules, prompts, reports, and calls to already registered capabilities.
4. **Show a preview and evidence.** Explain what it will do, what data it touches, what permissions it needs, what it costs, how success will be checked, and what it cannot do. Run it against fixtures or a sandbox; show the output and limitations.
5. **Let the person choose.** The owner can revise, test again, activate within that World, or discard the proposal. Activation is scoped, versioned, logged, and revocable.
6. **Learn across uses with consent.** Record whether it solved the stated need and any correction or failure. Aggregate demand only when allowed by the applicable privacy settings; do not expose a person's private World to other users.
7. **Promote only when reusable.** If the owner wants to share it, or repeated demand justifies a reusable Pack, prepare a versioned Sector Pack with tests, declared permissions, provenance, owner/maintainer, and rollback path. Distribution follows the existing review and trust gates.

## Build sequence

This work starts after a real user can sign in, collaborate in one World, and connect an assistant that can contribute there. Begin with a narrow pilot and real requests; do not make autonomous code generation the first user-facing version.

### 1. Make capability gaps explicit

- Add a capability registry that lists available tools, their input/output contracts, authority requirements, risk class, and whether they are reversible.
- Let the assistant distinguish “I can answer this,” “I can compose this from available tools,” and “this needs a new capability.”
- Persist a proposal with the user's goal, missing ability, relevant World, assumptions, required inputs, and acceptance criteria.
- Keep the proposal a draft until its owner chooses to test or activate it.

### 2. Compose a World-local prototype

- Build version one from typed, registered primitives rather than arbitrary generated code.
- Give the proposal its own version history and owner-scoped read/write grants.
- Permit safe read-only work and draft creation in the sandbox.
- Treat external connectors, secrets, purchases, messages, publishing, access changes, physical devices, and other consequential actions as unavailable until a person grants the specific scope and approves the action.
- Preserve human-versus-agent attribution and append-only history for every run and revision.

### 3. Test before activation

- Run proposals against fixtures or an isolated sandbox with no production credentials.
- Test declared inputs, expected outputs, denied scopes, retries, and failure behavior.
- Show test evidence, known limits, permissions, cost estimate where available, and a reversible preview.
- Require an owner approval to activate. If a required external action is not reversible, require the existing explicit approval for that action too.
- Support pause, revoke, rollback to an earlier version, export, and deletion of proposal content where policy allows.

### 4. Make proven proposals reusable

- Add a “share as a Pack” path controlled by the creator.
- Validate a Pack manifest: purpose, interfaces, data touched, scopes, providers, cost, retention, maintainer, dependencies, tests, version, and rollback.
- Run static checks and isolated integration tests; show all requested permissions before install.
- Keep Packs least-privilege and World-scoped by default. Installing one Pack must not grant it access to unrelated Worlds.
- Preserve a private fork when an installed Pack is customized; updates require review and must not silently widen permissions.

### 5. Improve from evidence

- Measure request-to-useful-result, completion, corrections, failures, revocations, repeated use, and owner-rated usefulness.
- Use real outcomes and observed friction to choose the next primitive or Pack improvement.
- Keep simulation results labeled as simulation; never treat generated evidence as real-world proof.
- Do not optimize for capability count or installs without demonstrated user value.

## Non-negotiable boundaries

- The identity, authority, permissions, event, ledger, provenance, history, and evidence kernel remains stable and is not rewritten by user requests or an agent.
- The agent may propose and test within a bounded sandbox; it cannot grant itself authority, secrets, provider access, publication rights, or spending power.
- Every installed capability declares what it can read and change. Every execution records actor, owner, World, version, inputs, approvals, outputs, and evidence.
- A proposal cannot claim real-world completion from a plan, simulation, or unverified provider response.
- Money movement, public communication, permission changes, publishing, signing, physical machine control, and irreversible actions use the existing approval and verification path.
- No cross-World data sharing by default. No sharing a user's proposal or data without the owner's explicit choice.
- Prefer a tested reusable primitive or declarative workflow before generated executable code. Any later code-generating Forge path needs isolated execution, review, provenance, and rollback.

## First pilot acceptance

The first pilot is complete when:

- A signed-in person asks for a task that the current tool registry cannot fulfill.
- The assistant identifies the exact gap, then creates a private, editable proposal in that person's World.
- The proposal is assembled from approved primitives and clearly lists its data and permission needs.
- The person can test it on sample data, inspect the result and evidence, revise it, and discard it.
- With owner approval, the proposal can be activated in that World under a narrow grant; a disallowed action is refused and recorded.
- The owner can revoke it or roll back to a prior version.
- A second person cannot see or use the proposal unless the owner explicitly shares it.
- The workflow passes focused tests for authorization, isolation, provenance, idempotent retries, failure handling, and revocation.
- No production credentials or real-world side effects are available during sandbox testing.

## Relationship to existing plans

This is a follow-on to `docs/plans/2026-10-04-open-creative-world.md` and complements `docs/plans/2026-10-04-bot-world-bridge.md`. It is not part of the current already-built World/bot slice, and it does not replace the current staging sign-in and real-user collaboration gates.
