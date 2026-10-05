import type { ActorProfile } from "@/lib/kernel/client";

export function formatWorldActorAttribution(
  actorId: string,
  profiles: Map<string, ActorProfile>,
  labels: Map<string, string>,
): string {
  const actor = profiles.get(actorId);
  const name = labels.get(actorId) ?? actorId.slice(0, 8);
  if (actor?.kind !== "agent" || !actor.accountable_party) return name;
  const owner = labels.get(actor.accountable_party) ?? actor.accountable_party.slice(0, 8);
  const kind = actor.role === "ai_companion" ? "bot" : "agent";
  return `${name} · ${kind} for ${owner}`;
}
