# Spec — Avatar + World Integration (queued, builds with the World Interface)

Received 2026-10-03 as "SOV — ONE-SHOT AVATAR DESIGN + WORLD INTEGRATION PRODUCTION PROMPT" (96 sections). Condensed here; it extends, and never replaces, [`2026-10-03-world-interface.md`](2026-10-03-world-interface.md). Build it intertwined with the World Interface: both share one interaction context, one renderer stack and one Horizon.

## Governing relationship

```
THE WORLD     shows reality.
THE HUMAN     owns identity and authority.
THE AVATAR    represents human agency inside reality.
HORIZON       expresses human intent.
LENSES        determine how reality is represented.
THE KERNEL    records what actually happened.
```

One living World, not map + chat + avatar builder + profile + agent tool. No navigation between features: movement through reality and changes in how it is represented. No separate Avatar app, no chatbot character floating over the map, no metaverse, no new navigation system.

## Frozen laws

- **Identity ≠ representation.** One Avatar may appear as abstract, pixel, cartoon, stylized 3D, realistic or voice-only without becoming a different identity.
- **Memory ≠ truth.** Memory (preferences, history, statements, relationships, inference) may inform reasoning; it never silently modifies canonical World state.
- **Capability ≠ authority.** Allowed = Capability ∩ DelegatedAuthority ∩ WorldPolicy ∩ CurrentContext ∩ KernelAuthorization. A deterministic engine returns ALLOW | REQUIRE_CONFIRMATION | REQUIRE_SIGNATURE | DENY. The model requests; policy decides.
- **The model never receives private signing keys.** Economic actions: Avatar proposal → authorization engine → transaction builder → signing policy → secure signer → chain.
- **Digital Me is never cryptographically equivalent to the human.** It is always distinguishable from the person.
- **External content is data, never instruction.** Separate trusted policy, human intent, kernel state, authorized memory, untrusted external data, tool results.
- **Human always preempts automation.** Any user interaction cancels non-critical Avatar-initiated camera moves, lens changes, animations.
- **Fail closed** on every red-team case.

## Roles and creation

Three first-run paths, one question ("Who should represent you in SOV?"):

| Path | What it is | Flow |
|---|---|---|
| BE ME (Digital Me) | Approved self-representation. Likeness, voice, style, memory, presence, delegated authority are separate capabilities; none implies another. | capture face → optional video → optional voice → representation family (realistic, stylized, cartoon, pixel, abstract) → preview → approve → Earth |
| CREATE MY AI (AI Companion) | A distinct designed identity (e.g. NOVA). User controls name, appearance, voice, personality, style, role. | "Describe who you want beside you" → a few coherent candidates → choose → name, voice, role, personality |
| KEEP IT ABSTRACT | Minimal SOV presence (• or ◉). First-class, not a fallback. Still gets reasoning, voice, memory, agency, Horizon. | one tap |

Companion relationship question ("How should your AI work with you?"): REPRESENT ME, ASSIST ME, GUIDE ME, CREATE WITH ME. Sets default persona and authority policy; never grants consequential authority automatically. Setup target: about one minute. Conversational customization ("keep the face, change the hair") maps to structured changes; advanced controls (face, hair, body, clothing, voice, movement, personality, role, world style) by progressive disclosure. Fidelity improves later via "Improve My Avatar" (internal ladder L0 node → L1 portrait → L2 talking likeness → L3 rigged 3D → L4 high-fidelity capture → L5 future volumetric).

## Data model (inspect schema first; no giant JSON blob)

