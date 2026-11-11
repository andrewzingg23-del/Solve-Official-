import assert from "node:assert/strict";
import { it } from "node:test";
import { CHAT_PROVIDER_OPTIONS, selectChatProvider } from "../../lib/bot/provider-choice";

it("keeps OpenRouter as a backward-compatible default", () => {
  assert.equal(selectChatProvider(undefined), "openrouter");
  assert.equal(selectChatProvider("openrouter"), "openrouter");
});

it("accepts only supported provider IDs, not user-controlled endpoints or models", () => {
  assert.equal(selectChatProvider("openai"), "openai");
  for (const value of ["", "unknown", "https://example.com", "gpt-6.1-sol", null, 0, {}, []]) {
    assert.equal(selectChatProvider(value), null);
  }
});

it("offers exactly the two providers and does not expose keys or model names", () => {
  assert.deepEqual(CHAT_PROVIDER_OPTIONS.map(p => p.id), ["openrouter", "openai"]);
  assert.equal(JSON.stringify(CHAT_PROVIDER_OPTIONS).includes("API_KEY"), false);
});
