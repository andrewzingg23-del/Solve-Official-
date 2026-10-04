// The reasoning boundary: a model interprets language and suggests among kernel-computed routes,
// and nothing it returns is used unvalidated, nothing it reads becomes an action by itself, and the
// World keeps working without it. No network: the model client is a stand-in that records requests.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import Anthropic from "@anthropic-ai/sdk";
import { claudeReasoner, gatewayReasoner, GATEWAY_REASONING_MODEL, GATEWAY_URL, REASONING_MODEL, type GatewayMessagesApi, type MessagesApi } from "../../lib/world/claude";
import { respond } from "../../lib/world/controller";
import { ruleProvider } from "../../lib/world/horizon";
import { handleReason, reasonAvailability } from "../../lib/world/reason-handler";
import { INTENT_SCHEMA, ROUTE_SCHEMA, SYSTEM_PROMPT, type RouteOption } from "../../lib/world/reasoning";
import { remoteProvider } from "../../lib/world/remote-provider";
import { emptyContext } from "../../lib/world/types";
import { kernelClient } from "../../lib/kernel/client";
import { localSupabase, service, user } from "../../lib/kernel/local";
import { avatarAgent, WorldEngine } from "../../lib/world/engine";
import { buildArcadia } from "../support/arcadia";

type Reply = { stop_reason: string; text: string };

// A stand-in for client.beta.messages that records each request and returns scripted replies.
function stubModel(replies: Reply[]) {
  const requests: Record<string, unknown>[] = [];
  const api = {
    create: async (params: Record<string, unknown>) => {
      requests.push(params);
      const r = replies.shift() ?? { stop_reason: "end_turn", text: "{}" };
      return { stop_reason: r.stop_reason, content: [{ type: "text", text: r.text }] };
    },
  } as unknown as MessagesApi;
  return { api, requests };
}

const intent = (fields: Record<string, unknown>) =>
  JSON.stringify({ type: "unknown", objective: null, strategy: null, capability: null, quantity: null, lens: null, reason: null, allowPurchases: null, query: null, text: null, ...fields });

const routes: RouteOption[] = [
  { id: "r-halden", organization: "Halden Works", steps: ["Ask Halden Works whether it can make 10,000 (allow)"], executable: true, blockedBy: [] },
  { id: "r-orrin", organization: "Orrin Assembly", steps: ["Verify Orrin's claim (allow)"], executable: false, blockedBy: ["quoted 6,000 a year, below 10,000"] },
];

