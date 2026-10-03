// The consequence pipeline: SOLVE's heartbeat, one implementation for every transition.
//
//   route (recorded) → propose (with declared consequences) → kernel decision → attempt
//   (kernel-native, or a provider) → evidence → reconciliation → settlement, which applies the
//   declared consequences to the canonical World in the same transaction → new Horizon
//
// Every step is keyed by the recorded route and its position, so running it again (a retry, a
// second tab, a crash and reload) continues where the kernel says it is; it never repeats an
// action or a consequence. Nothing here decides authority: the kernel does, for whoever acts.
import { KernelError, type Kernel } from "../kernel/client";
import { sha256Hex } from "../money/settlement";
import type { Providers } from "./providers";
import { canonical, STANDARD, type Transitions } from "./transitions";
import type { Route, RouteStep, StepOutcome } from "./types";
import type { WorldState } from "./world";

export const ROUTE_EVENT = "horizon.route.selected";

// What execution needs from a route: recorded once, then the canonical plan for its actions.
export type RecordedRoute = { eventId: string; routeId: string; goal: Route["goal"]; policy: string; steps: RouteStep[] };

const compact = (s: RouteStep): RouteStep => ({ ...s, preconditions: [], predicted: [], failures: [], authority: { ...s.authority, reasons: [] } });

// The selection is an attributable interpretation: who chose which route, under which ranking
// policy. It is recorded in the selector's own scope (a plan belongs to whoever made it; the
// World's history holds the consequences), never rewritten; choosing again records a new one.
export async function recordRoute(selector: Kernel, route: Route): Promise<RecordedRoute> {
  if (!route.steps.length) throw new Error("an empty route has nothing to record");
  const scope = `actor:${(await selector.whoami()).actor_id}`;
  // A route is its plan (steps, bindings, actors, consequences): selecting the same plan again
  // continues the existing selection, whose actions are keyed to it.
  const existing = (await selector.readEvents(scope, { limit: 500, newestFirst: true })).find((e) => e.type === ROUTE_EVENT && e.payload.route_id === route.id);
  if (existing) {
    const p = existing.payload as { goal: Route["goal"]; policy: string; steps: RouteStep[] };
    return { eventId: existing.id, routeId: route.id, goal: p.goal, policy: p.policy, steps: p.steps };
  }
  const steps = route.steps.map(compact);
  const payload = { route_id: route.id, goal: route.goal, org: route.orgRef, policy: route.policy, score: route.score, steps };
  const eventId = await selector.recordEvent({ type: ROUTE_EVENT, scope, payload, idempotencyKey: `route:${route.id}:${await sha256Hex(JSON.stringify(payload))}` });
  return { eventId, routeId: route.id, goal: route.goal, policy: route.policy, steps };
}

// The reader's latest recorded route for a goal (optionally through one organization), so
// execution resumes after a reload.
export async function loadRoute(reader: Kernel, goal: Route["goal"], orgRef?: string): Promise<RecordedRoute | null> {
  const events = await reader.readEvents(`actor:${(await reader.whoami()).actor_id}`, { limit: 500, newestFirst: true });
  // Structurally: stored JSON does not keep key order.
  const wanted = canonical({ kind: goal.kind, scope: goal.scope, desired: goal.desired, bind: goal.bind });
  const same = (g: Partial<Route["goal"]> | undefined) => !!g && canonical({ kind: g.kind, scope: g.scope, desired: g.desired, bind: g.bind }) === wanted;
  const e = events.find((x) => x.type === ROUTE_EVENT && same((x.payload as { goal?: Route["goal"] }).goal) && (!orgRef || x.payload.org === orgRef));
  if (!e) return null;
  const p = e.payload as { route_id: string; goal: Route["goal"]; policy: string; steps: RouteStep[] };
  return { eventId: e.id, routeId: p.route_id, goal: p.goal, policy: p.policy, steps: p.steps };
}

// An agent may keep its own plans only when its creator says so: the creator holds the agent's
// actor scope and delegates reading it and recording selections in it. Recorded, revocable.
export async function allowPlanning(creator: Kernel, agentId: string) {
  const scope = `actor:${agentId}`;
  await creator.issueGrant({ grantee: agentId, capability: "kernel.read", scope, idempotencyKey: `plan:read:${agentId}` });
  await creator.issueGrant({ grantee: agentId, capability: ROUTE_EVENT, scope, idempotencyKey: `plan:select:${agentId}` });
}

