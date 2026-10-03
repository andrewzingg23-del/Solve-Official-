// The transition registry: what can change the World, declared so a planner can chain it and a
// reviewer can read it. A transition names the capability that authorizes it, the provider
// capability that performs it (replaceable), the facts it requires, the facts it produces, the
// consequences it declares and the guards the kernel re-checks at enactment. Any World,
// organization or agent can extend the registry (`with`) without touching the core: the planner
// only ever reasons over patterns.
import type { EntityKind } from "../kernel/client";
import type { Binding, Consequence, Fact, Goal, KernelGuard, Pattern, Uncertainty } from "./types";
import type { WorldState } from "./world";

export const isVar = (s: unknown): s is string => typeof s === "string" && s.startsWith("?");
const name = (v: string) => v.slice(1);

// Stable text for structural identity: keys sorted, so the same plan always has the same id.
export const canonical = (value: unknown): string =>
  Array.isArray(value)
    ? `[${value.map(canonical).join(",")}]`
    : value && typeof value === "object"
      ? `{${Object.keys(value as object)
          .sort()
          .map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`)
          .join(",")}}`
      : JSON.stringify(value);

const resolve = (s: string | undefined, b: Binding) => (isVar(s) ? (b[name(s)] ?? s) : s);

// A pattern with its variables replaced from a binding; unbound ones stay variables.
export function instantiate(p: Pattern, b: Binding): Pattern {
  const value = p.value ? Object.fromEntries(Object.entries(p.value).map(([k, v]) => [k, isVar(v) ? (b[name(v)] ?? v) : v])) : undefined;
  return { ...p, subject: resolve(p.subject, b), object: resolve(p.object, b), ...(value ? { value } : {}) };
}

// Whether a fact matches a pattern under a binding: the binding extended by what the match fixed,
// or null. `value` entries are a subset the fact's value must contain.
export function unify(p: Pattern, f: Fact, b: Binding): Binding | null {
  if (p.predicate !== f.predicate) return null;
  if (p.status && !p.status.includes(f.status)) return null;
  const out: Binding = { ...b };
  const fit = (slot: string | undefined, actual: string | null) => {
    if (slot === undefined) return true;
    if (!isVar(slot)) return slot === actual;
    const v = name(slot);
    if (out[v] !== undefined) return out[v] === actual;
    if (actual === null) return false;
    out[v] = actual;
    return true;
  };
  if (!fit(p.subject, f.subject) || !fit(p.object, f.object)) return null;
  for (const [k, want] of Object.entries(p.value ?? {})) {
    const have = f.value?.[k];
    if (isVar(want)) {
      const v = name(want);
      if (out[v] !== undefined) {
        if (String(have) !== out[v]) return null;
      } else if (have === undefined) return null;
      else out[v] = String(have);
    } else if (canonical(have) !== canonical(want)) return null;
  }
  return out;
}

export const matches = (world: WorldState, p: Pattern, b: Binding) =>
  world.facts.flatMap((fact) => {
    const binding = unify(p, fact, b);
    return binding ? [{ fact, binding }] : [];
  });

export type Requirement = { label: string; pattern: Pattern; present?: boolean; because: string };

export type Transition = {
  id: string;
  kind: string;
  capability: string;
  provider: string;
  native: boolean;
  expectedEvidence: string;
  failures: string[];
  // Variables no requirement binds, enumerated from entities of a kind.
  binds?: Record<string, EntityKind>;
  requires: Requirement[];
  produces: Pattern[];
  // Whether a principal may hand this to its agent by a delegation step.
  delegable?: boolean;
  // The delegation transition itself: inserted by the planner's authority pass, never chained.
  delegation?: boolean;
  scope(b: Binding, w: WorldState, goal: Goal): string | null;
  // Why this binding is not a route at all, beyond unmet requirements.
  exclude?(b: Binding, w: WorldState, goal: Goal): string[];
  title(b: Binding, w: WorldState, goal: Goal): string;
  payload(b: Binding, w: WorldState, goal: Goal): Record<string, unknown>;
  consequences(b: Binding, w: WorldState, goal: Goal): Consequence[];
  guards?(b: Binding, w: WorldState, goal: Goal): KernelGuard[];
  uncertainty(b: Binding, w: WorldState, goal: Goal): Uncertainty;
  predicted?(b: Binding, w: WorldState, goal: Goal): Fact[];
};

export class Transitions {
  private readonly byId: Map<string, Transition>;
  constructor(list: Transition[]) {
    this.byId = new Map(list.map((t) => [t.id, t]));
  }
  all() {
    return [...this.byId.values()];
  }
  get(id: string) {
    return this.byId.get(id) ?? null;
  }
  // Transitions whose effects could make a pattern true.
  producing(p: Pattern) {
    return this.all().filter(
      (t) => !t.delegation && t.produces.some((q) => q.predicate === p.predicate && (!p.status || !q.status || q.status.some((s) => p.status!.includes(s)))),
    );
  }
  with(...more: Transition[]) {
    return new Transitions([...this.all(), ...more]);
  }
}

// --- The standard transitions ---------------------------------------------------------------

const num = (v: unknown) => (typeof v === "number" ? v : null);
const fmt = (n: number) => n.toLocaleString("en-US");
const titleOf = (w: WorldState, ref: string) => w.entities.get(ref)?.title ?? ref;
const scopeOf = (w: WorldState, ref: string | undefined) => (ref ? (w.entities.get(ref)?.scope ?? null) : null);
const claimOf = (w: WorldState, org: string | undefined) => (org ? w.facts.find((f) => f.subject === org && f.predicate === "claims") : undefined);
const quoteOf = (w: WorldState, org: string | undefined, world: string | undefined) =>
  org && world ? w.facts.find((f) => f.subject === org && f.predicate === "offers:quoted" && f.object === world) : undefined;
const capacityOf = (w: WorldState, org: string | undefined, world: string | undefined) =>
  num(quoteOf(w, org, world)?.value?.capacity_per_year) ?? num(claimOf(w, org)?.value?.capacity_per_year) ?? num(org ? w.entities.get(org)?.attributes.capacity_per_year : null);
const priceOf = (w: WorldState, org: string | undefined, world: string | undefined) =>
  num(quoteOf(w, org, world)?.value?.unit_price_usd) ?? num(org ? w.entities.get(org)?.attributes.unit_price_usd : null);
const leadOf = (w: WorldState, org: string | undefined, world: string | undefined) =>
  num(quoteOf(w, org, world)?.value?.lead_time_days) ?? num(org ? w.entities.get(org)?.attributes.lead_time_days : null);
const inferred = (subject: string, predicate: string, object: string | null, value: Record<string, unknown>): Fact => ({
  subject,
  predicate,
  object,
  value,
  status: "inferred",
  provenance: { events: [], actions: [], evidence: [], by: null },
});

function supplyUncertainty(w: WorldState, b: Binding, goal: Goal): Uncertainty {
  const claim = claimOf(w, b.org)?.status ?? "unknown";
  const capacity = capacityOf(w, b.org, b.world);
  const quantity = goal.quantity ?? null;
  if (claim === "verified" && capacity !== null && (!quantity || capacity >= quantity)) return { level: "low", because: "verified capacity covers the quantity" };
  if (capacity === null) return { level: "high", because: "no capacity on record" };
  return { level: "medium", because: `capacity is ${claim}` };
}

export const inquire: Transition = {
  id: "supplier.inquire",
  kind: "supplier.inquire",
  capability: "message.send",
  provider: "counterparty.inquiry",
  native: false,
  delegable: true,
  expectedEvidence: "A reply from the organization's agent, naming the principal it answers for.",
  failures: ["the organization declines", "no reply arrives", "it cannot meet the quantity"],
  requires: [
    { label: "offers the capability", pattern: { subject: "?org", predicate: "offers", object: "?capabilityRef" }, because: "its published record lists it" },
    { label: "no quote yet", pattern: { subject: "?org", predicate: "offers:quoted", object: "?world" }, present: false, because: "nothing recorded in this World" },
  ],
  produces: [{ subject: "?org", predicate: "offers:quoted", object: "?world", value: { capability: "?capability" } }],
  scope: (b, w) => scopeOf(w, b.world),
  title: (b, w, g) => `Ask ${titleOf(w, b.org)} whether it can make ${g.quantity ? fmt(g.quantity) : "enough"}`,
  payload: (_b, _w, g) => ({ quantity: g.quantity ?? null }),
  consequences: (b, w, g) => [
    {
      op: "relation.create",
      kind: "offers",
      from_ref: b.org,
      to_ref: b.world,
      scope: scopeOf(w, b.world)!,
      attributes: { status: "quoted", capability: b.capability, quantity: g.quantity ?? null },
      result_keys: ["capacity_per_year", "lead_time_days", "unit_price_usd", "minimum_order", "can_fulfill", "reply", "provider"],
    },
  ],
  guards: (b) => [{ op: "relation.absent", kind: "offers", from_ref: b.org, to_ref: b.world, attributes: { status: "quoted", capability: b.capability } }],
  uncertainty: (b, w, g) => supplyUncertainty(w, b, g),
  predicted: (b, w) => [inferred(b.org, "offers:quoted", b.world, { capacity_per_year: capacityOf(w, b.org, b.world), unit_price_usd: priceOf(w, b.org, b.world) })],
};

export const verify: Transition = {
  id: "claim.verify",
  kind: "claim.verify",
  capability: "verification.request",
  provider: "verification.service",
  native: false,
  expectedEvidence: "Externally verified evidence attached to the claim by an independent verifier.",
  failures: ["the claim does not hold up", "no verifier is available"],
  requires: [{ label: "a claim on record", pattern: { subject: "?org", predicate: "claims", status: ["asserted", "observed", "disputed"] }, because: "it published one" }],
  produces: [{ subject: "?org", predicate: "claims", status: ["verified"] }],
  scope: (b, w) => scopeOf(w, b.org),
  exclude: (b, w) => {
    const claim = claimOf(w, b.org);
    if (claim?.status !== "disputed") return [];
    const challenge = w.events.find((e) => e.type === "claim.challenge" && e.payload.claim_event_id === claim.provenance.events[0]);
    return [`its capacity claim is disputed${challenge ? `: ${String(challenge.payload.finding)}` : ""}`];
  },
  title: (b, w) => `Have ${titleOf(w, b.org)}'s capacity claim independently verified`,
  payload: (b, w) => ({ organization: b.org, claim_event: claimOf(w, b.org)?.provenance.events[0] ?? null }),
  consequences: () => [],
  uncertainty: () => ({ level: "high", because: "verification depends on an independent party" }),
  predicted: (b, w) => [inferred(b.org, "claims", null, { ...(claimOf(w, b.org)?.value ?? {}), verified: true })],
};

