# DOMAIN-CONTRACTS

The canonical primitives every surface builds on. One canonical graph, one action physics, one authority model. Map, Horizon, avatars, payments, tasks, organizations and Network States are projections of these, never parallel models. Changes here are kernel changes: new migration, tests, and an entry in DECISIONS.md.

Governing loop (any principal can run it, human or agent):

```
INTENT → HORIZON → ROUTE → AUTHORITY → ATTEMPT → EVIDENCE → RECONCILIATION → CONSEQUENCE → CANONICAL WORLD → NEW HORIZON
```

## 0. What is canonical

| Layer | Status | Notes |
|---|---|---|
| Kernel events, actions and transitions, evidence, grants and limits, entities and versions, relations, ledger, tasks, payments, settlements | **Canonical** | Append-only, hash-chained, one id per thing. The only place reality changes, and only through authorized writes. |
| The browser's kernel (PGlite) | Projection | The same database; its semantic digest must equal the Arcadia manifest's at boot (`npm run test:world`). |
| Arcadia snapshot and manifest | Projection | Generated through the real kernel; the build refuses a snapshot that does not reproduce the digest. |
| `WorldState` (`lib/causal/world.ts`), actor context | Projection | Rebuilt from one actor's own kernel reads; never stored; never shows what that actor may not read. |
| Facts and truth statuses | Projection | Derived from provenance: asserted, observed, verified, disputed, authorized, attempted, reconciled. |
| Horizon, routes, rankings, predictions (`inferred`) | Interpretation | Never canonical. A route selection is recorded as an attributable event with its ranking policy; it changes nothing until its actions complete with evidence. |
| Spatial view model, scene controller, Cesium, camera, selection, lens state | Rendering | Pure projections; never write to the kernel (tested: digest unchanged across selection and camera moves; recording proxies show zero writes). |

Identity: one canonical ref per thing (`entity:<uuid>`, `actor:<uuid>`, …) across kernel, browser, Horizon bindings, consequences, context and every renderer. Across Arcadia generations the same thing keeps its `arcadia_key`; its kernel id is minted per generation (see DECISIONS).

## The causal loop (`lib/causal`)

- **Transition** (`lib/causal/transitions.ts`): an operator on World state, declared so a planner can chain it and a reviewer can read it: the capability that authorizes it, the provider capability that performs it (replaceable), the fact patterns it requires (present or absent), the fact patterns it produces, the consequences it declares, the guards the kernel re-checks, the evidence that would show it happened, its failure states. Patterns bind variables (`?org`) against facts. The registry is extensible: a World, organization or agent adds transitions with `with(...)` and the planner reasons over them unchanged.
- **Goal**: desired fact patterns in a scope the actor must be able to see, plus the variables it fixes. `secure_supply` and `verify_claim` are constructors over the same shape; nothing in the planner knows either.
- **Horizon** (`computeHorizon`): a backward-chaining planner. For each desired fact: facts that already match satisfy it; otherwise every transition producing it is instantiated, its exclusions noted (why a candidate is not a route), its requirements planned recursively (bounded depth, never through the same transition twice), and the result ranked by a versioned policy. Every step carries its performer and the kernel's current decision for them; delegation is inserted by the authority pass for transitions marked delegable. Read-only.
- **Guards** (kernel v4): an action may declare conditions over active relations (`relation.exists` / `relation.absent`, with an attribute subset). They are judged at proposal (a precondition that already fails is not an action; a retry replays first), re-checked right before enactment (a lapsed guard fails the action with its reason), and at settlement an outside effect that landed while its guard lapsed becomes `needs_reconciliation`, never a consequence.
- **Money**: a transition may carry an amount and asset (`supplier.deposit`); the action is proposed with them, so lease budgets and policies decide for the amount, not just the capability. The provider (`lib/causal/money.ts`) is the proven payment router: one payment intent per action, its confirmed record is the evidence, a lost reply leaves the action `needs_reconciliation` with no consequence until the chain marker settles it. The consequence is a `pays` relation carrying the payment id and transaction.
- **Concrete steps**: a recorded route is the plan. When a step is proposed, its payload, consequences and guards are re-derived by its transition from the World at that moment, so what an approver sees is what happens (the quote actually recorded, not the one predicted when the route was planned).
- **Route**: a proposed sequence of transitions with a deterministic id; recorded once when selected, in the selector's own actor scope (a plan belongs to whoever made it; the World's history holds consequences); its actions are keyed to it and its position, so repeats, crashes, reloads and concurrent runs continue instead of duplicating. An agent keeps its own plans only when its creator delegates reading and recording in the agent's scope (`allowPlanning`).
- **Provider**: performs a capability outside the kernel and returns evidence, never truth. Routes name capabilities, not providers; history names which provider performed each action.
- **Pipeline** (`executeStep`): propose with declared consequences → kernel decision (ALLOW / REQUIRE_* / DENY, refusals recorded) → attempt (kernel-native, or provider) → evidence → settle completed / failed / needs_reconciliation → the kernel applies the declared consequences atomically with completion → the next Horizon starts from the changed World. Steps keep causal order; a refused attempt is retried only once the kernel would allow it.
- **Context** (`buildContext`): who, where, what it sees, what it can and cannot do, intent, beliefs with provenance, routes, for any principal, from its own authority. An organization's agent runs the same loop end to end on what its owner delegated (`tests/e2e/organization.test.ts`): nothing in it assumes a person.

