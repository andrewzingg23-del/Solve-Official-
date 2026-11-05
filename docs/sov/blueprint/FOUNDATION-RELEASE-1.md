# SOV — FOUNDATION RELEASE 1
## Canonical Product, Engineering, Design & Launch Contract

**Status:** Approved planning baseline for the foundational launch  
**Date:** November 4, 2026  
**Audience:** Codex, Claude Code, design agents, QA agents, and future contributors

**Objective:** Deliver one fully operational, multi-user foundational SOV product while preserving its long-term extensibility, integration-first philosophy, and approved visual identity.

---

# 1. The Mission

Build the first real version of SOV as a personally governed, AI-native operating environment.

SOV must allow people to maintain a persistent digital identity, access compatible intelligence, connect external capabilities, create durable work, collaborate under explicit permissions, and share selected results.

The experience has four destinations:

**Space — Where I exist and express myself.**

**Projects — What I create and accomplish.**

**Communities — Who I connect and build with.**

**Control — What I own, authorize, and operate.**

**My Agent** persists across all four.

The central principle is:

**Never compete. Integrate.**

The initial product must be useful independently of social adoption, cryptocurrency, autonomous agent teams, or complex infrastructure.

Do not confuse a working foundational product with the complete long-term platform.

---

# 2. Governing References and Precedence

Use the following references together:

1. SOV Long-Term Vision — strategic direction.
2. SOV Visual Design Guide — approved presentation and interaction direction.
3. SOV Foundation Release 1 — current release scope and acceptance criteria.
4. AGENTS.md — rules governing coding-agent behavior.
5. Current Implementation State — verified repository and deployment evidence.
6. Architecture Decision Records — approved technical decisions and reasons.

When guidance conflicts:

- Security, privacy, financial authority, and explicit human authorization are non-negotiable.
- Current source and execution evidence determine what is already implemented.
- This launch contract determines what the first release must deliver.
- The long-term vision guides architectural compatibility, not immediate feature breadth.
- The approved screenshots determine visual fidelity unless a deliberate design change is authorized.

Do not silently resolve material conflicts through assumptions. Document the choice and its rationale.

---

# 3. The Foundational Launch Scope

## 3.1 SOV ID

Must provide:

- Actual authenticated identity.
- Optional guest exploration.
- Recoverable account claiming.
- Persistent personal ownership.
- Session management.
- Separate internal and public identity references.
- Server-enforced resource isolation.
- Safe logout and account recovery.

Guest-created work must not be represented as safely recoverable across devices until the identity has been claimed.

Public publishing and shared collaboration require an appropriately recoverable identity.

Do not expose a universal internal SOV ID in every public representation.

**Pass:** Two users can sign in on separate devices, preserve their work, and cannot access each other's private resources.

## 3.2 Space

Must provide:

- The approved architectural Home experience.
- Genuine personal identity state.
- Persistent Agent entry point.
- Functional personalization using approved options.
- Actual saved Projects and activity.
- Useful empty states.
- Explicit public publication.
- A working visitor view.
- A real shareable public URL.

Do not automatically create placeholder Worlds or Projects.

The first personalization implementation can be deliberately narrow: selected themes, environment settings, and Agent appearance options.

**Pass:** A user can personalize their Home, create real work, publish a selected result, and verify the public view without leaking private information.

## 3.3 Projects

Must provide:

- Intentional Project creation.
- Persistent Project identity.
- Durable ownership and context.
- One functional adaptive Workbench.
- Editable artifacts.
- Save and reopen.
- Version history or recoverable revisions.
- Preview.
- Export.
- Agent access to approved Project context.
- Actual task state.

The first Workbench should be a configurable interactive-page builder, not a universal software creation engine.

Suggested initial artifact elements include text, images, sections, links, gallery content, and approved interactive components.

AI may assist in generating or revising the artifact, but the user must also be able to edit and preserve it without additional AI calls.

Use the existing World/Room primitives where appropriate.

**Pass:** A user creates a page, modifies it, closes the session, reopens it, continues editing, previews it, and exports or publishes it.

## 3.4 Communities

Must provide:

- Real Community creation.
- Invitation and acceptance.
- Membership records.
- Minimal owner/member roles.
- Explicit shared Project access.
- Membership revocation or removal.
- Server-enforced boundaries.
- Accurate member and sharing states.