export const accept: Transition = {
  id: "supplier.accept",
  kind: "supplier.accept",
  capability: "commitment.make",
  provider: "counterparty.acceptance",
  native: false,
  expectedEvidence: "The acceptance delivered to the organization's agent.",
  failures: ["the offer was withdrawn", "authority lapsed before enactment", "another supplier was agreed first"],
  requires: [
    { label: "a quote that meets the quantity", pattern: { subject: "?org", predicate: "offers:quoted", object: "?world", value: { can_fulfill: true } }, because: "recorded from its reply" },
    { label: "a verified capacity claim", pattern: { subject: "?org", predicate: "claims", status: ["verified"] }, because: "independently evidenced" },
  ],
  produces: [{ subject: "?org", predicate: "supplies:agreed", object: "?world", value: { capability: "?capability" } }],
  scope: (b, w) => scopeOf(w, b.world),
  exclude: (b, w, g) => {
    if (!b.org) return [];
    const reasons: string[] = [];
    const quote = quoteOf(w, b.org, b.world);
    const capacity = capacityOf(w, b.org, b.world);
    if (g.quantity && capacity !== null && capacity < g.quantity) reasons.push(`${quote ? "quoted" : "claims"} ${fmt(capacity)} a year, below ${fmt(g.quantity)}`);
    if (quote && quote.value?.can_fulfill === false) reasons.push("it said it cannot meet the quantity");
    return reasons;
  },
  title: (b, w) => {
    const price = priceOf(w, b.org, b.world);
    return `Accept ${titleOf(w, b.org)}'s terms${price ? ` at $${fmt(price)} a unit` : ""}`;
  },
  payload: (b, w, g) => ({ terms: { quantity: g.quantity ?? null, unit_price_usd: priceOf(w, b.org, b.world), lead_time_days: leadOf(w, b.org, b.world) } }),
  consequences: (b, w, g) => [
    {
      op: "relation.create",
      kind: "supplies",
      from_ref: b.org,
      to_ref: b.world,
      scope: scopeOf(w, b.world)!,
      attributes: { status: "agreed", capability: b.capability, quantity: g.quantity ?? null, unit_price_usd: priceOf(w, b.org, b.world), lead_time_days: leadOf(w, b.org, b.world) },
    },
  ],
  // Only if the quote still stands and nobody else was agreed for this need in the meantime.
  guards: (b) => [
    { op: "relation.exists", kind: "offers", from_ref: b.org, to_ref: b.world, attributes: { status: "quoted", can_fulfill: true } },
    { op: "relation.absent", kind: "supplies", to_ref: b.world, attributes: { status: "agreed", capability: b.capability } },
  ],
  uncertainty: (b, w) =>
    claimOf(w, b.org)?.status === "verified" ? { level: "low", because: "verified capacity and a recorded quote" } : { level: "high", because: "capacity not independently verified" },
  predicted: (b, w, g) => [inferred(b.org, "supplies:agreed", b.world, { capability: b.capability, quantity: g.quantity ?? null, unit_price_usd: priceOf(w, b.org, b.world) })],
};