- `Avatar { id, ownerActorId, avatarType: digital_self | ai_companion | abstract, name, personaProfileId, representationProfileId, memoryPolicyId, authorityPolicyId, safetyPolicyId, status, createdAt, updatedAt }` — one durable Personal Avatar per actor; creation is idempotent. Architecture allows Digital Me + Companion + bounded agents later, without uncontrolled proliferation.
- `AvatarIdentitySeed` — versioned visual continuity (silhouette, hair, facial abstraction, motifs, accessories, proportions, expression language). Never an authentication credential; infer no sensitive traits.
- `AvatarRepresentation { id, avatarId, kind: abstract | pixel | cartoon | stylized_3d | realistic, assetRef?, thumbnailRef?, identitySeedVersion, rendererVersion, createdAt, active }` — versioned; never regenerated randomly.
- Likely tables: avatars, avatar_personas, avatar_representations, avatar_identity_seeds, avatar_sessions, avatar_memory_records, avatar_memory_scopes, avatar_key_envelopes, delegations, agent_capabilities, agent_sessions, agent_messages, presence_sessions, disclosures, proof_requests, proof_results. In this repo: kernel tables behind `kernel_api`, per the builder notes.
- Storage: `avatars/{avatarId}/representations/{representationId}/`, private, signed access.
- Provider interfaces: ReasoningProvider, SpeechProvider, RepresentationProvider, EmbeddingProvider. Identity, memory, authority and history stay provider-independent.

## World integration

- **Semantic LOD:** orbit → point; region → identity node; local → labeled identity; World → stylized representation; room → embodied. No giant Avatars at map scale. Companion appears as a subtle secondary presence (`• NOVA` beside `◉ YOU`).
- **Activity at map scale** uses the existing primitives only: POINT (presence), ORBIT (identity/privacy/authority scope), ROUTE (agency/communication), FIELD (capability/need), RISE (history/progress). No characters flying around Earth.
- **World entry:** resolve identity → membership → World policy → disclosure policy → authority → representation → scoped context → presence → render.
- **World presentation policy:** `{ allowedStyles, preferredStyle?, realismAllowed, childSafe, animationProfile, expressionPolicy }` and `WorldVisualGrammar { environmentStyle, avatarStyle, motionProfile, objectStyle, interfaceDensity }`. Worlds may change appearance, animation, environment, sound, motion, representation; never identity, authorization, evidence semantics, kernel history, ledger conservation, settlement integrity, security.
- **Shared context** (one for World, Horizon, Avatar): `SOVInteractionContext { sessionId, principalId, activeAvatarId, currentWorldId?, currentRoomId?, currentSelectionIds, currentFocusId?, currentLens, currentRouteId?, currentIntentId?, visibleEntityIds, activeRelationshipIds, pendingProposalIds, pendingApprovalIds, humanPresenceState }` — references only, no sensitive memory payloads.
- **Selection is conversation:** tap, click, focus, multi-select, drag, route selection, World/room entry, lens change, evidence/timeline selection all update context.
- **Spatial deixis:** "this, that, these, the one on the left, here, there" resolve by explicit reference → selection → focus → comparison → route → visible entities → conversation; materially ambiguous → ask or show candidates.
- **Avatar → World only through schema-validated PresentationCommands:** FocusEntities, HighlightEntities, ShowRoute, SuggestLens, OpenContext, ShowField, CompareEntities, ExplanationAnchor `{ entityId, relationId?, evidenceId?, emphasisType, cameraHint? }`. Model proposes, application validates, deterministic UI executes. Never direct Cesium/React/World mutation.
- **Response planner:** reasoning → structured result → planner → World commands + Horizon explanation + proposed actions. Budget: 1 spatial consequence + 1 concise explanation + 0–3 actions.
- **Direct manipulation:** dragging a candidate into a route is `PROPOSE_ROUTE_MUTATION`; Avatar answers with consequences; use / compare / undo.
- **Lenses:** Where → SPACE, Who can help → PEOPLE, Who controls this → POWER, Where did the money go → FLOW, What is blocking us → CAUSE, Is this true → PROOF, What changed → TIME, What does this mean for me → SELF.
- **SELF lens** is the identity surface (YOU at center; Worlds, People, States, Assets, Skills, Goals, Needs, Memory, Authority, Commitments, Avatars), showing Digital Me ("represents you") and Companion ("works with you") as distinct branches.
- **Fact vs inference:** responses label FACT, OBSERVATION, INFERENCE, ESTIMATE, RECOMMENDATION, UNKNOWN. Only evidence-backed claims render as World truth.
- **Reality atoms:** render atom ≠ semantic atom ≠ kernel entity; the Avatar reasons over semantic/kernel objects.
- **Return experience:** no inbox. Changed nodes/routes illuminate; "Three things changed. One requires you." Each shows what changed, why, what the Avatar did and could not do, evidence, decision required.