export type Executor = {
  kernelFor(actorId: string): Kernel;
  providers: Providers;
  // The World as the executing actor sees it. `worldFor` (fresh, per actor) is preferred when
  // given: a step's concrete terms are fixed from the World at proposal time, not planning time.
  world: WorldState;
  worldFor?(actorId: string): Promise<WorldState>;
  transitions?: Transitions;
};

// A route is a plan; the action is proposed with what the transition would do now. The plan's
// bindings and actors stay; payload, consequences and guards are re-derived from the current
// World so that what approvers see is what happens (the quote actually recorded, not the one
// predicted when the route was planned).
async function concrete(x: Executor, route: RecordedRoute, index: number, world: WorldState): Promise<RouteStep> {
  const step = route.steps[index];
  const t = (x.transitions ?? STANDARD).get(step.transition);
  // Unknown to this registry, or an actor who cannot even see the World the step is in: the
  // recorded plan stands, and the kernel refuses the actor rather than the shape.
  const scope = t?.scope(step.binding, world, route.goal) ?? null;
  if (!t || !scope) return step;
  const money = t.amount?.(step.binding, world, route.goal) ?? null;
  return {
    ...step,
    scope,
    title: t.title(step.binding, world, route.goal),
    payload: t.payload(step.binding, world, route.goal),
    consequences: t.consequences(step.binding, world, route.goal),
    guards: t.guards?.(step.binding, world, route.goal) ?? [],
    amount: money?.amount ?? null,
    asset: money?.asset ?? null,
  };
}

// The attempts at one step of a recorded route, oldest first.
async function attempts(k: Kernel, route: RecordedRoute, index: number) {
  const step = route.steps[index];
  let actions;
  try {
    actions = await k.readActions(step.scope, 500);
  } catch (error) {
    // An actor that cannot read the scope has no attempts there; its proposal will be refused.
    if (error instanceof KernelError && error.name === "forbidden") return [];
    throw error;
  }
  return actions
    .filter((a) => (a.payload as { route?: string }).route === `event:${route.eventId}` && (a.payload as { step?: number }).step === index)
    .reverse();
}

