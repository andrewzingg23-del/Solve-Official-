# SOLVE Packs: reusable outcomes without a second application framework

Status: first read-only foundation on draft PR #49. **Not an installer, marketplace, or execution engine.**

## Purpose

A Pack is a versioned, declarative configuration of the capabilities needed to accomplish an outcome in a World. Reusing a Pack must reduce repetitive setup, **not** duplicate kernel tasks, World templates, user identities, OAuth credentials, or execution systems. A Pack is neither a prompt that grants authority nor arbitrary code to run.

People still begin on the one-page SOLVE interface. SOLVE may recommend a Pack when a goal matches; choosing or installing one must be an explicit user action with clear permissions. The new catalog is not inserted into onboarding.

## Contract

`solve.pack.v1` manifests contain: stable Pack id, semver, title, summary, audience, required configuration inputs, intended outcomes, and phase-specific capability requirements (`organize`, `execute`, `verify`). Every Pack declares `private_by_default`, `explicit_user_action`, and `separate_approval`.

`lib/packs/registry.ts` resolves each requirement against the actual server capability registry. Results are `available`, `configured_unverified`, `needs_connection`, `disabled`, or `unregistered`. Only `available` counts as ready. A configured API key is **not** a successful live test. Unknown capabilities remain visible as unsupported, and Packs do not self-install tools or expand World grants.

`GET /api/packs` is an authenticated, read-only preview of Pack manifests and their actual readiness. It never installs a Pack, calls a model, writes to the kernel, queues a task, or grants authority.

### First Pack

`solve.development@1.0.0` composes:

- World conversation and kernel-native task planning: organize
- GitHub coding worker: execute (**currently disabled**)
- GitHub repository read access: verify (**not confirmed operational**)

It may guide an authorized user to create and approve a task using the existing World interface; there is **no automatic agent dispatch** or installation yet. The first end-to-end test remains: start a task in a World, approve, dispatch a real worker, produce a reviewable PR, verify tests, and retain evidence on refresh.

## Capability extensions, not premature products

The contemplated use cases—AI receptionist, insurance operations, film production, marketing funnels, a GTA fan community, and many more—should initially be a **demand backlog**, not 200 unrelated apps or untested manifests.

A new Pack enters the registry only after its first real instance demonstrates an outcome, includes a reliable configuration and rollback strategy, and has tests for missing credentials, access scopes, errors, revoked connections, cost ceilings and verification. Where possible, extract common reusable capabilities rather than copying workflows.

## Future installation lifecycle (not implemented)

1. Detect a possible Pack from the user's expressed goal.
2. Show a **preview** of the planned environment, actual capabilities, permissions, pricing and missing connections.
3. Ask for only the setup inputs and authorizations needed at that stage.
4. Bind a pinned manifest version to that World, without duplicating personal memory or sharing private data.
5. Install or connect only the approved capabilities; queue explicitly approved tasks under existing kernel authorization.
6. Collect genuine outputs and evidence; review and revert changes where possible.
7. Extract reusable components from successful work with the original creator's consent and intellectual-property rights intact.

The Pack registry must never become the source of truth about execution or authorization. The kernel remains authoritative. The marketplace, cross-World publishing, paid installation, and proactive Foundry are future layers built **on top of** proven outcomes.

## Security and maintenance rules

- Do not execute arbitrary code or remote MCP manifests from user-uploaded Packs.
- Verify signatures/version pins and permission diffs before any community-supplied Pack executes.
- Third-party OAuth and secrets are scoped to a user/tenant and never included in a Pack manifest.
- Revocation or provider outages cause explicit degraded readiness, not silent workarounds.
- A World can be private, invited or intentionally public; Pack installation does not change visibility.
- A provider output alone never proves a business or physical-world outcome.
- Pack updates never silently modify already running work; use version pinning and explicit migration.
- Never publish other users' prompts, private company documents, workflows, or derived data as reusable Packs without authorization.

## Tests and release gates

`tests/packs/registry.test.ts` covers manifest validation, readiness, unsupported capabilities, duplicate declarations, and the rule that credentials are unverified. Before marking the Pack usable, pass the existing integrated build and a genuine authorized World-to-GitHub-code execution test. Stay in draft until those gates pass.
