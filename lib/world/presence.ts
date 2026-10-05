// Who's in the World right now. Kernel-native presence: each viewer records a
// heartbeat event in the World scope every 30 seconds; readers list actors
// whose heartbeat is fresher than 90 seconds. No new auth model — writing a
// heartbeat requires the same World access as anything else, so presence
// automatically respects grants. Append-only: old heartbeats age out by time,
// nothing is deleted.
import type { Kernel } from "../kernel/client";

export const PRESENCE_EVENT = "world.presence.heartbeat";
const FRESH_MS = 90_000;

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
  const events = await kernel.readEvents(worldScope, { limit: 200 });
  const cutoff = Date.now() - FRESH_MS;
  const latest = new Map<string, PresentActor>();
  for (const e of events) {
    if (e.type !== PRESENCE_EVENT) continue;
    const at = new Date(e.occurred_at).getTime();
    if (Number.isNaN(at) || at < cutoff) continue;
    const actorId = e.actor_id;
    const prev = latest.get(actorId);
    if (!prev || at > new Date(prev.at).getTime()) {
      const label = typeof e.payload?.label === "string" && e.payload.label ? e.payload.label : actorId.slice(0, 8);
      latest.set(actorId, { actorId, label, at: e.occurred_at });
    }
  }
  return [...latest.values()].sort((a, b) => a.label.localeCompare(b.label));
}
