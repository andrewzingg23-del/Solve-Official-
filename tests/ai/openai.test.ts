import assert from "node:assert/strict";
import { it } from "node:test";
import {
  OPENAI_DEFAULT_MODEL,
  OPENAI_RESPONSES_URL,
  buildOpenAIResponsesBody,
  completeOpenAIChat,
  parseOpenAIResponse,
} from "../../lib/ai/openai";

it("builds a scoped, non-stored Responses request with the supplied history", () => {
  const body = buildOpenAIResponsesBody({
    model: OPENAI_DEFAULT_MODEL,
    system: "You are an assistant. Do not act without approval.",
    history: [{ role: "user", content: "first" }, { role: "assistant", content: "second" }],
    message: "third",
  });
  assert.equal(body.model, "gpt-6.1-sol");
  assert.equal(body.store, false);
  assert.equal(body.max_output_tokens, 2048);
  assert.equal(body.instructions.includes("Do not act"), true);
  assert.deepEqual(body.input.map(x => x.content), ["first", "second", "third"]);
  assert.deepEqual(body.input.map(x => x.role), ["user", "assistant", "user"]);
  assert.equal(JSON.stringify(body).includes("apiKey"), false);
});

it("extracts only user-visible assistant text and usage", () => {
  const parsed = parseOpenAIResponse({
    output: [
      { type: "reasoning", summary: [{ type: "summary_text", text: "Private trace" }] },
      { type: "message", content: [{ type: "output_text", text: "Hello from SOLVE" }] },
    ],
    usage: { input_tokens: 12, output_tokens: 5 },
  });
  assert.equal(parsed.reply, "Hello from SOLVE");
  assert.equal(parsed.reply.includes("Private trace"), false);
  assert.deepEqual([parsed.inputTokens, parsed.outputTokens], [12, 5]);
});

it("rejects no-message responses rather than claiming success", () => {
  assert.throws(() => parseOpenAIResponse({ output: [{ type: "reasoning" }] }), /no message/i);
});

it("calls only the OpenAI Responses API and never stores the conversation", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (request, options) => {
      assert.equal(request, OPENAI_RESPONSES_URL);
      assert.equal(options?.method, "POST");
      const headers = options?.headers as Record<string, string>;
      assert.equal(headers.Authorization, "Bearer test-secret");
      const body = JSON.parse(String(options?.body));
      assert.equal(body.store, false);
      assert.equal(body.model, OPENAI_DEFAULT_MODEL);
      return new Response(JSON.stringify({
        output: [{ type: "message", content: [{ type: "output_text", text: "Confirmed" }] }],
        usage: { input_tokens: 10, output_tokens: 4 },
      }), { status: 200 });
    };
    const response = await completeOpenAIChat("test-secret", buildOpenAIResponsesBody({
      model: OPENAI_DEFAULT_MODEL, system: "Rules", history: [], message: "Hi",
    }));
    assert.equal(response.reply, "Confirmed");
  } finally { globalThis.fetch = original; }
});

it("fails closed on provider errors without revealing secrets", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({
      error: { message: "private-provider-message sk-123" },
    }), { status: 401 });
    await assert.rejects(
      () => completeOpenAIChat("test-secret", buildOpenAIResponsesBody({
        model: OPENAI_DEFAULT_MODEL, system: "Rules", history: [], message: "Hi",
      })),
      (e: unknown) => e instanceof Error && /credentials/i.test(e.message)
        && !e.message.includes("sk-123"),
    );
  } finally { globalThis.fetch = original; }
});
