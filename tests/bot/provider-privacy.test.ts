import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildChatCompletionBody } from "../../lib/bot/openrouter";

const args = {
  model: "anthropic/claude-haiku-4.5",
  system: "Help with my project within existing permissions.",
  history: [{ role: "user" as const, content: "Hello" }],
  message: "Make a plan.",
};

test("every model request restricts provider data collection and preserves eligible fallback", () => {
  const body = buildChatCompletionBody(args);
  assert.deepEqual(body.provider, {
    data_collection: "deny",
    allow_fallbacks: true,
  });
  assert.equal(body.model, args.model);
  assert.equal(body.max_tokens, 1024);
  assert.equal(JSON.stringify(body).includes("Bearer"), false);
});

test("explicit zero-retention operator setting opts into stricter provider pool", () => {
  const body = buildChatCompletionBody({ ...args, requireZeroRetention: true });
  assert.deepEqual(body.provider, {
    data_collection: "deny",
    allow_fallbacks: true,
    zdr: true,
  });
  assert.deepEqual(buildChatCompletionBody({ ...args, requireZeroRetention: false }).provider, {
    data_collection: "deny",
    allow_fallbacks: true,
  });
});

test("server controls stricter privacy setting; browser cannot inject it through message body", () => {
  const route = readFileSync("app/api/bot/chat/route.ts", "utf8");
  assert.match(route, /requireZeroRetention: process\.env\.OPENROUTER_ZDR_REQUIRED === "true"/);
  assert.doesNotMatch(route, /requireZeroRetention: body\./);
});
