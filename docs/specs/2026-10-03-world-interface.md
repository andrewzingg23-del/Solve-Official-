# World Interface — build brief

Saved 2026-10-03 from the founder's "One-shot World Interface build prompt" (86 sections), condensed without dropping requirements. **Queued as the next task** after the monetary proof-of-life. Re-read the original message in the session history for full wording where available.

## Rule

**The world is the interface.** Not a dashboard with a globe behind it, not Google Earth with pins, not a Web3 dashboard, not a generic sci-fi HUD. Earth is the root coordinate system; everything else is a representation of one underlying reality.

- Scale continuum: EARTH → REGION → CITY → NODE → WORLD → ROOM → OBJECT / PERSON / ASSET / CONTRACT.
- Lenses over the same reality, each answering one question: **SPACE** (where), **PEOPLE** (who), **POWER** (who controls), **FLOW** (how value/resources/obligations move), **CAUSE** (what depends on what), **PROOF** (what we know and why), **TIME** (how it became this). Not everything is forced into geography.

## Opening

Darkness → frontier point → rising line → line becomes terrain/skyline → curvature → Earth → user's world context → Horizon: *"What do you want to make real?"* Native rendering, no video. Shortens or skips for returning users. No dashboard home, tile grid or app launcher.

## Stack and boundaries

- Next.js App Router, TypeScript, React, **CesiumJS** (primary Earth runtime), Supabase kernel, **WebGL2** baseline (WebGPU only feature-detected later), Web Workers for heavy spatial work, DOM overlay for all interaction surfaces.
- Pipeline: domain state → spatial view model → scene controller → Cesium. React expresses product state; the scene controller owns Cesium calls.
- Modules: `lib/spatial/{types, coordinates, semantic-zoom, lenses, scene-controller, camera-controller, entity-registry, selection, clustering, routes, performance}.ts`.
- Cesium owns Earth, terrain, imagery, geographic geometry, arcs, fields, world-space entities, camera, depth. DOM owns Horizon, identity, cards, typography, drawers, commands, evidence, accounts, keyboard, mobile sheets. No paragraphs/forms/controls in WebGL textures.
- Client-only Cesium (dynamic load, no SSR); branded deterministic loading state. Viewer created once per session; `SpatialShell` persists in a layout across navigation (`app/(world)/layout`, `world/[id]`, `state/[id]`).
- Providers replaceable: `SpatialProvider`, `TerrainProvider`, `ImageryProvider`, `PhysicalTilesProvider`. Domain state never depends on Cesium ion IDs; provider outage degrades fidelity, never erases state.

## Semantic zoom and LOD

- Levels: ORBIT (> 8,000 km), PLANET (2,000–8,000), REGION (200–2,000), METRO (10–200), SITE (0.1–10), WORLD and ROOM (entered by intent/selection, not altitude). Thresholds centralized in `SemanticZoomConfig`, tuned by testing.
- Every entity has representations per level (orbit `•` → regional `◉` → local `◉ LABEL` → focused summary). No detailed labels at global scale.
- Information budget: visible = f(relevance, intent, zoom, selection). Orbit shows ~10–30 dominant entities; cluster aggressively.
- Render priority = intent relevance × scope relevance × importance × visibility permission; drives visibility, labels, detail, clustering. Label collision suppression from day one; selection overrides.

## Domain model

- One `SpatialEntity` contract (id, kind, spatial {anchor, geometry?, extent?}, semantic {title, summary, importance, visibility}, truth {provenanceLevel, evidenceRefs}, state {activity, selected, focused}, relations). Kinds: PERSON, WORLD, NETWORK_STATE, BUSINESS, PROJECT, PROPERTY, ASSET, EVENT, INFRASTRUCTURE, MARKET, OPPORTUNITY, RESOURCE, NEED.
- One canonical World graph (Actor, World, Role, Resource, Need, Asset, Event, Evidence, Contract, Obligation, Transaction, State, Relationship). Lenses are projections; never persist competing map/graph/economy state.
- Network States are distributed constellations, never fake borders. Keep MEMBERSHIP (constellation), PRESENCE (activity pulse), OWNERSHIP (bounded geometry), JURISDICTION (explicit legal layer) visually distinct.
- A World is a semantic container (geographic and digital anchors, members, resources, economics, causal structure, evidence, Rooms), not a marker. Entering it makes it the primary scope with Earth conceptually underneath.
- Location truth kinds: declared, device-observed, provider-derived, asset legal address, estimated. Never treat coordinates as equally true. PostGIS spatial columns for real geometry only; no fake coordinates for digital entities.

