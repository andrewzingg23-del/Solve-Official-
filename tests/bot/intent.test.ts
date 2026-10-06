// Turn intent: "they ask for a way" vs. conversation.
import assert from "node:assert/strict";
import { it } from "node:test";
import { classifyTurn } from "../../lib/bot/intent";

it("recognizes asks for a way", () => {
  for (const msg of [
    "how do I set up my trading bot",
    "help me find a route to launch this",
    "I want to build a landing page",
    "can you show me my swaps",
    "remind me to call the lead back",
  ]) {
    const intent = classifyTurn(msg);
    assert.equal(intent.kind, "way", `"${msg}" is a way`);
    assert.ok(intent.kind === "way" && intent.goal.length > 0);
  }
});

it("leaves conversation alone", () => {
  for (const msg of ["hey", "what's up", "you're the best", "", "lol"]) {
    assert.equal(classifyTurn(msg).kind, "chat", `"${msg}" is chat`);
  }
});

it("caps the goal length", () => {
  const intent = classifyTurn("help me " + "x".repeat(1000));
  assert.equal(intent.kind, "way");
  assert.ok(intent.kind === "way" && intent.goal.length <= 500);
});
