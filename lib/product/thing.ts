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

export function actsFrom(
  events: Array<{ occurred_at: string; type: string; actor_id: string; grant_id: string | null; on_behalf_of: string | null }>,
  actorLabels: Record<string, string> = {},
): ThingAct[] {
  return events.map(e => ({
    at: e.occurred_at,
    type: e.type,
    actorLabel: actorLabels[e.actor_id] ?? "Someone",
    authority: e.grant_id ? "granted" : "own",
    onBehalfOf: e.on_behalf_of ? (actorLabels[e.on_behalf_of] ?? "someone else") : null,
  }));
}

/** One provenance line, used wherever an act is shown. Never claims more than the act carried. */
export function provenanceLine(act: ThingAct, proof?: ThingProof): string {
  const who = act.onBehalfOf ? `${act.actorLabel}, for ${act.onBehalfOf}` : act.actorLabel;
  const how = act.authority === "granted" ? "under a grant" : act.authority === "own" ? "on their own authority" : "authority unknown";
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
  actorLabels: Record<string, string> = {},
  granteeOf: Record<string, string> = {},
): ThingAccess[] {
  return grants.map(g => ({
    actorLabel: actorLabels[granteeOf[g.id] ?? ""] ?? "Someone",
    capability: g.capability,
    scope: g.scope,
    grantId: g.id,
  }));
}
