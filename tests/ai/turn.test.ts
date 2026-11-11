import assert from "node:assert/strict";
import { it, mock, type TestContext } from "node:test";
import { createConsoleHandler } from "../../lib/ai/turn";
import { kernelClient } from "../../lib/kernel/client";
import { localSupabase } from "../../lib/kernel/local";
import { app, createKernelDb, user } from "../kernel/harness";
import { createCreativeWorld } from "../../lib/world/creative";

const WORLD = "a40c239c-f086-4f7b-919f-0b1a5d17791b";
const request = (body: unknown = { message: "hello", path: "/people" }, origin = "https://preview.test") => new Request("https://preview.test/api/ai/turn", {
  method: "POST", headers: { "Content-Type": "application/json", "X-SOLVE-Viewer": "alice", Origin: origin }, body: JSON.stringify(body),
});
async function setup() {
  const db = await createKernelDb();
  const alice = kernelClient(localSupabase(db, user("alice")));
  const bob = kernelClient(localSupabase(db, user("bob")));
  await alice.register("Alice"); await bob.register("Bob");
  const env = { VERCEL_ENV: "preview", SOLVE_AI_INTERNAL_PREVIEW: "1", SOLVE_AI_PREVIEW_USER_IDS: "alice", OPENAI_API_KEY: "fixture-key", SOLVE_AI_ENGINE: "openai" };
  const handler = (over: Partial<Parameters<typeof createConsoleHandler>[0]> = {}) => createConsoleHandler({
    env, getUser: async () => ({ id: "alice", is_anonymous: false }), getKernel: async () => alice, ...over,
  });
  return { db, alice, bob, env, handler };
}
function provider(t: TestContext, response: unknown, status = 200) {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  t.after(() => mock.restoreAll());
  mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) });
    return Response.json(response, { status });
  });
  return calls;
}
const success = { model: "reported-openai", output_text: "Hello Alice", usage: { input_tokens: 80, output_tokens: 20 } };

