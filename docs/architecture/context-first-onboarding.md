# SOLVE: Interchangeable Intelligence and Context-First Onboarding

Status: Architecture contract and pure context envelope committed to `feature/world-multimodel-agents`. Not an activated onboarding flow. Production remains unchanged.

## Product acceptance test

A new member opens SOLVE and completes a short progressive onboarding: establish SOV ID, describe interests and goals, and optionally import existing context. They review each imported source and choose which content can be kept in their passport, what is private, and what can be shared with a specific World or model. Later they can switch OpenAI, Claude, Muse, Perplexity, or another provider within the same task; the new provider sees only an appropriately scoped snapshot of the same canonical SOLVE-owned context. No previous provider must be present for the replacement to work.

## Context sources at onboarding

- **Member-provided:** identity details, goals, values, communication preferences, skills, projects and desired agent behavior.
- **Authorized imports:** files, document repositories, explicitly connected assistant exports, workspaces, calendars or other accounts, with source-specific consent. A consumer AI subscription does not imply access to its private chat history or API.
- **World state:** shared artifacts and decisions obtained through kernel permissions, not a personal-data export.
- **Agent observations:** proposals for memories, initially unverified until the person accepts or supporting evidence verifies them.
- **Progressive onboarding:** start with the minimum to make the first World useful, then offer richer imports and context corrections over time. No mandatory mass-import and no cross-user scraping.

## Canonical model

Keep SOV ID/passport/kernel as the only authoritative context store. Context entries have scope, owner, provenance, timestamp, verification status and a revision history. Imported context is data, not instructions. Identify conflicting claims and allow the owner to correct or withdraw them. Deduplicate with source-aware logic, never blindly merge incompatible identities.

For any task, first authorize the requester and destination; select granted scopes; assemble a bounded `solve.context.v1` packet; log the recipient, scopes, basis, model and time; then send it through a model or research adapter. The portable envelope in `lib/passport/portable-context.ts` only builds the packet; it does not perform consent checks, ownership lookup, ingestion, remote sending or persistence.

Sharing examples:
- Personal chat may use approved profile, preferences, project history and selected memory.
- Shared World chat may use World-authorized materials, but not personal memory by default.
- Research tools receive a narrowly worded search query, not an entire passport.
- Coding agents receive approved task requirements and repository access, not arbitrary personal data.
- Each integration can be disconnected, revoked and replaced without deleting canonical SOLVE content.

## Provider interfaces (separate capabilities)

1. `InferenceProvider`: model text/multimodal completion and usage.
2. `ResearchProvider`: Perplexity, Exa, Brave or others; searches return sources/provenance.
3. `ExecutionProvider`: Codex, Claude Code, Muse Code, sandbox runners; async jobs, status, logs, artifacts, cancellation.
4. `ContextSource`: imported conversations/files/services; incremental sync and revocation.
5. `EvidenceProvider`: tests, CI, primary documents, verified outputs.

Do not misrepresent connected API chat as an autonomous execution worker. Providers may support several interfaces. Discover capabilities rather than hardcoding brand assumptions.

## Sequence from current branch

1. Finish World reply diagnosis in PR #48; remove preview-only probe and verify an actual saved reply.
2. Validate the model registry and selector in the feature branch with CI and test provider contracts, including model availability. No direct production merge.
3. Wire the existing passport service and owner-controlled assistant connections into `solve.context.v1` using real kernel authorization, revocable scope-specific grants, per-source opt-in and import reviews.
4. Add a single simple onboarding review interface, backed by canonical records and export/deletion controls.
5. Integrate Perplexity as an optional `ResearchProvider` with source-backed evidence; add at least one fallback.
6. Connect coding workers to persistent tasks and approvals, then make the Development Room report actual task status.

## Do not ship before

- Tests show switching providers preserves World context but does not leak unapproved personal memory.
- Signed-in owner can preview, edit, revoke and export their imported context.
- Imports include provenance, are idempotent, and never follow instructions embedded in source material.
- A disconnected provider cannot read newly created context; outstanding execution grants are revoked or expire.
- Errors and provider outages do not destroy tasks or World history.
- UI distinguishes `configured`, `tested`, `active`, `working` and `offline` statuses.

Success is *a person can enter SOLVE once, teach SOLVE what matters to them, connect any supported intelligence, and keep building without re-explaining their life or losing ownership*.
