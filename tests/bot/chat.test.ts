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
