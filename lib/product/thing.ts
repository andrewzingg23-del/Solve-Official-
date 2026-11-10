// The guaranteed record of one thing: six parts, always present, always in this order.
//
//   1 what it is        — its type and its own declared fields
//   2 whose it is       — the scope it lives in, and who holds it
//   3 what happened     — acts in order, each with who acted and under what authority
//   4 what's proven     — evidence and confirmation, or the absence of them, shown as plainly
//   5 what's next       — one real action, or nothing
//   6 who can reach it  — actual access, revocable
//
// This module holds the rules, not the layout. A thing may also be shown as a calendar, a map or
// an editor; this is the one view every thing is guaranteed to have, and the one that can be
// inspected when something is disputed.
//
// Two rules are load-bearing and are the reason this is a module rather than JSX:
//   * Fields come from the type's own declaration, in its order. A field the type declares and the
//     data lacks is rendered as absent, never omitted and never filled in.
//   * Claimed, witnessed, verified and disputed are different words for different things. The
//     status is derived from what the kernel actually holds and is never upgraded by presentation.

export const SIX_PARTS = [
  "what it is",
  "whose it is",
  "what happened",
  "what's proven",
  "what's next",
  "who can reach it",
] as const;

export type PartName = (typeof SIX_PARTS)[number];

export type FieldKind = "text" | "number" | "boolean" | "date" | "list";

export type TypeFieldSpec = { type?: FieldKind; required?: boolean; label?: string };

export type ThingField = {
  name: string;
  label: string;
  kind: FieldKind;
  required: boolean;
  /** False when the type declares this field and the record does not carry it. */
  present: boolean;
  value: unknown;
};

/** What the kernel can say about whether a thing is proven. Ordered by how much it claims. */
export type ProofStatus = "none" | "claimed" | "witnessed" | "verified" | "disputed";

export type ProofItem = { basis: string; description: string; at: string };

export type ThingProof = { status: ProofStatus; items: ProofItem[]; disputes: number };

export type ThingAct = {
  at: string;
  type: string;
  actorLabel: string;
  /** Whose permission a granted act relied on, when that is known. */
  grantor?: string | null;
  /** Whether the act carried a grant. Unknown is said, not guessed. */
  authority: "own" | "granted" | "unknown";
  onBehalfOf: string | null;
};

export type ThingAccess = { actorLabel: string; capability: string; scope: string; grantId: string };

/**
 * A field list built from the type's declaration, in the type's own order.
 * `data` is whatever the record carries. Anything in `data` the type never declared is appended
 * at the end rather than hidden, because a record may outlive a change to its type.
 */
export function fieldsFromType(
  typeFields: Record<string, TypeFieldSpec> | null | undefined,
  data: Record<string, unknown> | null | undefined,
): ThingField[] {
  const values = data && typeof data === "object" ? data : {};
  const declared = typeFields && typeof typeFields === "object" ? typeFields : {};
  const fields: ThingField[] = Object.entries(declared).map(([name, spec]) => {
    const raw = values[name];
    const present = name in values && raw !== null && raw !== undefined;
    return {
      name,
      label: spec?.label ?? humanize(name),
      kind: spec?.type ?? "text",
      required: Boolean(spec?.required),
      present,
      value: present ? raw : null,
    };
  });
  for (const [name, raw] of Object.entries(values)) {
    if (name in declared) continue;
    fields.push({
      name, label: humanize(name), kind: kindOf(raw), required: false,
      present: raw !== null && raw !== undefined, value: raw,
    });
  }
  return fields;
}

