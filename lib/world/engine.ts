// The World engine: loads the World Graph from the kernel into one view model and runs the
// interactions that change it. Every change is a kernel call under the caller's own authority;
// nothing here keeps state the kernel does not have.
import type {
  ActorProfile,
  Avatar,
  AvatarRelationship,
  AvatarType,
  AuthorityDecision,
  Entitlement,
  InboxMessage,
  Kernel,
  KernelEvent,
  Payment,
  RepresentationKind,
  Task,
  WorldEntity,
  WorldRelation,
} from "../kernel/client";
import type { ArcadiaManifest } from "../sandbox/manifest";
import { loadOperations, type OperationsView } from "./operations";
import { computeHorizon, TRANSITIONS, type HorizonInput } from "../causal/horizon";
import { executeStep, recordRoute, type RecordedRoute } from "../causal/pipeline";
import { arcadiaProviders, type Providers } from "../causal/providers";
import type { Fact, Goal, Horizon, StepOutcome } from "../causal/types";
import { loadWorld, type WorldState } from "../causal/world";
import type { Edge, Node, ProofState } from "./types";
import { planVehicleCompany, type RoutePlan } from "./wayfinder";

export type SandboxLike = {
  manifest: ArcadiaManifest;
  you: Kernel;
  steward?: Kernel;
  as(actorId: string): Kernel;
};

export type PaymentLeg = {
  venue: string;
  kind: string;
  operator: string;
  input: string;
  output: string;
  amountIn: string;
  amountOut: string;
  tradingFee: string;
  providerFee: string;
};

export type PaymentView = Payment & {
  legs: PaymentLeg[];
  costs: Record<string, string> | null;
  quotedAt: string | null;
};

export type Venture = {
  scope: string;
  worldRef: string;
  milestones: Node[];
  needs: Node[];
  tasks: Task[];
};

export type WorldModel = {
  nodes: Map<string, Node>;
  edges: Edge[];
  actors: Map<string, ActorProfile>;
  venture: Venture | null;
  payment: PaymentView | null;
  settlement: Entitlement | null;
  avatars: Avatar[];
  companionInbox: InboxMessage[];
  events: KernelEvent[];
  loadedAt: string;
};

export type ProofStep = {
  title: string;
  detail: string;
  evidence: { basis: string; description: string; content_hash: string }[];
  at: string | null;
};

export type ProofDetail = { kind: "claim" | "settlement" | "payment" | "none"; steps: ProofStep[] };

const PROOF_TITLES: Record<string, string> = {
  "obligation.created": "Obligation",
  "outcome.completed": "Outcome and evidence",
  "kernel.entitlement.created": "Entitlement",
  "kernel.settlement.prepared": "Authorization to settle",
};

