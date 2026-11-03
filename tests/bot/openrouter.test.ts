// The chat pipe: the request body matches OpenRouter's chat-completions
// format, the required headers go out, provider errors come back honest,
// and the missing-key state names OpenRouter in plain words.
import assert from "node:assert/strict";
import { it } from "node:test";
import {
  buildChatCompletionBody,
  completeChat,
  OPENROUTER_API_URL,
  OPENROUTER_MISSING_KEY_ERROR,
  OPENROUTER_REFERER,
  OPENROUTER_TITLE,
} from "../../lib/bot/openrouter";

it("builds an OpenRouter chat-completions body", () => {
  const body = buildChatCompletionBody({
    model: "anthropic/claude-sonnet-5.5",
    system: "You are Nova.",
    history: [{ role: "user", content: "hi" }],
    message: "hello",
  });
  assert.equal(body.model, "anthropic/claude-sonnet-5.5");
  assert.equal(body.max_tokens, 1024);
  assert.deepEqual(body.messages, [
    { role: "system", content: "You are Nova." },
    { role: "user", content: "hi" },
    { role: "user", content: "hello" },
  ]);
});

it("the missing-key error names OpenRouter in plain words", () => {
  assert.ok(OPENROUTER_MISSING_KEY_ERROR.toLowerCase().includes("openrouter"));
  assert.ok(!OPENROUTER_MISSING_KEY_ERROR.includes("ANTHROPIC_API_KEY"));
});

const withFetch = async <T>(stub: typeof fetch, run: () => Promise<T>): Promise<T> => {
  const prev = globalThis.fetch;
  globalThis.fetch = stub;
  try {
    return await run();
  } finally {
    globalThis.fetch = prev;
  }
};

const jsonResponse = (status: number, payload: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  }) as Response;

it("posts to the OpenRouter endpoint with the required headers", async () => {
  let seenUrl = "";
  let seenHeaders: Record<string, string> = {};
  let seenBody: unknown = null;
  await withFetch(
    (async (url: unknown, init: unknown) => {
      seenUrl = String(url);
      seenHeaders = { ...((init as { headers?: Record<string, string> }).headers ?? {}) };
      seenBody = JSON.parse(String((init as { body?: string }).body));
      return jsonResponse(200, {
        choices: [{ message: { role: "assistant", content: "  hey  " } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      });
    }) as typeof fetch,
    () =>
      completeChat("test-key", {
        model: "anthropic/claude-haiku-4.5",
        max_tokens: 1024,
        messages: [{ role: "user", content: "hi" }],
      }),
  );
  assert.equal(seenUrl, OPENROUTER_API_URL);
  assert.equal(seenHeaders["Authorization"], "Bearer test-key");
  assert.equal(seenHeaders["HTTP-Referer"], OPENROUTER_REFERER);
  assert.equal(seenHeaders["X-Title"], OPENROUTER_TITLE);
  assert.equal((seenBody as { model: string }).model, "anthropic/claude-haiku-4.5");
});

it("returns the trimmed reply with token usage", async () => {
  const result = await withFetch(
    (async () =>
      jsonResponse(200, {
        choices: [{ message: { role: "assistant", content: "  hey  " } }],
        usage: { prompt_tokens: 10.4, completion_tokens: 5 },
      })) as typeof fetch,
    () =>
      completeChat("k", {
        model: "anthropic/claude-haiku-4.5",
        max_tokens: 1024,
        messages: [{ role: "user", content: "hi" }],
      }),
  );
  assert.equal(result.reply, "hey");
  assert.equal(result.inputTokens, 11);
  assert.equal(result.outputTokens, 5);
});

it("turns provider errors into honest plain-word errors", async () => {
  const run = (status: number, payload: unknown) =>
    withFetch(
      (async () => jsonResponse(status, payload)) as typeof fetch,
      () =>
        completeChat("k", {
          model: "m",
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }],
        }),
    );
  await assert.rejects(
    run(401, { error: { message: "No auth credentials found", code: 401 } }),
    /rejected.*OpenRouter key/i,
    "a 401 names the key, not the provider's raw code",
  );
  await assert.rejects(run(429, { error: "rate limited" }), /rate-limiting/i);
  await assert.rejects(
    run(400, { error: { message: "This endpoint's maximum context length is 10" } }),
    /maximum context length/,
    "a 400 surfaces the provider's message, trimmed",
  );
  await assert.rejects(run(500, null), /answered 500/, "an empty 500 still says something");
  await assert.rejects(
    run(200, { choices: [{ message: { content: "   " } }] }),
    /nothing to say/,
    "an empty reply is honest, not a blank bubble",
  );
});

it("reports provider truncation instead of implying a finished answer", async () => {
  const result = await withFetch((async () => jsonResponse(200, {
    choices: [{ message: { content: "An unfinished" }, finish_reason: "length" }],
  })) as typeof fetch, () => completeChat("k", { model: "m", max_tokens: 1, messages: [] }));
  assert.equal(result.finishReason, "length");
});

it("allowEmpty returns an empty reply with finish_reason and reasoning size instead of throwing", async () => {
  const { ChatTimeoutError } = await import("../../lib/bot/openrouter");
  void ChatTimeoutError;
  const res = await withFetch(
    (async () => jsonResponse(200, { choices: [{ finish_reason: "stop", message: { content: "", reasoning: "thinking hard" } }], usage: { prompt_tokens: 5, completion_tokens: 0 } })) as unknown as typeof fetch,
    () => completeChat("k", buildChatCompletionBody({ model: "m", system: "s", history: [], message: "u" }), { allowEmpty: true }),
  );
  assert.equal(res.reply, "");
  assert.equal(res.finishReason, "stop");
  assert.equal(res.reasoningChars, "thinking hard".length);
});

it("without allowEmpty, an empty completion still throws (chat behavior preserved)", async () => {
  await assert.rejects(
    withFetch(
      (async () => jsonResponse(200, { choices: [{ finish_reason: "stop", message: { content: "" } }] })) as unknown as typeof fetch,
      () => completeChat("k", buildChatCompletionBody({ model: "m", system: "s", history: [], message: "u" })),
    ),
    /nothing to say/i,
  );
});

it("a provider timeout surfaces as ChatTimeoutError", async () => {
  const { ChatTimeoutError } = await import("../../lib/bot/openrouter");
  await assert.rejects(
    withFetch(
      (async () => { throw Object.assign(new Error("timed out"), { name: "TimeoutError" }); }) as unknown as typeof fetch,
      () => completeChat("k", buildChatCompletionBody({ model: "m", system: "s", history: [], message: "u" }), { timeoutMs: 10, allowEmpty: true }),
    ),
    (e) => e instanceof ChatTimeoutError,
  );
});

it("classifies a timeout while reading the response body as a timeout, not empty output", async () => {
  const { ChatTimeoutError } = await import("../../lib/bot/openrouter");
  await assert.rejects(withFetch((async () => ({ ok: true, json: async () => {
    throw Object.assign(new Error("Body aborted"), { name: "AbortError" });
  } })) as unknown as typeof fetch, () => completeChat("k", { model: "m", max_tokens: 1, messages: [] }, { allowEmpty: true })),
  e => e instanceof ChatTimeoutError);
});
