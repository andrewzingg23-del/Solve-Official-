// Canonical reality as one actor may see it. Everything here comes from that actor's own kernel
// reads, so authorization happens before visibility: an agent with no read on a World does not
// receive that World and then get told it cannot act on it; it never sees it. Nothing here is
// stored: it is a projection of kernel state, rebuilt on every load.
import { KernelError, type ActionSummary, type InboxMessage, type Kernel, type KernelEvent, type WorldEntity, type WorldRelation } from "../kernel/client";
import type { Fact, TruthStatus } from "./types";

export type WorldState = {
  actorId: string;
  // World scopes this actor may read, from its own grants.
  scopes: string[];
  entities: Map<string, WorldEntity>;
  relations: WorldRelation[];
  actions: ActionSummary[];
  events: KernelEvent[];
  // Messages delivered to this actor: what others asked of it.
  messages: InboxMessage[];
  facts: Fact[];
  // Highest event sequence seen: what this view is current to.
  watermark: number;
};

const readsAll = (capability: string) => capability === "*" || capability === "kernel.read" || capability === "kernel.*";

async function readableScopes(k: Kernel) {
  const scopes = new Set<string>();
  for (const g of await k.myGrants()) {
    if (readsAll(g.capability) && g.scope.startsWith("world:")) scopes.add(g.scope);
  }
  return [...scopes].sort();
}

const empty = () => ({ events: [] as string[], actions: [] as string[], evidence: [] as string[], by: null as string | null });

// Truth from provenance. A relation written by an action's declared consequence was reconciled by
// that action's evidence; a claim is verified, disputed or merely asserted by its evidence; an open
// action is authorized or attempted, never yet true.
function derive(entities: Map<string, WorldEntity>, relations: WorldRelation[], actions: ActionSummary[], events: KernelEvent[], messages: InboxMessage[], verified: Set<string>): Fact[] {
  const facts: Fact[] = [];
  const challenged = new Set(events.filter((e) => e.type === "claim.challenge").map((e) => String(e.payload.claim_event_id)));
  for (const e of events.filter((x) => x.type === "claim.capability")) {
    const org = String(e.payload.organization);
    const status: TruthStatus = challenged.has(e.id) ? "disputed" : verified.has(e.id) ? "verified" : "asserted";
    facts.push({ subject: org, predicate: "claims", object: null, value: { statement: e.payload.statement, ...(e.payload.attributes as object) }, status, provenance: { ...empty(), events: [e.id], by: e.actor_id } });
  }
  for (const r of relations) {
    const action = typeof r.attributes.action === "string" ? r.attributes.action.slice("action:".length) : null;
    facts.push({
      subject: r.from_ref,
      predicate: r.attributes.status ? `${r.kind}:${String(r.attributes.status)}` : r.kind,
      object: r.to_ref,
      value: r.attributes,
      status: action ? "reconciled" : "asserted",
      provenance: { ...empty(), actions: action ? [action] : [] },
    });
  }
  for (const a of actions) {
    if (a.status === "authorized" || a.status === "proposed" || a.status === "enacting" || a.status === "needs_reconciliation") {
      facts.push({ subject: `action:${a.action_id}`, predicate: a.kind, object: a.target_ref, value: a.payload, status: a.status === "enacting" || a.status === "needs_reconciliation" ? "attempted" : "authorized", provenance: { ...empty(), actions: [a.action_id], by: a.proposer_id } });
    }
  }
  for (const e of entities.values()) {
    if (e.kind === "need") facts.push({ subject: `entity:${e.entity_id}`, predicate: "needs", object: null, value: e.attributes, status: "asserted", provenance: empty() });
  }
  // An inquiry delivered to this actor is an observed fact about the organization it concerns; it
  // is answered when a completed reply to it exists in a scope this actor reads.
  for (const m of messages.filter((x) => x.message_type === "CAPABILITY_QUERY" && typeof x.payload.organization === "string")) {
    const reply = actions.find((a) => a.kind === "message.send" && a.in_reply_to === m.action_id && a.status === "completed") ?? null;
    facts.push({
      subject: `action:${m.action_id}`,
      predicate: reply ? "inquiry:answered" : "inquiry:open",
      object: String(m.payload.organization),
      value: {
        from: `actor:${m.sender_id}`,
        on_behalf_of: m.on_behalf_of ? `actor:${m.on_behalf_of}` : null,
        capability: m.payload.capability ?? null,
        quantity: typeof m.payload.quantity === "number" ? m.payload.quantity : null,
        reply: reply ? `action:${reply.action_id}` : null,
      },
      status: "observed",
      provenance: { ...empty(), actions: reply ? [m.action_id, reply.action_id] : [m.action_id], by: m.sender_id },
    });
  }
  return facts;
}

export async function loadWorld(k: Kernel, actorId: string): Promise<WorldState> {
  const scopes = await readableScopes(k);
  const entities = new Map<string, WorldEntity>();
  for (const e of await k.publicWorld()) entities.set(`entity:${e.entity_id}`, e);
  const relations: WorldRelation[] = [];
  const actions: ActionSummary[] = [];
  const events: KernelEvent[] = [];
  for (const scope of scopes) {
    for (const e of await k.readWorld(scope)) entities.set(`entity:${e.entity_id}`, e);
    relations.push(...(await k.readRelations(scope)));
    actions.push(...(await k.readActions(scope, 500)));
    events.push(...(await k.readEvents(scope, { limit: 500 })));
  }
  // What was asked of this actor. A session that is nobody in particular has no inbox.
  let messages: InboxMessage[] = [];
  try {
    messages = await k.inbox();
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
  }
  const verified = new Set<string>();
  for (const e of events.filter((x) => x.type === "claim.capability")) {
    if ((await k.readEvidence(e.id)).some((ev) => ev.basis === "externally_verified")) verified.add(e.id);
  }
  const dedupe = <T>(items: T[], key: (t: T) => string) => [...new Map(items.map((i) => [key(i), i])).values()];
  const rel = dedupe(relations, (r) => r.relation_id);
  const acts = dedupe(actions, (a) => a.action_id);
  const evs = dedupe(events, (e) => e.id).sort((a, b) => a.seq - b.seq);
  return {
    actorId,
    scopes,
    entities,
    relations: rel,
    actions: acts,
    events: evs,
    messages,
    facts: derive(entities, rel, acts, evs, messages, verified),
    watermark: evs.reduce((max, e) => Math.max(max, e.seq), 0),
  };
}

export const factsAbout = (world: WorldState, ref: string) => world.facts.filter((f) => f.subject === ref || f.object === ref);
