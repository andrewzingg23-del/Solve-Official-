// The spend policy: the kernel counts, this module judges. Pure — so the
// threshold, the fallbacks and the person's message are all testable without a
// database. A meter that cannot be read must never lock someone out of their
// own workspace.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  chargeSpend,
  checkSpend,
  judge,
  remaining,
  spentMessage,
  tokensPerWindow,
  DEFAULT_TOKENS_PER_WINDOW,
  type SpendMeter,
} from "../../lib/bot/meter";

const meter = (spend: { tokens: number; calls: number }, calls: string[] = []): SpendMeter => ({
  readAiSpend: async () => {
    calls.push("read");
    return spend;
  },
  recordAiSpend: async (input) => {
    calls.push(`record:${input.tokens}:${input.kind}:${input.requestId ?? ""}`);
    return spend;
  },
});

const broken: SpendMeter = {
  readAiSpend: async () => {
    throw new Error("kernel unreachable");
  },
  recordAiSpend: async () => {
    throw new Error("kernel unreachable");
  },
};

describe("the spend policy", () => {
  it("takes the limit from env and falls back to the default", () => {
    assert.equal(tokensPerWindow({}), DEFAULT_TOKENS_PER_WINDOW);
    assert.equal(tokensPerWindow({ CHAT_MAX_TOKENS_PER_HOUR: "5000" }), 5000);
    assert.equal(tokensPerWindow({ CHAT_MAX_TOKENS_PER_HOUR: "0" }), DEFAULT_TOKENS_PER_WINDOW);
    assert.equal(tokensPerWindow({ CHAT_MAX_TOKENS_PER_HOUR: "nonsense" }), DEFAULT_TOKENS_PER_WINDOW);
  });

  it("blocks at the limit, not before, and reports what is left", () => {
    assert.equal(judge({ tokens: 99, calls: 1 }, 100).blocked, false);
    assert.equal(judge({ tokens: 100, calls: 1 }, 100).blocked, true);
    assert.equal(judge({ tokens: 101, calls: 1 }, 100).blocked, true);
    assert.equal(remaining(judge({ tokens: 40, calls: 1 }, 100)), 60);
    assert.equal(remaining(judge({ tokens: 400, calls: 1 }, 100)), 0);
  });

  it("names the kernel as the source of a real count", async () => {
    const verdict = await checkSpend(meter({ tokens: 10, calls: 1 }), 100);
    assert.equal(verdict.source, "kernel");
    assert.equal(verdict.tokens, 10);
  });

  it("an unreadable meter never blocks the person", async () => {
    const verdict = await checkSpend(broken, 100);
    assert.equal(verdict.blocked, false);
    assert.equal(verdict.source, "unknown");
    // No meter at all (a guest) behaves the same way.
    const none = await checkSpend(null, 100);
    assert.equal(none.blocked, false);
    assert.equal(none.source, "unknown");
  });

  it("charges the completed call, passing the retry key through", async () => {
    const calls: string[] = [];
    await chargeSpend(meter({ tokens: 50, calls: 1 }, calls), { tokens: 12.4, kind: "chat", requestId: "t1" });
    // Rounded up: a fractional token is still a token spent.
    assert.deepEqual(calls, ["record:13:chat:t1"]);
  });

  it("never charges a non-count, and a failed charge is not fatal", async () => {
    const calls: string[] = [];
    const m = meter({ tokens: 1, calls: 1 }, calls);
    await chargeSpend(m, { tokens: 0, kind: "chat" });
    await chargeSpend(m, { tokens: Number.NaN, kind: "chat" });
    await chargeSpend(null, { tokens: 10, kind: "chat" });
    assert.deepEqual(calls, []);
    const verdict = await chargeSpend(broken, { tokens: 10, kind: "chat" });
    assert.equal(verdict.source, "unknown");
    assert.equal(verdict.blocked, false);
  });

  it("tells the person what ran out and when it comes back", () => {
    const text = spentMessage(judge({ tokens: 150000, calls: 9 }, 150000));
    assert.match(text, /150,000/);
    assert.match(text, /60 minutes/);
    assert.doesNotMatch(text, /error|wrong/i);
  });
});
