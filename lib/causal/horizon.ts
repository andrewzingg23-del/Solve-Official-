// Horizon: given this World and this actor, what could happen next, and which sequences of state
// transitions reach the actor's desired facts. A backward-chaining planner over the transition
// registry: it finds transitions that produce a desired fact, then plans their unmet requirements,
// bounded in depth and never through the same transition twice. It reads only (World state and
// read-only authority decisions); everything it produces is interpretation, ranked by a versioned
// policy, and becomes canonical only when a route's actions complete with evidence.
import type { AuthorityDecision, Kernel } from "../kernel/client";
import { sha256Hex } from "../money/settlement";
import type { Providers } from "./providers";
import { canonical, instantiate, isVar, matches, STANDARD, TRANSITIONS, type Transition, type Transitions } from "./transitions";
import type { Binding, Goal, Horizon, Pattern, Route, RouteStep } from "./types";
import type { WorldState } from "./world";

export { TRANSITIONS } from "./transitions";

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
  transitions?: Transitions;
  // When the actor lacks authority for a step: its principal delegates it (default), its principal
  // does it, or nobody stands in and the actor's own decision stands (an attempt it was asked to make).
  fallback?: "delegate" | "principal" | "none";
};

const MAX_DEPTH = 4;

type Planned = { t: Transition; binding: Binding };
type Alternative = { binding: Binding; steps: Planned[] };

// Binds a transition's produced pattern against the pattern wanted, under a binding.
function fitProduced(produced: Pattern, wanted: Pattern, b: Binding): Binding | null {
  const w = instantiate(wanted, b);
  const out: Binding = { ...b };
  for (const [mine, theirs] of [
    [produced.subject, w.subject],
    [produced.object, w.object],
  ] as const) {
    if (mine === undefined || theirs === undefined || isVar(theirs)) continue;
    if (isVar(mine)) {
      const v = mine.slice(1);
      if (out[v] !== undefined && out[v] !== theirs) return null;
      out[v] = theirs;
    } else if (mine !== theirs) return null;
  }
  for (const [k, theirs] of Object.entries(w.value ?? {})) {
    const mine = produced.value?.[k];
    if (mine === undefined || isVar(theirs)) continue;
    if (isVar(mine)) out[mine.slice(1)] = String(theirs);
    else if (canonical(mine) !== canonical(theirs)) return null;
  }
  return out;
}

function enumerate(t: Transition, b: Binding, world: WorldState): Binding[] {
  let out: Binding[] = [b];
  for (const [v, kind] of Object.entries(t.binds ?? {})) {
    if (b[v] !== undefined) continue;
    const refs = [...world.entities.entries()].filter(([, e]) => e.kind === kind).map(([ref]) => ref);
    out = out.flatMap((bb) => refs.map((ref) => ({ ...bb, [v]: ref })));
  }
  return out;
}

