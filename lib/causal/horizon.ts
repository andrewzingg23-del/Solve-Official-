// Horizon: given this World and this actor, what could happen next, and which sequences of state
// transitions reach the actor's desired state. It reads only (World state and read-only authority
// decisions); everything it produces is interpretation, ranked by a versioned policy, and becomes
// canonical only when a route's actions complete with evidence.
import type { AuthorityDecision, Kernel, WorldEntity } from "../kernel/client";
import { sha256Hex } from "../money/settlement";
import type { Providers } from "./providers";
import type { Binding, Check, Consequence, Fact, Goal, Horizon, Route, RouteStep, Uncertainty } from "./types";
import type { WorldState } from "./world";

// The transitions this Horizon knows. Each names the capability that authorizes it, the provider
// capability that performs it (resolved at run time, replaceable), the evidence that would show it
// happened, and how it can fail.
export const TRANSITIONS = {
  inquire: {
    id: "supplier.inquire",
    kind: "supplier.inquire",
    capability: "message.send",
    provider: "counterparty.inquiry",
    native: false,
    expectedEvidence: "A reply from the organization's agent, naming the principal it answers for.",
    failures: ["the organization declines", "no reply arrives", "it cannot meet the quantity"],
  },
  accept: {
    id: "supplier.accept",
    kind: "supplier.accept",
    capability: "commitment.make",
    provider: "counterparty.acceptance",
    native: false,
    expectedEvidence: "The acceptance delivered to the organization's agent.",
    failures: ["the offer was withdrawn", "authority lapsed before enactment"],
  },
  delegate: {
    id: "authority.delegate",
    kind: "grant.issue",
    capability: "kernel.grant.issue",
    provider: "kernel",
    native: true,
    expectedEvidence: "The kernel's grant record.",
    failures: ["the delegator no longer holds the capability"],
  },
  verify: {
    id: "claim.verify",
    kind: "claim.verify",
    capability: "verification.request",
    provider: "verification",
    native: false,
    expectedEvidence: "Externally verified evidence attached to the claim.",
    failures: ["the claim does not hold up", "no verifier is available"],
  },
} as const;

export type RankingPolicy = { id: string; score(route: Omit<Route, "score" | "policy" | "id">, world: WorldState): number };

// How routes are ordered: interpretation, versioned, never written into history except as the
// policy id a selection was made under.
export const RANKING_V1: RankingPolicy = {
  id: "horizon-rank/1",
  score(route) {
    const terms = route.steps.find((s) => s.transition === TRANSITIONS.accept.id)?.payload.terms as { unit_price_usd?: number } | undefined;
    const handoffs = route.steps.filter((s, i) => i > 0 && s.actorId !== route.steps[i - 1].actorId).length;
    return (route.executable ? 100 : 0) - route.steps.length * 5 - handoffs * 3 - (terms?.unit_price_usd ?? 0) / 10_000;
  },
};

export type HorizonInput = {
  world: WorldState; // as the acting actor sees it
  actorId: string;
  principalId: string | null; // the human the actor answers to, if it is an agent
  goal: Goal;
  kernelFor(actorId: string): Kernel;
  providers: Providers;
  policy?: RankingPolicy;
  // When the actor lacks authority for a step: its principal delegates it (default), its principal
  // does it, or nobody stands in and the actor's own decision stands (an attempt it was asked to make).
  fallback?: "delegate" | "principal" | "none";
};

const canonical = (value: unknown): string =>
  Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : value && typeof value === "object" ? `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(",")}}` : JSON.stringify(value);

function capabilityRef(world: WorldState, key: string) {
  for (const [ref, e] of world.entities) if (e.kind === "capability" && e.attributes.key === key) return ref;
  return null;
}

const num = (v: unknown) => (typeof v === "number" ? v : null);

