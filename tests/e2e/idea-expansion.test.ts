import assert from "node:assert/strict";
import { it } from "node:test";
import { createIdeaExpander, IDEA_EXPANSION_SCHEMA } from "../../lib/world/idea-expansion";
import type { IdeaRecord } from "../../lib/world/ideas";

const base: IdeaRecord = {
  id: "00000000-0000-4000-8000-000000000301",
  scope: "world:00000000-0000-4000-8000-000000000001",
  title: "Continue earlier thinking",
  description: "Build from a saved idea.",
  status: "captured",
  assumptions: [],
  openQuestions: ["How will this stay safe?"],
  version: 1,
  updatedAt: "2026-10-04T00:00:00Z",
};

it("asks for a constrained proposal from the selected idea and authorized related context", async () => {
  let received: Record<string, unknown> | undefined;
  const expander = createIdeaExpander(async (request) => {
    received = request as unknown as Record<string, unknown>;
    return {
      stop_reason: "end_turn",
      content: [{ type: "text", text: JSON.stringify({
        title: "Keep the idea connected",
        description: "Persist an explicit source edge.",
        assumptions: ["The source remains visible"],
        openQuestions: ["How is authorship shown?"],
        rationale: "This turns the original thought into a testable capability.",
      }) }],
    };
  }, "test-model");
  const result = await expander.expand(base, []);
  assert.equal(expander.model, "test-model");
  assert.equal(result?.title, "Keep the idea connected");
  assert.equal((received?.output_config as { format: { schema: unknown } }).format.schema, IDEA_EXPANSION_SCHEMA);
  assert.match(String((received?.messages as { content: string }[])[0].content), /Continue earlier thinking/);
});

it("returns no draft for malformed, refused, or truncated model output", async () => {
  const malformed = createIdeaExpander(async () => ({
    stop_reason: "end_turn",
    content: [{ type: "text", text: JSON.stringify({ title: "x", description: "y", assumptions: [4], openQuestions: [], rationale: "z" }) }],
  }), "test-model");
  assert.equal(await malformed.expand(base, []), null);

  const refused = createIdeaExpander(async () => ({ stop_reason: "refusal", content: [] }), "test-model");
  assert.equal(await refused.expand(base, []), null);

  const truncated = createIdeaExpander(async () => ({ stop_reason: "max_tokens", content: [] }), "test-model");
  assert.equal(await truncated.expand(base, []), null);
});
