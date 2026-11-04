import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { completeRoomAgent, extraRoomAgents, listRoomAgents, roomAgentById } from "../../lib/world/agent-models";
import { parseRoomTurn } from "../../lib/world/room";

const CONTEXT = { system: "Give a short factual answer.", sharedText: "{\"world\":\"Test\"}" };

describe("World model adapter registry", () => {
  it("exposes a truthful configured roster without server secrets", () => {
    const env = { OPENROUTER_API_KEY: "test-router", ANTHROPIC_API_KEY: "test-claude" };
    const agents = listRoomAgents(env);
    assert.deepEqual(agents.map(x => x.id), ["solve", "chatgpt", "claude", "muse"]);
    assert.deepEqual(agents.map(x => x.configured), [true, false, true, false]);
    assert.ok(!JSON.stringify(agents).includes("test-router"));
    assert.ok(!JSON.stringify(agents).includes("test-claude"));
  });

  it("accepts only deployment-owned custom models on fixed provider transports", () => {
    const env = { SOLVE_ROOM_AGENTS_JSON: JSON.stringify([
      { id: "qwen", label: "Qwen", provider: "openrouter", model: "qwen/qwen3" },
      { id: "evil", label: "Evil", provider: "https://local.invalid", model: "x" },
      { id: "solve", label: "Collision", provider: "meta", model: "muse-spark-1.3" },
    ]) };
    assert.deepEqual(extraRoomAgents(env).map(a => a.id), ["qwen"]);
    assert.equal(roomAgentById("qwen", env)?.configured, false);
    assert.equal(roomAgentById("unknown", env), null);
  });

  it("preserves the optional agent ID through the World message parser", () => {
    const base = { requestId: "req-1", text: "What now?", intent: "ask_ai" };
    const parsed = parseRoomTurn("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", { ...base, agentId: "muse" });
    assert.equal(parsed?.agentId, "muse");
    assert.equal(parseRoomTurn("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", { ...base, agentId: "https://evil" }), null);
    assert.ok(!Object.prototype.hasOwnProperty.call(parseRoomTurn("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", base), "agentId"));
  });

  it("reports an unconfigured model rather than sending data to another model", async () => {
    await assert.rejects(() => completeRoomAgent("muse", CONTEXT, "hello", {}), /agent_not_configured/);
    await assert.rejects(() => completeRoomAgent("unknown", CONTEXT, "hello", {}), /agent_not_allowed/);
  });

  it("routes OpenAI to its own Responses API and extracts answer and usage", async () => {
    const original = globalThis.fetch;
    let called = false;
    globalThis.fetch = async (url, init) => {
      called = true;
      assert.equal(String(url), "https://api.openai.com/v1/responses");
      const body = JSON.parse(String(init?.body));
      assert.equal(body.model, "gpt-6-luna");
      assert.match(body.input, /Test/);
      assert.equal(init?.headers && (init.headers as Record<string, string>).Authorization, "Bearer key");
      return Response.json({
        output: [{ type: "message", content: [{ type: "output_text", text: "OpenAI response" }] }],
        usage: { input_tokens: 12, output_tokens: 5 },
      });
    };
    try {
      const reply = await completeRoomAgent("chatgpt", CONTEXT, "question", { OPENAI_API_KEY: "key" });
      assert.equal(reply.reply, "OpenAI response");
      assert.equal(reply.model, "gpt-6-luna");
      assert.equal(reply.inputTokens, 12);
      assert.ok(called);
    } finally { globalThis.fetch = original; }
  });

  it("routes Claude to the Anthropic Messages API", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      assert.equal(String(url), "https://api.anthropic.com/v1/messages");
      assert.equal(JSON.parse(String(init?.body)).model, "claude-haiku-4-5-20251001");
      return Response.json({ content: [{ type: "text", text: "Claude response" }],
        usage: { input_tokens: 20, output_tokens: 6 } });
    };
    try {
      const reply = await completeRoomAgent("claude", CONTEXT, "question", { ANTHROPIC_API_KEY: "key" });
      assert.equal(reply.reply, "Claude response");
      assert.equal(reply.outputTokens, 6);
    } finally { globalThis.fetch = original; }
  });

  it("routes Muse Spark through Meta's model API, not a pretend coding worker", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      assert.equal(String(url), "https://api.meta.ai/v1/chat/completions");
      const body = JSON.parse(String(init?.body));
      assert.equal(body.model, "muse-spark-1.3");
      assert.equal(body.messages[0].role, "developer");
      return Response.json({ choices: [{ message: { content: "Muse response" } }],
        usage: { prompt_tokens: 9, completion_tokens: 3 } });
    };
    try {
      const reply = await completeRoomAgent("muse", CONTEXT, "question", { MODEL_API_KEY: "key" });
      assert.equal(reply.reply, "Muse response");
      assert.equal(reply.outputTokens, 3);
    } finally { globalThis.fetch = original; }
  });
});