## 1. Principals

| Kind | What it is | Accountable party |
|---|---|---|
| `human` | A person, signed in through an identity provider | itself |
| `agent` | Any AI principal: personal avatar, AI companion, World, organization, State, system or engineering agent (`kernel.agent_roles`) | recursive owner chain up to a human or service |
| `service` | An integration or operating service (settlement, payments, verifier) | itself (or the agent principal it acts for) |

- Agents are first-class actors. They hold grants, enact actions, hold budgets and create agents when their authority allows.
- An agent is never the human it represents; provenance always names the executor and whom it acts for.
- Authority, not humanness, controls action. No rule checks "is this a human?" except identity itself (only a signed-in user acts as a human; the service key never does).

## 2. Authority

- **Grant** = capability (`world.entity.write`, `payment.send`, `*`) on a scope (`world:arcadia/room:x`), with optional expiry, issued by a holder or by kernel policy, chained to a parent. A grant is active only while every grant above it is active. A delegated grant never covers more than its issuer holds.
- **Lease** = a grant plus limits (`kernel.grant_limits`): max amount and asset, counterparty, task. A child's limits sit inside its parent's. A limited lease authorizes only where a request names what its limits constrain (`decide`, task transitions, approvals); plain capability checks never see it, so a lease limited to one task cannot be spent elsewhere. Authority limited to a task ends when the task completes, fails or is cancelled.
- **Provenance**: every grant records who granted it, under which parent or policy, for which scope, until when. Authority can come from delegation or from a scope's governance (a World or organization granting its own agents), never from content, prompts or confidence.
- **Policy** (`kernel.action_policies`) attaches a requirement to a capability on a scope. The most specific scope, then the most specific capability, wins.
- **Decision** (`kernel_api.authorize`, deterministic):

| Decision | Meaning |
|---|---|
| `DENY` | no active grant, a lease limit exceeded, or policy denies |
| `ALLOW` | enact now |
| `REQUIRE_SECOND_AUTHORITY` | one more distinct holder of the approver capability must approve |
| `REQUIRE_QUORUM` | N distinct holders must approve |
| `REQUIRE_MULTISIG` | named signers, threshold T |
| `REQUIRE_DELAY` | enactable after a timelock |
| `REQUIRE_CHALLENGE_WINDOW` | enactable after a window in which holders of the challenger capability can stop it |