function summarize(e: KernelEvent) {
  const p = e.payload as Record<string, unknown>;
  if (e.type === "obligation.created") return String(p.title ?? "");
  if (e.type === "outcome.completed") return String(p.summary ?? "");
  if (e.type === "kernel.entitlement.created") return `${Number(p.amount) / 1e9} DEV-SOLVE under policy ${p.policy_key}`;
  if (e.type === "kernel.settlement.prepared") return `to wallet ${String(p.recipient_address ?? "").slice(0, 8)}…`;
  return "";
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export function nodeFromEntity(e: WorldEntity, proof: ProofState = "none", claimEventId: string | null = null): Node {
  const lat = num(e.latitude);
  const lon = num(e.longitude);
  return {
    ref: `entity:${e.entity_id}`,
    kind: e.kind,
    title: e.title,
    summary: e.summary,
    scope: e.scope,
    attributes: e.attributes ?? {},
    location: lat !== null && lon !== null && e.location_truth ? { latitude: lat, longitude: lon, truth: e.location_truth } : null,
    importance: e.importance,
    proof,
    claimEventId,
  };
}

export const avatarAgent = (model: WorldModel, type: AvatarType = "ai_companion") => model.avatars.find((a) => a.avatar_type === type) ?? null;

export class WorldEngine {
  constructor(readonly sb: SandboxLike) {}

  get manifest() {
    return this.sb.manifest;
  }

  // Proof state of each organization's capability claim, from the kernel's evidence.
  private async claims(events: KernelEvent[]) {
    const challenged = new Set(
      events.filter((e) => e.type === "claim.challenge").map((e) => String((e.payload as { claim_event_id?: string }).claim_event_id)),
    );
    const byOrg = new Map<string, { proof: ProofState; eventId: string }>();
    for (const e of events.filter((x) => x.type === "claim.capability")) {
      const org = String((e.payload as { organization?: string }).organization);
      let proof: ProofState = "self_reported";
      if (challenged.has(e.id)) proof = "challenged";
      else if ((await this.sb.you.readEvidence(e.id)).some((ev) => ev.basis === "externally_verified")) proof = "verified";
      byOrg.set(org, { proof, eventId: e.id });
    }
    return byOrg;
  }

  async load(): Promise<WorldModel> {
    const { you, manifest } = this.sb;
    const nodes = new Map<string, Node>();
    const edges: Edge[] = [];

    const marketEvents = await you.readEvents(manifest.world, { limit: 500 });
    const claims = await this.claims(marketEvents);
    for (const e of await you.publicWorld()) {
      const ref = `entity:${e.entity_id}`;
      const claim = claims.get(ref);
      nodes.set(ref, nodeFromEntity(e, claim?.proof ?? "none", claim?.eventId ?? null));
    }
    const relations: WorldRelation[] = await you.readRelations(manifest.world);

    let venture: Venture | null = null;
    const grants = await you.myGrants();
    const ventureScope = grants.find((g) => g.capability === "*" && g.scope.startsWith("world:venture-"))?.scope ?? null;
    if (ventureScope) {
      const entities = await you.readWorld(ventureScope);
      for (const e of entities) nodes.set(`entity:${e.entity_id}`, nodeFromEntity(e));
      relations.push(...(await you.readRelations(ventureScope)));
      const world = entities.find((e) => e.kind === "world");
      venture = {
        scope: ventureScope,
        worldRef: world ? `entity:${world.entity_id}` : "",
        milestones: entities.filter((e) => e.kind === "milestone").map((e) => nodeFromEntity(e)).sort((a, b) => Number(a.attributes.order) - Number(b.attributes.order)),
        needs: entities.filter((e) => e.kind === "need").map((e) => nodeFromEntity(e)),
        tasks: await you.readTasks(ventureScope),
      };
    }
    for (const r of relations) edges.push({ id: r.relation_id, kind: r.kind, from: r.from_ref, to: r.to_ref, scope: r.scope, attributes: r.attributes });

    const avatars = await you.myAvatars();
    const actorIds = new Set<string>([manifest.you.actorId, manifest.bob.actorId, ...avatars.map((a) => a.agent_id)]);
    for (const e of edges) for (const ref of [e.from, e.to]) if (ref.startsWith("actor:")) actorIds.add(ref.slice(6));
    for (const o of Object.values(manifest.orgs)) {
      actorIds.add(o.ownerId);
      actorIds.add(o.agentId);
    }
    const actors = new Map((await you.readActors([...actorIds])).map((a) => [a.actor_id, a]));
    for (const a of actors.values()) {
      nodes.set(`actor:${a.actor_id}`, {
        ref: `actor:${a.actor_id}`,
        kind: "actor",
        title: a.label || (a.kind === "agent" ? "Agent" : "Person"),
        summary: a.role ? a.role.replace(/_/g, " ") : a.kind,
        scope: `actor:${a.actor_id}`,
        attributes: { kind: a.kind, role: a.role, owner_id: a.owner_id },
        location: null,
        importance: a.actor_id === manifest.you.actorId ? 100 : 40,
        proof: "none",
        claimEventId: null,
      });
    }

    const payment = await this.payment();
    if (payment) {
      nodes.set(`payment:${payment.payment_id}`, {
        ref: `payment:${payment.payment_id}`,
        kind: "payment",
        title: "Payment to Bob",
        summary: payment.memo,
        scope: `actor:${manifest.you.actorId}`,
        attributes: {},
        location: null,
        importance: 50,
        proof: payment.status === "confirmed" ? "verified" : "none",
        claimEventId: null,
      });
    }
    const [settlement] = await you.myEntitlements();
    if (settlement) {
      nodes.set(`settlement:${settlement.settlement_id}`, {
        ref: `settlement:${settlement.settlement_id}`,
        kind: "settlement",
        title: "Earn Vault release",
        summary: "DEV-SOLVE released for verified work",
        scope: settlement.world_scope,
        attributes: {},
        location: null,
        importance: 50,
        proof: settlement.status === "confirmed" ? "verified" : "none",
        claimEventId: null,
      });
    }

    const companion = avatars.find((a) => a.avatar_type === "ai_companion");
    const companionInbox = companion ? await this.sb.as(companion.agent_id).inbox() : [];
    const events = [
      ...(await you.readEvents(`actor:${manifest.you.actorId}`, { limit: 100, newestFirst: true })),
      ...(ventureScope ? await you.readEvents(ventureScope, { limit: 100, newestFirst: true }) : []),
    ].sort((a, b) => b.seq - a.seq);

    return { nodes, edges, actors, venture, payment, settlement: settlement ?? null, avatars, companionInbox, events, loadedAt: new Date().toISOString() };
  }

  private async payment(): Promise<PaymentView | null> {
    const { you, manifest } = this.sb;
    try {
      const payment = await you.readPayment(manifest.you.paymentId);
      const routed = (await you.readEvents(`actor:${manifest.you.actorId}`, { limit: 200 })).filter(
        (e) => e.type === "kernel.payment.routed" && (e.payload as { payment_id?: string }).payment_id === payment.payment_id,
      );
      const last = routed.at(-1)?.payload as { route?: { route?: { legs?: PaymentLeg[]; costs?: Record<string, string> }; quoted_at?: string } } | undefined;
      return { ...payment, legs: last?.route?.route?.legs ?? [], costs: last?.route?.route?.costs ?? null, quotedAt: last?.route?.quoted_at ?? null };
    } catch {
      return null;
    }
  }

  async createAvatar(input: { type: AvatarType; name: string; relationship: AvatarRelationship; seed: Record<string, unknown>; representation: RepresentationKind }) {
    return this.sb.you.createAvatar(input);
  }

  // Turns a vehicle-company intent into a World: milestones, needs and a causal route, each a
  // kernel event in a scope the person owns.
  async buildVenture(objective: string, leastCapital: boolean, model: WorldModel): Promise<{ scope: string; plan: RoutePlan }> {
    const { you, manifest } = this.sb;
    const plan = planVehicleCompany(objective, leastCapital);
    const scope = `world:venture-${crypto.randomUUID().slice(0, 8)}`;
    await you.claimScope(scope);
    // From the kernel, not the caller's possibly stale model: the companion may have just been made.
    const companion = (await you.myAvatars()).find((a) => a.avatar_type === "ai_companion") ?? null;
    if (companion) await this.assist(companion.agent_id, scope);

    // A venture is a World, not a place: it gets no coordinates until it has a real site.
    const world = await you.upsertEntity({
      kind: "world",
      scope,
      title: "Your car company",
      summary: plan.title,
      attributes: {
        objective,
        strategy: plan.strategy,
        capital_usd: plan.capitalUsd,
        alternative: plan.alternative,
        truth: "estimate",
        source: plan.source,
        explanation: plan.explanation,
      },
      visibility: "members",
      importance: 90,
    });
    const milestoneIds: string[] = [];
    for (const m of plan.milestones) {
      const id = await you.upsertEntity({
        kind: "milestone",
        scope,
        title: m.title,
        summary: m.summary,
        attributes: { key: m.key, order: m.order, status: m.status, capital_usd: m.capitalUsd, needs: m.needs, truth: "estimate" },
        importance: 70,
      });
      await you.relate({ kind: "part_of", fromRef: `entity:${id}`, toRef: `entity:${world}`, scope });
      if (milestoneIds.length) await you.relate({ kind: "requires", fromRef: `entity:${id}`, toRef: `entity:${milestoneIds.at(-1)}`, scope });
      milestoneIds.push(id);
    }
    const needIds = new Map<string, string>();
    for (const key of plan.missing) {
      const capability = manifest.capabilities[key];
      const capabilityTitle = model.nodes.get(`entity:${capability}`)?.title ?? key;
      const id = await you.upsertEntity({
        kind: "need",
        scope,
        title: capabilityTitle,
        summary: `A capability your route needs and you do not have.`,
        attributes: { capability: key },
        importance: 75,
      });
      needIds.set(key, id);
      if (capability) await you.relate({ kind: "requires", fromRef: `entity:${id}`, toRef: `entity:${capability}`, scope });
    }
    for (const [i, m] of plan.milestones.entries()) {
      for (const key of m.needs) await you.relate({ kind: "needs", fromRef: `entity:${milestoneIds[i]}`, toRef: `entity:${needIds.get(key)}`, scope });
    }
    const manufacturing = needIds.get("contract_manufacturing") ?? needIds.values().next().value;
    if (manufacturing) {
      await you.createTask({
        scope,
        title: "Find a manufacturing partner",
        objective: "Shortlist partners who can build the first 10,000 vehicles, with proof of capacity.",
        requiredCapability: "task.work.sourcing",
        causeRef: `entity:${manufacturing}`,
        evidenceBases: ["artifact"],
        verification: "none",
      });
    }
    return { scope, plan };
  }

  // Organizations offering the capabilities, verified claims first.
  discover(model: WorldModel, capabilities: string[]) {
    const rank: Record<ProofState, number> = { verified: 0, self_reported: 1, none: 2, challenged: 3 };
    return [...model.nodes.values()]
      .filter((n) => n.kind === "organization" && ((n.attributes.capabilities as string[]) ?? []).some((c) => capabilities.includes(c)))
      .sort((a, b) => rank[a.proof] - rank[b.proof] || b.importance - a.importance)
      .map((n) => n.ref);
  }

  // Evidence behind a claim, a settlement or a payment, read from the kernel.
  async proofOf(ref: string, model: WorldModel): Promise<ProofDetail> {
    const { you, manifest } = this.sb;
    const node = model.nodes.get(ref);
    if (node?.kind === "organization" && node.claimEventId) {
      const events = await you.readEvents(manifest.world, { limit: 500 });
      const claim = events.find((e) => e.id === node.claimEventId) ?? null;
      const challenge = events.find((e) => e.type === "claim.challenge" && (e.payload as { claim_event_id?: string }).claim_event_id === node.claimEventId) ?? null;
      return {
        kind: "claim",
        steps: [
          { title: "Claim", detail: String((claim?.payload as { statement?: string })?.statement ?? ""), evidence: await you.readEvidence(node.claimEventId), at: claim?.occurred_at ?? null },
          ...(challenge
            ? [{ title: "Challenge", detail: String((challenge.payload as { finding?: string }).finding ?? ""), evidence: await you.readEvidence(challenge.id), at: challenge.occurred_at }]
            : []),
          ...(await this.agreementSteps(ref, model)),
        ],
      };
    }
    if (ref.startsWith("settlement:") && model.settlement) {
      const events = await you.readEvents(model.settlement.world_scope, { limit: 100 });
      const steps = [];
      for (const e of events.filter((x) => ["obligation.created", "outcome.completed", "kernel.entitlement.created", "kernel.settlement.prepared"].includes(x.type))) {
        steps.push({ title: PROOF_TITLES[e.type] ?? e.type, detail: summarize(e), evidence: await you.readEvidence(e.id), at: e.occurred_at });
      }
      steps.push({
        title: "Settlement",
        detail: `${model.settlement.status} on ${model.settlement.chain}; transaction ${model.settlement.tx_signature ?? "pending"}`,
        evidence: [],
        at: null,
      });
      return { kind: "settlement", steps };
    }
    if (ref.startsWith("payment:") && model.payment) {
      const p = model.payment;
      return {
        kind: "payment",
        steps: [
          { title: "Intent", detail: `Pay Bob ${Number(p.amount) / 1e6} ${p.asset.replace("_", "-")} at his published address`, evidence: [], at: p.created_at },
          { title: "Route", detail: `${p.legs.map((l) => l.venue).join(" → ") || "direct transfer"}, quoted ${p.quotedAt ?? ""}`, evidence: [], at: p.quotedAt },
          { title: "Execution", detail: `${p.status}; transaction ${p.tx_signature ?? "pending"}`, evidence: [], at: null },
        ],
      };
    }
    return { kind: "none", steps: [] };
  }

  // What an assisting companion may do in a World you build together, as recorded grants: see the
  // World and the market it draws on, and record what it finds into the World. Contacting anyone
  // and committing to anything stay with you until you delegate them.
  async assist(agentId: string, scope: string) {
    const { you, manifest } = this.sb;
    await you.issueGrant({ grantee: agentId, capability: "kernel.read", scope, idempotencyKey: `assist:read:${agentId}:${scope}` });
    await you.issueGrant({ grantee: agentId, capability: "world.relation.write", scope, idempotencyKey: `assist:record:${agentId}:${scope}` });
    await you.issueGrant({ grantee: agentId, capability: "kernel.read", scope: manifest.world, idempotencyKey: `assist:market:${agentId}` });
  }

  // SOV's own operations, as the steward reads them. Null where no steward runs on this device.
  operations(): Promise<OperationsView> | null {
    return this.sb.steward ? loadOperations(this.sb.steward) : null;
  }

  // The consequence, inspectable: the offer as the organization's agent gave it, your acceptance
  // with the kernel's decision, and the agreement it wrote into the World Graph.
  private async agreementSteps(orgRef: string, model: WorldModel): Promise<ProofStep[]> {
    const edge = model.edges.find((e) => e.kind === "supplies" && e.from === orgRef && e.attributes.status === "agreed");
    if (!edge) return [];
    const org = model.nodes.get(orgRef)?.title ?? "The organization";
    const steps: ProofStep[] = [];
    const reply = model.companionInbox.find((m) => (m.payload as { organization?: string }).organization === orgRef);
    if (reply) {
      const p = reply.payload as { capacity_per_year?: number; lead_time_days?: number; unit_price_usd?: number };
      steps.push({
        title: "Offer",
        detail: `${org}'s agent answered for its principal: ${p.capacity_per_year?.toLocaleString("en-US")} a year, ${p.lead_time_days} days lead time, $${p.unit_price_usd?.toLocaleString("en-US")} a unit.`,
        evidence: [],
        at: reply.delivered_at,
      });
    }
    // The kernel stamps every declared consequence with the action that caused it.
    const actionId = String(edge.attributes.action ?? "").replace(/^action:/, "");
    if (actionId) {
      const action = await this.sb.you.readAction(actionId);
      steps.push({
        title: "Acceptance",
        detail: `You accepted under your own authority (${action.capability}). The kernel decided ${action.decision}; the action is ${action.status}.`,
        evidence: [],
        at: action.created_at,
      });
    }
    const world = model.nodes.get(edge.to)?.title ?? "your World";
    const terms = edge.attributes as { quantity?: number; unit_price_usd?: number };
    steps.push({ title: "Agreement", detail: `${org} supplies ${world}: ${terms.quantity?.toLocaleString("en-US") ?? "?"} vehicles at $${terms.unit_price_usd?.toLocaleString("en-US") ?? "?"} a unit.`, evidence: [], at: null });
    return steps;
  }

  companionGrants(agentId: string) {
    return this.sb.as(agentId).myGrants();
  }

  authority(agentId: string, capability: string, scope: string): Promise<AuthorityDecision> {
    return this.sb.as(agentId).authorize({ capability, scope });
  }

  // Read-only: whether the companion may commit here (it may not, unless delegated).
  commitDecision(agentId: string, scope: string) {
    return this.authority(agentId, "commitment.make", scope);
  }

  // The causal loop on this sandbox. Every change below runs through lib/causal: Horizon plans
  // from the World as the acting principal sees it, the selection is recorded, and each step goes
  // through the one pipeline (kernel decision, provider evidence, atomic consequence).
  private providerSet: Providers | null = null;
  providers() {
    const orgs = Object.values(this.manifest.orgs);
    this.providerSet ??= arcadiaProviders({
      agentFor: (ref) => orgs.find((o) => `entity:${o.entityId}` === ref)?.agentId ?? null,
      claimEventFor: (ref) => orgs.find((o) => `entity:${o.entityId}` === ref)?.claimEventId ?? null,
      as: (id) => this.sb.as(id),
      replyScope: this.manifest.world,
    });
    return this.providerSet;
  }

  kernelFor(actorId: string) {
    return actorId === this.manifest.you.actorId ? this.sb.you : this.sb.as(actorId);
  }

  supplyGoal(model: WorldModel, quantity: number | null = 10000, capability = "contract_manufacturing"): Goal | null {
    return model.venture?.worldRef ? { kind: "secure_supply", world: model.venture.worldRef, capability, quantity } : null;
  }

  async horizon(actorId: string, goal: Goal, fallback?: HorizonInput["fallback"], world?: WorldState): Promise<Horizon> {
    const you = this.manifest.you.actorId;
    const seen = world ?? (await loadWorld(this.kernelFor(actorId), actorId));
    return computeHorizon({ world: seen, actorId, principalId: actorId === you ? null : you, goal, kernelFor: (id) => this.kernelFor(id), providers: this.providers(), fallback });
  }

  // The route through one organization, as the actor would take it now, recorded as your selection.
  async plan(orgRef: string, goal: Goal, actorId: string, fallback?: HorizonInput["fallback"]) {
    const world = await loadWorld(this.kernelFor(actorId), actorId);
    const horizon = await this.horizon(actorId, goal, fallback, world);
    const route = horizon.routes.find((r) => r.orgRef === orgRef) ?? null;
    const excluded = horizon.excluded.find((e) => e.orgRef === orgRef)?.reasons ?? null;
    const recorded = route ? await recordRoute(this.sb.you, route) : null;
    return { horizon, route, recorded, excluded, world };
  }

  // Runs one step. The provider reads the World only for the entities it addresses, so the World
  // the plan was made from serves when the same actor performs it.
  async perform(recorded: RecordedRoute, transition: string, world?: WorldState): Promise<StepOutcome | null> {
    const index = recorded.steps.findIndex((s) => s.transition === transition);
    if (index < 0) return null;
    const actor = recorded.steps[index].actorId;
    const seen = world && world.actorId === actor ? world : await loadWorld(this.kernelFor(actor), actor);
    return executeStep({ kernelFor: (id) => this.kernelFor(id), providers: this.providers(), world: seen }, recorded, index);
  }

  async quote(orgRef: string, worldRef: string): Promise<Fact | null> {
    const world = await loadWorld(this.sb.you, this.manifest.you.actorId);
    return world.facts.find((f) => f.subject === orgRef && f.predicate === "offers:quoted" && f.object === worldRef) ?? null;
  }

  // "Can they make N?": the companion asks on its own authority, because it was told to. If it may
  // not, the kernel refuses and the refusal is history.
  async ask(orgRef: string, quantity: number | null, model: WorldModel, agentId: string) {
    const goal = this.supplyGoal(model, quantity)!;
    const plan = await this.plan(orgRef, goal, agentId, "none");
    if (plan.horizon.satisfied) return { ...plan, outcome: null, quote: await this.quote(orgRef, goal.world) };
    const outcome = plan.recorded ? await this.perform(plan.recorded, TRANSITIONS.inquire.id, plan.world) : null;
    return { ...plan, outcome, quote: await this.quote(orgRef, goal.world) };
  }

  // "You may contact suppliers": the delegation step of the companion's planned route.
  async allowContact(model: WorldModel, agentId: string, orgRef?: string) {
    const goal = this.supplyGoal(model)!;
    const horizon = await this.horizon(agentId, goal);
    const route = horizon.routes.find((r) => (orgRef ? r.orgRef === orgRef : true) && r.steps.some((s) => s.transition === TRANSITIONS.delegate.id));
    if (!route) return null;
    return this.perform(await recordRoute(this.sb.you, route), TRANSITIONS.delegate.id);
  }

  // "Accept as you": the acceptance step, performed with your authority; its declared consequence
  // (the supply agreement) lands with it.
  async acceptAsYou(orgRef: string, model: WorldModel, agentId: string) {
    const goal = this.supplyGoal(model)!;
    const plan = await this.plan(orgRef, goal, agentId, "principal");
    const outcome = plan.recorded ? await this.perform(plan.recorded, TRANSITIONS.accept.id, plan.world) : null;
    return { ...plan, outcome };
  }
}