export async function executeStep(x: Executor, route: RecordedRoute, index: number): Promise<StepOutcome> {
  const actor = route.steps[index].actorId;
  const world = x.worldFor ? await x.worldFor(actor) : x.world;
  const step = await concrete(x, route, index, world);
  const k = x.kernelFor(step.actorId);
  const provider = step.native ? null : x.providers.resolve(step.provider.capability);
  if (!step.native && !provider) return { index, actionId: null, status: "blocked", detail: `no provider for ${step.provider.capability} is connected`, provider: null };
  // Causal order: a step runs only after the steps before it are done.
  for (let i = 0; i < index; i++) {
    if (!(await attempts(x.kernelFor(route.steps[i].actorId), route, i)).some((a) => a.status === "completed")) {
      return { index, actionId: null, status: "blocked", detail: `step ${i + 1} (${route.steps[i].title}) must complete first`, provider: null };
    }
  }
  // A refused attempt stays refused; once the kernel would allow the step (authority was granted
  // since), the next attempt gets its own key. While it would still refuse, report the refusal
  // instead of recording another.
  const prior = await attempts(k, route, index);
  const done = prior.find((a) => a.status === "completed");
  if (done) return { index, actionId: done.action_id, status: "completed", detail: "already completed", provider: null };
  const last = prior.at(-1);
  if (last?.status === "rejected") {
    const now = await k.authorize({ capability: step.capability, scope: step.scope, amount: step.amount ?? undefined, asset: step.asset ?? undefined });
    if (now.decision === "DENY") return { index, actionId: last.action_id, status: "denied", detail: now.reasons.join("; ") || "denied", provider: null };
  }
  const attempt = prior.filter((a) => a.status === "rejected").length;

  let actionId: string;
  try {
    actionId = await k.proposeAction({
      kind: step.kind,
      capability: step.capability,
      scope: step.scope,
      targetRef: step.targetRef ?? undefined,
      amount: step.amount ?? undefined,
      asset: step.asset ?? undefined,
      payload: {
        ...step.payload,
        route: `event:${route.eventId}`,
        step: index,
        binding: step.binding,
        ...(step.consequences.length ? { consequences: step.consequences } : {}),
        ...(step.guards?.length ? { guards: step.guards } : {}),
      },
      idempotencyKey: `route:${route.eventId}:${index}${attempt ? `:${attempt}` : ""}`,
    });
  } catch (error) {
    if (error instanceof KernelError && error.name === "forbidden") return { index, actionId: null, status: "denied", detail: error.message, provider: null };
    // A precondition the kernel found already false: the World moved since the plan.
    if (error instanceof KernelError && error.name === "invalid" && /guard does not hold/.test(error.message)) return { index, actionId: null, status: "failed", detail: error.message, provider: null };
    throw error;
  }
  let action = await k.readAction(actionId);
  const out = (status: StepOutcome["status"], detail: string, by: string | null = provider?.id ?? null): StepOutcome => ({ index, actionId, status, detail, provider: by });

  if (action.status === "completed") return out("completed", "already completed");
  if (action.status === "rejected") return out("denied", action.reasons.join("; ") || "denied");
  if (action.status === "failed" || action.status === "cancelled") return out("failed", action.detail || action.status);
  if (action.status === "proposed") return out("awaiting_authority", `${action.decision.replace(/_/g, " ").toLowerCase()} (${action.approvals} of ${action.threshold ?? 1})`);

  if (step.native) {
    await k.enactAction(actionId);
    action = await k.readAction(actionId);
    return action.status === "completed" ? out("completed", "enacted by the kernel", "kernel") : out("failed", action.detail || action.status, "kernel");
  }
  if (action.status === "authorized") {
    // The kernel re-checks the step's guards right before the outside call.
    await k.beginAction(actionId, `performing through ${provider!.id}`);
    action = await k.readAction(actionId);
    if (action.status === "failed") return out("failed", action.detail || "a guard no longer holds");
  }
  // Enacting, or reopened for reconciliation: ask the provider (idempotent per action), then let
  // its evidence settle what happened.
  const response = await provider!.perform({ actor: k, actorId: step.actorId, actionId, step, world });
  if (response.status === "succeeded") {
    const settled = await k.settleAction({ actionId, status: "completed", result: response.result, detail: response.detail, evidence: response.evidence });
    // The effect landed but a guard lapsed meanwhile: not a consequence until someone reconciles.
    if (settled !== "completed") return out("unknown", (await k.readAction(actionId)).detail || "needs reconciliation");
    return out("completed", response.detail);
  }
  if (response.status === "failed") {
    await k.settleAction({ actionId, status: "failed", detail: response.detail });
    return out("failed", response.detail);
  }
  await k.settleAction({ actionId, status: "needs_reconciliation", detail: response.detail });
  return out("unknown", response.detail);
}

// Runs a recorded route as far as authority and evidence allow, stopping at the first step that is
// not complete: waiting for another authority, refused, failed, unknown or without a provider.
export async function executeRoute(x: Executor, route: RecordedRoute, { only }: { only?: string } = {}): Promise<StepOutcome[]> {
  const outcomes: StepOutcome[] = [];
  for (let i = 0; i < route.steps.length; i++) {
    // An actor may run only its own steps (an agent acting autonomously stops at its principal's).
    if (only && route.steps[i].actorId !== only) {
      const action = await alreadyDone(x, route, i);
      if (action) {
        outcomes.push(action);
        continue;
      }
      outcomes.push({ index: i, actionId: null, status: "awaiting_authority", detail: `waiting for ${route.steps[i].actorId}`, provider: null });
      break;
    }
    const outcome = await executeStep(x, route, i);
    outcomes.push(outcome);
    if (outcome.status !== "completed") break;
  }
  return outcomes;
}

async function alreadyDone(x: Executor, route: RecordedRoute, index: number): Promise<StepOutcome | null> {
  const found = (await attempts(x.kernelFor(route.steps[index].actorId), route, index)).find((a) => a.status === "completed");
  return found ? { index, actionId: found.action_id, status: "completed", detail: "already completed", provider: null } : null;
}
