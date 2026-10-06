import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Kernel, KernelEvent } from "../../lib/kernel/client";
import { BRIEF_WRITTEN, buildBriefPrompt, readBrief, writeBrief, BRIEF_TTL_MS } from "../../lib/bot/brief";

function fakeKernel(events: KernelEvent[] = []) {
  const recorded: { type: string; payload: Record<string, unknown> }[] = [];
  const kernel = {
    readEvents: async () => events,
    recordEvent: async (input: { type: string; payload?: Record<string, unknown> }) => {
      recorded.push({ type: input.type, payload: input.payload ?? {} });
      return "id";
    },
  } as unknown as Kernel;
  return { kernel, recorded };
}

function briefEvent(at: string, text: string): KernelEvent {
  return {
    seq: 1, id: "b1", occurred_at: at, type: BRIEF_WRITTEN, scope: "actor:o/bot:memory",
    actor_id: "o", on_behalf_of: null, grant_id: null, auth_method: "user_jwt",
    payload: { text }, corrects: null, correlation_id: null, hash: "h",
  };
}

describe("while you were away", () => {
  it("returns a fresh cached brief", async () => {
    const { kernel } = fakeKernel([briefEvent(new Date().toISOString(), "All quiet.")]);
    const brief = await readBrief(kernel, "o");
    assert.equal(brief?.text, "All quiet.");
  });

  it("ignores a stale brief", async () => {
    const old = new Date(Date.now() - BRIEF_TTL_MS - 1000).toISOString();
    const { kernel } = fakeKernel([briefEvent(old, "Old news.")]);
    assert.equal(await readBrief(kernel, "o"), null);
  });

  it("writes the brief as a kernel event", async () => {
    const { kernel, recorded } = fakeKernel([]);
    await writeBrief(kernel, "o", "Heads up.");
    assert.equal(recorded[0].type, BRIEF_WRITTEN);
  });

  it("builds a grounded prompt", () => {
    const prompt = buildBriefPrompt({
      botName: "Ava",
      waiting: [{ kind: "approve", ask: "3 messages", worldTitle: "Launch" }],
      newMemories: 0,
      recentWorlds: [],
    });
    assert.match(prompt, /Ava/);
    assert.match(prompt, /3 messages/);
    assert.match(prompt, /Never invent/);
  });
});