export async function computeHorizon(input: HorizonInput): Promise<Horizon> {
  const { world, actorId, principalId, goal, providers } = input;
  const policy = input.policy ?? RANKING_V1;
  const registry = input.transitions ?? STANDARD;
  const horizon: Horizon = { actorId, goal, satisfied: null, routes: [], excluded: [], next: [], policy: policy.id };

  // Authorization before visibility: an actor that cannot see the scope plans nothing in it.
  if (!world.scopes.includes(goal.scope)) {
    horizon.excluded.push({ orgRef: goal.scope, title: "this World", reasons: ["you cannot see this World"] });
    return horizon;
  }
  for (const hit of matches(world, goal.desired[0], goal.bind)) {
    if (goal.desired.every((p) => matches(world, p, hit.binding).length > 0)) {
      horizon.satisfied = hit.fact;
      return horizon;
    }
  }

  // Why a candidate is not a route, by the thing it was about.
  const exclusions = new Map<string, Set<string>>();
  const note = (b: Binding, reasons: string[]) => {
    const key = b.org ?? b.subject;
    if (!key || !reasons.length) return;
    const set = exclusions.get(key) ?? new Set<string>();
    for (const r of reasons) set.add(r);
    exclusions.set(key, set);
  };

  const solve = (pattern: Pattern, b: Binding, depth: number, seen: Set<string>): Alternative[] => {
    const alternatives: Alternative[] = matches(world, pattern, b).map((m) => ({ binding: m.binding, steps: [] }));
    if (depth >= MAX_DEPTH) return alternatives;
    for (const t of registry.producing(pattern)) {
      if (seen.has(t.id)) continue;
      const produced = t.produces.find((q) => q.predicate === pattern.predicate)!;
      const bound = fitProduced(produced, pattern, b);
      if (!bound) continue;
      for (const candidate of enumerate(t, bound, world)) {
        const early = t.exclude?.(candidate, world, goal) ?? [];
        if (early.length) {
          note(candidate, early);
          continue;
        }
        let branch: Alternative[] = [{ binding: candidate, steps: [] }];
        for (const req of t.requires) {
          const next: Alternative[] = [];
          for (const alt of branch) {
            if (req.present === false) {
              if (matches(world, req.pattern, alt.binding).length === 0) next.push(alt);
              continue;
            }
            for (const sub of solve(req.pattern, alt.binding, depth + 1, new Set([...seen, t.id]))) {
              next.push({ binding: sub.binding, steps: [...alt.steps, ...sub.steps] });
            }
          }
          branch = next;
          if (!branch.length) break;
        }
        for (const alt of branch) {
          const late = t.exclude?.(alt.binding, world, goal) ?? [];
          if (late.length) {
            note(alt.binding, late);
            continue;
          }
          alternatives.push({ binding: alt.binding, steps: [...alt.steps, { t, binding: alt.binding }] });
        }
      }
    }
    return alternatives;
  };

  let plans: Alternative[] = [{ binding: { ...goal.bind }, steps: [] }];
  for (const desired of goal.desired) {
    const next: Alternative[] = [];
    for (const alt of plans) for (const sub of solve(desired, alt.binding, 0, new Set())) next.push({ binding: sub.binding, steps: [...alt.steps, ...sub.steps] });
    plans = next;
  }

  const decisions = new Map<string, Promise<AuthorityDecision>>();
  const decide = (who: string, capability: string, scope: string, money: { amount: string; asset: string } | null = null) => {
    const key = `${who}|${capability}|${scope}|${money?.amount ?? ""}|${money?.asset ?? ""}`;
    if (!decisions.has(key)) decisions.set(key, input.kernelFor(who).authorize({ capability, scope, amount: money?.amount, asset: money?.asset }));
    return decisions.get(key)!;
  };
  const fallback = input.fallback ?? "delegate";

  for (const plan of plans) {
    // Each transition once per binding, in causal order.
    const seenSteps = new Set<string>();
    const planned = plan.steps.filter((s) => {
      const key = `${s.t.id}|${canonical(s.binding)}`;
      if (seenSteps.has(key)) return false;
      seenSteps.add(key);
      return true;
    });
    if (!planned.length) continue;
    const steps: RouteStep[] = [];
    const delegated = new Set<string>();
    for (const { t, binding } of planned) {
      const scope = t.scope(binding, world, goal);
      if (!scope) continue;
      // Who does a step: the actor if its authority allows; otherwise its principal delegates it
      // (a step of the route) or performs it, as the caller asked.
      const money = t.amount?.(binding, world, goal) ?? null;
      let who = actorId;
      let decision = await decide(actorId, t.capability, scope, money);
      if (decision.decision === "DENY" && principalId && principalId !== actorId && fallback !== "none") {
        const theirs = await decide(principalId, t.capability, scope, money);
        if (theirs.decision !== "DENY") {
          const grant = fallback === "delegate" && t.delegable ? await decide(principalId, TRANSITIONS.delegate.capability, scope) : null;
          if (grant && grant.decision !== "DENY") {
            const key = `${t.capability}|${scope}`;
            if (!delegated.has(key)) {
              delegated.add(key);
              const db: Binding = { ...binding, scope, grantee: actorId, grants: t.capability };
              steps.push(routeStep(TRANSITIONS.delegate, db, principalId, grant, world, goal, scope));
            }
            decision = { decision: "ALLOW", reasons: ["granted by the step before"], grant_id: null, policy_id: null, threshold: null, delay_seconds: null };
          } else {
            who = principalId;
            decision = theirs;
          }
        }
      }
      steps.push(routeStep(t, binding, who, decision, world, goal, scope));
    }
    const blockedBy: string[] = [];
    for (const [i, s] of steps.entries()) {
      if (!s.native && !providers.resolve(s.provider.capability)) blockedBy.push(`step ${i + 1}: no provider for ${s.provider.capability} is connected`);
      else if (s.authority.decision === "DENY") blockedBy.push(`step ${i + 1}: ${s.authority.reasons.join("; ") || "not authorized"}`);
    }
    const orgRef = plan.binding.org ?? plan.binding.subject ?? "";
    const draft = {
      goal,
      orgRef,
      title: `${orgRef ? titleOf(world, orgRef) : goal.title}: ${steps.map((s) => s.transition.split(".")[1]).join(" → ")}`,
      steps,
      executable: blockedBy.length === 0,
      blockedBy,
      needsHuman: steps.some((s) => s.actorId !== actorId),
    };
    const id = await sha256Hex(canonical({ goal: { kind: goal.kind, scope: goal.scope, desired: goal.desired, bind: goal.bind }, steps: steps.map((s) => ({ t: s.transition, b: s.binding, a: s.actorId, c: s.consequences })) }));
    horizon.routes.push({ ...draft, id, score: policy.score(draft, world), policy: policy.id });
  }

  const routed = new Set(horizon.routes.map((r) => r.orgRef));
  for (const [ref, reasons] of exclusions) {
    if (!routed.has(ref)) horizon.excluded.push({ orgRef: ref, title: titleOf(world, ref), reasons: [...reasons] });
  }
  horizon.routes.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
  horizon.excluded.sort((a, b) => (a.title < b.title ? -1 : 1));
  horizon.next = horizon.routes.filter((r) => r.executable).map((r) => r.steps[0]);
  return horizon;
}

