import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Kernel, KernelEvent } from "../../lib/kernel/client";
import { heartbeat, PRESENCE_EVENT, readPresence } from "../../lib/world/presence";

const SCOPE = "world:00000000-0000-4000-8000-000000000001";

function event(over: Partial<KernelEvent> = {}): KernelEvent {
  return {
    seq: 1,
    id: "e1",
    occurred_at: new Date().toISOString(),
    type: PRESENCE_EVENT,
    scope: SCOPE,
    actor_id: "actor-1",
    on_behalf_of: null,
    grant_id: null,
    auth_method: "user_jwt",
    payload: { label: "Drew" },
    corrects: null,
    correlation_id: null,
    hash: "h",
    ...over,
  };
}

function fakeKernel(events: KernelEvent[], label = "Drew") {
  const recorded: { type: string; scope: string; payload: Record<string, unknown> }[] = [];
  return {
    whoami: async () => ({ actor_id: "actor-1", kind: "human", label, owner_id: null }),
    recordEvent: async (input: { type: string; scope: string; payload?: Record<string, unknown> }) => {
      recorded.push({ type: input.type, scope: input.scope, payload: input.payload ?? {} });
      return "event-id";
    },
    readEvents: async () => events,
    recorded,
  } as unknown as Kernel & { recorded: typeof recorded };
}

describe("world presence", () => {
  it("heartbeat records a heartbeat event in the world scope", async () => {
    const k = fakeKernel([]);
    await heartbeat(k, SCOPE);
    assert.equal(k.recorded.length, 1);
    assert.equal(k.recorded[0].type, PRESENCE_EVENT);
    assert.equal(k.recorded[0].scope, SCOPE);
  });

  it("lists actors with fresh heartbeats, latest label wins", async () => {
    const now = Date.now();
    const k = fakeKernel([
      event({ actor_id: "a", occurred_at: new Date(now - 10_000).toISOString(), payload: { label: "Old" } }),
      event({ actor_id: "a", occurred_at: new Date(now - 5_000).toISOString(), payload: { label: "New" } }),
      event({ actor_id: "b", occurred_at: new Date(now - 20_000).toISOString(), payload: { label: "Bee" } }),
    ]);
    const present = await readPresence(k, SCOPE);
    assert.deepEqual(present.map((p) => p.label).sort(), ["Bee", "New"]);
  });

  it("drops stale heartbeats and non-heartbeat events", async () => {
    const now = Date.now();
    const k = fakeKernel([
      event({ actor_id: "stale", occurred_at: new Date(now - 120_000).toISOString() }),
      event({ type: "world.entity.write", actor_id: "other" }),
    ]);
    assert.deepEqual(await readPresence(k, SCOPE), []);
  });
});
