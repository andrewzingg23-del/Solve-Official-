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
import { respondToQueries, type CapabilityAnswer } from "./counterparty";
import type { Edge, Node, ProofState } from "./types";
import { planVehicleCompany, type RoutePlan } from "./wayfinder";

export type SandboxLike = {
  manifest: ArcadiaManifest;
  you: Kernel;
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

  companionGrants(agentId: string) {
    return this.sb.as(agentId).myGrants();
  }

  authority(agentId: string, capability: string, scope: string): Promise<AuthorityDecision> {
    return this.sb.as(agentId).authorize({ capability, scope });
  }

  // You delegate contact (never commitment) to your companion for a week.
  delegateContact(agentId: string, scope: string) {
    return this.sb.you.issueLease({ grantee: agentId, capability: "message.send", scope, expiresAt: new Date(Date.now() + 7 * 86400_000) });
  }

  // The companion asks an organization's agent a structured capability question; that agent
  // answers from its published record. Both are kernel actions with provenance.
  // The attempt is always a proposal, so a refusal is a kernel record (the World shows the route
  // stop from that record), not a silent client-side check.
  async capabilityQuery(agentId: string, orgRef: string, quantity: number | null, scope: string, model: WorldModel) {
    const orgKey = Object.entries(this.manifest.orgs).find(([, o]) => `entity:${o.entityId}` === orgRef)?.[0];
    if (!orgKey) throw new Error("that organization has no agent in Arcadia");
    const org = this.manifest.orgs[orgKey];
    const node = model.nodes.get(orgRef)!;
    const companion = this.sb.as(agentId);
    const queryId = await companion.proposeAction({
      kind: "message.send",
      capability: "message.send",
      scope,
      targetRef: `actor:${org.agentId}`,
      payload: { type: "CAPABILITY_QUERY", organization: orgRef, capability: "contract_manufacturing", quantity },
    });
    const proposed = await companion.readAction(queryId);
    const decision: AuthorityDecision = { decision: proposed.decision, grant_id: null, policy_id: null, threshold: proposed.threshold, delay_seconds: null, reasons: proposed.reasons };
    if (proposed.decision !== "ALLOW") return { decision, answer: null as CapabilityAnswer | null, queryId };
    await companion.enactAction(queryId);

    const entity: WorldEntity = {
      entity_id: orgRef.slice(7),
      kind: "organization",
      scope: node.scope,
      version: 1,
      title: node.title,
      summary: node.summary,
      attributes: node.attributes,
      latitude: null,
      longitude: null,
      location_truth: null,
      importance: node.importance,
      updated_at: "",
    };
    await respondToQueries(this.sb.as(org.agentId), entity, node.claimEventId, this.manifest.world);
    const reply = (await companion.inbox()).find((m) => m.in_reply_to === queryId);
    return { decision, queryId, answer: (reply?.payload as unknown as CapabilityAnswer) ?? null };
  }

  // A commitment (acceptance of an offer) needs commitment.make. The companion is denied unless
  // it was delegated; the person can commit with their own authority.
  async commitDecision(agentId: string, scope: string) {
    return this.authority(agentId, "commitment.make", scope);
  }

  async commitAsYou(orgRef: string, scope: string, terms: Record<string, unknown>) {
    const org = Object.values(this.manifest.orgs).find((o) => `entity:${o.entityId}` === orgRef);
    if (!org) throw new Error("unknown organization");
    const id = await this.sb.you.proposeAction({
      kind: "message.send",
      capability: "commitment.make",
      scope,
      targetRef: `actor:${org.agentId}`,
      payload: { type: "ACCEPTANCE", organization: orgRef, ...terms },
    });
    await this.sb.you.enactAction(id);
    // The consequence in the World Graph: the organization now supplies your World, on these terms.
    const world = (await this.sb.you.readWorld(scope)).find((e) => e.kind === "world");
    if (world) {
      await this.sb.you.relate({ kind: "supplies", fromRef: orgRef, toRef: `entity:${world.entity_id}`, scope, attributes: { status: "agreed", acceptance: `action:${id}`, ...terms } });
    }
    return id;
  }
}
