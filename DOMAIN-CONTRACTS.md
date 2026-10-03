# DOMAIN-CONTRACTS

The canonical primitives every surface builds on. One canonical graph, one action physics, one authority model. Map, Horizon, avatars, payments, tasks, organizations and Network States are projections of these, never parallel models. Changes here are kernel changes: new migration, tests, and an entry in DECISIONS.md.

Governing loop (any principal can run it, human or agent):

```
INTENT → AUTHORITY → DECISION → ENACTMENT → EVIDENCE → CONSEQUENCE → EVENT → UPDATED STATE
```

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

**Build proposals** (`lib/ops/changes.ts`). Repeated friction becomes an `ops.learning.recorded` event and then an `ops.build_proposal.proposed` event carrying problem, cause, evidence refs, expected outcome, affected paths and capabilities, risk, reuse analysis (compose > extend > create), rollback and status. Its change class (A autonomous, B supervised, C human approval before production, D agents propose only) is computed from what it touches, never claimed; the classifier itself is Class D.

## 6. Avatars

- One identity, many representations: `avatars` (owner, backing agent actor, type `digital_self / ai_companion / abstract`, name, relationship `represent / assist / guide / create_with`), versioned identity seeds, versioned representations (`abstract, pixel, cartoon, stylized_3d, realistic, voice_only`). Changing representation never changes identity, authority, memory or history.
- An avatar acts only through its agent actor's grants. New avatars receive observe/organize-level grants from their owner; messaging, negotiation, transactions and commitments need explicit delegation.

## 7. Truth

Kinds: CLAIM, OBSERVATION, INFERENCE, ESTIMATE, PROOF, COMMITMENT. Evidence bases: `self_reported, witnessed, artifact, system_observed, externally_verified`. Memory informs reasoning and never becomes canonical state without an event. Rendering primitives are never kernel entities.

## 8. Economics

Fixed-supply SOLVE, entitlements only from verified productive consequence, explicit funding sources, ledger conservation, no protocol price (docs/MONETARY-CONSTITUTION.md). Agents may hold budgets (lease limits today; agent accounts next) and pay through the same payment physics as people.