it("denies production, guests, nonallowlisted people and connected apps before any paid call", async t => {
  const { alice, db, env, handler } = await setup();
  const calls = provider(t, success);
  assert.equal((await handler({ env: { ...env, VERCEL_ENV: "production" } })(request())).status, 403);
  assert.equal((await handler({ getUser: async () => null })(request())).status, 401);
  assert.equal((await handler({ getUser: async () => ({ id: "alice", is_anonymous: true }) })(request())).status, 401);
  assert.equal((await handler({ getUser: async () => ({ id: "bob" }) })(request())).status, 403);
  await alice.connectApp("oauth-app", "External app", "connect");
  const connected = kernelClient(localSupabase(db, app("alice", "oauth-app")));
  assert.equal((await handler({ getKernel: async () => connected })(request())).status, 403);
  assert.equal(calls.length, 0);
});
it("authorizes Space metadata with the actual kernel and refuses outsiders before transport", async t => {
  const { alice, bob, handler } = await setup();
  await createCreativeWorld(alice, { worldId: WORLD, title: "Private title", goal: "Private goal" });
  const calls = provider(t, success);
  const body = { message: "help", path: `/world/${WORLD}` };
  assert.equal((await handler({ getKernel: async () => bob })(request(body))).status, 403);
  assert.equal(calls.length, 0);
  const res = await handler()(request(body));
  assert.equal(res.status, 200);
  assert.match(String(calls[0].body.instructions), /Private title/);
  assert.equal(calls[0].body.store, false);
  assert.equal(calls[0].body.tools, undefined);
});
it("returns server provenance, actual model, usage and unknown OpenAI cost, and records usage", async t => {
  const { alice, handler } = await setup();
  const calls = provider(t, success);
  const res = await handler()(request()); const json = await res.json();
  assert.equal(json.engine.id, "openai");
  assert.equal(json.engine.model, "reported-openai");
  assert.deepEqual(json.usage, { inputTokens: 80, outputTokens: 20 });
  assert.deepEqual(json.cost, { estimatedUsd: null, status: "unknown" });
  assert.equal(json.metering, "recorded");
  assert.deepEqual(await alice.readAiSpend(), { tokens: 100, calls: 1 });
  assert.equal(calls.length, 1);
  assert.equal(res.headers.get("cache-control"), "no-store");
});
it("missing meter fails closed before spending, and post-call meter failure preserves the paid reply honestly", async t => {
  const { alice, handler } = await setup();
  const calls = provider(t, success);
  const broken = { ...alice, readAiSpend: async () => { throw new Error("missing migration"); } };
  assert.equal((await handler({ getKernel: async () => broken })(request())).status, 503);
  assert.equal(calls.length, 0);
  const writeBroken = { ...alice, recordAiSpend: async () => { throw new Error("db down"); } };
  const json = await (await handler({ getKernel: async () => writeBroken })(request())).json();
  assert.equal(json.reply, "Hello Alice");
  assert.equal(json.metering, "failed");
});
it("bounds request bodies, blocks cross-origin calls and malformed turns without a provider call", async t => {
  const { handler } = await setup(); const calls = provider(t, success);
  assert.equal((await handler()(request(undefined, "https://attacker.test"))).status, 403);
  assert.equal((await handler()(request({ message: "x".repeat(50000), path: "/" }))).status, 413);
  assert.equal((await handler()(request({ message: "hello", path: "https://attacker.test" }))).status, 422);
  assert.equal(calls.length, 0);
});
it("reports selected Anthropic engine and estimated cost without reporting unknown usage as zero", async t => {
  const { env, handler } = await setup();
  provider(t, { model: "claude-haiku-5-5", stop_reason: "end_turn", content: [{ type: "text", text: "Hi" }], usage: { input_tokens: 100, output_tokens: 100 } });
  const h = handler({ env: { ...env, OPENAI_API_KEY: "", ANTHROPIC_API_KEY: "fixture-key", ANTHROPIC_MODEL: "claude-haiku-5-5" } });
  const json = await (await h(request())).json();
  assert.equal(json.engine.id, "anthropic");
  assert.equal(json.cost.estimatedUsd, 0.00006);
  assert.equal(json.cost.status, "estimated");
});
it("safe failures identify the selected engine without returning provider diagnostics", async t => {
  const { handler } = await setup();
  provider(t, { error: { message: "fixture-key private prompt" } }, 429);
  const res = await handler()(request()); const json = await res.json();
  assert.equal(res.status, 429); assert.equal(json.engine.id, "openai");
  assert.equal(json.code, "provider_rate_limited");
  assert.doesNotMatch(JSON.stringify(json), /fixture-key|private prompt/);
});
it("missing provider configuration and empty replies fail honestly without inventing usage", async t => {
  const { env, handler } = await setup(); const calls = provider(t, {});
  const absent = await handler({ env: { ...env, OPENAI_API_KEY: "" } })(request());
  assert.equal(absent.status, 503); assert.equal(calls.length, 0);
  const empty = await handler()(request());
  assert.equal(empty.status, 502);
  assert.equal((await empty.json()).engine.id, "openai");
});
it("missing provider usage stays unknown and makes no fabricated meter charge", async t => {
  const { alice, handler } = await setup(); provider(t, { model: "reported", output_text: "Hello" });
  const json = await (await handler()(request())).json();
  assert.deepEqual(json.usage, { inputTokens: null, outputTokens: null });
  assert.equal(json.metering, "unknown");
  assert.equal(json.cost.estimatedUsd, null);
  assert.deepEqual(await alice.readAiSpend(), { tokens: 0, calls: 0 });
});
it("durable recorded usage stops a later handler instance before transport", async t => {
  const { alice, handler } = await setup(); const calls = provider(t, success);
  await alice.recordAiSpend({ tokens: 20_000, kind: "chat" });
  assert.equal((await handler()(request())).status, 429);
  assert.equal(calls.length, 0);
});
it("revoking Space access is rechecked on the next turn even with client-supplied history", async t => {
  const { alice, bob, handler } = await setup();
  const world = await createCreativeWorld(alice, { worldId: WORLD, title: "Private title" });
  const bobId = (await bob.whoami()).actor_id;
  const grant = await alice.issueGrant({ grantee: bobId, capability: "kernel.read", scope: world.scope });
  const calls = provider(t, success);
  const h = handler({ getKernel: async () => bob });
  const body = { message: "help", path: `/world/${WORLD}`, history: [{ role: "assistant", content: "I have access" }] };
  assert.equal((await h(request(body))).status, 200);
  await alice.revokeGrant(grant);
  assert.equal((await h(request(body))).status, 403);
  assert.equal(calls.length, 1);
});
it("cache tokens are metered and prevent an incomplete cost estimate", async t => {
  const { env, alice, handler } = await setup();
  provider(t, { model: "claude-haiku-5-5", stop_reason: "end_turn", content: [{ type: "text", text: "Hi" }], usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 100, cache_creation_input_tokens: 20 } });
  const h = handler({ env: { ...env, OPENAI_API_KEY: "", ANTHROPIC_API_KEY: "fixture-key" } });
  const json = await (await h(request())).json();
  assert.equal(json.cost.estimatedUsd, null);
  assert.deepEqual(await alice.readAiSpend(), { tokens: 135, calls: 1 });
});
for (const [id, payload, code, tokens] of [
  ["anthropic", { model: "claude-haiku-5-5", stop_reason: "end_turn", content: [], usage: { input_tokens: 80, output_tokens: 1024 } }, "provider_empty", 1104],
  ["anthropic", { model: "claude-haiku-5-5", stop_reason: "refusal", content: [], usage: { input_tokens: 80, output_tokens: 10 } }, "provider_refusal", 90],
  ["openai", { model: "reported", output: [{ type: "reasoning" }], usage: { input_tokens: 80, output_tokens: 1024 } }, "provider_empty", 1104],
] as const) it(`accounts for charged ${id} ${code} responses without claiming a reply`, async t => {
  const { env, alice, handler } = await setup(); provider(t, payload);
  const h = handler({ env: { ...env, SOLVE_AI_ENGINE: id, ...(id === "anthropic" ? { OPENAI_API_KEY: "", ANTHROPIC_API_KEY: "fixture-key" } : {}) } });
  const json = await (await h(request())).json();
  assert.equal(json.code, code); assert.equal(json.reply, undefined);
  assert.equal(json.metering, "recorded");
  assert.deepEqual(await alice.readAiSpend(), { tokens, calls: 1 });
});

it("a stale tab cannot send its previous account's history under a new session", async t => {
  const { env, bob, handler } = await setup(); const calls = provider(t, success);
  const h = handler({ env: { ...env, SOLVE_AI_PREVIEW_USER_IDS: "alice,bob" }, getUser: async () => ({ id: "bob" }), getKernel: async () => bob });
  const res = await h(request({ message: "next", path: "/", history: [{ role: "user", content: "Alice private history" }] }));
  assert.equal(res.status, 409); assert.equal((await res.json()).code, "session_changed");
  assert.equal(calls.length, 0);
});
