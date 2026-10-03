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
import type { Providers } from "./providers";
import type { Route, RouteStep, StepOutcome } from "./types";
import type { WorldState } from "./world";

export const ROUTE_EVENT = "horizon.route.selected";

// What execution needs from a route: recorded once, then the canonical plan for its actions.
export type RecordedRoute = { eventId: string; routeId: string; goal: Route["goal"]; policy: string; steps: RouteStep[] };

const compact = (s: RouteStep): RouteStep => ({ ...s, preconditions: [], predicted: [], failures: [], authority: { ...s.authority, reasons: [] } });

// The selection is an attributable interpretation: who chose which route, under which ranking
// policy. It is never rewritten; choosing again records a new selection.
export async function recordRoute(selector: Kernel, route: Route): Promise<RecordedRoute> {
  const scope = route.steps[0]?.scope;
  if (!scope) throw new Error("an empty route has nothing to record");
  const steps = route.steps.map(compact);
  const eventId = await selector.recordEvent({
    type: ROUTE_EVENT,
    scope,
    payload: { route_id: route.id, goal: route.goal, org: route.orgRef, policy: route.policy, score: route.score, steps },
    idempotencyKey: `route:${route.id}`,
  });
  return { eventId, routeId: route.id, goal: route.goal, policy: route.policy, steps };
}

// The latest recorded route for a goal in a scope, so execution resumes after a reload.
export async function loadRoute(reader: Kernel, scope: string, goal: Route["goal"]): Promise<RecordedRoute | null> {
  const events = await reader.readEvents(scope, { limit: 500, newestFirst: true });
  // Field by field: stored JSON does not keep key order.
  const same = (g: Partial<Route["goal"]> | undefined) => !!g && g.kind === goal.kind && g.world === goal.world && g.capability === goal.capability && (g.quantity ?? null) === (goal.quantity ?? null);
  const e = events.find((x) => x.type === ROUTE_EVENT && same((x.payload as { goal?: Route["goal"] }).goal));
  if (!e) return null;
  const p = e.payload as { route_id: string; goal: Route["goal"]; policy: string; steps: RouteStep[] };
  return { eventId: e.id, routeId: p.route_id, goal: p.goal, policy: p.policy, steps: p.steps };
}

export type Executor = {
  kernelFor(actorId: string): Kernel;
  providers: Providers;
  world: WorldState;
};

export async function executeStep(x: Executor, route: RecordedRoute, index: number): Promise<StepOutcome> {
  const step = route.steps[index];
  const k = x.kernelFor(step.actorId);
  const provider = step.native ? null : x.providers.resolve(step.provider.capability);
  if (!step.native && !provider) return { index, actionId: null, status: "blocked", detail: `no provider for ${step.provider.capability} is connected`, provider: null };

  let actionId: string;
  try {
    actionId = await k.proposeAction({
      kind: step.kind,
      capability: step.capability,
      scope: step.scope,
      targetRef: step.targetRef ?? undefined,
      payload: { ...step.payload, route: `event:${route.eventId}`, step: index, binding: step.binding, ...(step.consequences.length ? { consequences: step.consequences } : {}) },
      idempotencyKey: `route:${route.eventId}:${index}`,
    });
  } catch (error) {
    if (error instanceof KernelError && error.name === "forbidden") return { index, actionId: null, status: "denied", detail: error.message, provider: null };
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
    return out("completed", "enacted by the kernel", "kernel");
  }
  if (action.status === "authorized") {
    await k.beginAction(actionId, `performing through ${provider!.id}`);
    action = await k.readAction(actionId);
  }
  // Enacting, or reopened for reconciliation: ask the provider (idempotent per action), then let
  // its evidence settle what happened.
  const response = await provider!.perform({ actor: k, actorId: step.actorId, actionId, step, world: x.world });
  if (response.status === "succeeded") {
    await k.settleAction({ actionId, status: "completed", result: response.result, detail: response.detail, evidence: response.evidence });
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
  const step = route.steps[index];
  const actions = await x.kernelFor(step.actorId).readActions(step.scope, 500);
  const found = actions.find((a) => (a.payload as { route?: string; step?: number }).route === `event:${route.eventId}` && (a.payload as { step?: number }).step === index);
  return found?.status === "completed" ? { index, actionId: found.action_id, status: "completed", detail: "already completed", provider: null } : null;
}