const titleOf = (w: WorldState, ref: string) => w.entities.get(ref)?.title ?? ref;

function routeStep(t: Transition, binding: Binding, actorId: string, authority: AuthorityDecision, world: WorldState, goal: Goal, scope: string): RouteStep {
  return {
    transition: t.id,
    title: t.title(binding, world, goal),
    binding,
    actorId,
    authority: { actorId, decision: authority.decision, reasons: authority.reasons },
    capability: t.capability,
    scope,
    kind: t.kind,
    targetRef: t.target?.(binding, world, goal) ?? null,
    inReplyTo: t.inReplyTo?.(binding, world, goal) ?? null,
    native: t.native,
    provider: { capability: t.provider, id: null },
    preconditions: t.requires.map((req) => {
      const met = req.present === false ? matches(world, req.pattern, binding).length === 0 : matches(world, req.pattern, binding).length > 0;
      return { label: req.label, met, because: met ? req.because : "comes from an earlier step" };
    }),
    expectedEvidence: t.expectedEvidence,
    failures: [...t.failures],
    uncertainty: t.uncertainty(binding, world, goal),
    consequences: t.consequences(binding, world, goal),
    guards: t.guards?.(binding, world, goal) ?? [],
    predicted: t.predicted?.(binding, world, goal) ?? [],
    payload: t.payload(binding, world, goal),
    amount: t.amount?.(binding, world, goal)?.amount ?? null,
    asset: t.amount?.(binding, world, goal)?.asset ?? null,
  };
}