Do not build a complete social feed, marketplace, fundraising system, or elaborate governance framework for the first release.

**Pass:** User A creates a Community, invites User B, and grants access to a specific Project. User B can use only the granted resources. Removal prevents new protected operations.

## 3.5 Control

Must provide actual status for:

- Identity and security.
- AI provider configuration.
- Connected external services.
- Available capabilities.
- Agent configuration.
- Task execution.
- Approval requests.
- Resource grants.
- Inference usage.
- Funding and budget limits.
- Execution history and evidence.

Do not show invented financial balances, available models, completed tasks, or connected services.

If actual provider usage data is unavailable, explain the limitation instead of guessing.

**Pass:** A real connection, task execution, permission change, or AI request is accurately reflected in the relevant Control view.

## 3.6 My Agent

Must provide:

- A persistent Agent identity.
- A consistent presence across all four destinations.
- At least one functioning model-provider adapter.
- Approved personal and Project context.
- Actual inference requests.
- Durable results where appropriate.
- A working capability invocation path.
- Explicit authorization.
- Task budget enforcement.
- Honest execution and failure states.

The initial Agent must not depend on continuously running inference.

Model-independent Agent state must be stored outside provider conversation sessions.

A second provider is desirable, but architectural compatibility must be tested even if only one production inference provider is initially enabled.

**Pass:** The user asks the Agent to create or modify something useful; the Agent performs actual work within approved permissions, saves the result, and reports actual usage and state.

---

# 4. One Real External Integration

The foundational launch must prove that SOV can use outside technology through a standard capability contract.

Prefer an existing GitHub integration for the first developer-oriented test, provided the current code and permissions support it.

Minimum behavior:

- User initiates a real connection.
- Provider authentication completes.
- Supported operations are discovered.
- Connection state is stored.
- Control shows actual capabilities.
- A Project receives a specific authorized grant.
- The Agent executes at least one real external operation.
- The result is recorded with evidence.
- Revoking access prevents subsequent protected actions.

A repository read can provide the first verified operation.

If a write capability is included, use a narrowly scoped, explicitly approved operation such as creating an issue before allowing higher-impact code or deployment actions.

The capability architecture must not be hardcoded so deeply to GitHub that another provider requires recreating the Agent or task system.

**Pass:** Connecting, using, revoking, and recovering from a failed integration all produce truthful system states.

---

# 5. Shared Canonical Architecture

Every release feature uses existing or reconciled implementations of:

- Actors and identity.
- Contexts and resources.
- Grants and authority.
- Capabilities and connections.
- Tasks, leases, and execution.
- Evidence and verification.
- Events and projections.
- Artifacts and revisions.
- Publications and memberships.
- Usage, budgets, and funding records.

Inspect the actual kernel and reuse existing mechanisms.

Never create a second task engine, second permissions model, or second financial ledger without an explicitly approved migration.

The preferred initial architecture is a modular application with durable independent workers.

## Required change flow

**Authenticated command → authoritative authorization → atomic state transition → durable event → relevant projection update → authorized UI refresh.**

AI can interpret or recommend an operation.

AI output does not bypass this change flow.

Read models may be eventually consistent.

Protected authorization and spending decisions must use current authoritative state.

---

# 6. Cross-Application Synchronization

A foundational feature must work across the relevant SOV destinations.

Example: external provider connected.

Expected results:

- Connection state recorded.
- Available capabilities discovered.
- Control reflects the actual connection.
- Agent routing recognizes eligible capabilities.
- Authorized Projects can request use.
- Provider revocation disables new protected operations.
- Reconnection restores legitimate availability.
- Other devices eventually display correct state.

Example: Project artifact published.

Expected results:

- New publication record created.
- Public representation generated.
- Owner's Space reflects the published result.
- Visitor URL works.
- Private Project state remains protected.
- Unpublishing revokes public access as defined by publication policy.

For each significant feature, document its event producers, consumers, security boundaries, and read models.

Do not use repeated LLM conversations as the synchronization mechanism.

---

# 7. AI Resource Economics

The first launch must be financially bounded.

Support at least:

**Managed allowance:** A small, server-enforced SOV-funded inference quota if the platform offers one.

**User-funded provider:** A legitimate supported API billing connection where permitted, with secure credential handling.

Additional managed billing can be introduced when an appropriate payment provider and reconciliation process have been implemented.

Every governed inference request requires:

