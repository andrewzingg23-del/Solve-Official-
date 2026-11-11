import assert from "node:assert/strict";
import { it } from "node:test";
import { historyForTurn, replyLabel } from "../../lib/ai/console-contract";
import { validateConsoleTurn } from "../../lib/ai/console-contract";
it("long replies remain usable as bounded history on the next turn", () => {
  const turns = Array.from({ length: 12 }, (_, i) => ({ role: i % 2 ? "assistant" as const : "user" as const, content: "x".repeat(4000) }));
  const history = historyForTurn(turns);
  assert.ok(history.length > 0);
  assert.ok(validateConsoleTurn({ message: "next", path: "/people", history }));
});
it("each assistant reply is labelled from server provenance, not a fixed engine name", () => {
  assert.equal(replyLabel({ id: "anthropic", model: "claude-haiku-5-5" }), "Anthropic · claude-haiku-5-5");
  assert.equal(replyLabel({ id: "openai", model: "configured-model" }), "OpenAI · configured-model");
  assert.equal(replyLabel(undefined), "AI");
});