export async function computeHorizon(input: HorizonInput): Promise<Horizon> {
  const { world, actorId, principalId, goal, providers } = input;
  const policy = input.policy ?? RANKING_V1;
  const horizon: Horizon = { actorId, goal, satisfied: null, routes: [], excluded: [], next: [], policy: policy.id };
  const worldEntity = world.entities.get(goal.world);
  if (!worldEntity) {
    // Authorization before visibility: an actor that cannot see the World plans nothing in it.
    horizon.excluded.push({ orgRef: goal.world, title: "this World", reasons: ["you cannot see this World"] });
    return horizon;
  }
  const scope = worldEntity.scope;
  horizon.satisfied =
    world.facts.find((f) => f.predicate === "supplies:agreed" && f.object === goal.world && f.value?.capability === goal.capability) ?? null;
  if (horizon.satisfied) return horizon;

  const decisions = new Map<string, Promise<AuthorityDecision>>();
  const decide = (who: string, capability: string) => {
    const key = `${who}|${capability}`;
    if (!decisions.has(key)) decisions.set(key, input.kernelFor(who).authorize({ capability, scope }));
    return decisions.get(key)!;
  };
  // Who does a step: the actor if its authority allows, otherwise its principal if theirs does.
  const fallback = input.fallback ?? "delegate";
  const performer = async (capability: string) => {
    const mine = await decide(actorId, capability);
    if (fallback === "none" || mine.decision !== "DENY" || !principalId || principalId === actorId) return { who: actorId, decision: mine };
    const theirs = await decide(principalId, capability);
    return theirs.decision === "DENY" ? { who: actorId, decision: mine } : { who: principalId, decision: theirs };
  };

  const capRef = capabilityRef(world, goal.capability);
  const candidates = [...world.entities.entries()].filter(
    ([, e]) => e.kind === "organization" && ((e.attributes.capabilities as string[] | undefined) ?? []).includes(goal.capability),
  );

  for (const [orgRef, org] of candidates as [string, WorldEntity][]) {
    const claim = world.facts.find((f) => f.subject === orgRef && f.predicate === "claims");
    const quote = world.facts.find((f) => f.subject === orgRef && f.predicate === "offers:quoted" && f.object === goal.world);
    const reasons: string[] = [];
    if (claim?.status === "disputed") {
      const challenge = world.events.find((e) => e.type === "claim.challenge" && e.payload.claim_event_id === claim.provenance.events[0]);
      reasons.push(`its capacity claim is disputed${challenge ? `: ${String(challenge.payload.finding)}` : ""}`);
    }
    const capacity = num(quote?.value?.capacity_per_year) ?? num(claim?.value?.capacity_per_year) ?? num(org.attributes.capacity_per_year);
    if (goal.quantity && capacity !== null && capacity < goal.quantity) {
      reasons.push(`${quote ? "quoted" : "claims"} ${capacity.toLocaleString("en-US")} a year, below ${goal.quantity.toLocaleString("en-US")}`);
    }
    if (quote && quote.value?.can_fulfill === false) reasons.push("it said it cannot meet the quantity");
    if (reasons.length) {
      horizon.excluded.push({ orgRef, title: org.title, reasons });
      continue;
    }

    const binding: Binding = { world: goal.world, org: orgRef, capability: goal.capability, ...(capRef ? { capabilityRef: capRef } : {}) };
    const steps: RouteStep[] = [];
    const unitPrice = num(quote?.value?.unit_price_usd) ?? num(org.attributes.unit_price_usd);
    const leadTime = num(quote?.value?.lead_time_days) ?? num(org.attributes.lead_time_days);
    const claimStatus = claim?.status ?? "unknown";

    if (!quote) {
      const inquiry = await performer(TRANSITIONS.inquire.capability);
      // An agent without contact authority can be given it by its principal, so it can then act on
      // its own: that delegation is a step of the route, not a side effect.
      const own = await decide(actorId, TRANSITIONS.inquire.capability);
      if (fallback === "delegate" && own.decision === "DENY" && principalId && principalId !== actorId) {
        const grant = await decide(principalId, TRANSITIONS.delegate.capability);
        const holds = await decide(principalId, TRANSITIONS.inquire.capability);
        if (grant.decision !== "DENY" && holds.decision !== "DENY") {
          steps.push(step({
            t: TRANSITIONS.delegate,
            title: `Let your companion contact ${org.title} (and suppliers in this World) for 7 days`,
            binding,
            actorId: principalId,
            authority: grant,
            scope,
            targetRef: null,
            preconditions: [{ label: "you hold contact authority here", met: true, because: "your grants cover message.send" }],
            uncertainty: { level: "low", because: "a kernel-native grant" },
            consequences: [],
            predicted: [],
            payload: { grantee_id: actorId, capability: TRANSITIONS.inquire.capability, expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10) + "T00:00:00Z" },
          }));
        }
      }
      const granted = steps.length > 0;
      const quantity = goal.quantity;
      steps.push(step({
        t: TRANSITIONS.inquire,
        title: `Ask ${org.title} whether it can make ${quantity ? quantity.toLocaleString("en-US") : "enough"}`,
        binding,
        actorId: granted ? actorId : inquiry.who,
        authority: granted ? { decision: "ALLOW", reasons: ["granted by the step before"], grant_id: null, policy_id: null, threshold: null, delay_seconds: null } : inquiry.decision,
        scope,
        targetRef: null,
        preconditions: [
          { label: `${org.title} offers ${goal.capability.replace(/_/g, " ")}`, met: true, because: "its published record lists it" },
          { label: "no quote yet", met: true, because: "nothing recorded in this World" },
        ],
        uncertainty: unc(claimStatus, capacity, quantity),
        consequences: [{ op: "relation.create", kind: "offers", from_ref: orgRef, to_ref: goal.world, scope, attributes: { status: "quoted", capability: goal.capability, quantity }, result_keys: ["capacity_per_year", "lead_time_days", "unit_price_usd", "minimum_order", "can_fulfill", "reply", "provider"] }],
        predicted: [{ subject: orgRef, predicate: "offers:quoted", object: goal.world, value: { capacity_per_year: capacity, unit_price_usd: unitPrice }, status: "inferred", provenance: { events: [], actions: [], evidence: [], by: null } }],
        payload: { quantity },
      }));
    }

    if (claimStatus !== "verified") {
      const verify = await performer(TRANSITIONS.verify.capability);
      steps.push(step({
        t: TRANSITIONS.verify,
        title: `Have ${org.title}'s capacity claim independently verified`,
        binding,
        actorId: verify.who,
        authority: verify.decision,
        scope,
        targetRef: null,
        preconditions: [{ label: "its claim is not yet verified", met: true, because: `the claim is ${claimStatus}` }],
        uncertainty: { level: "high", because: "verification depends on an independent party" },
        consequences: [],
        predicted: [],
        payload: {},
      }));
    }

    const accept = await performer(TRANSITIONS.accept.capability);
    const terms = { quantity: goal.quantity, unit_price_usd: unitPrice, lead_time_days: leadTime };
    steps.push(step({
      t: TRANSITIONS.accept,
      title: `Accept ${org.title}'s terms${unitPrice ? ` at $${unitPrice.toLocaleString("en-US")} a unit` : ""}`,
      binding,
      actorId: accept.who,
      authority: accept.decision,
      scope,
      targetRef: null,
      preconditions: [
        { label: "a quote that meets the quantity", met: Boolean(quote && quote.value?.can_fulfill), because: quote ? "recorded from its reply" : "comes from the inquiry" },
        { label: "a verified capacity claim", met: claimStatus === "verified", because: `the claim is ${claimStatus}` },
      ],
      uncertainty: claimStatus === "verified" ? { level: "low", because: "verified capacity and a recorded quote" } : { level: "high", because: "capacity not independently verified" },
      consequences: [{ op: "relation.create", kind: "supplies", from_ref: orgRef, to_ref: goal.world, scope, attributes: { status: "agreed", capability: goal.capability, ...terms } }],
      predicted: [{ subject: orgRef, predicate: "supplies:agreed", object: goal.world, value: { capability: goal.capability, ...terms }, status: "inferred", provenance: { events: [], actions: [], evidence: [], by: null } }],
      payload: { terms },
    }));

    const blockedBy: string[] = [];
    for (const [i, s] of steps.entries()) {
      if (!s.native && !providers.resolve(s.provider.capability)) blockedBy.push(`step ${i + 1}: no provider for ${s.provider.capability} is connected`);
      else if (s.authority.decision === "DENY") blockedBy.push(`step ${i + 1}: ${s.authority.reasons.join("; ") || "not authorized"}`);
    }
    const draft = {
      goal,
      orgRef,
      title: `${org.title}: ${steps.map((s) => s.transition.split(".")[1]).join(" → ")}`,
      steps,
      executable: blockedBy.length === 0,
      blockedBy,
      needsHuman: steps.some((s) => s.actorId !== actorId),
    };
    const id = await sha256Hex(canonical({ goal, steps: steps.map((s) => ({ t: s.transition, b: s.binding, a: s.actorId, c: s.consequences })) }));
    horizon.routes.push({ ...draft, id, score: policy.score(draft, world), policy: policy.id });
  }

  horizon.routes.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
  horizon.next = horizon.routes.filter((r) => r.executable).map((r) => r.steps[0]);
  return horizon;
}