## Lenses

- `WorldLens { id, label, canRender(context), deriveViewModel(context) }` registry; core ids `space, people, power, flow, cause, proof, time`; Packs can add lenses.
- SPACE: geography, assets, infrastructure, logistics (Cesium-heavy). PEOPLE: relationship topology on a graph plane. POWER: authority, ownership, control, approvals, governance (structural, not moral). FLOW: money, resources, inventory, obligations, settlement as first-class visuals. CAUSE: dependencies, prerequisites, blockers, milestones, critical path, uncertainty. PROOF: claimed/observed/inferred/verified with provenance states SELF_REPORTED, SYSTEM_OBSERVED, WITNESSED, ARTIFACT_BACKED, EXTERNAL_VERIFIED (shape/ring + label + text, never color alone). TIME: past → now → possible future from append-only events; never rewrites history.
- `IntentRepresentationResolver`: "Why are we running out of cash?" → FLOW; "Who can unblock this?" → PEOPLE + CAUSE; "Who controls approval?" → POWER; "Is this true?" → PROOF. AI may suggest/switch presentation; never mutates canonical state silently.
- Graph-plane renderer (Canvas/WebGL, SVG for small graphs), stable positions, clustering, progressive disclosure, keyboard-accessible equivalent, layout in a Web Worker.
- Signature transition geo ↔ graph: selected object stays the anchor, terrain fades, relationships emerge; reverse restores geography; identity preserved.

## Horizon (universal interaction plane)

- Bottom-center on desktop ("What do you want to do?"), bottom sheet on mobile. Natural language, suggestions, context, AI response, routes, actions, evidence. Not a bottom-right chatbot.
- `HorizonComposer`, `IntentParser`, `IntentRepresentationResolver`, `HorizonResult`, `ProposedAction`. Structured, schema-validated instructions only (`focusEntities`, `suggestLens`, `showRoute`, `showRelationships`, `openContext`, `proposeMutation`); the model never gets direct scene or JS access.
- Response types: EXPLANATION, ROUTE, COMPARISON, QUESTION, PROPOSED_EDIT, FOCUS, SEARCH_RESULT, WARNING; each can have spatial consequences. The world moves; text accompanies it.

## Camera, selection, routes

- Camera controller only: `focusEntity`, `focusBounds`, `enterWorld`, `exitWorld`, `teleportTo`, `frameRoute`, `returnHome`. Heavy, intentional, inertial motion; skip on reduced motion, keyboard nav, near targets. Intent > animation: repeated commands teleport.
- One selection model: none → hovered → selected → focused → entered. URL keeps scope (`/world/:id?lens=flow`); camera stays client-side unless shared.
- Routes are a primary primitive (origin, destination, steps, dependencies, status, confidence, cost, evidence) with one semantics and lens-specific rendering. One route id has geographic, causal and economic representations.

## Visual language

- Primitives: POINT (possibility/AI focus), ORBIT (bounded identity/World), ROUTE (causality/transfer), FIELD (influence/demand/capability/State), RISE (history/progress). NEED = inward field, CAPABILITY = outward field; subtle interaction when they match.
- Palette: #04070d, #0a1220, #f2f7fb, cyan #22d3ee (frontier/selection/active intelligence only), emerald #00e5a0 (verified), red #ff4d5e (destructive). No gold, no rainbow; mostly monochrome; never color-only meaning.
- Archivo; sparse normal/medium display; uppercase tracked labels; tabular numbers; no ultra-light. Surfaces: deep near-black, subtle transparency, restrained blur, one thin luminance edge, minimal shadow.
- Graphics come from data: lines = relationships, fields = state, pulses = real change, rings = scope/provenance, arcs = flows. Earth: dark oceans, graphite land, restrained city light, subtle atmosphere, quiet stars, no saturated imagery or big national labels. Photoreal only where physical truth matters, with provenance; never implied live.
- Motion tokens: focus, teleport, enterWorld, exitWorld, lensTransition, entityResolve, routeTrace, verificationClose, errorFracture; reduced-motion variants mandatory. Pending = incomplete orbit; verified = ring closes; settlement = pulse origin → destination; blocked = route stops; failed = route fractures; completed = stabilizes. No confetti.
- Layer registry `SpatialLayer { id, requiredLens?, minSemanticLevel?, maxSemanticLevel?, update, dispose }`: World, State, Actor, Infrastructure, Opportunity, EconomicFlow, Route, Evidence, Asset, Presence.
- Brand mark derived from the interface: rising route + frontier point + orbit. No crowns, shields, coins, hexagons.

