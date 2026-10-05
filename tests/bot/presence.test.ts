// Live presence: the connector's broadcast goes to the owner's private topic only, carries which
// assistant used which tool (never content), and a failing Realtime never fails the tool call.
import assert from "node:assert/strict";
import { it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { broadcastActivity, describeActivity, presenceTopic } from "../../lib/bot/presence";

function fakeService(fail = false) {
  const sent: { topic: string; config: unknown; event: string; payload: unknown }[] = [];
  let removed = 0;
  const service = {
    channel(topic: string, opts: { config: unknown }) {
      return {
        async httpSend(event: string, payload: unknown) {
          if (fail) throw new Error("realtime is down");
          sent.push({ topic, config: opts.config, event, payload });
          return { success: true };
        },
      };
    },
    async removeChannel() {
      removed++;
      return "ok";
    },
  } as unknown as SupabaseClient;
  return { service, sent, removed: () => removed };
}

it("broadcasts who is doing what to the owner's private topic, and never fails the call", async () => {
  const { service, sent, removed } = fakeService();
  await broadcastActivity(service, "user-1", { tool: "remember", client: "Claude" }, new Date("2026-10-04T12:00:00Z"));
  assert.deepEqual(sent, [{ topic: "bot-live:user-1", config: { private: true }, event: "activity", payload: { tool: "remember", client: "Claude", at: "2026-10-04T12:00:00.000Z" } }]);
  assert.equal(removed(), 1, "no channel is left open");
  assert.equal(presenceTopic("user-1"), "bot-live:user-1");

  const down = fakeService(true);
  await broadcastActivity(down.service, "user-1", { tool: "search", client: "ChatGPT" });
  assert.equal(down.removed(), 1);

  assert.equal(describeActivity({ tool: "search", client: "ChatGPT" }, "Nova"), "ChatGPT is searching Nova's memory");
  assert.equal(describeActivity({ tool: "something_new", client: "Muse" }, "Nova"), "Muse is working with Nova");
});
