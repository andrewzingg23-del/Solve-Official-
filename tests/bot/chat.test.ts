// The room's talking bot: the chat request validates, the system prompt speaks
// as the person's bot, and model picking prefers the cheapest capable model.
import assert from "node:assert/strict";
import { it } from "node:test";
import {
  buildChatSystemPrompt,
  packSystemPrompt,
  resolveChatModel,
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

it("resolves OpenRouter models per tier, cheapest capable first", () => {
  // Defaults hold only when no env override is set. Isolate the ambient OPENROUTER_MODEL env so this
  // stays deterministic even when a deployment sets a model (e.g. the free-model defaults in prod).
  const a = process.env.OPENROUTER_MODEL, b = process.env.OPENROUTER_MODEL_SMART;
  delete process.env.OPENROUTER_MODEL; delete process.env.OPENROUTER_MODEL_SMART;
  try {
    assert.equal(resolveChatModel("flash"), "anthropic/claude-haiku-4.5");
    assert.equal(resolveChatModel("smart"), "anthropic/claude-sonnet-5.5");
    assert.equal(resolveChatModel(), "anthropic/claude-haiku-4.5", "default tier stays flash");
  } finally {
    if (a === undefined) delete process.env.OPENROUTER_MODEL; else process.env.OPENROUTER_MODEL = a;
    if (b === undefined) delete process.env.OPENROUTER_MODEL_SMART; else process.env.OPENROUTER_MODEL_SMART = b;
  }
});

it("lets the environment override the OpenRouter model", () => {
  const prev = process.env.OPENROUTER_MODEL;
  const prevSmart = process.env.OPENROUTER_MODEL_SMART;
  try {
    process.env.OPENROUTER_MODEL = "anthropic/claude-opus-4.8";
    process.env.OPENROUTER_MODEL_SMART = "anthropic/claude-opus-4.8";
    assert.equal(resolveChatModel("flash"), "anthropic/claude-opus-4.8");
    assert.equal(resolveChatModel("smart"), "anthropic/claude-opus-4.8");
  } finally {
    if (prev === undefined) delete process.env.OPENROUTER_MODEL;
    else process.env.OPENROUTER_MODEL = prev;
    if (prevSmart === undefined) delete process.env.OPENROUTER_MODEL_SMART;
    else process.env.OPENROUTER_MODEL_SMART = prevSmart;
  }
});

it("rate-limits each person to 30 messages an hour", async () => {
  const { rateLimited, MAX_PER_WINDOW } = await import("../../lib/bot/chat");
  const user = `test-user-${Date.now()}`;
  for (let i = 0; i < MAX_PER_WINDOW; i++) assert.equal(rateLimited(user), false);
  assert.equal(rateLimited(user), true, "the 31st message in the hour is refused");
  assert.equal(rateLimited("someone-else"), false, "limits are per person");
});

it("routes simple turns to flash and complex turns to smart", async () => {
  const { parseTier, resolveChatModel } = await import("../../lib/bot/chat");
  // Isolate the ambient model override (see note above) so the default-model assertions are stable.
  const a = process.env.OPENROUTER_MODEL, b = process.env.OPENROUTER_MODEL_SMART;
  delete process.env.OPENROUTER_MODEL; delete process.env.OPENROUTER_MODEL_SMART;
  try {
    const simple = parseTier("hey, what's up");
    assert.equal(simple.tier, "flash");
    assert.equal(resolveChatModel(simple.tier), "anthropic/claude-haiku-4.5");

    const forced = parseTier("smart: analyze this quarter for me");
    assert.equal(forced.tier, "smart");
    assert.equal(forced.message, "analyze this quarter for me", "prefix is stripped");
    assert.equal(resolveChatModel(forced.tier), "anthropic/claude-sonnet-5.5");

    const long = parseTier("x".repeat(601));
    assert.equal(long.tier, "smart");

    const code = parseTier("fix this:\n```js\nconst x = 1;\n```");
    assert.equal(code.tier, "smart");
  } finally {
    if (a === undefined) delete process.env.OPENROUTER_MODEL; else process.env.OPENROUTER_MODEL = a;
    if (b === undefined) delete process.env.OPENROUTER_MODEL_SMART; else process.env.OPENROUTER_MODEL_SMART = b;
  }
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

it("estimates cost from the OpenRouter model family, labeled as estimate", async () => {
  const { estimateCostUsd } = await import("../../lib/bot/chat");
  const haiku = estimateCostUsd("anthropic/claude-haiku-4.5", 1_000_000, 1_000_000);
  const sonnet = estimateCostUsd("anthropic/claude-sonnet-5.5", 1_000_000, 1_000_000);
  assert.ok(haiku > 0 && sonnet > haiku, "sonnet estimates cost more than haiku");
  assert.equal(haiku, 1.0 + 5.0, "haiku-4.5 priced at $1/M in, $5/M out (2026-10-06)");
  assert.equal(estimateCostUsd("unknown-model-x", 0, 0), 0);
});

// The console sends where the person stands; the chat contract carries it as
// context and never lets a bad one break the conversation.
it("carries a valid screen context on the chat request", () => {
  const chat = validateChatBody({
    message: "make this wider",
    botName: "Nova",
    screen: { path: "/world/abc", label: "a project workspace", worldId: "abc" },
  });
  assert.ok(chat);
  assert.equal(chat.screen?.worldId, "abc");
});

it("a missing or malformed screen context is dropped, not fatal", () => {
  assert.equal(validateChatBody({ message: "hi", botName: "Nova" })?.screen, null);
  assert.equal(validateChatBody({ message: "hi", botName: "Nova", screen: "nope" })?.screen, null);
  assert.equal(validateChatBody({ message: "hi", botName: "Nova", screen: { path: "/" } })?.screen, null);
});

it("the screen layer survives a tight budget and reads as position, not orders", () => {
  const packed = packSystemPrompt(
    {
      rules: buildChatSystemPrompt("Nova"),
      passport: "x".repeat(8000),
      screen: { path: "/world/abc/room", label: "a project's shared room", worldId: "abc" },
    },
    400,
  );
  const screen = packed.layers.find((l) => l.name === "screen");
  assert.ok(screen);
  assert.ok(screen.tokens > 0, "the screen layer is reserved, not evicted by a big passport");
  assert.match(packed.text, /shared room/);
  assert.match(packed.text, /not an instruction/);
});