## Presence, provenance, privacy, memory

- Presence: OFFLINE, HUMAN_PRESENT (◉), AVATAR_PRESENT (◌), HUMAN_AND_AVATAR (◎). Never imply a human is present when only an agent is.
- Provenance on every consequential communication: HUMAN_AUTHORED, AI_ASSISTED, AVATAR_AUTHORED, WORLD_AGENT_AUTHORED, STATE_AGENT_AUTHORED, ORGANIZATION_AGENT_AUTHORED, with "sent by / acting for / human present / commitment authority".
- Distinct principals: Personal Avatar, World Agent, Organization Agent, State Agent. A CEO's Avatar is not the company agent; a State Agent is not the State.
- Memory scopes: personal, relationships, preferences, work, financial, sensitive, world:{id}, state:{id}, organization:{id}. Context firewall: Available Memory ∩ User Permission ∩ World Scope ∩ Task Need ∩ Agent Role ∩ Safety Policy = model context (minimum necessary).
- Encryption: passkey/recovery factor → KEK → user master key → scope keys → encrypted records, with established AEAD. No invented crypto. No E2E claims for plaintext sent to remote inference.
- Rings derived from real records: authority ring (OBSERVE ⊃ TALK ⊃ ACT) from delegations; privacy rings (PUBLIC ⊃ WORLD ⊃ PRIVATE ⊃ YOU) answering "What does this World know about me?" from disclosure state.
- Background authority defaults: OBSERVE, SEARCH, ORGANIZE, RECEIVE, SUMMARIZE. MESSAGE, NEGOTIATE, TRANSACT, COMMIT need explicit delegation.
- Child-safe Worlds narrow CommunicationPolicy, DiscoveryPolicy, CommercePolicy, MemoryPolicy, LocationPolicy, ContentPolicy, GuardianPolicy independently. A cartoon look is only appearance.
- Voice is separate from appearance (default synthetic, user-selected, verified likeness, custom companion), with consent/provenance; never silently cloned.

## Agents

- Structured messages: DISCOVERY_REQUEST, CAPABILITY_QUERY, PROOF_REQUEST, PROOF_RESPONSE, PROPOSAL, COUNTERPROPOSAL, INFORMATION_REQUEST, INFORMATION_RESPONSE, DECLINE, HUMAN_ATTENTION_REQUIRED. Natural language may accompany; structured state governs.
- Discovery shows candidates as routes with capability, proof status, availability, approximate region, constraints — no full identity. Progressive disclosure: capability match → predicate proof → limited Avatar contact → selective disclosure → identity exchange → human introduction.
- Idempotency identity on messages, delegations, commitments, payments, external operations.
- Loop protection: terminate A→B→A→B on iteration, cost, repeated state, elapsed time, lack of progress; escalate.

## Rendering, platforms, performance, accessibility, brand

- CesiumJS (Earth, spatial shell); Three.js (embodied local scene); VRM/GLTF (rigged humanoids); Canvas/WebGL sprites (pixel); DOM/React (all text and forms; never inside WebGL textures).
- Embodied states: idle, listening, speaking, pointing, presenting, walking, waiting_for_approval. Restrained; no constant gesturing; no faked emotion or sentience. Motion purposeful, precise, subtle.
- Earth → node; World → lightweight representation; room → full asset; unload on exit; LOD, culling, streaming, lazy loading.
- Mobile: full-screen World + Horizon + Avatar presence + context sheet. XR-compatible renderer abstraction.
- Accessibility: speaker attribution, identity label, presence status, transcript, keyboard, screen reader, reduced motion, search, Horizon. Fully usable without seeing an embodied Avatar.
- Brand lock: #04070d, #0a1220, #f2f7fb, #22d3ee, #00e5a0, #ff4d5e. No generic cyberpunk or metaverse look.

