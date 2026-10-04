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
- The current root app is an Arcadia-backed globe, Horizon, lenses, and deterministic interaction loop. The kernel, authority model, provider boundary, answer service, agent inquiry exchange, and reasoning-provider code are implemented and tested.
- The product gap is collaborative authoring: there is no staging-backed shared canvas where multiple humans and external agents can make visible, persistent changes together.
- The exact local snapshot matches all 164 GitHub blob hashes. Typecheck, lint, build, and the isolated kernel test pass. One local npm test run alongside typecheck and lint exited nonzero at file level; the latest branch CI is the full-suite green gate.

## Page and surface outline

Keep the World at the center. Most destinations are views or contextual tools inside it, not standalone pages.

1. **World entrance — `/`**  
   Keep the existing spatial World as the entry point. Return to the active World quickly; offer creation or joining from there when durable World membership is available. Do not insert a dashboard or social feed.

2. **The World — current root shell, future persistent World route**  
   One underlying World can be viewed spatially, as a canvas, or in 3D when the work needs it. The current build is the Arcadia Earth prototype; a truly open, kernel-backed creative canvas is still future work. Starting blank with optional examples is the default.

3. **Everyday views inside the World**  
   Keep four wayfinding choices visible: **World** (spatial view), **Path** (what is moving or blocked), **People** (people and agents), and **History** (what changed). They are projections of the same state.

4. **Specialist views under More**  
   **Authority**, **Value**, **Proof**, and **You** remain available without crowding the first screen.

5. **Contextual tools, not feed pages**  
   Selection opens an inspector. Presence and invitations belong beside the shared work. Changes and evidence stay available through History and Proof. Connections to files, tools, services, and outside agents begin from the World that needs them. The current prototype does not yet implement live presence, invitations, or generic shared authoring.

6. **Identity and account — existing `/account`**  
   SOV ID, human/agent distinction, grants, and memory controls. Reachable when needed; secondary to the World.

7. **Money — existing `/money`, separate and gated**  
   Economic tools remain separate. No currency, purchase, or token action is required to create.

On phone, keep the World full-screen, use reachable sheets, and show the Arcadia sandbox label. On laptop, offer wider side panels without turning the product into a dashboard.

## Build sequence

### 0. Recover the real state — done
Confirm branch head and CI, confirm staging project/migrations/integrity/grants, preserve the production boundary, and reconcile build status. The staging project currently has v4; production does not.

### 1. Make the staging app path real
Verify Auth redirect URLs and Data API exposure on staging, wire the app to staging-only configuration, and demonstrate account registration and World load through kernel_api. Keep Arcadia available as a labeled sandbox; do not present its activity as real collaboration.

### 2. Build durable creative primitives
Use the existing World Graph/kernel contract where it fits. A creator should be able to add, move, revise, connect, and undo generic items without choosing a Sector Pack first. Persist meaningful edits through the kernel-gated interface with actor, owner/agent relationship, scope, and history. Store larger binary/3D artifacts outside the event payload and attach versioned references plus content hashes.

### 3. Make two people see the same World live
Add authenticated World membership and scoped grants first. Use ephemeral presence/cursor signals for “who is here”; use the kernel event as the durable record and realtime notifications only to prompt authorized clients to refresh. Avoid broadcasting private payloads. Define conflict behavior for same-object edits and test reload, offline/reconnect, revoked access, and concurrent edits.

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
