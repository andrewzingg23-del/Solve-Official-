import assert from "node:assert/strict";
import { it } from "node:test";
import { estimateAnthropicCostUsd, completeAnthropicChat, buildAnthropicMessagesBody } from "../../lib/ai/anthropic";
import { parseOpenAIResponse } from "../../lib/ai/openai";

it("an unpriced model is unknown, never a free call", () => {
  assert.equal(estimateAnthropicCostUsd("unpriced", 100, 100), null);
});
it("provider diagnostics cannot carry a credential or prompt into an error", async () => {
  const body = buildAnthropicMessagesBody({ model: "claude-haiku-5-5", system: "private", history: [], message: "hello" });
  await assert.rejects(completeAnthropicChat("secret-fixture", body, {
    fetchImpl: async () => new Response('secret-fixture private user prompt', { status: 401 }),
  }), (e: unknown) => {
    assert.doesNotMatch(String(e), /secret-fixture|private user prompt/);
    assert.match(String(e), /credentials|permission/i);
    return true;
  });
});
it("OpenAI reports missing usage as unknown and preserves the actual returned model", () => {
  const done = parseOpenAIResponse({ model: "actual-model", output_text: "Hello" });
  assert.equal(done.inputTokens, null);
  assert.equal(done.outputTokens, null);
  assert.equal(done.model, "actual-model");
});
