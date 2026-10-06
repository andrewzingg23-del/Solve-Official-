// The room's talking bot: the chat request validates, the system prompt speaks
// as the person's bot, and model picking prefers the cheapest capable model.
import assert from "node:assert/strict";
import { it } from "node:test";
import {
  buildChatSystemPrompt,
  pickChatModel,
  validateChatBody,
} from "../../lib/bot/chat";

it("accepts a well-formed chat request", () => {
  const chat = validateChatBody({
    message: "hello",
    botName: "Nova",
    history: [{ role: "user", content: "hi" }, { role: "assistant", content: "hey" }],
  });
  assert.ok(chat);
  assert.equal(chat.message, "hello");
  assert.equal(chat.botName, "Nova");
  assert.equal(chat.history.length, 2);
});

it("history is optional", () => {
  const chat = validateChatBody({ message: "hello", botName: "Nova" });
  assert.ok(chat);
  assert.deepEqual(chat.history, []);
});

it("rejects missing or oversized fields", () => {
  assert.equal(validateChatBody(null), null);
  assert.equal(validateChatBody({ message: "hello" }), null);
  assert.equal(validateChatBody({ message: "", botName: "Nova" }), null);
  assert.equal(validateChatBody({ message: "x".repeat(2001), botName: "Nova" }), null);
  assert.equal(validateChatBody({ message: "hi", botName: "Nova", history: [{ role: "user", content: "" }] }), null);
  assert.equal(
    validateChatBody({ message: "hi", botName: "Nova", history: [{ role: "stranger", content: "hi" }] }),
    null,
  );
  assert.equal(
    validateChatBody({
      message: "hi",
      botName: "Nova",
      history: Array.from({ length: 21 }, () => ({ role: "user", content: "hi" })),
    }),
    null,
  );
});

it("the system prompt speaks as the bot and sets its bounds", () => {
  const prompt = buildChatSystemPrompt("Nova");
  assert.ok(prompt.includes("Nova"));
  assert.ok(prompt.toLowerCase().includes("never invent"));
  assert.ok(prompt.toLowerCase().includes("kernel"));
});

it("picks the cheapest capable model", () => {
  assert.equal(pickChatModel([]), null);
  assert.equal(
    pickChatModel(["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5"]),
    "claude-haiku-4-5",
  );
  assert.equal(pickChatModel(["claude-opus-4-6", "claude-sonnet-4-6"]), "claude-sonnet-4-6");
  assert.equal(pickChatModel(["claude-opus-4-6"]), "claude-opus-4-6");
});

it("rate-limits each person to 30 messages an hour", async () => {
  const { rateLimited, MAX_PER_WINDOW } = await import("../../lib/bot/chat");
  const user = `test-user-${Date.now()}`;
  for (let i = 0; i < MAX_PER_WINDOW; i++) assert.equal(rateLimited(user), false);
  assert.equal(rateLimited(user), true, "the 31st message in the hour is refused");
  assert.equal(rateLimited("someone-else"), false, "limits are per person");
});

it("routes simple turns to flash and complex turns to smart", async () => {
  const { parseTier, pickChatModel } = await import("../../lib/bot/chat");
  const ids = ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5"];

  const simple = parseTier("hey, what's up");
  assert.equal(simple.tier, "flash");
  assert.equal(pickChatModel(ids, simple.tier), "claude-haiku-4-5");

  const forced = parseTier("smart: analyze this quarter for me");
  assert.equal(forced.tier, "smart");
  assert.equal(forced.message, "analyze this quarter for me", "prefix is stripped");
  assert.equal(pickChatModel(ids, forced.tier), "claude-sonnet-4-6");

  const long = parseTier("x".repeat(601));
  assert.equal(long.tier, "smart");

  const code = parseTier("fix this:\n```js\nconst x = 1;\n```");
  assert.equal(code.tier, "smart");

  assert.equal(pickChatModel(ids), "claude-haiku-4-5", "default tier stays flash");
});

it("caps hourly token spend per person", async () => {
  const { recordSpend, spendBlocked, tokensSpentThisHour, maxTokensPerHour } = await import(
    "../../lib/bot/chat"
  );
  const user = `spend-user-${Date.now()}`;
  assert.equal(spendBlocked(user), false);
  assert.equal(tokensSpentThisHour(user), 0);
  recordSpend(user, 1000);
  assert.equal(tokensSpentThisHour(user), 1000);
  assert.equal(spendBlocked(user), false, "well under the cap");
  recordSpend(user, maxTokensPerHour());
  assert.equal(spendBlocked(user), true, "at the cap the next turn is refused");
  assert.equal(spendBlocked(`other-${Date.now()}`), false, "budgets are per person");
});

it("estimates cost from the model family, labeled as estimate", async () => {
  const { estimateCostUsd } = await import("../../lib/bot/chat");
  const haiku = estimateCostUsd("claude-haiku-4-5", 1_000_000, 1_000_000);
  const sonnet = estimateCostUsd("claude-sonnet-4-6", 1_000_000, 1_000_000);
  assert.ok(haiku > 0 && sonnet > haiku, "sonnet estimates cost more than haiku");
  assert.equal(estimateCostUsd("unknown-model-x", 0, 0), 0);
});