Distinctness is by accountable party by default, or by actor when a policy says so (agent collectives). The model requests; the policy engine decides. No principal can expand its own authority outside a grant or a governance process the constitution provides.

## 3. Actions (the generic consequence contract)

Every consequential operation is an action with one lifecycle. The settlement worker and the payment router already follow it; they keep their own tables and map onto it.

```
proposed ──approvals / quorum / multisig──▶ authorized ──timelock / challenge window──▶ enacting ──▶ completed
   │                                           │                                         ├──▶ failed
   └──▶ rejected (DENY, challenge, cancel)     └──▶ cancelled                            └──▶ needs_reconciliation ──▶ completed | failed
```

| Contract | Rule |
|---|---|
| Identity | `action_key = sha256('solve:action:v1|' ‖ proposer ‖ '|' ‖ idempotency_key)`; an exact retry returns the same action, a changed payload under the same key is rejected |
| Authority | decided at proposal from grants, leases and policy; re-checked at enactment (revocation stops it) |
| Enactment | kernel-native kinds (agent, grant, policy, World Graph, task) enact atomically inside the kernel; external kinds (message, payment, deployment) record `enacting` before the outside call |
| Evidence | completion of an external action carries evidence; chain/provider observations are `externally_verified` from a service actor |
| Exactly once | an action completes at most once; external enactment uses an outcome marker where the outside world allows (chain markers for settlements and payments) |
| Recovery | unknown outcomes are `needs_reconciliation`, never success or failure by assumption |
| Consequence | every transition is a kernel event; the World Graph changes only through events |

Mapping of the proven slices: settlement `prepared → submitted → confirmed | failed | needs_reconciliation`; payment `routed → submitted → confirmed | failed | needs_reconciliation`, with re-routing only after a definite failure.

## 4. World Graph

| Primitive | Contract |
|---|---|
| Entity | `entity:<uuid>`; kind (`world, place, organization, resource, need, capability, asset, milestone, agreement, offer, document`); governing scope; versioned state (title, summary, attributes, optional location with a location-truth kind, visibility `public / members / private`, importance). Versions are append-only. |
| Relation | `relation:<uuid>` between refs, a kind (`owns, controls, member_of, located_in, supplies, requires, blocks, produces, verifies, represents, assists, offers, needs`), a scope; ended by an event, never deleted. |
| Refs | `actor:<uuid>`, `entity:<uuid>`, `task:<uuid>`, `action:<uuid>`, `event:<uuid>`, `payment:<sha256>`, `settlement:<sha256>`. One canonical id per thing across every lens. |
| Scope | `world:<id>[/room:<id>…]` is the World as a security and semantic container; reads require `kernel.read` on it; private entities need `world.private.read`. |
| Location truth | `declared, device_observed, provider_derived, legal_address, estimated`. Digital entities have no coordinates. |

Lenses (SPACE, PEOPLE, POWER, FLOW, CAUSE, PROOF, TIME, SELF) are projections of entities, relations, events, evidence, grants, actions, payments and settlements. No lens persists its own truth.

### The spatial pipeline

`DOMAIN STATE → AUTHORIZED QUERY (WorldEngine.load, kernel_api as the viewer) → SPATIAL VIEW (lib/world/spatial.ts) → SCENE CONTROLLER (lib/world/scene.ts) → RENDERER (app/world/cesium-scene.ts)`.

- **One entity, many representations.** Markers, selectable lines, selection and deixis all carry the canonical ref; no renderer-specific ids.
- **Real geography only.** A marker exists only for something with a recorded location and its truth. Worlds, Network States, people and payments get no convenient coordinates: they are listed off Earth, and later move into relationship, causal or World space.
- **Authorization before visibility.** The view model is built only from what the viewer's kernel reads return; private records are withheld by the kernel (entities, their events, evidence and proposals), never sent and hidden.
- **Consequence, not decoration.** Marker states (committed, blocked) and one-shot effects (commitment, route stopped, proof closed) derive from kernel records; effects play once per causing event and only for events after the World opened.
- **Semantic zoom.** Bands ORBIT, PLANET, REGION, METRO, SITE (from camera height) and WORLD, ROOM (entered). Labels and representation change by band; identity never does.
- **The camera is not state.** The product calls semantic operations (`focusEntity`, `focusBounds`, `frameRoute`, `teleportTo`, `returnHome`, `enterWorld`, `exitWorld`); only band changes and settled visibility flow back.

