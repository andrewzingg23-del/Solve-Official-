// Who's in the World right now. Kernel-native presence: each viewer records a
// heartbeat event in the World scope every 30 seconds; readers list actors
// whose heartbeat is fresher than 90 seconds. No new auth model — writing a
// heartbeat requires the same World access as anything else, so presence
// automatically respects grants. Append-only: old heartbeats age out by time,
// nothing is deleted.
import type { Kernel } from "../kernel/client";

export const PRESENCE_EVENT = "world.presence.heartbeat";

export type PresentActor = { actorId: string; label: string; at: string };

export async function heartbeat(kernel: Kernel, worldScope: string): Promise<void> {
  const me = await kernel.whoami();
  await kernel.recordEvent({
    type: PRESENCE_EVENT,
    scope: worldScope,
    payload: { label: me.label },
    idempotencyKey: `presence:${me.actor_id}:${Math.floor(Date.now() / 30_000)}`,
  });
}

export async function readPresence(kernel: Kernel, worldScope: string): Promise<PresentActor[]> {
  const actors = await kernel.readWorldPresence(worldScope);
  return actors.map(a => ({ actorId: a.actor_id, label: a.label, at: new Date(a.at).toISOString() }));
}
