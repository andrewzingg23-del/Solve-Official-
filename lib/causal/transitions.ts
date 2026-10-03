// The transition registry: what can change the World, declared so a planner can chain it and a
// reviewer can read it. A transition names the capability that authorizes it, the provider
// capability that performs it (replaceable), the facts it requires, the facts it produces, the
// consequences it declares and the guards the kernel re-checks at enactment. Any World,
// organization or agent can extend the registry (`with`) without touching the core: the planner
// only ever reasons over patterns.
import type { EntityKind } from "../kernel/client";
import { answerCapabilityQuery } from "../world/counterparty";
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
  // The actor a message step is addressed to, and the message it answers.
  target?(b: Binding, w: WorldState, goal: Goal): string | null;
  inReplyTo?(b: Binding, w: WorldState, goal: Goal): string | null;
  // Why this binding is not a route at all, beyond unmet requirements.
  exclude?(b: Binding, w: WorldState, goal: Goal): string[];
  title(b: Binding, w: WorldState, goal: Goal): string;
  payload(b: Binding, w: WorldState, goal: Goal): Record<string, unknown>;
  consequences(b: Binding, w: WorldState, goal: Goal): Consequence[];
  guards?(b: Binding, w: WorldState, goal: Goal): KernelGuard[];
  // Money the transition moves, so authority is decided for the amount.
  amount?(b: Binding, w: WorldState, goal: Goal): { amount: string; asset: string } | null;
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

// A good-faith deposit to the agreed supplier: money through the proven payment physics, under the
// same guards and reconciliation as everything else. Nominal, on test assets.
export const DEPOSIT_USD = 25;

export const deposit: Transition = {
  id: "supplier.deposit",
  kind: "supplier.deposit",
  capability: "payment.send",
  provider: "payment.send",
  native: false,
  expectedEvidence: "The kernel's payment record, confirmed on chain with its payment marker.",
  failures: ["the payment fails on chain", "the outcome stays unknown until reconciled", "the payer's authority or budget does not cover it"],
  requires: [
    { label: "an agreed supplier", pattern: { subject: "?org", predicate: "supplies:agreed", object: "?world" }, because: "the agreement is recorded" },
    { label: "no deposit paid yet", pattern: { subject: "?world", predicate: "pays:paid", object: "?org", value: { purpose: "deposit" } }, present: false, because: "nothing paid" },
  ],
  produces: [{ subject: "?world", predicate: "pays:paid", object: "?org", value: { purpose: "deposit" } }],
  scope: (b, w) => scopeOf(w, b.world),
  title: (b, w) => `Pay ${titleOf(w, b.org)} a $${DEPOSIT_USD} good-faith deposit (test assets)`,
  amount: () => ({ amount: String(DEPOSIT_USD * 1_000_000), asset: "DEV_USDC" }),
  payload: (b) => ({ purpose: "deposit", organization: b.org, amount: String(DEPOSIT_USD * 1_000_000), asset: "DEV_USDC" }),
  consequences: (b, w) => [
    {
      op: "relation.create",
      kind: "pays",
      from_ref: b.world,
      to_ref: b.org,
      scope: scopeOf(w, b.world)!,
      attributes: { status: "paid", purpose: "deposit", asset: "DEV_USDC" },
      result_keys: ["payment_id", "tx_signature", "amount", "recipient", "provider"],
    },
  ],
  guards: (b) => [
    { op: "relation.exists", kind: "supplies", from_ref: b.org, to_ref: b.world, attributes: { status: "agreed" } },
    { op: "relation.absent", kind: "pays", from_ref: b.world, to_ref: b.org, attributes: { purpose: "deposit" } },
  ],
  uncertainty: () => ({ level: "medium", because: "a chain transaction: its outcome is evidence, never assumed" }),
  predicted: (b) => [inferred(b.world, "pays:paid", b.org, { purpose: "deposit", amount: String(DEPOSIT_USD * 1_000_000), asset: "DEV_USDC" })],
};