## Data, privacy, performance

- Viewport/context queries `SpatialQuery { bounds, semanticLevel, lens, selectedWorld?, entityKinds, limit }`; server returns only authorized entities. Private by default: no residential, private-World, live member or sensitive-asset locations; public may be generalized (exact → members, city beacon → public). Presence = online / active in World / available / in Room; precise location needs separate permission.
- Live activity from real kernel events only: KernelEvent → VisualEventInterpreter → ephemeral SceneEffect.
- Budget: desktop 60 fps (30 floor), mobile 30 fps. Clustering, culling, LOD, debounced camera, typed arrays, batched primitives, workers, lazy viewport fetch. No React state per frame; publish only semantic changes (zoom level, selection, camera settled, scope).
- Instrument FPS, frame time, tile load, entity/primitive counts, query latency, Horizon-to-focus, camera-settle, memory (dev diagnostics only).
- Degrade gracefully: simplified map, ellipsoid, standard site view, manual search when AI is down, accessible list/graph without WebGL.
- Deep links for World, State, public asset/route/evidence; never leak private camera context. Search is spatial (clusters, remote actors, evidence) plus a normal list.

## Mobile and accessibility

Same mental model: full-screen world + bottom Horizon + context bottom sheet (pinch, tap, double-tap focus, drag, sheet drag). Context drawer 360–440 px on desktop: identity, state, why it matters, action, evidence, relationships, history. Every spatial operation has a keyboard/screen-reader/search/Horizon equivalent; visible focus; reduced motion; contrast; text alternatives.

## Signature flows (real app state)

1. "Build a car company": intent → Earth reacts → geographic possibilities → World draft → Cause lens (design → prototype → certification → production → distribution) → people/capability needs → economic requirements → choose route → World saved → reload restores World and spatial context.
2. Network State: constellation; SPACE = membership distribution, FLOW = economic routes, POWER = governance/treasury authority, PROOF = constitutional/economic evidence.
3. "Show me where this payment went": Flow lens, origin/destination, traced route, conversion legs, fees, inspectable settlement evidence.

## First slice (required)

Persistent SpatialShell; Cesium globe with SOV treatment; semantic zoom; entity registry; World layer; Network State constellation layer; selection/focus; Horizon; lens framework; SPACE + CAUSE + FLOW; World transition; context drawer; mobile; reduced motion; persisted World reopening. Synthetic, unmistakably labelled fixtures: 3 Worlds, 2 Network States, 10–20 actors, resources, needs, relationships, economic routes, evidence, events.

## Adversarial UX tests

Global overload (no marker soup), label collision, rapid zoom (no React thrash), rapid selection (stale fetch can't overwrite), World access denial (private Worlds never leak via nearby queries), location privacy, provider outage, mobile memory pressure (no primitive accumulation), reduced motion, keyboard-only.

## No fake reality

Never imply verified location when estimated, ownership without evidence, presence without evidence, economic size from token price, territory from membership, unknown infrastructure, live photoreal imagery, or AI hypothesis as fact.

## Execution order

Spatial domain model → persistent Cesium shell → Earth visual system → semantic zoom → entity registry → selection + camera → World layer → State constellations → Horizon → lens registry → Space → Cause → Flow → World transitions → context surfaces → mobile → accessibility → performance → visual polish. Keep the kernel-first security model; integrate with canonical World state.

## Definition of done

Opens on Earth; feels like SOV, not default Cesium; shell persists; semantic zoom changes information; Worlds aren't pins; States are networks, not borders; select and enter a World; one World renders in Space, Cause and Flow; Horizon drives deterministic focus from intent; AI commands schema-validated; map queries respect authorization/privacy; mobile keeps the model; reduced motion works; keyboard/accessibility alternatives; large fixtures don't make marker soup; reload restores World; graphics match truth labels; users know where they are and how to act; not a dashboard with a globe; architecture accepts People, Power, Proof, Time, State economics, SOLVE settlement, photoreal sites and AI-chosen representations later.
