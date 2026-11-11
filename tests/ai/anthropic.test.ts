// The Anthropic adapter: a request shaped the way the current models actually accept, and a
// response read without mistaking a decline or a thinking block for an answer.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ANTHROPIC_DEFAULT_MODEL,
  ANTHROPIC_MESSAGES_URL,
  ANTHROPIC_VERSION,
  AnthropicRefusal,
  buildAnthropicMessagesBody,
  completeAnthropicChat,
  estimateAnthropicCostUsd,
  readAnthropicReply,
} from "../../lib/ai/anthropic";

const body = (over: Partial<Parameters<typeof buildAnthropicMessagesBody>[0]> = {}) =>
  buildAnthropicMessagesBody({ model: ANTHROPIC_DEFAULT_MODEL, system: "You are Nova.", history: [], message: "hello", ...over });

describe("the Anthropic request body", () => {
  it("puts the ask last, after the history", () => {
    const b = body({ history: [{ role: "user", content: "hi" }, { role: "assistant", content: "hey" }] });
    assert.deepEqual(b.messages.map(m => m.role), ["user", "assistant", "user"]);
    assert.equal(b.messages.at(-1)!.content, "hello");
    assert.equal(b.system, "You are Nova.");
  });

  it("always bounds max_tokens", () => {
    assert.equal(body().max_tokens, 2048);
    assert.equal(body({ maxTokens: 512 }).max_tokens, 512);
  });

  it("sends none of the fields the current models reject", () => {
    const keys = Object.keys(body({ effort: "high" }));
    for (const rejected of ["thinking", "budget_tokens", "temperature", "top_p", "top_k"]) {
      assert.ok(!keys.includes(rejected), `${rejected} must never be sent`);
    }
  });

  it("carries effort only when asked, inside output_config", () => {
    assert.equal(body().output_config, undefined);
    assert.deepEqual(body({ effort: "low" }).output_config, { effort: "low" });
  });
});

describe("reading an Anthropic response", () => {
  it("joins the text blocks and ignores thinking blocks", () => {
    const done = readAnthropicReply({
      model: "claude-opus-5-5",
      stop_reason: "end_turn",
      content: [
        { type: "thinking", thinking: "not the answer" },
        { type: "text", text: "Half" },
        { type: "text", text: " an answer" },
      ],
      usage: { input_tokens: 10, output_tokens: 4, cache_read_input_tokens: 7 },
    });
    assert.equal(done.reply, "Half an answer");
    assert.equal(done.inputTokens, 10);
    assert.equal(done.outputTokens, 4);
    assert.equal(done.cachedTokens, 7);
    assert.equal(done.model, "claude-opus-5-5");
  });

  it("a decline is an error, never an empty answer", () => {
    assert.throws(
      () => readAnthropicReply({ stop_reason: "refusal", stop_details: { category: "cyber" }, content: [] }),
      (e: unknown) => e instanceof AnthropicRefusal && e.category === "cyber",
    );
    // A decline is checked before the content, so content that looks fine can't mask it.
    assert.throws(
      () => readAnthropicReply({ stop_reason: "refusal", stop_details: null, content: [{ type: "text", text: "sure!" }] }),
      (e: unknown) => e instanceof AnthropicRefusal && e.category === null,
    );
  });

  it("survives a malformed body instead of throwing a type error", () => {
    assert.equal(readAnthropicReply(null).reply, "");
    assert.equal(readAnthropicReply({ content: "not an array" }).reply, "");
    assert.equal(readAnthropicReply({ usage: { input_tokens: -5, output_tokens: "x" } }).inputTokens, 0);
  });
});

describe("the call", () => {
  const ok = (payload: unknown) =>
    (async () => new Response(JSON.stringify(payload), { status: 200 })) as unknown as typeof fetch;

  it("sends the key and version as headers, and the key never lands in the body", async () => {
    let seen: { url?: string; init?: RequestInit } = {};
    const fetchImpl = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return new Response(JSON.stringify({ content: [{ type: "text", text: "hi" }], stop_reason: "end_turn" }), { status: 200 });
    }) as unknown as typeof fetch;
    const done = await completeAnthropicChat("sk-test-key", body(), { fetchImpl });
    assert.equal(done.reply, "hi");
    assert.equal(seen.url, ANTHROPIC_MESSAGES_URL);
    const headers = seen.init!.headers as Record<string, string>;
    assert.equal(headers["x-api-key"], "sk-test-key");
    assert.equal(headers["anthropic-version"], ANTHROPIC_VERSION);
    assert.doesNotMatch(String(seen.init!.body), /sk-test-key/, "the key must not be in the request body");
  });

  it("surfaces the provider's own message on a failure, truncated", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ error: { message: "x".repeat(400) } }), { status: 429 })) as unknown as typeof fetch;
    await assert.rejects(() => completeAnthropicChat("k", body(), { fetchImpl }), (e: unknown) => {
      const message = (e as Error).message;
      assert.match(message, /^Claude returned 429: x+$/);
      assert.ok(message.length < 260, "the provider's message is truncated");
      return true;
    });
  });

  it("does not choke on a non-JSON error body", async () => {
    const fetchImpl = (async () => new Response("<html>gateway</html>", { status: 502 })) as unknown as typeof fetch;
    await assert.rejects(() => completeAnthropicChat("k", body(), { fetchImpl }), /Claude returned 502/);
  });

  it("a decline from the call is the refusal error, not a blank reply", async () => {
    await assert.rejects(
      () => completeAnthropicChat("k", body(), { fetchImpl: ok({ stop_reason: "refusal", stop_details: { category: "bio" }, content: [] }) }),
      (e: unknown) => e instanceof AnthropicRefusal,
    );
  });
});

describe("cost", () => {
  it("prices the current models and returns 0 for an unknown one", () => {
    // 1k in + 5k out, the measured shape of a first-draft generation.
    assert.equal(estimateAnthropicCostUsd("claude-haiku-5-5", 1000, 5000), 0.0026);
    assert.equal(estimateAnthropicCostUsd("claude-sonnet-5-5", 1000, 5000), 0.052);
    assert.equal(estimateAnthropicCostUsd("claude-opus-5-5", 1000, 5000), 0.104);
    assert.equal(estimateAnthropicCostUsd("some-other-model", 1000, 5000), 0);
  });
});