// The counterparty's side of an inquiry: the organization's agent answers from the organization's
// published record, as a kernel message in reply to the inquiry, under its own authority in the
// market. Native: the kernel delivers it; the asker's provider finds it in its inbox.
const inquiryOf = (w: WorldState, ref: string | undefined) => (ref ? w.facts.find((f) => f.subject === ref && f.predicate.startsWith("inquiry:")) : undefined);
const askerOf = (w: WorldState, ref: string | undefined) => {
  const from = inquiryOf(w, ref)?.value?.from;
  return typeof from === "string" ? from : null;
};

export const answer: Transition = {
  id: "inquiry.answer",
  kind: "message.send",
  capability: "message.send",
  provider: "kernel",
  native: true,
  expectedEvidence: "The kernel's delivery record of the reply, bound to the inquiry it answers.",
  failures: ["the agent may not speak in the market", "the organization publishes no record to answer from"],
  requires: [{ label: "an open inquiry", pattern: { subject: "?inquiry", predicate: "inquiry:open", object: "?org" }, because: "it was delivered to the organization's agent" }],
  produces: [{ subject: "?inquiry", predicate: "inquiry:answered", object: "?org" }],
  scope: (b, w) => scopeOf(w, b.org),
  target: (b, w) => askerOf(w, b.inquiry),
  inReplyTo: (b) => (b.inquiry?.startsWith("action:") ? b.inquiry.slice("action:".length) : null),
  title: (b, w) => {
    const asker = askerOf(w, b.inquiry);
    const quantity = num(inquiryOf(w, b.inquiry)?.value?.quantity);
    return `Answer ${asker ? titleOf(w, asker) : "the"} inquiry${quantity ? ` for ${fmt(quantity)}` : ""} from ${titleOf(w, b.org)}'s published record`;
  },
  payload: (b, w) => {
    const entity = w.entities.get(b.org);
    const quantity = num(inquiryOf(w, b.inquiry)?.value?.quantity);
    const claim = claimOf(w, b.org)?.provenance.events[0] ?? null;
    return { type: "INFORMATION_RESPONSE", organization: b.org, in_reply_to: b.inquiry, ...(entity ? answerCapabilityQuery(entity, quantity, claim) : { can_fulfill: false, quantity, note: "no published record" }) };
  },
  consequences: () => [],
  uncertainty: () => ({ level: "low", because: "a kernel-native reply from the published record" }),
  predicted: (b) => [inferred(b.inquiry, "inquiry:answered", b.org, {})],
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

export const STANDARD = new Transitions([inquire, verify, accept, deposit, answer, delegate]);
export const TRANSITIONS = { inquire, verify, accept, deposit, answer, delegate } as const;

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

export function depositGoal(input: { worldRef: string; scope: string; title: string }): Goal {
  return {
    kind: "pay_deposit",
    title: `a good-faith deposit to ${input.title}'s agreed supplier`,
    scope: input.scope,
    desired: [{ subject: input.worldRef, predicate: "pays:paid", object: "?org", value: { purpose: "deposit" } }],
    bind: { world: input.worldRef },
    world: input.worldRef,
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

// The counterparty's goals: one per inquiry delivered to it and still open, in the World the
// organization lives in. Nothing here assumes who asked.
export function answerGoal(input: { inquiryRef: string; orgRef: string; scope: string; title: string }): Goal {
  return {
    kind: "answer_inquiry",
    title: `the inquiry to ${input.title} answered`,
    scope: input.scope,
    desired: [{ subject: input.inquiryRef, predicate: "inquiry:answered", object: input.orgRef }],
    bind: { org: input.orgRef, inquiry: input.inquiryRef },
  };
}

export function openInquiryGoals(world: WorldState, orgRef: string): Goal[] {
  const scope = scopeOf(world, orgRef);
  if (!scope) return [];
  return world.facts
    .filter((f) => f.predicate === "inquiry:open" && f.object === orgRef)
    .map((f) => answerGoal({ inquiryRef: f.subject, orgRef, scope, title: titleOf(world, orgRef) }));
}