## 5. Operational tasks

| Field | Meaning |
|---|---|
| cause_ref, objective, scope | why it exists, what done means, where |
| inputs | what the worker starts from, set by the creator and never by the worker, so a verifier can check the worker against it |
| required_capability | what a worker's lease must cover |
| risk, reversible, budget | consequence profile |
| evidence_bases, verification | `none / distinct_actor / distinct_party` |
| status | `created, ready, claimed, in_progress, blocked, waiting_external, verifying, escalated, completed, failed, needs_reconciliation, cancelled` |

Workers (human or agent) claim with a lease covering the capability. Completion requires the declared evidence and, when verification is required, a verifier that is a different actor or party holding `task.verify`. Task dependencies are World Graph relations between `task:` refs (`blocks, requires, produces, verifies, challenges, replaces, escalates_to`).

**SOV operating SOV** (`lib/ops/`). The first internal loop runs on these primitives with no special path: deterministic code detects an unsettled payment and opens a task (the least-powerful worker for detection); a worker agent claims it under a lease limited to that task, observes the chain and proposes the consequence as a governed action; a verifier agent of a different party re-derives the facts from the task's inputs, the chain and kernel records and authorizes it; the service that owns the capability performs it only for that authorized action and re-checks the chain itself; the verifier confirms the consequence occurred and closes the task. Agents attach their observations as `artifact` evidence; `system_observed` and `externally_verified` stay with service actors.

**Creation loop** (`lib/ops/creation.ts`, Class A only). Proposal → engineering task (cause = the proposal) → builder under a task-limited lease writes in an isolated workspace and proposes `change.promote` with capability `engineering.promote.<class of the actual diff>` → CI service runs it against an Arcadia simulation (system-observed evidence) → reviewer of another party authorizes (policy: second authority holding `engineering.review`) → promotion applies exactly the reviewed hash → observation against the live kernel → reviewer closes. Agents are never granted promotion above Class A.

**Build proposals** (`lib/ops/changes.ts`). Repeated friction becomes an `ops.learning.recorded` event and then an `ops.build_proposal.proposed` event carrying problem, cause, evidence refs, expected outcome, affected paths and capabilities, risk, reuse analysis (compose > extend > create), rollback and status. Its change class (A autonomous, B supervised, C human approval before production, D agents propose only) is computed from what it touches, never claimed; the classifier itself is Class D.

## 6. Avatars

- One identity, many representations: `avatars` (owner, backing agent actor, type `digital_self / ai_companion / abstract`, name, relationship `represent / assist / guide / create_with`), versioned identity seeds, versioned representations (`abstract, pixel, cartoon, stylized_3d, realistic, voice_only`). Changing representation never changes identity, authority, memory or history.
- An avatar acts only through its agent actor's grants. New avatars receive observe/organize-level grants from their owner; messaging, negotiation, transactions and commitments need explicit delegation.

## 7. Truth

Kinds: CLAIM, OBSERVATION, INFERENCE, ESTIMATE, PROOF, COMMITMENT. Evidence bases: `self_reported, witnessed, artifact, system_observed, externally_verified`. Memory informs reasoning and never becomes canonical state without an event. Rendering primitives are never kernel entities.

## 8. Economics

Fixed-supply SOLVE, entitlements only from verified productive consequence, explicit funding sources, ledger conservation, no protocol price (docs/MONETARY-CONSTITUTION.md). Agents may hold budgets (lease limits today; agent accounts next) and pay through the same payment physics as people.
