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

## Provisional page and surface outline

Keep one World as the product. These are entry points and contextual surfaces, not a menu of disconnected apps.

1. **World arrival — /**  
   First visit: the existing frontier-to-Earth entry leads into the user's World and invites creation. Returning visit: resume the last active World quickly. Horizon stays available as a prompt, not a required workflow. No dashboard tile grid.

2. **Creative World — /world/[worldId]**  
   The main open canvas. A creator can add, arrange, revise, and connect general objects and artifacts. The representation can be spatial 2D or 3D as the work needs; an empty canvas is a valid start. Preserve the existing Earth/World visual grammar.

3. **Context inspector — contextual side sheet**  
   Selecting a thing reveals what it is, its relationships, source, status, and editable properties. Changes show whether they are drafts, proposals, applied edits, or verified facts. Keep the main scene visible.

4. **People and agents — contextual panel**  
   Show who is present, which agent belongs to whom, what each can see/do, and what they are contributing. Invitations and grants are explicit. Do not turn activity into a feed.

5. **Changes and evidence — TIME/PROOF lenses**  
   Review who changed what, why, with what evidence, and whether it can be undone or needs approval. The kernel stays the record of consequential changes.

6. **Connections — contextual action from the World**  
   Bring in files, tools, services, data, models, or outside agents when a creation needs them. Show scope, owner, permissions, provenance, and consequences. No broad app marketplace in the first slice.

7. **Identity and account — existing /account**  
   SOV ID, human/agent distinction, active grants, memory and representation controls. Keep this out of the way until needed.

8. **Money — existing /money, separate and gated**  
   Economic tools remain available for real payment work, but never interrupt ordinary creation.

On phone, the canvas stays primary with reachable contextual sheets. On laptop, the same World can sit beside richer inspector and collaboration surfaces. Do not shrink a desktop dashboard onto a phone.

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

## Current gates and questions

The staging v4 migration is applied and the event chain is healthy. Staging app sign-in and the collaborative canvas are not yet verified. Production stays untouched until a separate founder decision.

Questions that affect the first page slice:

1. **First canvas:** should first-time creation open on a truly blank canvas, with optional starter examples, or show one default example World that can be reshaped? Recommended default: blank canvas plus optional examples.
2. **First outside agent:** should we optimize first for your brother connecting the AI he already uses through a provider-neutral MCP/API, or start with a built-in SOV companion and add external agents next? Recommended default: provider-neutral connection first, so the experience solves the cross-agent handoff problem.

I can proceed with those defaults unless you steer them differently.