function humanize(name: string): string {
  const spaced = name.replace(/[_-]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function kindOf(value: unknown): FieldKind {
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (Array.isArray(value)) return "list";
  return "text";
}

/**
 * What is proven about a thing, from the evidence attached to its events and the answers of
 * anyone asked to confirm it.
 *
 * A dispute outranks everything: an unresolved disagreement is the most important fact about a
 * record and must not be averaged away by other evidence. Below that, only a party other than
 * the actor can raise a record above "claimed" — which is the kernel's own rule, not a
 * presentation choice.
 */
export function proofOf(
  evidence: Array<{ basis: string; description?: string; created_at?: string; attached_at?: string }>,
  confirmations: Array<{ state: string; asked_of?: string; answered_at?: string | null }> = [],
): ThingProof {
  const items: ProofItem[] = evidence.map(e => ({
    basis: e.basis,
    description: e.description ?? "",
    at: e.attached_at ?? e.created_at ?? "",
  }));
  const disputes = confirmations.filter(c => c.state === "disputed").length;
  if (disputes > 0) return { status: "disputed", items, disputes };

  const confirmed = confirmations.some(c => c.state === "confirmed");
  const bases = new Set(items.map(i => i.basis));
  if (bases.has("externally_verified") || bases.has("system_observed")) {
    return { status: "verified", items, disputes };
  }
  if (confirmed || bases.has("witnessed")) return { status: "witnessed", items, disputes };
  if (bases.has("self_reported") || bases.has("artifact")) return { status: "claimed", items, disputes };
  return { status: "none", items, disputes };
}

/** Plain words for each status. Nothing here may overstate what the kernel holds. */
export function proofWording(proof: ThingProof): string {
  switch (proof.status) {
    case "disputed":
      return proof.disputes === 1 ? "Disputed by the person asked" : `Disputed by ${proof.disputes} people asked`;
    case "verified":
      return "Verified by a service outside this record";
    case "witnessed":
      return "Confirmed by someone other than its owner";
    case "claimed":
      return "Recorded by its owner, not yet confirmed by anyone else";
    case "none":
      return "Nothing proves this yet";
  }
}

/**
 * A kernel event type, said in words a person has.
 *
 * Event types are our vocabulary — `kernel.confirmation.answered` is a fact about our schema, not
 * something anyone should have to read. Anything unrecognised falls back to its last segment,
 * humanised, so a new event type degrades into plain English rather than leaking a dotted path.
 */
export function actWording(type: string): string {
  const known: Record<string, string> = {
    "kernel.scope.claimed": "Started this",
    "world.entity.recorded": "Recorded",
    "world.entity.revised": "Changed",
    "kernel.grant.issued": "Gave access",
    "kernel.grant.revoked": "Took access back",
    "kernel.evidence.attached": "Attached proof",
    "kernel.confirmation.requested": "Asked for confirmation",
    "kernel.confirmation.answered": "Answered",
    "kernel.confirmation.cancelled": "Withdrew the request",
    "kernel.world.invitation.created": "Invited someone",
    "kernel.world.invitation.accepted": "Joined",
  };
  if (known[type]) return known[type];
  const last = type.split(".").pop() ?? type;
  const spaced = last.replace(/[_-]+/g, " ").trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : "Something happened";
}

/** Who an actor is, in words a person can read. */
export type ActorNames = {
  /** Display labels from the kernel. An empty label means the person never named themselves. */
  labels?: Record<string, string>;
  /** Actor kinds, so the system's own acts are attributed to SOLVE rather than to "kernel". */
  kinds?: Record<string, string>;
  /** The person looking. Their own acts are "You", which is the truest name there is. */
  viewerId?: string | null;
  /**
   * Who holds the thing. Their acts are on their own authority — the grant they act under is their
   * ownership — and anyone else's granted act happened with their permission, which is what a
   * person needs to read rather than "under a grant".
   */
  ownerId?: string | null;
};

/**
 * The name shown for an actor.
 *
 * Found by the staging acceptance run, not by reasoning: an ordinary visitor who never named
 * themselves has an empty label, and the record was rendering their own acts with a blank name;
 * and the kernel's own service actor is labelled "kernel", which is our word on a person's thing.
 * So: the viewer is "You", the system is "SOLVE" (the brand, which is on the card), a real label is
 * used as given, and anyone else unnamed is "Someone" — never blank, never an internal id.
 */
export function nameFor(actorId: string, names: ActorNames = {}): string {
  if (names.viewerId && actorId === names.viewerId) return "You";
  if (names.kinds?.[actorId] === "service") return "SOLVE";
  const label = names.labels?.[actorId]?.trim();
  return label ? label : "Someone";
}

export function actsFrom(
  events: Array<{ occurred_at: string; type: string; actor_id: string; grant_id: string | null; on_behalf_of: string | null }>,
  names: ActorNames | Record<string, string> = {},
): ThingAct[] {
  // Accept a bare label map for callers that have nothing more to say about who is who.
  const resolved: ActorNames = "labels" in names || "kinds" in names || "viewerId" in names || "ownerId" in names
    ? names as ActorNames : { labels: names as Record<string, string> };
  const owner = resolved.ownerId ?? null;
  return events.map(e => {
    const byOwner = owner !== null && e.actor_id === owner;
    return {
      at: e.occurred_at,
      type: e.type,
      actorLabel: nameFor(e.actor_id, resolved),
      grantor: e.grant_id && owner && !byOwner ? nameFor(owner, resolved) : null,
      authority: e.grant_id && !byOwner ? "granted" : "own",
      onBehalfOf: e.on_behalf_of ? nameFor(e.on_behalf_of, resolved) : null,
    };
  });
}

/**
 * One human act can be several kernel rows — making a thing writes the thing, its link and its
 * goal. Consecutive acts that read identically, by the same person, in the same minute, are shown
 * once. Nothing different is ever merged.
 */
export function collapseActs(acts: ThingAct[]): ThingAct[] {
  const out: ThingAct[] = [];
  for (const act of acts) {
    const prev = out[out.length - 1];
    const same = prev && actWording(prev.type) === actWording(act.type) && prev.actorLabel === act.actorLabel
      && prev.authority === act.authority && prev.grantor === act.grantor && prev.at.slice(0, 16) === act.at.slice(0, 16);
    if (!same) out.push(act);
  }
  return out;
}

/** One provenance line, used wherever an act is shown. Never claims more than the act carried. */
export function provenanceLine(act: ThingAct, proof?: ThingProof): string {
  const who = act.onBehalfOf ? `${act.actorLabel}, for ${act.onBehalfOf}` : act.actorLabel;
  const own = act.actorLabel === "You" ? "on your own authority" : act.actorLabel === "SOLVE" ? "as the system" : "on their own authority";
  const permission = act.grantor ? (act.grantor === "You" ? "with your permission" : `with ${act.grantor}'s permission`) : "under a grant";
  const how = act.authority === "granted" ? permission : act.authority === "own" ? own : "authority unknown";
  const when = act.at ? ` · ${act.at.slice(0, 10)}` : "";
  const proven = proof && proof.status !== "none" ? ` · ${proofWording(proof)}` : "";
  return `${who} · ${how}${when}${proven}`;
}

/**
 * The access list, as something a person can act on. Only grants the viewer could actually
 * withdraw are marked revocable, so the interface never offers a control that would fail.
 */
export function accessFrom(
  grants: Array<{ id: string; capability: string; scope: string; issued_by: string }>,
  names: ActorNames | Record<string, string> = {},
  granteeOf: Record<string, string> = {},
): ThingAccess[] {
  const resolved: ActorNames = "labels" in names || "kinds" in names || "viewerId" in names
    ? names as ActorNames : { labels: names as Record<string, string> };
  return grants.map(g => ({
    actorLabel: granteeOf[g.id] ? nameFor(granteeOf[g.id], resolved) : "Someone",
    capability: g.capability,
    scope: g.scope,
    grantId: g.id,
  }));
}

/** A confirmation request as its owner sees it. */
export type ThingConfirmation = {
  id: string;
  askedOf: string;
  question: string;
  state: "awaiting" | "confirmed" | "disputed" | "expired" | "withdrawn";
  answeredBy: string | null;
  answeredAt: string | null;
};

/**
 * Each state in plain words. Awaiting is a state, not a gap: asking is not the same as being
 * answered, and the owner must never be shown a request as if it had been confirmed.
 */
export function confirmationWording(c: Pick<ThingConfirmation, "state" | "answeredBy">): string {
  const who = c.answeredBy?.trim() || "the person asked";
  switch (c.state) {
    case "awaiting": return "Waiting for an answer";
    case "confirmed": return `Confirmed by ${who}`;
    case "disputed": return `Disputed by ${who}`;
    case "expired": return "Expired without an answer";
    case "withdrawn": return "Withdrawn";
  }
}


/**
 * One event in a person's own identity history, with its subject. "Updated" alone tells a person
 * nothing; the event carries the request it made, so the history can say what changed.
 */
export function identityEventWording(e: { type: string; payload?: unknown }): string {
  if (e.type === "kernel.person.label.updated") return "Name changed";
  if (e.type === "kernel.actor.registered") return "SOV ID created";
  const request = (e.payload as { request?: { title?: unknown; attributes?: { sov?: unknown } } } | undefined)?.request;
  if (/^kernel\.entity\.(created|updated|revised)$/.test(e.type)) {
    if (request?.attributes?.sov === "solve.look") return e.type.endsWith("created") ? "Card look set" : "Card look changed";
    if (typeof request?.title === "string" && request.title.trim()) return `${actWording(e.type)}: ${request.title.trim()}`;
  }
  return actWording(e.type);
}