- Actor attribution.
- Context attribution.
- Model and provider identification.
- Funding arrangement.
- Request budget.
- Provider usage measurement where available.
- Execution result.
- Stored usage record.

Use atomic reservations or equivalent concurrency-safe limits to prevent parallel tasks from overspending one shared allowance.

Track estimates separately from provider-confirmed charges.

Community-funded intelligence and creator monetization should fit the resource model, but do not need complete user-facing payment experiences in this release.

Conventional payments and crypto remain future supported integration categories, not prerequisites for initial identity or creation.

**Pass:** Two users can use SOV under separate funding rules. Concurrent operations obey limits, and one user cannot consume another's resources without authorization.

---

# 8. Security Boundaries

Launch must enforce:

- Private user isolation.
- Project-scoped grants.
- Community-scoped membership.
- Private/public publication separation.
- Secure OAuth credentials.
- No secrets in model prompts.
- No unrestricted external tool execution.
- Revocation checks before protected actions.
- Rate limits and abuse controls.
- Prompt-injection-resistant tool boundaries.
- Protected financial authorizations.
- Validated and sanitized artifact rendering.
- Safe identity recovery.

The first public release must not claim to be child-safe without appropriate age, guardian, moderation, and communication protections.

If guardian functionality is not ready, restrict supported launch use accordingly while preserving future-compatible identity architecture.

Untrusted generated pages must not receive access to SOV authentication tokens or privileged origin capabilities.

---

# 9. Production Operations

A feature working locally does not make SOV operational.

The launch requires:

- A reproducible build.
- Verified database migrations.
- Separate development, staging, and production configurations.
- Managed secret handling.
- Documented runtime environment.
- Automated tests.
- Deployment verification.
- Error monitoring.
- Traceable task execution.
- Usage and infrastructure cost monitoring.
- Database backup and restoration procedures.
- Retry and recovery procedures for worker failures.
- Rollback strategy.
- Basic support and incident-handling procedures.

Before launch, establish realistic service objectives and ownership for incident response.

Do not represent historical previews or local tests as proof of production behavior.

---

# 10. Required End-to-End Acceptance Tests

## Test A — Personal Creator Journey

1. New user enters SOV.
2. User establishes recoverable identity.
3. User customizes Space.
4. User intentionally creates a Project.
5. Agent generates or revises an artifact through a real provider.
6. User edits the result directly.
7. Artifact is saved.
8. User closes the session.
9. User reopens the same Project.
10. Artifact and revisions remain available.
11. User previews and explicitly publishes it.
12. A visitor opens the public URL.
13. Visitor cannot access private Project data.
14. Control records appropriate AI usage.

**Required:** Fully functional on desktop and mobile.

## Test B — External Capability Journey

1. User opens Control.
2. User connects a supported external provider.
3. SOV discovers real permitted capabilities.
4. User authorizes a Project-specific operation.
5. Agent invokes the capability through a durable task.
6. Worker records the result.
7. Relevant Project and Control views update.
8. User revokes the connection.
9. Future protected operations are denied.
10. Existing verified records remain accessible.

**Required:** Tested with provider errors, retries, and interruption.

## Test C — Collaboration Journey

1. User A creates a Community.
2. User A invites User B.
3. User B accepts using their own identity.
4. User A grants access to a specific Project.
5. Both users can see authorized shared state.
6. Unrelated private data remains inaccessible.
7. User A removes access.
8. User B can no longer perform protected operations.

**Required:** Server-side authorization tests, not just UI tests.

## Test D — Funded Execution

1. Two billable tasks request a limited budget.
2. The system atomically checks and reserves available resources.
3. Unauthorized overspending is prevented.
4. Worker failures are reconciled.
5. Final usage is attributable to the correct funding source.
6. No duplicate charge or invented settlement is recorded.

**Required:** Concurrency and failure-path tests.

## Test E — Resilience

Verify behavior when:

- The browser closes during a task.
- A worker crashes.
- A model provider times out.
- A connector loses authorization.
- The same event is delivered twice.
- A device misses realtime notifications.
- A user changes permissions during execution.
- A database projection is temporarily behind.
- An external operation has an uncertain outcome.

The system must preserve durable state and accurately explain uncertainty.

---

# 11. Explicit Exclusions from Foundation Release 1

Do not block foundational launch on:

- Native SOLVE token transactions.
- Universal agent marketplace.
- Creator monetization marketplace.
- Global social recommendation feeds.
- Autonomous multi-agent organizations.
- Mandatory immersive Worlds or 3D.
- Full universal app generation.
- User-operated GPU compute marketplace.
- Independent SOV hosting or federation.
- Complex community governance.
- Full banking and crypto account aggregation.
- Dozens of unrelated Workbenches.
- Automatically building every conceivable use case.

These are compatible future directions, not implied launch features.

If any are already implemented and working, preserve them without allowing them to destabilize the release.

---

# 12. Engineering Execution Order

## Gate 0 — Audit and reconcile

Inspect actual implementation and deployed state.

Identify canonical owners, working code, simulations, gaps, and integration risks.

Baseline the approved visual appearance.

No architecture rewrite based on assumptions.

## Gate 1 — Secure identity and durable Projects

Complete recoverable identity, Project creation, artifact persistence, and cross-user isolation.

## Gate 2 — Operational Agent and cost controls

Connect one working model provider, persistent Agent state, bounded inference, and real usage metering.

## Gate 3 — Task and event reliability

Complete the required durable worker path, recovery logic, event propagation, and relevant projections.

## Gate 4 — Creation and publication

Complete one Workbench and the private-to-public creator journey.

## Gate 5 — External integration

Deliver one usable connector with discovery, scoped authority, execution, evidence, and revocation.

## Gate 6 — Collaboration

Deliver real Communities, invitations, membership, and shared Project permissions.

## Gate 7 — Production hardening

Complete security, resilience, responsive verification, monitoring, backup/restore testing, deployment gates, and operating documentation.

Gate numbering represents dependency order, not permission to postpone all testing until the last gate.

Every increment must remain testable and deployable.

---

# 13. Definition of Done

A foundational release is complete only when:

- Every advertised feature genuinely works.
- All four destinations contain their defined minimum functionality.
- The personal Agent performs at least one meaningful real task.
- A user can create, preserve, and publish a real artifact.
- A second user can collaborate under correct permissions.
- At least one external capability works through the integration architecture.
- State updates reach relevant screens consistently.
- AI usage is measurable and bounded.
- Private resources stay private.
- Failure and recovery paths have been tested.
- The product operates on desktop and mobile.
- Production deployment is verified.
- Monitoring, rollback, backup, and operating procedures exist.
- No critical known security or data-integrity defects remain.
- Deferred capabilities are honestly labeled or absent.

Do not declare release complete based on passing unit tests alone.

Do not declare release complete based on an attractive UI alone.

Do not declare release complete based on model-generated assurances.

All critical journeys require direct evidence from actual software execution.

---

# 14. Codex Operating Instructions

Start by reconciling the current repository against this document and the two founding references.

Create a requirements-to-code traceability matrix.

For every launch requirement, record:

- Current implementation status.
- Relevant files and database contracts.
- Required dependencies.
- Actual tests and evidence.
- Owner module.
- Missing work.
- Priority.
- Release blocker status.

Then build the smallest coherent increment required to advance the acceptance tests.

Use the established feature change contract for substantive work.

Preserve existing working functionality.

Do not repeatedly rewrite documentation instead of completing functional work.

Do not silently expand launch scope.

Do not introduce a new architectural layer if an existing verified mechanism can meet the requirement.

Do not redesign approved visual screens.

Maintain one current-state record and a precise handoff after each development session.

## Completion report

Every meaningful implementation session must report:

1. What became operational.
2. Files and contracts changed.
3. Tests actually executed.
4. UI behavior verified.
5. Security and cost implications.
6. Deployment status, if checked.
7. Remaining launch blockers.
8. Next smallest implementation step.

---

# 15. Final Foundational Launch Principle

**Build a complete small operating system, not an incomplete large one.**

The first release must prove that one person can establish identity, use intelligence, create durable work, integrate an external capability, govern permissions, collaborate with another person, and preserve the result.

The underlying foundation must support future capabilities without requiring replacement of identity, authority, task execution, evidence, or ownership.

The visual experience should already communicate the long-term SOV identity.

The infrastructure should be ready to grow.

The functions that are presented to users must actually work.

**One environment. One authoritative foundation. Four destinations. One persistent Agent. Real capabilities. Verified outcomes.**

**END — FOUNDATION RELEASE 1 CONTRACT**