function unc(claim: string, capacity: number | null, quantity: number | null): Uncertainty {
  if (claim === "verified" && capacity !== null && (!quantity || capacity >= quantity)) return { level: "low", because: "verified capacity covers the quantity" };
  if (capacity === null) return { level: "high", because: "no capacity on record" };
  return { level: "medium", because: `capacity is ${claim}` };
}

type StepInput = {
  t: (typeof TRANSITIONS)[keyof typeof TRANSITIONS];
  title: string;
  binding: Binding;
  actorId: string;
  authority: AuthorityDecision;
  scope: string;
  targetRef: string | null;
  preconditions: Check[];
  uncertainty: Uncertainty;
  consequences: Consequence[];
  predicted: Fact[];
  payload: Record<string, unknown>;
};

function step(i: StepInput): RouteStep {
  return {
    transition: i.t.id,
    title: i.title,
    binding: i.binding,
    actorId: i.actorId,
    authority: { actorId: i.actorId, decision: i.authority.decision, reasons: i.authority.reasons },
    capability: i.t.capability,
    scope: i.scope,
    kind: i.t.kind,
    targetRef: i.targetRef,
    native: i.t.native,
    provider: { capability: i.t.provider, id: null },
    preconditions: i.preconditions,
    expectedEvidence: i.t.expectedEvidence,
    failures: [...i.t.failures],
    uncertainty: i.uncertainty,
    consequences: i.consequences,
    predicted: i.predicted,
    payload: i.payload,
  };
}