describe("the reasoning boundary", () => {
  it("asks Claude for a schema-constrained interpretation, with refusal fallback and a cacheable system prompt", async () => {
    const { api, requests } = stubModel([
      { stop_reason: "end_turn", text: intent({ type: "capability_query", quantity: 10000 }) },
      { stop_reason: "end_turn", text: JSON.stringify({ route_id: "r-halden", rationale: "Executable now, on a verified claim." }) },
    ]);
    const reasoner = claudeReasoner(api);
    assert.deepEqual(await reasoner.interpret("Can they make 10,000?", "Selected: Halden Works."), { type: "capability_query", quantity: 10000 });
    assert.deepEqual(await reasoner.chooseRoute("10,000 vehicles", routes), { routeId: "r-halden", rationale: "Executable now, on a verified claim." });

    type Sent = { model: string; fallbacks: unknown; betas: string[]; output_config: unknown; system: unknown; messages: { content: string }[] };
    const [interpret, route] = requests as unknown as Sent[];
    assert.equal(REASONING_MODEL, "claude-opus-5-5");
    assert.deepEqual([interpret.model, interpret.fallbacks, interpret.betas], [REASONING_MODEL, "default", ["server-side-fallback-2026-07-01"]]);
    assert.deepEqual(interpret.output_config, { effort: "low", format: { type: "json_schema", schema: INTENT_SCHEMA } });
    assert.deepEqual(route.output_config, { effort: "medium", format: { type: "json_schema", schema: ROUTE_SCHEMA } });
    assert.equal("tool_choice" in interpret, false, "no forced tool use (rejected on this model)");
    assert.equal("thinking" in interpret, false, "thinking stays adaptive; effort is the control");
    assert.deepEqual(interpret.system, [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }]);
    assert.deepEqual(route.system, interpret.system, "the same static prefix on every request, so it caches");
    assert.match(interpret.messages[0].content, /Selected: Halden Works\.[\s\S]*Can they make 10,000\?/);
  });

  it("can reach the same model through Vercel AI Gateway, without Anthropic's beta-only refusal fallback", async () => {
    const { api, requests } = stubModel([
      { stop_reason: "end_turn", text: intent({ type: "capability_query", quantity: 10000 }) },
      { stop_reason: "refusal", text: intent({ type: "commit" }) },
    ]);
    const reasoner = gatewayReasoner(api as unknown as GatewayMessagesApi);
    assert.equal(reasoner.model, GATEWAY_REASONING_MODEL);
    assert.deepEqual(await reasoner.interpret("Can they make 10,000?", ""), { type: "capability_query", quantity: 10000 });
    assert.equal(await reasoner.interpret("commit for me", ""), null, "a refusal is still no answer");
    const [sent] = requests as unknown as { model: string; output_config: unknown; system: unknown }[];
    assert.equal(sent.model, "anthropic/claude-opus-5.5");
    assert.equal("betas" in sent || "fallbacks" in sent, false);
    assert.deepEqual(sent.output_config, { effort: "low", format: { type: "json_schema", schema: INTENT_SCHEMA } });
    assert.deepEqual(sent.system, [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }]);

    // The real client, pointed at the gateway, calls its plain Messages endpoint with the gateway key.
    const seen: { url: string; key: string | null }[] = [];
    const fetchStub = (async (url: string, init?: RequestInit) => {
      seen.push({ url: String(url), key: new Headers(init?.headers).get("x-api-key") });
      return Response.json({ id: "msg", type: "message", role: "assistant", model: sent.model, stop_reason: "end_turn", content: [{ type: "text", text: intent({ type: "expand_control" }) }], usage: { input_tokens: 1, output_tokens: 1 } });
    }) as unknown as typeof fetch;
    const client = new Anthropic({ apiKey: "test-gateway-key", baseURL: GATEWAY_URL, fetch: fetchStub, maxRetries: 0 });
    assert.deepEqual(await gatewayReasoner(client.messages).interpret("what else do they control?", ""), { type: "expand_control" });
    assert.deepEqual(seen, [{ url: "https://ai-gateway.vercel.sh/v1/messages", key: "test-gateway-key" }]);
  });

  it("uses nothing the model returns until it validates, and treats refusals and truncation as no answer", async () => {
    const cases: [Reply, unknown][] = [
      [{ stop_reason: "end_turn", text: intent({ type: "discover", capability: "contract_manufacturing" }) }, { type: "discover", capability: "contract_manufacturing" }],
      [{ stop_reason: "end_turn", text: intent({ type: "discover", capability: "time_travel" }) }, { type: "discover", capability: null }],
      [{ stop_reason: "end_turn", text: intent({ type: "lens", lens: "proof", reason: "Proof separates claims from evidence." }) }, { type: "lens", lens: "proof", reason: "Proof separates claims from evidence." }],
      [{ stop_reason: "end_turn", text: intent({ type: "lens", lens: "omniscience" }) }, null],
      [{ stop_reason: "end_turn", text: intent({ type: "capability_query", quantity: -5 }) }, { type: "capability_query", quantity: null }],
      [{ stop_reason: "end_turn", text: intent({ type: "delegate_contact", allowPurchases: "yes" }) }, { type: "delegate_contact", allowPurchases: false }],
      [{ stop_reason: "end_turn", text: intent({ type: "transfer_all_funds" }) }, null],
      [{ stop_reason: "end_turn", text: "not json" }, null],
      [{ stop_reason: "refusal", text: intent({ type: "commit" }) }, null],
      [{ stop_reason: "max_tokens", text: intent({ type: "commit" }) }, null],
    ];
    const { api } = stubModel(cases.map(([reply]) => reply));
    const reasoner = claudeReasoner(api);
    for (const [, expected] of cases) assert.deepEqual(await reasoner.interpret("…", ""), expected);

    // A route suggestion counts only if it names a route the kernel computed.
    const routing = claudeReasoner(stubModel([{ stop_reason: "end_turn", text: JSON.stringify({ route_id: "r-invented", rationale: "Trust me." }) }]).api);
    assert.equal(await routing.chooseRoute("10,000 vehicles", routes), null);
    assert.equal(await claudeReasoner(stubModel([]).api).chooseRoute("anything", []), null);
  });

  it("serves the model only to signed-in people, within limits, and reports what is unavailable", async () => {
    const reasoner = claudeReasoner(stubModel([{ stop_reason: "end_turn", text: intent({ type: "expand_control" }) }]).api);
    assert.deepEqual(reasonAvailability({ signedIn: true, reasoner: null }), { status: 200, body: { available: false, reason: "no reasoning model is configured" } });
    assert.deepEqual(reasonAvailability({ signedIn: false, reasoner }).body.available, false);
    assert.deepEqual(reasonAvailability({ signedIn: true, reasoner }).body, { available: true, model: REASONING_MODEL });
    assert.equal((await handleReason({ kind: "interpret", text: "hi" }, { signedIn: true, reasoner: null })).status, 503);
    assert.equal((await handleReason({ kind: "interpret", text: "hi" }, { signedIn: false, reasoner })).status, 401);
    assert.equal((await handleReason(null, { signedIn: true, reasoner })).status, 422);
    assert.equal((await handleReason({ kind: "interpret", text: "x".repeat(501) }, { signedIn: true, reasoner })).status, 422);
    assert.equal((await handleReason({ kind: "route", goal: "g", routes: [{ id: "a" }] }, { signedIn: true, reasoner })).status, 422);
    assert.equal((await handleReason({ kind: "delete_everything" }, { signedIn: true, reasoner })).status, 422);
    const ok = await handleReason({ kind: "interpret", text: "What else do they control?", summary: "Selected: Halden Works." }, { signedIn: true, reasoner });
    assert.deepEqual([ok.status, ok.body.model, ok.body.intent], [200, REASONING_MODEL, { type: "expand_control" }]);
    const failing = { model: REASONING_MODEL, interpret: async () => { throw new Error("overloaded"); }, chooseRoute: async () => null };
    assert.deepEqual((await handleReason({ kind: "interpret", text: "hi" }, { signedIn: true, reasoner: failing })).status, 502);
  });

  it("falls back to the rules whenever the model is unavailable or returns nothing valid, and says which interpreted", async () => {
    const calls: string[] = [];
    // A stand-in server: GET answers availability (always 200), POST answers with the given reply.
    const server = (available: boolean, status: number, body: unknown) =>
      (async (_url: string, init?: RequestInit) => {
        calls.push(init?.method ?? "GET");
        return init?.method === "POST" ? new Response(JSON.stringify(body), { status }) : Response.json(available ? { available: true, model: REASONING_MODEL } : { available: false });
      }) as unknown as typeof fetch;
    const ctx = emptyContext("me");

    const live = remoteProvider(ruleProvider, server(true, 200, { model: REASONING_MODEL, intent: { type: "lens", lens: "power", reason: "Who controls it." } }));
    assert.deepEqual(await live.interpret("who is in charge of this?", ctx), { type: "lens", lens: "power", reason: "Who controls it." });
    assert.deepEqual(live.lastSource, { kind: "model", model: REASONING_MODEL });
    assert.match(live.label, /claude-opus-5-5 interpreted this/);

    const garbage = remoteProvider(ruleProvider, server(true, 200, { model: REASONING_MODEL, intent: { type: "launch" } }));
    assert.deepEqual(await garbage.interpret("Can they make 10,000?", ctx), { type: "capability_query", quantity: 10000 });
    assert.deepEqual(garbage.lastSource, { kind: "rules" });

    calls.length = 0;
    const off = remoteProvider(ruleProvider, server(false, 200, {}));
    await off.interpret("Can they make 10,000?", ctx);
    await off.interpret("who controls this?", ctx);
    assert.equal(await off.proposeRoute("goal", routes), null);
    assert.deepEqual(calls, ["GET"], "asked once whether a model is available, and sent nothing when it is not");
    assert.equal(off.label, ruleProvider.label);

    const failing = remoteProvider(ruleProvider, server(true, 502, { available: false }));
    assert.equal((await failing.interpret("Can they make 10,000?", ctx)).type, "capability_query", "a failed model call falls back to the rules");

    const down = remoteProvider(ruleProvider, (async () => { throw new TypeError("network down"); }) as typeof fetch);
    assert.equal((await down.interpret("Can they make 10,000?", ctx)).type, "capability_query");
    assert.equal(await down.proposeRoute("goal", routes), null);
  });

  it("never grants authority from a model's reading: a consequential intent becomes a proposal to confirm", async () => {
    const { k, manifest } = await buildArcadia();
    const you = kernelClient(localSupabase(k, user(manifest.personas.you)));
    const as = (id: string) => kernelClient(localSupabase(k, service), { actAs: id });
    const engine = new WorldEngine({ manifest, you, as });
    await engine.createAvatar({ type: "ai_companion", name: "Nova", relationship: "assist", seed: {}, representation: "abstract" });
    let model = await engine.load();
    await engine.buildVenture("a car company with the least upfront capital", true, model);
    model = await engine.load();
    const ctx = emptyContext(manifest.you.actorId);
    const events = async () => Number((await k.owner("select count(*)::int as n from kernel.events"))[0].n);

    const before = await events();
    const proposed = await respond({ type: "delegate_contact", allowPurchases: false }, { engine, model, ctx, text: "sure, go talk to them", confirmed: false });
    assert.equal(await events(), before, "nothing was written");
    assert.equal(engine.contactTask(await engine.load()), null, "no task, no lease");
    assert.deepEqual(proposed.result.actions.map((a) => a.id), ["allow-contact"], "the person confirms with a click");

    // The click is the person's explicit act: granted, task-scoped.
    const granted = await respond({ type: "delegate_contact", allowPurchases: false }, { engine, model, ctx, text: "", confirmed: true });
    assert.equal(granted.reload, true);
    assert.ok(engine.contactTask(await engine.load()), "the grant exists only after confirmation");
    assert.ok(avatarAgent(model));
  });
});
