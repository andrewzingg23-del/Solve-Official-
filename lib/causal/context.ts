// An actor's context: its intelligent interface into reality, built only from what that actor's
// own authority lets it read, so it is never a second source of truth and never shows something to
// then forbid it. The same function serves a human, an agent, an organization's agent or any future
// principal: nothing in it assumes a person at a screen.
import type { Kernel } from "../kernel/client";
import { computeHorizon, type HorizonInput } from "./horizon";
import { STANDARD } from "./transitions";
import type { Fact, Goal, Horizon } from "./types";
import { loadWorld, type WorldState } from "./world";

export type ActorContext = {
  who: { actorId: string; label: string; kind: string; role: string | null; principalId: string | null };
  where: { world: string | null; title: string | null; scope: string | null };
  sees: { scopes: string[]; entities: number; facts: number };
  can: { capability: string; scope: string; decision: string }[];
  cannot: { capability: string; scope: string; reasons: string[] }[];
  intent: Goal | null;
  // What the actor believes about its goal, each with the provenance that supports it.
  beliefs: Fact[];
  horizon: Horizon | null;
  world: WorldState;
};

export async function buildContext(
  input: Omit<HorizonInput, "world" | "actorId" | "principalId" | "goal"> & { kernel: Kernel; actorId: string; goal: Goal | null },
): Promise<ActorContext> {
  const { kernel, actorId, goal } = input;
  const world = await loadWorld(kernel, actorId);
  const [profile] = await kernel.readActors([actorId]);
  const principalId = profile?.kind === "agent" ? (profile.owner_id ?? null) : null;
  const target = goal?.world ? world.entities.get(goal.world) : undefined;
  const scope = goal?.scope ?? null;

  const can: ActorContext["can"] = [];
  const cannot: ActorContext["cannot"] = [];
  if (scope) {
    const capabilities = [...new Set(["kernel.read", "world.relation.write", ...(input.transitions ?? STANDARD).all().map((t) => t.capability)])];
    for (const capability of capabilities) {
      const d = await kernel.authorize({ capability, scope });
      if (d.decision === "DENY") cannot.push({ capability, scope, reasons: d.reasons });
      else can.push({ capability, scope, decision: d.decision });
    }
  }
  const horizon = goal ? await computeHorizon({ ...input, world, actorId, principalId, goal }) : null;
  const relevant = new Set<string>(goal ? [...Object.values(goal.bind), ...(horizon?.routes.map((r) => r.orgRef) ?? []), ...(horizon?.excluded.map((e) => e.orgRef) ?? [])] : []);
  return {
    who: { actorId, label: profile?.label ?? "", kind: profile?.kind ?? "unknown", role: profile?.role ?? null, principalId },
    where: { world: goal?.world ?? null, title: target?.title ?? goal?.title ?? null, scope },
    sees: { scopes: world.scopes, entities: world.entities.size, facts: world.facts.length },
    can,
    cannot,
    intent: goal,
    beliefs: world.facts.filter((f) => relevant.has(f.subject) || (f.object !== null && relevant.has(f.object))),
    horizon,
    world,
  };
}
