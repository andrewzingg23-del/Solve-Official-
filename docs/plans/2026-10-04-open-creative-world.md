# Shared Creative World — product and implementation plan

Date: 2026-10-04
Branch reviewed: claude/keen-cerf-tpd7io at fd09d67e84009e207424e1b1cade77e5fc265d49

## Product north star

SOV gives people the brush. They can begin with an intention, a blank canvas, an imported artifact, or an existing World, then create something the system did not predefine. The World is a premium, navigable design environment for people and their agents to collaborate and connect to the outer world when useful.

The existing vision remains the backbone: person-centered Worlds, Horizon as a way forward, Rooms and Packs as reusable tools, governed actions, evidence, and learning from real outcomes. This clarification means routes, Rooms, and Packs are optional ways to create, not a forced funnel. Collaboration centers on the shared creation, not a social feed.

SOV ID keeps human and agent identity, ownership, and grants clear. Currency rails support actual economic consequences when needed; they are not required to create. Simulated, proposed, and externally verified states remain visibly distinct.

## Verified project checkpoint

- The branch CI for the reviewed commit is green.
- Supabase staging project solve-staging is active on Postgres 17. Its migration history includes v4; the chain check returned ok=true across 35 events, and inspected grants do not give API roles direct access to kernel tables.
- Production was not migrated.
- The branch-specific Vercel Preview is set to solve-staging; the pre-creative preview for commit 812153d is READY. Auth redirect settings remain unverified, so the staging-backed sign-in path has not been exercised.
- The current root app is an Arcadia-backed globe, Horizon, lenses, and deterministic interaction loop. The kernel, authority model, provider boundary, answer service, agent inquiry exchange, and reasoning-provider code are implemented and tested.
- First creative slice added: signed-in `/` opens `/worlds`; people can create and reopen a private, blank World at `/world/[worldId]`, then add, move, revise, and reload text artifacts backed by versioned kernel entities and a visible event history. `/arcadia` stays the labeled sandbox. This code path has not yet been exercised through staging Auth.
- The remaining product gap is live collaboration: there is no invitation UI, real-time change sync or presence, or provider-neutral path for a collaborator's existing agent to contribute to this creative World.
- At takeover, the recovered snapshot matched 164 GitHub blob hashes at fd09d67. For the creative slice, its focused kernel test passes 1/1, with typecheck, lint, and production build passing locally; the push CI remains the full-suite gate.

## Page and surface outline

Keep the World at the center. Most destinations are views or contextual tools inside it, not standalone pages.

1. **World entrance — `/` and `/worlds`**  
   Signed-out visitors enter the Arcadia sample. Signed-in people arrive at their Worlds, where they can reopen work or start a new blank World. This is a compact work index, not a social feed. The sample is also available at `/arcadia`.

2. **The World — `/world/[worldId]`**  
   One private kernel-backed workspace opens blank. The first canvas slice supports text artifacts with saved position, revision history, and explicit access boundaries. It currently lays pieces out as a responsive board; richer free placement, other artifact types, and 3D remain future work. Arcadia keeps the spatial Earth prototype separate.

3. **Everyday views inside the World**  
   Keep four wayfinding choices visible: **World** (spatial view), **Path** (what is moving or blocked), **People** (people and agents), and **History** (what changed). They are projections of the same state.

4. **Specialist views under More**  
   **Authority**, **Value**, **Proof**, and **You** remain available without crowding the first screen.

5. **Contextual tools, not feed pages**  
   Changes and evidence stay available through History and Proof. Connections to files, tools, services, and outside agents begin from the World that needs them. The creative World now has kernel event history; live presence, invitations, and outside-agent joining are still unbuilt.

6. **Identity and account — existing `/account`**  
   SOV ID, human/agent distinction, grants, and memory controls. Reachable when needed; secondary to the World.

7. **Money — existing `/money`, separate and gated**  
   Economic tools remain separate. No currency, purchase, or token action is required to create.

On phone, keep the World full-screen, use reachable sheets, and show the Arcadia sandbox label. On laptop, offer wider side panels without turning the product into a dashboard.

## Build sequence

### 0. Recover the real state — done
Confirm branch head and CI, confirm staging project/migrations/integrity/grants, preserve the production boundary, and reconcile build status. The staging project currently has v4; production does not.

### 1. Make the staging app path real
The branch preview has staging-only Supabase configuration, and the signed-in route now calls the kernel. Still verify Auth redirect URLs and Data API exposure, then demonstrate account registration and World load through kernel_api. Keep Arcadia available as a labeled sandbox; do not present its activity as real collaboration.

### 2. Build durable creative primitives
First slice implemented: claim a private World scope; create its root entity and owner relation; create, move, and revise text documents; persist each revision with idempotent kernel writes; show actor-attributed World history. Remaining: generic shapes and imported files, connect and undo, richer placement, and content-addressed storage for larger artifacts.

### 3. Make two people see the same World live
Add an in-app invitation and scoped-grant flow. Use ephemeral presence/cursor signals for “who is here”; use the kernel event as the durable record and realtime notifications only to prompt authorized clients to refresh. Avoid broadcasting private payloads. Define conflict behavior for same-object edits and test reload, offline/reconnect, revoked access, and concurrent edits.

### 4. Bring each person's agent into the project
Expose a provider-neutral, permission-checked World interface (MCP/API adapter) so a collaborator can connect the agent they already use. Each agent keeps its own identity and owner; it receives only the World/task context it was granted. Start with reversible edits and visible proposals; external commitments still require the existing approval/authority path.

### 5. Run the real pilot, then improve
Use the app with two people and their agents on one actual project. Capture one meaningful friction, implement the smallest reusable change, and verify the changed behavior and security boundary. Scale presence to 10+ participants after the two-person loop works; then add richer 3D authoring, industry adapters, and real-time simulations when projects demand them.

## First-slice acceptance

- Two people join one private World from separate devices.
- Each can create and revise at least one shared item; the other sees the change without reloading manually.
- Changes persist across reload and show author, agent owner where applicable, and history.
- An agent can make an authorized reversible contribution; an out-of-scope write is denied.
- Reconnect and concurrent-edit behavior are understandable and tested.
- No payment, token, marketplace, or production migration is needed to create.
- The World remains legible on phone and laptop, with no social feed or marker clutter.

## Current gates and accepted defaults

The founder said “Go” after review of the recommended page structure. Use these working defaults:

- New creative Worlds can start blank, with optional examples.
- Keep one World model with multiple views. Preserve the spatial Earth experience and add canvas or 3D representations as useful; do not require a map or a 3D scene for every creation.
- Connect an existing outside agent through a provider-neutral API/MCP before prioritizing a built-in companion for shared creative work.
- Keep production untouched. The verified v4 database is staging; sign-in and the staging-backed authoring path remain to be demonstrated.

## Implementation state — 2026-10-04

Owner-managed human viewer/editor grants and private live invalidation are implemented on `codex/world-live-collaboration`. The event stream remains canonical; Realtime carries only an invalidation (World ID and sequence), and clients re-read through the existing kernel API. CI, staging migration installation, and two-person authenticated browser validation are pending.
