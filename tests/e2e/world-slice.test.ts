// The first complete SOV loop, below the interface: intent → World → route → discovery →
// selection-resolved inquiry → authority check → delegation → agent-to-agent exchange with
// provenance → commitment under the right authority → kernel history intact. Runs on Arcadia.
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { kernelClient } from "../../lib/kernel/client";
import { localSupabase, service, user } from "../../lib/kernel/local";
import { resolveDeixis } from "../../lib/world/deixis";
import { avatarAgent, WorldEngine, type WorldModel } from "../../lib/world/engine";
import { ruleProvider } from "../../lib/world/horizon";
import { emptyContext } from "../../lib/world/types";
import { buildArcadia } from "../support/arcadia";

let engine: WorldEngine;
let model: WorldModel;
let k: Awaited<ReturnType<typeof buildArcadia>>["k"];
let manifest: Awaited<ReturnType<typeof buildArcadia>>["manifest"];

before(async () => {
  ({ k, manifest } = await buildArcadia());
  engine = new WorldEngine({
    manifest,
    you: kernelClient(localSupabase(k, user(manifest.personas.you))),
    as: (id) => kernelClient(localSupabase(k, service), { actAs: id }),
  });
  model = await engine.load();
});

const org = (key: string) => `entity:${manifest.orgs[key].entityId}`;

describe("Arcadia as seen by You", () => {
  it("shows the market with claims in their true proof states", () => {
    assert.equal(model.nodes.get(org("halden"))?.proof, "verified");
    assert.equal(model.nodes.get(org("orrin"))?.proof, "self_reported");
    assert.equal(model.nodes.get(org("cobalt"))?.proof, "challenged");
    assert.equal(model.nodes.get(org("halden"))?.location?.truth, "declared");
  });

  it("carries your real economic history: an Earn Vault release and a $10 payment", () => {
    assert.equal(model.settlement?.status, "confirmed");
    assert.equal(model.payment?.status, "confirmed");
    assert.equal(model.payment?.deliver_amount, "10000000");
    assert.ok((model.payment?.legs.length ?? 0) >= 1);
  });
});

describe("the car-company loop", () => {
  it("runs from intent to a committed, recorded consequence", async () => {
    // Avatar: Nova, an AI companion that assists. It starts with observe-level authority only.
    await engine.createAvatar({ type: "ai_companion", name: "Nova", relationship: "assist", seed: { hair: "dark" }, representation: "stylized_3d" });
    model = await engine.load();
    const nova = avatarAgent(model)!;
    assert.equal(nova.name, "Nova");

    // Intent → World with a causal route.
    const intent = await ruleProvider.interpret("Nova, help me build a car company with the least upfront capital possible.", emptyContext(manifest.you.actorId));
    assert.deepEqual(intent.type === "build_venture" && intent.strategy, "least_capital");
    const { scope, plan } = await engine.buildVenture(intent.type === "build_venture" ? intent.objective : "", true, model);
    model = await engine.load();
    assert.equal(model.venture?.scope, scope);
    assert.deepEqual(model.venture?.milestones.map((m) => m.title), ["Idea", "Design", "Prototype", "Certification", "Contract manufacturing", "Distribution"]);
    assert.ok(plan.capitalUsd < plan.alternative.capitalUsd, "least capital beats an own plant");
    assert.ok(model.venture?.needs.some((n) => n.attributes.capability === "contract_manufacturing"));
    assert.equal(model.venture?.tasks[0].title, "Find a manufacturing partner");

    // "Find them" → candidates for the needs, verified claims first, challenged ones last.
    const find = await ruleProvider.interpret("Find them", emptyContext(manifest.you.actorId));
    assert.equal(find.type, "discover");
    const candidates = engine.discover(model, ["contract_manufacturing"]);
    assert.deepEqual(candidates, [org("halden"), org("orrin"), org("cobalt")]);

    // Select Halden; "Can they make 10,000?" resolves "they" from the selection.
    const ctx = { ...emptyContext(manifest.you.actorId), comparisonIds: candidates, currentSelectionIds: [org("halden")] };
    const ask = await ruleProvider.interpret("Can they make 10,000?", ctx);
    assert.deepEqual(ask, { type: "capability_query", quantity: 10000 });
    const target = resolveDeixis("Can they make 10,000?", ctx, model.nodes, { consequential: true });
    assert.deepEqual(target, { kind: "resolved", refs: [org("halden")], source: "selection" });

    // Nova may not contact anyone yet: authority, not willingness, decides.
    const denied = await engine.capabilityQuery(nova.agent_id, org("halden"), 10000, scope, model);
    assert.equal(denied.decision.decision, "DENY");

    // "You may contact suppliers but not make purchases."
    const delegation = await ruleProvider.interpret("You may contact suppliers but not make purchases.", ctx);
    assert.deepEqual(delegation, { type: "delegate_contact", allowPurchases: false });
    await engine.delegateContact(nova.agent_id, scope);
    const answered = await engine.capabilityQuery(nova.agent_id, org("halden"), 10000, scope, model);
    assert.equal(answered.decision.decision, "ALLOW");
    assert.deepEqual(
      [answered.answer?.can_fulfill, answered.answer?.capacity_per_year, answered.answer?.lead_time_days, answered.answer?.unit_price_usd],
      [true, 12000, 210, 18500],
    );
    model = await engine.load();
    const reply = model.companionInbox.find((m) => m.in_reply_to === answered.queryId)!;
    assert.deepEqual([reply.sender_kind, reply.on_behalf_of], ["agent", manifest.orgs.halden.ownerId], "provenance names the agent and its principal");

    // "Accept their offer": Nova was never given commitment authority; You commit with yours.
    assert.equal((await ruleProvider.interpret("Accept their offer", ctx)).type, "commit");
    assert.equal((await engine.commitDecision(nova.agent_id, scope)).decision, "DENY");
    const acceptance = await engine.commitAsYou(org("halden"), scope, { quantity: 10000, unit_price_usd: 18500 });
    const done = await engine.sb.you.readAction(acceptance);
    assert.deepEqual([done.status, done.payload.type], ["completed", "ACCEPTANCE"]);

    const integrity = await kernelClient(localSupabase(k, service)).verifyChain();
    assert.equal(integrity.ok, true);
  });
});
