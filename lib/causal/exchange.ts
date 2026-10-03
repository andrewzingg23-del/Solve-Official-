// The counterparty's side of an exchange, through the same loop. An organization's agent reads
// the World as its own authority lets it (its inbox included), finds the inquiries addressed to its
// organization that are still open, plans each answer through the Horizon, records its selection in
// its own scope and runs it alone. Nothing here is a special path for "the other side": the asker
// and the answerer use one registry, one planner, one pipeline, one kernel.
import type { Kernel } from "../kernel/client";
import { computeHorizon } from "./horizon";
import { executeRoute, recordRoute } from "./pipeline";
import type { Providers } from "./providers";
import { openInquiryGoals, type Transitions } from "./transitions";
import type { Goal, Route, StepOutcome } from "./types";
import { loadWorld } from "./world";

export type Answerer = {
  // The agent's own session.
  kernel: Kernel;
  actorId: string;
  orgRef: string;
  kernelFor?(actorId: string): Kernel;
  // Providers for the steps that need one (answering is kernel-native and needs none).
  providers: Providers;
  transitions?: Transitions;
};

export type Answered = { goal: Goal; route: Route | null; outcomes: StepOutcome[] };

// Answers every open inquiry to the organization that the agent's own authority allows, once each;
// an inquiry it may not answer stays open with the kernel's reason in the route.
export async function answerInquiries(x: Answerer): Promise<Answered[]> {
  // The agent acts through its own session; other actors (read-only here) through kernelFor.
  const kernelFor = (id: string) => (id === x.actorId ? x.kernel : (x.kernelFor?.(id) ?? x.kernel));
  const providers = x.providers;
  const world = await loadWorld(x.kernel, x.actorId);
  const answered: Answered[] = [];
  for (const goal of openInquiryGoals(world, x.orgRef)) {
    // On its own authority or not at all: nobody stands in for an organization's agent.
    const horizon = await computeHorizon({ world, actorId: x.actorId, principalId: null, goal, kernelFor, providers, transitions: x.transitions, fallback: "none" });
    const route = horizon.routes[0] ?? null;
    if (!route || !route.executable) {
      answered.push({ goal, route, outcomes: [] });
      continue;
    }
    const recorded = await recordRoute(x.kernel, route);
    const outcomes = await executeRoute(
      { kernelFor, providers, world, worldFor: (id) => (id === x.actorId ? Promise.resolve(world) : loadWorld(kernelFor(id), id)), transitions: x.transitions },
      recorded,
      { only: x.actorId },
    );
    answered.push({ goal, route, outcomes });
  }
  return answered;
}
