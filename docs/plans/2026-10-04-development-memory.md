# Development Memory — Idea Graph and evidence lineage

Date: 2026-10-04  
Status: implementation plan; no application or database changes in this slice  
Base reviewed: `claude/keen-cerf-tpd7io` at `c5b26b81f0fe41bcf4ae2bfe0b33dadcb4d95536`

## Goal

Let people and authorized agents keep developing ideas across sessions, expand prior ideas with traceable lineage, and connect decisions to the code and real outcomes they produce. Keep the existing app playable throughout: invention happens in a private World or isolated experiment branch, and production changes only through the existing review and deployment gates.

This is the next compounding layer of the vision, not a replacement for the current World or master-bot work.

## Order of work

1. **Finish the active shared-World slice first.** Codex's current owner lane in `ACTIVE-WORK.md` remains staging Auth, scoped collaborator access, realtime updates, and a two-person/two-agent shared-work proof. Do not interrupt or duplicate that work. Claude retains its master-bot lane.
2. **Start Idea Graph v1 after that acceptance gate passes.** Use one private World as a development workspace. A person can capture an idea, link it to prior ideas and principles, and record assumptions and unresolved questions. The graph must be useful without AI.
3. **Add governed AI expansion.** An authorized agent can read accessible ideas and history; draft a derived idea, contradiction, hypothesis, or experiment proposal; and explain the source links. Suggestions require a person to accept before they become canonical graph records or change canon.
4. **Connect experiments to implementation.** A proposal can point to a branch/commit, changed paths, checks, and an evidence record. An experiment can be rejected, blocked, or retained with its reason preserved. Nothing gets deleted to make the history look cleaner.
5. **Add the isolated build loop.** Once a concrete proposal is approved, create an isolated branch/preview and run the app there. Compare the experiment against stated acceptance criteria. Promote through review, checks, staging, and the existing release gate; never let the ideation loop deploy to production.
6. **Learn from actual use.** Record whether the intended user outcome happened, with evidence source and limits. Synthetic/Arcadia results remain labeled simulated and cannot be presented as real adoption or effectiveness.

## V1 graph records

Use versioned, typed records with stable IDs and explicit links:

- **Canon / Principle** — founder-authored product invariants. Readable by agents; writable only through the founder's existing directive/canon process.
- **Idea** — intent, description, origin, author, created time, current status, and links to its source.
- **Hypothesis** — a falsifiable expected outcome, target user/action, observation window, and success/failure criteria.
- **Experiment** — approved question, isolated environment/branch, implementation reference, checks, observations, and conclusion.
- **Implementation reference** — repository, branch, commit, paths, migration references, and related PR/deployment where available.
- **Evidence** — who or what observed the result, when, method, source, confidence/limitations, and whether it is real or simulated.

Typed relations should include `derived_from`, `supports`, `contradicts`, `supersedes`, `requires`, `implemented_by`, `tested_by`, `evidenced_by`, and `blocked_by`. Validate endpoint types and scope. A relation is a first-class, provenance-bearing record, not freeform text hidden in an idea description.

Suggested lifecycle: `captured → explored → proposed → approved_for_experiment → building → observed → retained | rejected | blocked`. Keep prior status changes as history. A failed or abandoned idea remains searchable, with the reason and conditions that could justify retesting.

## Architecture constraints

- Treat the memory kernel as the sole durable write boundary. Before implementation, inspect its existing typed commands and read projections. Reuse them if they can represent these records without weakening invariants; otherwise add new typed, authorized kernel API operations and a new migration only when required. Never write directly to `kernel` tables or edit an applied migration.
- Preserve verified actor identity, scoped grants, append-only history, provenance, and idempotent retries for every graph write. Agents may write only in the person's or organization's explicitly granted development World.
- Keep canon above the graph. Agents can cite and question canon, but cannot silently amend it. Surface contradictions with their supporting links for founder review.
- Keep creation open-ended. Route suggestions and Ideas are optional tools, never prerequisites for creating or editing a World.
- Keep costs and irreversible effects at zero by default. No SOV issuance/transfers, payment, public publishing, access changes, external messages, or production mutation from an idea or experiment without the relevant separate grant and approval.
- Do not collect broad user telemetry just to feed AI. Use only authorized, purpose-limited signals and record their source and limitations.

## UX slice

Inside a private development World, add a compact **Ideas** view beside existing World/Path/People/History views. It should support:

- Capture an idea and connect it to one or more existing ideas or principles.
- View the idea's lineage and status history.
- Record assumptions, open questions, and a measurable hypothesis.
- Ask an authorized assistant to expand the selected idea, with every suggestion labeled as a proposal and linked to its sources.
- Accept, edit, reject, or defer a proposal; preserve rejected/deferred rationale.
- See linked implementation, test/evidence, and experiment status as they become available.

On mobile the World remains the main playable surface; Ideas opens as a reachable sheet or focused view. Do not turn this into an operations dashboard or public social feed.

## Safety and test gates

Before calling v1 ready, verify:

- Separate users and separate Worlds cannot read or link each other's private records without a grant.
- An agent can read only what its identity and grant allow; read-only connections cannot create, edit, or accept proposals.
- Canon cannot be modified through the graph API or an agent suggestion.
- Retries and concurrent submissions do not duplicate ideas, edges, or status transitions.
- Every change has actor, authorization, time, source, and an append-only event; corrections add new versions/events.
- A failed, rejected, blocked, or superseded idea remains queryable.
- Idea links to code, tests, and evidence resolve to the exact immutable commit or artifact recorded.
- Simulated and real observations are distinguishable in storage and UI.
- The existing creation, World reload, collaboration, and agent-consent flows continue to work.
- Application checks pass on the isolated branch and preview. Staging verification precedes promotion; production is unchanged.

Use focused tests for graph validation, authority/scope, lineage, and retries; run the complete suite and browser collaboration proof for the integration slice. Report only checks actually completed.

## Out of scope for v1

Autonomous merging or deployment, agent-created production features, auto-editing canon, a general-purpose multi-tenant graph query language, public idea discovery, user-behavior scraping, simulated societies as evidence of product value, token economics, and a dashboard that replaces the playable World.

## Definition of done

A person can open a World, capture an idea, see how it connects to earlier thinking, ask a permitted agent for a source-linked expansion, approve a testable hypothesis, run that experiment on an isolated branch/preview while the stable app remains available, and retain either the positive or negative result with provenance and links to the exact implementation and checks. Nothing is promoted to production automatically.

## Immediate next action

Resume Codex's existing shared-World owner task in `ACTIVE-WORK.md`. Once its staging acceptance gate is met, implement the smallest graph-backed Idea capture/lineage vertical slice before attempting autonomous branch creation.