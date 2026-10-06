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
import { bandCeiling, bandForHeight, buildSpatialView, type SpatialInput } from "../../lib/world/spatial";
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
    steward: kernelClient(localSupabase(k, user(manifest.personas.steward))),
    as: (id) => kernelClient(localSupabase(k, service), { actAs: id }),
  });
  model = await engine.load();
});

const org = (key: string) => `entity:${manifest.orgs[key].entityId}`;
const input = (over: Partial<SpatialInput> = {}): SpatialInput => ({ selected: [], highlights: [], routes: [], fields: [], effectsAfterSeq: 0, ...over });
const maxSeq = (m: WorldModel) => m.events.reduce((max, e) => Math.max(max, e.seq), 0);

describe("Arcadia as seen by You", () => {
  it("shows the market with claims in their true proof states", () => {
    assert.equal(model.nodes.get(org("halden"))?.proof, "verified");
    assert.equal(model.nodes.get(org("orrin"))?.proof, "self_reported");
    assert.equal(model.nodes.get(org("cobalt"))?.proof, "challenged");
    assert.equal(model.nodes.get(org("halden"))?.location?.truth, "declared");
  });

  it("renders only real geography, under canonical ids, and never what You may not see", () => {
    const view = buildSpatialView(model, input());
    assert.ok(view.markers.length > 0);
    for (const m of view.markers) {
      const node = model.nodes.get(m.ref);
      assert.ok(node, `${m.ref} is a canonical ref of the World model`);
      assert.match(m.ref, /^entity:[0-9a-f-]{36}$/);
      assert.ok(node.location && node.location.truth, "markers exist only for things with a recorded location");
    }
    // Network States have no territory: they draw as constellations of their hubs, and the line
    // stands for the State.
    const meridian = `entity:${manifest.states.meridian.entityId}`;
    assert.ok(!view.markers.some((m) => m.ref === meridian));
    assert.ok(view.links.some((l) => l.kind === "constellation" && l.ref === meridian));
    // The private record never reaches the model, so it can never reach a renderer.
    assert.ok(!model.nodes.has(`entity:${manifest.privateEntityId}`));
    assert.ok(!view.markers.some((m) => m.ref === `entity:${manifest.privateEntityId}`));
    // History is state, not animation.
    assert.deepEqual(buildSpatialView(model, input({ effectsAfterSeq: maxSeq(model) })).effects, []);
  });

  it("lets the steward see SOV operating SOV, with what needs a human and what is not built", async () => {
    const ops = (await engine.operations())!;
    assert.equal(ops.tasks.length, 2);
    for (const t of ops.tasks) {
      assert.equal(t.status, "completed");
      assert.equal(t.decision, "REQUIRE_SECOND_AUTHORITY");
      assert.equal(t.actionStatus, "completed");
      assert.equal(t.outcome, "payment confirmed");
      assert.match(t.worker!, /Reconciler/);
      assert.match(t.verifier!, /Verifier/);
    }
    assert.equal(ops.learning.length, 1);
    assert.deepEqual(ops.proposals.map((p) => p.changeClass), ["A"]);
    assert.deepEqual(ops.needsYou, []);
    assert.match(ops.proposals[0].status, /promoted and observed \(completed\)/);
    assert.ok(ops.notBuilt.some((n) => /not this repository/.test(n)), "what is not built is stated, not hidden");
    // You cannot read SOV's operations.
    await assert.rejects(engine.sb.you.readTasks("system/chain:litesvm"));
  });

  it("maps camera height to semantic zoom bands", () => {
    assert.equal(bandForHeight(30_000_000), "ORBIT");
    assert.equal(bandForHeight(17_000_000), "PLANET");
    assert.equal(bandForHeight(3_000_000), "REGION");
    assert.equal(bandForHeight(400_000), "METRO");
    assert.equal(bandForHeight(20_000), "SITE");
    assert.equal(bandCeiling("ORBIT"), Number.POSITIVE_INFINITY);
    assert.equal(bandCeiling("REGION"), 8_000_000);
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
    const intent = await ruleProvider.interpret("Nova, help me launch my insurance agency with the least upfront capital possible.", emptyContext(manifest.you.actorId));
    assert.deepEqual(intent.type === "build_venture" && intent.strategy, "least_capital");
    const { scope, plan } = await engine.buildVenture(intent.type === "build_venture" ? intent.objective : "", true, model);
    model = await engine.load();
    assert.equal(model.venture?.scope, scope);
    assert.deepEqual(model.venture?.milestones.map((m) => m.title), ["Idea", "Validate", "First customers", "Systematize"]);
    assert.ok(plan.capitalUsd < plan.alternative.capitalUsd, "least capital beats the funded path");
    assert.ok(model.venture?.needs.some((n) => n.attributes.capability === "customer_discovery"));
    assert.equal(model.venture?.tasks[0].title, "First move: Validate");
    // A venture is a World, not a place: no invented coordinates; listed off Earth when it matters.
    const worldRef = model.venture!.worldRef;
    assert.equal(model.nodes.get(worldRef)?.location, null);
    const routeView = buildSpatialView(model, input({ routes: [worldRef, org("halden"), org("orrin")] }));
    assert.ok(!routeView.markers.some((m) => m.ref === worldRef));
    assert.deepEqual(routeView.offEarth.map((o) => o.ref), [worldRef]);
    assert.ok(!routeView.links.some((l) => l.kind === "route"), "no route lines from an origin with no geography");
    assert.equal(routeView.markers.find((m) => m.ref === org("halden"))?.emphasis, "lit");

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
    const beforeDenial = maxSeq(model);
    const denied = await engine.ask(org("halden"), 10000, model, nova.agent_id);
    assert.equal(denied.outcome?.status, "denied");
    // The refusal is a kernel record, and the World shows it: Halden is not reachable yet.
    model = await engine.load();
    const refused = buildSpatialView(model, input({ effectsAfterSeq: beforeDenial }));
    assert.equal(refused.markers.find((m) => m.ref === org("halden"))?.state, "blocked");
    assert.deepEqual(refused.effects.map((e) => [e.kind, e.refs[0]]), [["route_stopped", org("halden")]]);
    assert.match(refused.effects[0].label, /no active grant for message.send/);

    // "You may contact suppliers but not make purchases."
    const delegation = await ruleProvider.interpret("You may contact suppliers but not make purchases.", ctx);
    assert.deepEqual(delegation, { type: "delegate_contact", allowPurchases: false });
    // Granted as task-scoped consent; the World reloads (as the UI does) and the ask is done for that task.
    assert.equal((await engine.allowContact(model, nova.agent_id))?.status, "completed");
    model = await engine.load();
    const answered = await engine.ask(org("halden"), 10000, model, nova.agent_id);
    assert.equal(answered.outcome?.status, "completed");
    const q = answered.quote!.value!;
    assert.deepEqual([q.can_fulfill, q.capacity_per_year, q.lead_time_days, q.unit_price_usd], [true, 12000, 210, 18500]);
    assert.equal(answered.quote!.status, "reconciled", "the quote is canonical because the reply settled the inquiry");
    model = await engine.load();
    const reply = model.companionInbox.find((m) => m.message_type === "INFORMATION_RESPONSE" && m.payload.organization === org("halden"))!;
    assert.deepEqual([reply.sender_kind, reply.on_behalf_of], ["agent", manifest.orgs.halden.ownerId], "provenance names the agent and its principal");

    // "Accept their offer": Nova was never given commitment authority; You commit with yours.
    assert.equal((await ruleProvider.interpret("Accept their offer", ctx)).type, "commit");
    assert.equal((await engine.commitDecision(nova.agent_id, scope)).decision, "DENY");
    const acceptance = await engine.acceptAsYou(org("halden"), model, nova.agent_id);
    assert.equal(acceptance.outcome?.status, "completed");
    const done = await engine.sb.you.readAction(acceptance.outcome!.actionId!);
    assert.deepEqual([done.status, done.kind, done.capability, done.proposer_id], ["completed", "supplier.accept", "commitment.make", manifest.you.actorId]);

    // The consequence changes the World: Halden now supplies your World, its marker shows the
    // agreement, its real logistics route through Sable carries it, and the change plays once.
    const beforeReload = maxSeq(model);
    model = await engine.load();
    assert.ok(model.edges.some((e) => e.kind === "supplies" && e.from === org("halden") && e.to === worldRef && e.attributes.status === "agreed"));
    const after = buildSpatialView(model, input({ effectsAfterSeq: beforeReload }));
    assert.equal(after.markers.find((m) => m.ref === org("halden"))?.state, "committed");
    assert.ok(after.links.some((l) => l.kind === "relation" && l.from === org("sable") && l.to === org("halden") && l.style === "committed"));
    assert.deepEqual(after.effects.map((e) => [e.kind, e.refs[0]]), [["commitment", org("halden")]]);
    // And it is inspectable: the proof of Halden now runs from claim to agreement.
    const proof = await engine.proofOf(org("halden"), model);
    assert.deepEqual(proof.steps.map((st) => st.title), ["Claim", "Offer", "Acceptance", "Agreement"]);
    assert.match(proof.steps[2].detail, /commitment.make\). The kernel decided ALLOW; the action is completed/);

    const integrity = await kernelClient(localSupabase(k, service)).verifyChain();
    assert.equal(integrity.ok, true);
  });
});
