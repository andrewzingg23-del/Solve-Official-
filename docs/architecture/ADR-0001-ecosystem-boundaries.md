# ADR-0001 — SOLVE as a modular core in a multi-service ecosystem

**Status:** Proposed architecture for founder review (2026-11-07). This ADR documents and coordinates the new repo boundaries; it is **not** a production service migration or a replacement of approved canon.

## Context

SOLVE needs one trust foundation and many parallel human/AI contributors. The current running codebase at [Solve-Official-](https://github.com/andrewzingg23-del/Solve-Official-) includes the consumer app, `kernel_api`, agent connector, and design tokens. A single deployable codebase helped prove end-to-end features, but increases edit collisions, slow release coordination, and coupling among security-critical identity, provider workers, and interface evolution.

Splitting **everything** into network microservices now would be worse: identity, grants, task transitions, append-only events and ledger writes require transactional ordering, high confidence under retries, and consistent revocation. A fleet of small services with shared mutable tables would be a distributed monolith.

## Proposed decision

**The product is an ecosystem. The kernel is a cohesive modular transactional trust core.** Deploy externally varying execution and integrations as independent services only when security, scale, ownership or release cadence justify the operational overhead. Distribute computation; do **not** distribute authority.

### Repositories created

| Code boundary | Private repo | Runtime boundary | Authoritative responsibility |
| --- | --- | --- | --- |
| Consumer application | [Solve-Official-](https://github.com/andrewzingg23-del/Solve-Official-) | Next.js/Vercel app | First-use, SOV ID, personalized Space, Worlds/Rooms, user interaction and displays |
| Kernel | [solve-kernel](https://github.com/andrewzingg23-del/solve-kernel) | Cohesive API + transactional Postgres (future extraction) | Actors, grants, task states/leases, event history, evidence, ledger invariants |
| Agent execution | [solve-agents](https://github.com/andrewzingg23-del/solve-agents) | Independently deployable worker service(s), optional OpenClaw | Replaceable AI providers, queues, bounded tool execution, retries and provider receipts |
| Shared design | [solve-design](https://github.com/andrewzingg23-del/solve-design) | Semantic-versioned package **not a service** | Brand, tokens, accessible components, required visual/technical user states |

Optional future services after first proven customer flows: connection adapters, notifications, search/indexing, billing/payments, collaboration realtime fanout. These do not own identity or canonical task/event truth. They are not implemented by this ADR.

### Boundary diagram

```text
          SOLVE user (phone, browser, future devices)
                             |
                 solve-app / Solve-Official-
              SOV ID · Space · Worlds · Rooms
                  |               |
             typed commands    UI package
                  |               |
             solve-kernel    solve-design
               [AUTHORITY]       [PRESENTATION]
                  |
        transaction + outbox events
                  |
           independently deployed queue
                  |
              solve-agents
         [OPENAI | CLAUDE | MUSE | OPENCLAW]
                  |
       proposed / completed attempt + evidence
                  |
         kernel adjudicates authoritative result
```

OpenClaw is one optional runtime adapter, never the authority, memory root or public gateway. Provider/model names in messages are not proof a real agent is connected.

## Contract: every cross-repo interaction

- **Identity:** verified kernel actor, session/client identity, human consent, explicit World/scope/capability. Never trust a model-reported identity.
- **Action request:** versioned schema, `world_id`, `actor_id`, `task_id`, `request_id` / idempotency key, lease expiry, intended result, risk, reversibility and approval requirement. If absent, do not execute.
- **Transaction + event:** authoritative write commits in the kernel. A transactional outbox or equivalent durable mechanism publishes `event_id`, schema version and trace context to consumers **after** commit.
- **Delivery:** at-least-once transport and **idempotent** consumers. Handle duplication, partial completion, replay, reordering, provider timeout, cancellation and revoked access. Exactly-once network delivery is not assumed.
- **Result:** a provider acknowledgement is not completed work. The worker returns evidence/provenance and the kernel independently validates transition. UI shows queued, executing, provider-acknowledged, failed, denied and verified honestly.
- **Privacy:** read only least-privileged scoped context; distinct households and Worlds cannot leak memories. The message `@claude` is not a private DM, permission or delivery receipt. Audit logs exclude secrets.

## Parallel ownership and shipping model

- **Claude / kernel lane:** schema, authorization boundary, typed interfaces, migration parity, security tests.
- **Claude / agents lane:** worker adapters, protocol, bounded leases, provider integrations. Does not independently create kernel grants.
- **Muse / design lane:** tokens, brand, visual/technical experience components and first-contact acceptance; no fake working controls.
- **ChatGPT / cross-cutting lane:** contract review, integration tests, dependency graph, independent release verification.
- **Founder:** mission, consumer outcomes, high-impact approvals and production release gates.

All lanes can work simultaneously on disjoint repos. Cross-repo changes must follow **consumer-driven contract tests**; prefer compatible extensions, tagged releases and explicit integration PRs. Never silently make the app depend on a moving `main` from another repository.

## Extraction plan: progressive, reversible

1. **Now:** Create and seed repositories and ownership rules (completed); keep the current app and single production kernel authoritative.
2. **Contract-first:** inventory current `lib/kernel`, migration history and `kernel_api`, then export typed client contracts into solve-kernel without moving the actual database.
3. **Agents first, independent runtime:** move one stateless, bounded agent connector behind a signed request / verified kernel grant. Test the same room read/reply, timeout, revocation, repeat and owner attribution before traffic switch.
4. **Design package:** publish versioned tokens and one existing component with screenshot parity; app pins it by version.
5. **Kernel extraction last and deliberately:** move implementation/test ownership with staging data parity, migration hashes and rollback; switch reads first; write path only under approved release. Never run two authoritative kernels.
6. **Release gates:** GitHub tests, signed contracts, deploy proof, negative access tests, real device, independent QA; separately approved production schema and irreversible external work.

## Non-goals

- No immediate Kubernetes/service mesh, per-feature database, streaming infrastructure, payment service or OpenClaw install.
- No automatic autonomous Claude/ChatGPT/Muse dispatch merely because multiple repos exist.
- No provider-specific model code inside the kernel; no duplicate identity, memory or user-facing design system.
- No premature production migration or renaming the authoritative app.

## Measurable reason to extract a service

Extract only when one of these is independently true: provider-specific sandbox/security boundary; materially different scaling or failure profile; repeated cross-team edit/deploy collisions; separate compliance/data retention needs; or significant deployment cadence and cost benefit. If none applies, keep the capability as a module and enforce the interface locally.

## Current implementation/evidence status

Repos were created private on 2026-11-07 and seeded with `ARCHITECTURE.md` and `AGENTS.md`. They contain **plans/contracts, not extracted running services**. Existing app consumer/security PRs remain separate, including [PR #73](https://github.com/andrewzingg23-del/Solve-Official-/pull/73) for advisory AI teammate addressing in the actual kernel-backed World Room. Do not claim verified multi-provider execution or a completed distributed migration until actual tests and deployment prove it.

**Guiding principle:** one consistent identity and truth, many replaceable minds and ways to act.