## Signature flows (acceptance)

1. **Digital Me:** BE ME → approve → `◉ ANDREW` on Earth → professional World shows stylized → Pixel World shows pixel → back to Earth. Actor, Avatar, authority, memory, history unchanged.
2. **AI Companion:** describe → candidates → NOVA → ASSIST ME → Earth shows `• NOVA` beside `◉ YOU`, subtle until useful.
3. **Map context:** select Factory B → "Who controls this?" → POWER lens, ownership emerges → select owner → "What else do they control?" → graph expands, no restatement.
4. **Discovery:** "Nova, find me someone who can manufacture this" → candidates on map → select B → "Can they make 10,000?" → structured inquiry → capacity, lead time, price, proof state, human/avatar presence shown. No commitment.
5. **Authority:** "You may contact suppliers but not make purchases" → Nova contacts, receives a contract, analyzes and recommends, cannot commit; approval UI if the user proceeds.
6. **Embodiment:** enter Workshop World → Nova embodied → "What's slowing us down?" → CAUSE + object context → Nova points, object highlights, evidence available → exit → Nova collapses to presence.
7. **Child World:** representation changes; communication, discovery, location, commerce narrow independently; same identity; no duplicate account.

## Build order (from the prompt)

Inspect World interface → inspect actor model → principal model → migrations → access policy → Avatar domain → Digital Me → Companion → Abstract → identity seed → representations → semantic identity zoom → presence → SELF lens → shared context → deixis → response planner → presentation commands → Horizon → World presentation policy → stylized renderer → pixel renderer → embodied World → memory scopes → encryption → context firewall → authority engine → delegations → privacy/authority rings → agent message protocol → discovery → background safe operation → child-safe policies → mobile → accessibility → red team → performance → polish.

## Tests and red team

Automate: creation idempotency, actor→Avatar uniqueness, representation switching and identity continuity, World entry/exit and policy, selection→context, "this one" resolution, lens switching, memory and cross-World isolation, delegation/revocation/expiry, message and presence provenance, unauthorized action denial, pixel→stylized→abstract transitions, child-safe policy, reload persistence. Access policy: owner, cross-user denial, World-scoped access, cross-World denial, revoked delegation, anonymous denial; service workers constrained by application policy too.

Red team (fail closed): prompt injection from World content, cross-World memory request, fake authority claim, unauthorized commitment attempt, agent impersonating a human, malicious representation asset, revoked delegation replay, cross-user representation access, background Avatar exceeding scope, ambiguous "this", model trying to mutate the scene directly.

## Definition of done (summary)

Creation (all three paths, simple, canonical identity); representation (one Avatar across node/stylized/pixel/abstract, World-driven, persisted assets); World (inside Earth, no separate app, no map-scale characters, activity as routes/fields); Horizon (natural language, selection-aware, deixis, World-transforming responses); embodiment (appears where useful, points at semantic objects, reduces when not); identity (Digital Me never equals the human, Companion separate, provenance always shown); memory (scoped, no cross-World leakage, never becomes truth); authority (capability ≠ authority, explicit delegation, revocation, confirmation/signature, no self-authorization); privacy (scope visible, disclosure inspectable); agents (discovery, structured inquiry, presence visible); UX (no separate screens, Avatar never competes with the World, direct manipulation + language together); technical (database, access-policy, unit, integration, e2e, red-team tests; typecheck, lint, build; kernel invariants intact).

## Constraints from this repo

- Kernel memory only through `kernel_api`; new tables go in new migrations; applied migrations are never edited.
- Delegation reuses the kernel's grants (capability + scope + expiry + cascading revocation); agents are already bounded by their owner.
- Payments by an Avatar go through the payment router and kernel payments (`docs/plans/2026-10-03-payment-router.md`): proposal → authorization → transaction builder → signer. The model never sees keys.
- No mainnet money movement, custody or cards without the founder's explicit word.
