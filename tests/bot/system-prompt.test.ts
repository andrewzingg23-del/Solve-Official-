import assert from "node:assert/strict";
import { it } from "node:test";
import { buildChatSystemPrompt, packSystemPrompt } from "../../lib/bot/chat";
import { estimateTokens } from "../../lib/ai/context";

it("keeps rules, soul and passport in priority order when they fit", () => {
  const rules = buildChatSystemPrompt("Vance");
  const packed = packSystemPrompt({ rules, soul: "be terse", passport: "sells solar in Orlando" }, 2400);
  const order = packed.layers.filter((l) => l.text).map((l) => l.name);
  assert.deepEqual(order, ["rules", "soul", "passport"]);
  assert.match(packed.text, /^You are Vance/);
  assert.ok(packed.text.includes("be terse"));
  assert.ok(packed.text.includes("sells solar in Orlando"));
  assert.ok(packed.totalTokens <= 2400);
});

it("always keeps the bot's rules, even under a tiny budget", () => {
  const rules = buildChatSystemPrompt("Muse");
  const packed = packSystemPrompt({ rules, soul: "x".repeat(4000), passport: "y".repeat(4000) }, 80);
  assert.ok(packed.layers.find((l) => l.name === "rules")!.tokens > 0, "rules survive");
  assert.ok(packed.totalTokens <= 80);
});

it("bounds a huge passport to its cap and the budget", () => {
  const rules = buildChatSystemPrompt("Vance");
  const packed = packSystemPrompt({ rules, passport: "z".repeat(40000) }, 2400);
  const passport = packed.layers.find((l) => l.name === "passport")!;
  assert.ok(passport.tokens <= 1400, "passport within its cap");
  assert.ok(passport.truncated, "passport was trimmed");
  assert.ok(packed.totalTokens <= 2400);
});

it("omits soul, project and passport when absent — just the rules", () => {
  const rules = buildChatSystemPrompt("Vance");
  const packed = packSystemPrompt({ rules }, 2400);
  assert.equal(packed.text, rules);
  assert.equal(estimateTokens(packed.text), packed.layers.find((l) => l.name === "rules")!.tokens);
});