const VERBS: Record<string, string> = { "message.send": "contact suppliers (not purchase)", "commitment.make": "make commitments", "verification.request": "request verification" };

export const delegate: Transition = {
  id: "authority.delegate",
  kind: "grant.issue",
  capability: "kernel.grant.issue",
  provider: "kernel",
  native: true,
  delegation: true,
  expectedEvidence: "The kernel's grant record.",
  failures: ["the delegator no longer holds the capability"],
  requires: [],
  produces: [],
  scope: (b) => b.scope ?? null,
  title: (b) => `Let your companion ${VERBS[b.grants] ?? `act with ${b.grants}`} in this World for 7 days`,
  payload: (b) => ({ grantee_id: b.grantee, capability: b.grants, expires_at: `${new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)}T00:00:00Z` }),
  consequences: () => [],
  uncertainty: () => ({ level: "low", because: "a kernel-native grant" }),
};

export const STANDARD = new Transitions([inquire, verify, accept, delegate]);
export const TRANSITIONS = { inquire, verify, accept, delegate } as const;

// --- Goals ----------------------------------------------------------------------------------

export function supplyGoal(input: { worldRef: string; scope: string; capability: string; capabilityRef: string; quantity: number | null; what?: string }): Goal {
  const quantity = input.quantity ?? null;
  return {
    kind: "secure_supply",
    title: `${quantity ? `${fmt(quantity)} ${input.what ?? "units"} of ` : ""}${input.capability.replace(/_/g, " ")}`,
    scope: input.scope,
    desired: [{ subject: "?org", predicate: "supplies:agreed", object: input.worldRef, value: { capability: input.capability } }],
    bind: { world: input.worldRef, capability: input.capability, capabilityRef: input.capabilityRef },
    world: input.worldRef,
    capability: input.capability,
    quantity,
  };
}

export function verifyGoal(input: { orgRef: string; scope: string; title: string }): Goal {
  return {
    kind: "verify_claim",
    title: `${input.title}'s capacity claim, independently verified`,
    scope: input.scope,
    desired: [{ subject: input.orgRef, predicate: "claims", status: ["verified"] }],
    bind: { org: input.orgRef },
  };
}
