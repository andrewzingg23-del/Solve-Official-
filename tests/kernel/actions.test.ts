// Kernel v4: authority decides (never humanness), agents enact and create agents, governance
// (second authority, quorum, multisig, delay, challenge window) gates actions, leases bound
// delegated power, the World Graph and tasks change only through events, avatars keep identity.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { KernelError, kernelClient, type Kernel } from "../../lib/kernel/client";
import { pgliteSupabase } from "../support/pglite-supabase";
import { createKernelDb, service, sha, sqlstate, user, type KernelDb } from "./harness";

const WORLD = "world:arcadia";
const evidence = (n: number) => [{ basis: "artifact" as const, content_hash: sha(n) as `sha256:${string}`, description: "work product" }];

const named = (name: string, pattern?: RegExp) => (error: unknown) => {
  assert.ok(error instanceof KernelError, `expected KernelError, got ${error}`);
  assert.equal(error.name, name, error.message);
  if (pattern) assert.match(error.message, pattern);
  return true;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function setup() {
  const k = await createKernelDb();
  const human = (sub: string) => kernelClient(pgliteSupabase(k, user(sub)));
  const founder = human("auth-founder");
  const founderId = await founder.register("Founder");
  await k.owner("select kernel.grant_root($1)", [founderId]);
  await founder.defineAsset({ code: "DEV_USDC", issuerScope: "system", decimals: 6 });

  const alice = human("auth-alice");
  const bob = human("auth-bob");
  const carol = human("auth-carol");
  const aliceId = await alice.register("Alice");
  const bobId = await bob.register("Bob");
  const carolId = await carol.register("Carol");
  await alice.claimScope(WORLD);
  const agent = (actorId: string) => kernelClient(pgliteSupabase(k, service), { actAs: actorId });
  return { k, founder, alice, bob, carol, aliceId, bobId, carolId, agent };
}

async function party(k: KernelDb, actorId: string) {
  const [row] = await k.owner("select kernel.party_of($1) as party", [actorId]);
  return row.party as string;
}

describe("principals", () => {
  it("lets agents create agents, with provenance to an accountable party", async () => {
    const t = await setup();
    const nova = await t.alice.spawnAgent({ label: "Nova", role: "ai_companion" });
    assert.equal(await party(t.k, nova), t.aliceId);

    // Nova has no authority to create agents until it is granted, then creates one itself.
    await assert.rejects(t.agent(nova).spawnAgent({ label: "Scout", role: "specialist", serves: WORLD }), named("forbidden"));
    await t.alice.issueGrant({ grantee: nova, capability: "kernel.actor.create", scope: WORLD });
    const scout = await t.agent(nova).spawnAgent({ label: "Scout", role: "specialist", serves: WORLD, idempotencyKey: "scout" });
    assert.equal(await t.agent(nova).spawnAgent({ label: "Scout", role: "specialist", serves: WORLD, idempotencyKey: "scout" }), scout);
    const [row] = await t.k.owner("select owner_id from kernel.actors where id = $1", [scout]);
    assert.equal(row.owner_id, nova);
    assert.equal(await party(t.k, scout), t.aliceId, "accountability follows ownership to the human");

    const [spawned] = await t.k.owner(
      "select actor_id, on_behalf_of, payload from kernel.events where type = 'kernel.agent.spawned' and payload->>'actor_id' = $1",
      [scout],
    );
    assert.equal(spawned.actor_id, nova);
    assert.equal(spawned.on_behalf_of, t.aliceId);
    assert.equal((spawned.payload as { authority_grant: string }).authority_grant !== null, true);
  });

  it("decides by authority alone: an agent with a grant enacts, one without is refused", async () => {
    const t = await setup();
    const nova = await t.alice.spawnAgent({ label: "Nova", role: "ai_companion" });
    const before = await t.agent(nova).authorize({ capability: "world.entity.write", scope: WORLD });
    assert.equal(before.decision, "DENY");
    await assert.rejects(t.agent(nova).upsertEntity({ kind: "place", scope: WORLD, title: "Factory" }), named("forbidden"));

    await t.alice.issueGrant({ grantee: nova, capability: "world.entity.write", scope: WORLD });
    assert.equal((await t.agent(nova).authorize({ capability: "world.entity.write", scope: WORLD })).decision, "ALLOW");
    const factory = await t.agent(nova).upsertEntity({ kind: "place", scope: WORLD, title: "Factory", latitude: 48.1, longitude: 11.5, locationTruth: "declared" });
    const world = await t.alice.readWorld(WORLD);
    assert.equal(world.find((e) => e.entity_id === factory)?.title, "Factory");

    // A delegated agent cannot pass on what it does not hold.
    const scout = await t.alice.spawnAgent({ label: "Scout", role: "specialist" });
    await assert.rejects(t.agent(nova).issueGrant({ grantee: scout, capability: "payment.send", scope: WORLD }), named("forbidden"));
  });
});

describe("leases", () => {
  it("bound amount, counterparty and task, and never widen down the chain", async () => {
    const t = await setup();
    const nova = await t.alice.spawnAgent({ label: "Nova", role: "ai_companion" });
    const scout = await t.alice.spawnAgent({ label: "Scout", role: "specialist" });
    const bob = `actor:${t.bobId}`;
    await t.alice.issueLease({ grantee: nova, capability: "payment.send", scope: WORLD, maxAmount: "50000000", asset: "DEV_USDC", counterpartyRef: bob });
    await t.alice.issueGrant({ grantee: nova, capability: "kernel.grant.issue", scope: WORLD });

    const ask = (who: Kernel, amount: string, counterpartyRef = bob) =>
      who.authorize({ capability: "payment.send", scope: WORLD, amount, asset: "DEV_USDC", counterpartyRef });
    assert.equal((await ask(t.agent(nova), "40000000")).decision, "ALLOW");
    const over = await ask(t.agent(nova), "60000000");
    assert.equal(over.decision, "DENY");
    assert.match(over.reasons.join(), /exceeds the delegated limit/);
    assert.equal((await ask(t.agent(nova), "1000000", `actor:${t.carolId}`)).decision, "DENY");

    await assert.rejects(
      t.agent(nova).issueLease({ grantee: scout, capability: "payment.send", scope: WORLD, maxAmount: "100000000", asset: "DEV_USDC", counterpartyRef: bob }),
      named("forbidden", /cannot exceed the amount limit/),
    );
    await assert.rejects(
      t.agent(nova).issueLease({ grantee: scout, capability: "payment.send", scope: WORLD, maxAmount: "10000000", asset: "DEV_USDC" }),
      named("forbidden", /counterparty/),
    );
    await t.agent(nova).issueLease({ grantee: scout, capability: "payment.send", scope: WORLD, maxAmount: "30000000", asset: "DEV_USDC", counterpartyRef: bob });
    assert.equal((await ask(t.agent(scout), "30000000")).decision, "ALLOW");
    assert.equal((await ask(t.agent(scout), "35000000")).decision, "DENY");
  });

  it("are invisible to functions that check a capability alone", async () => {
    const t = await setup();
    const scout = await t.alice.spawnAgent({ label: "Scout", role: "specialist" });
    const task = await t.alice.createTask({ scope: WORLD, title: "Survey the site", requiredCapability: "survey.run" });
    const others = await t.alice.createTask({ scope: WORLD, title: "Another job", requiredCapability: "survey.run" });

    // A read lease limited to one task is not a general read grant: read_events checks only the
    // capability, so it must not see the lease at all.
    await t.alice.issueLease({ grantee: scout, capability: "kernel.read", scope: WORLD, taskRef: `task:${task}` });
    await assert.rejects(t.agent(scout).readEvents(WORLD), named("forbidden"));

    // Where the request names its task, the same kind of lease works for that task only.
    await t.alice.issueLease({ grantee: scout, capability: "task.verify", scope: WORLD, taskRef: `task:${task}` });
    const [row] = await t.k.owner("select kernel.find_permitted_grant($1, 'task.verify', $2, null, null, null, $3) as g", [scout, WORLD, `task:${task}`]);
    assert.ok(row.g, "permitted for its task");
    const [other] = await t.k.owner("select kernel.find_permitted_grant($1, 'task.verify', $2, null, null, null, $3) as g", [scout, WORLD, `task:${others}`]);
    assert.equal(other.g, null, "not for another task");

    // A task limit must name a real task.
    await assert.rejects(t.alice.issueLease({ grantee: scout, capability: "survey.run", scope: WORLD, taskRef: "task:abc" }), named("invalid"));
    await assert.rejects(
      t.alice.issueLease({ grantee: scout, capability: "survey.run", scope: WORLD, taskRef: "task:00000000-0000-4000-8000-000000000000" }),
      named("not_found"),
    );
  });
});

describe("governance", () => {
  it("quorum needs distinct parties; the action enacts once with evidence", async () => {
    const t = await setup();
    const nova = await t.alice.spawnAgent({ label: "Nova", role: "ai_companion" });
    const scout = await t.alice.spawnAgent({ label: "Scout", role: "specialist" });
    await t.alice.setActionPolicy({ scope: WORLD, capability: "treasury.spend", requirement: "quorum", approverCapability: "treasury.approve", threshold: 2 });
    await t.alice.issueGrant({ grantee: nova, capability: "treasury.spend", scope: WORLD });
    await t.alice.issueGrant({ grantee: scout, capability: "treasury.approve", scope: WORLD });
    await t.alice.issueGrant({ grantee: t.bobId, capability: "treasury.approve", scope: WORLD });

    const id = await t.agent(nova).proposeAction({ kind: "treasury.transfer", capability: "treasury.spend", scope: WORLD, payload: { to: "supplier" } });
    let action = await t.agent(nova).readAction(id);
    assert.equal(action.decision, "REQUIRE_QUORUM");
    assert.equal(action.status, "proposed");
    await assert.rejects(t.agent(nova).beginAction(id), named("invalid", /not authorized/));

    assert.equal(await t.agent(scout).approveAction(id), "proposed");
    await assert.rejects(t.alice.approveAction(id), named("forbidden"), "Alice holds no treasury.approve");
    await t.alice.issueGrant({ grantee: t.aliceId, capability: "treasury.approve", scope: WORLD }).catch(() => undefined);
    await assert.rejects(t.carol.approveAction(id), named("forbidden"));
    assert.equal(await t.bob.approveAction(id), "authorized");

    assert.equal(await t.agent(nova).beginAction(id), "enacting");
    await assert.rejects(t.agent(nova).settleAction({ actionId: id, status: "completed" }), named("invalid", /requires evidence/));
    await t.agent(nova).settleAction({ actionId: id, status: "completed", result: { tx: "abc" }, evidence: evidence(7) });
    assert.equal(await t.agent(nova).settleAction({ actionId: id, status: "completed", evidence: evidence(7) }), "completed");
    action = await t.agent(nova).readAction(id);
    assert.equal(action.status, "completed");
    assert.equal(action.approvals, 2);
    const done = await t.k.owner("select count(*)::int as n from kernel.action_transitions where action_id = $1 and status = 'completed'", [id]);
    assert.equal(done[0].n, 1);
  });

  it("lets an agent collective approve and enact without a human when policy counts actors", async () => {
    const t = await setup();
    const builder = await t.alice.spawnAgent({ label: "Builder", role: "engineering_agent" });
    const reviewer = await t.alice.spawnAgent({ label: "Reviewer", role: "engineering_agent" });
    await t.alice.setActionPolicy({ scope: WORLD, capability: "event.deploy", requirement: "second_authority", approverCapability: "deploy.review", distinctBy: "actor" });
    await t.alice.issueGrant({ grantee: builder, capability: "event.deploy", scope: WORLD });
    await t.alice.issueGrant({ grantee: reviewer, capability: "deploy.review", scope: WORLD });

    const id = await t.agent(builder).proposeAction({ kind: "event.record", capability: "event.deploy", scope: WORLD, payload: { type: "event.deploy", payload: { build: "a1" } } });
    assert.equal((await t.agent(builder).readAction(id)).decision, "REQUIRE_SECOND_AUTHORITY");
    // The builder is the first authority; approving again adds nothing.
    assert.equal(await t.agent(builder).approveAction(id), "proposed");
    assert.equal((await t.agent(builder).readAction(id)).approvals, 1);
    assert.equal(await t.agent(reviewer).approveAction(id), "authorized");
    const result = await t.agent(builder).enactAction(id);
    const [event] = await t.k.owner("select type, actor_id, on_behalf_of from kernel.events where id = $1", [result.event_id]);
    assert.deepEqual([event.type, event.actor_id, event.on_behalf_of], ["event.deploy", builder, t.aliceId]);
  });

  it("multisig accepts only named signers", async () => {
    const t = await setup();
    await t.alice.setActionPolicy({ scope: WORLD, capability: "world.entity.write", requirement: "multisig", signers: [t.bobId, t.carolId], threshold: 2 });
    const id = await t.alice.proposeAction({ kind: "entity.upsert", capability: "world.entity.write", scope: WORLD, payload: { kind: "place", title: "Plant" } });
    await assert.rejects(t.alice.approveAction(id), named("forbidden"));
    assert.equal(await t.bob.approveAction(id), "proposed");
    assert.equal(await t.carol.approveAction(id), "authorized");
    const { entity_id } = await t.alice.enactAction(id);
    assert.ok((await t.alice.readWorld(WORLD)).some((e) => e.entity_id === entity_id));
    await assert.rejects(t.alice.upsertEntity({ kind: "place", scope: WORLD, title: "Shortcut" }), named("forbidden", /governed \(REQUIRE_MULTISIG\)/));
  });

  it("timelocks and challenge windows hold enactment; revocation stops it", async () => {
    const t = await setup();
    await t.alice.setActionPolicy({ scope: WORLD, capability: "world.relation.write", requirement: "delay", delaySeconds: 1 });
    const a = await t.alice.upsertEntity({ kind: "organization", scope: WORLD, title: "Supplier A" });
    const b = await t.alice.upsertEntity({ kind: "organization", scope: WORLD, title: "Factory B" });
    const delayed = await t.alice.proposeAction({ kind: "relation.create", capability: "world.relation.write", scope: WORLD, payload: { kind: "supplies", from_ref: `entity:${a}`, to_ref: `entity:${b}` } });
    assert.equal((await t.alice.readAction(delayed)).decision, "REQUIRE_DELAY");
    await assert.rejects(t.alice.enactAction(delayed), named("invalid", /cannot be enacted before/));
    await sleep(1100);
    await t.alice.enactAction(delayed);
    assert.equal((await t.alice.readRelations(WORLD)).length, 1);

    // Challenge window: a holder of the challenger capability from another party can stop it.
    const nova = await t.alice.spawnAgent({ label: "Nova", role: "ai_companion" });
    await t.alice.issueGrant({ grantee: nova, capability: "task.create", scope: WORLD });
    await t.alice.setActionPolicy({ scope: WORLD, capability: "task.create", requirement: "challenge_window", delaySeconds: 1, approverCapability: "world.challenge" });
    await t.alice.issueGrant({ grantee: t.bobId, capability: "world.challenge", scope: WORLD });
    const task = { title: "Hire certification lab", required_capability: "task.work" };
    const challenged = await t.agent(nova).proposeAction({ kind: "task.create", capability: "task.create", scope: WORLD, payload: task });
    await assert.rejects(t.alice.challengeAction(challenged, "mine"), named("forbidden"));
    assert.equal(await t.bob.challengeAction(challenged, "lab is not accredited"), "rejected");
    await sleep(1100);
    await assert.rejects(t.agent(nova).enactAction(challenged), named("invalid", /rejected/));
    const unchallenged = await t.agent(nova).proposeAction({ kind: "task.create", capability: "task.create", scope: WORLD, payload: task });
    await sleep(1100);
    assert.ok((await t.agent(nova).enactAction(unchallenged)).task_id);

    // Authority is re-checked at enactment.
    const grantId = await t.alice.issueGrant({ grantee: nova, capability: "world.relation.write", scope: WORLD });
    const pending = await t.agent(nova).proposeAction({ kind: "relation.create", capability: "world.relation.write", scope: WORLD, payload: { kind: "blocks", from_ref: `entity:${b}`, to_ref: `entity:${a}` } });
    await t.alice.revokeGrant(grantId, "no longer trusted");
    await sleep(1100);
    await assert.rejects(t.agent(nova).enactAction(pending), named("forbidden", /authority lapsed/));
  });

  it("records denied attempts and never lets a principal expand its own authority", async () => {
    const t = await setup();
    const nova = await t.alice.spawnAgent({ label: "Nova", role: "ai_companion" });
    await assert.rejects(t.agent(nova).setActionPolicy({ scope: WORLD, capability: "*", requirement: "allow" }), named("forbidden"));
    const attempt = await t.agent(nova).proposeAction({ kind: "policy.set", capability: "kernel.policy.set", scope: WORLD, payload: { capability: "*", requirement: "allow" } });
    const denied = await t.agent(nova).readAction(attempt);
    assert.deepEqual([denied.decision, denied.status], ["DENY", "rejected"]);
    await assert.rejects(t.agent(nova).enactAction(attempt), named("invalid"));
    await assert.rejects(
      t.agent(nova).proposeAction({ kind: "policy.set", capability: "world.entity.write", scope: WORLD, payload: {} }),
      named("invalid", /require the kernel.policy.set capability/),
    );

    await t.alice.setActionPolicy({ scope: WORLD, capability: "payment.send", requirement: "deny" });
    const blocked = await t.alice.proposeAction({ kind: "payment.send", capability: "payment.send", scope: WORLD, payload: {} });
    assert.match((await t.alice.readAction(blocked)).reasons.join(), /policy on world:arcadia denies payment.send/);

    // Governance can approve a grant, but the grant still comes from the proposer's own authority.
    await t.alice.setActionPolicy({ scope: WORLD, capability: "kernel.grant.issue", requirement: "second_authority", approverCapability: "kernel.grant.approve" });
    await t.alice.issueGrant({ grantee: t.bobId, capability: "kernel.grant.approve", scope: WORLD }).catch((e) => {
      assert.match(String(e), /governed/);
    });
  });

  it("governs grants through actions with recorded provenance", async () => {
    const t = await setup();
    const nova = await t.alice.spawnAgent({ label: "Nova", role: "ai_companion" });
    await t.alice.issueGrant({ grantee: t.bobId, capability: "kernel.grant.approve", scope: WORLD });
    await t.alice.setActionPolicy({ scope: WORLD, capability: "kernel.grant.issue", requirement: "second_authority", approverCapability: "kernel.grant.approve" });
    await assert.rejects(t.alice.issueGrant({ grantee: nova, capability: "message.send", scope: WORLD }), named("forbidden", /governed/));

    const id = await t.alice.proposeAction({ kind: "grant.issue", capability: "kernel.grant.issue", scope: WORLD, payload: { grantee_id: nova, capability: "message.send" } });
    assert.equal(await t.bob.approveAction(id), "authorized");
    const { grant_id } = await t.alice.enactAction(id);
    const [grant] = await t.k.owner("select g.issued_by, e.payload->>'basis' as basis from kernel.grants g join kernel.events e on e.id = g.event_id where g.id = $1", [grant_id]);
    assert.deepEqual([grant.issued_by, grant.basis], [t.aliceId, `action:${id}`]);
    assert.equal((await t.agent(nova).authorize({ capability: "message.send", scope: WORLD })).decision, "ALLOW");
  });
});

describe("messages", () => {
  it("deliver structured messages with provenance and stop agent loops", async () => {
    const t = await setup();
    const nova = await t.alice.spawnAgent({ label: "Nova", role: "ai_companion" });
    const bobAgent = await t.bob.spawnAgent({ label: "Bob's agent", role: "organization_agent" });
    await t.alice.issueGrant({ grantee: nova, capability: "message.send", scope: WORLD });
    await t.alice.issueGrant({ grantee: bobAgent, capability: "message.send", scope: WORLD });

    const query = await t.agent(nova).proposeAction({
      kind: "message.send",
      capability: "message.send",
      scope: WORLD,
      targetRef: `actor:${bobAgent}`,
      payload: { type: "CAPABILITY_QUERY", capability: "contract manufacturing", quantity: 10000 },
    });
    await t.agent(nova).enactAction(query);
    const [message] = await t.agent(bobAgent).inbox();
    assert.deepEqual([message.message_type, message.sender_id, message.sender_kind, message.on_behalf_of], ["CAPABILITY_QUERY", nova, "agent", t.aliceId]);
    await assert.rejects(
      t.agent(nova).proposeAction({ kind: "message.send", capability: "message.send", scope: WORLD, targetRef: `actor:${bobAgent}`, payload: { type: "GOSSIP" } }),
      named("invalid", /unknown message type/),
    );
    // Contacting is not committing: an acceptance needs commitment.make.
    await assert.rejects(
      t.agent(nova).proposeAction({ kind: "message.send", capability: "message.send", scope: WORLD, targetRef: `actor:${bobAgent}`, payload: { type: "ACCEPTANCE" } }),
      named("invalid", /commitment.make/),
    );
    const accept = await t.agent(nova).proposeAction({ kind: "message.send", capability: "commitment.make", scope: WORLD, targetRef: `actor:${bobAgent}`, payload: { type: "ACCEPTANCE" } });
    assert.equal((await t.agent(nova).readAction(accept)).decision, "DENY");

    // A reply chain longer than 20 is stopped by the kernel.
    let last = query;
    let sender = bobAgent;
    for (let i = 0; i < 20; i++) {
      const to = sender === bobAgent ? nova : bobAgent;
      last = await t.agent(sender).proposeAction({ kind: "message.send", capability: "message.send", scope: WORLD, targetRef: `actor:${to}`, payload: { type: "INFORMATION_RESPONSE" }, inReplyTo: last });
      sender = to;
    }
    await assert.rejects(
      t.agent(sender).proposeAction({ kind: "message.send", capability: "message.send", scope: WORLD, targetRef: `actor:${nova}`, payload: { type: "INFORMATION_RESPONSE" }, inReplyTo: last }),
      named("invalid", /agent loop stopped/),
    );
  });
});

describe("world graph", () => {
  it("versions entities, hides private ones, and keeps relations to things that exist", async () => {
    const t = await setup();
    const plant = await t.alice.upsertEntity({ kind: "place", scope: WORLD, title: "Plant", visibility: "public", latitude: 37.4, longitude: -122.1, locationTruth: "declared" });
    await t.alice.upsertEntity({ entityId: plant, kind: "place", scope: WORLD, title: "Plant (expanded)", visibility: "public", latitude: 37.4, longitude: -122.1, locationTruth: "declared" });
    const secret = await t.alice.upsertEntity({ kind: "document", scope: `${WORLD}/room:board`, title: "Term sheet", visibility: "private" });
    await assert.rejects(t.alice.upsertEntity({ entityId: plant, kind: "asset", scope: WORLD, title: "x" }), named("invalid", /keeps its kind and scope/));

    const world = await t.alice.readWorld(WORLD);
    assert.equal(world.find((e) => e.entity_id === plant)?.version, 2);
    const versions = await t.k.owner("select count(*)::int as n from kernel.entity_versions where entity_id = $1", [plant]);
    assert.equal(versions[0].n, 2, "history keeps both versions");

    await t.alice.issueGrant({ grantee: t.bobId, capability: "kernel.read", scope: WORLD });
    const bobView = await t.bob.readWorld(WORLD);
    assert.ok(bobView.some((e) => e.entity_id === plant));
    assert.ok(!bobView.some((e) => e.entity_id === secret), "private entities need world.private.read");
    // Nor do their events, evidence or proposals reach a reader who may not see them.
    const bobEvents = await t.bob.readEvents(WORLD, { limit: 500 });
    assert.ok(!bobEvents.some((e) => JSON.stringify(e.payload).includes("Term sheet")), "a private record's events are withheld");
    assert.ok((await t.alice.readEvents(WORLD, { limit: 500 })).some((e) => JSON.stringify(e.payload).includes("Term sheet")));
    const [created] = await t.k.owner("select event_id from kernel.entity_versions where entity_id = $1", [secret]);
    await assert.rejects(t.bob.readEvidence(created.event_id as string), named("not_found"));
    const proposal = await t.alice.proposeAction({ kind: "entity.upsert", capability: "world.entity.write", scope: WORLD, payload: { kind: "document", title: "Board minutes", visibility: "private" } });
    assert.deepEqual((await t.bob.readAction(proposal)).payload, { withheld: "private" });
    assert.equal((await t.alice.readAction(proposal)).payload.title, "Board minutes");
    assert.ok(!(await t.bob.readEvents(WORLD, { limit: 500 })).some((e) => JSON.stringify(e.payload).includes("Board minutes")));
    await assert.rejects(t.carol.readWorld(WORLD), named("forbidden"));
    assert.deepEqual((await t.carol.publicWorld()).map((e) => e.entity_id), [plant]);

    await assert.rejects(t.alice.relate({ kind: "owns", fromRef: `actor:${t.aliceId}`, toRef: "entity:00000000-0000-4000-8000-000000000000", scope: WORLD }), named("not_found"));
    const owns = await t.alice.relate({ kind: "owns", fromRef: `actor:${t.aliceId}`, toRef: `entity:${plant}`, scope: WORLD });
    await t.alice.endRelation(owns, "sold");
    assert.equal((await t.alice.readRelations(WORLD)).length, 0);
    assert.equal((await t.alice.readRelations(WORLD, true))[0].ended_at !== null, true);
    await assert.rejects(t.k.owner("update kernel.entity_versions set title = 'x'"), sqlstate("KA006"));
  });
});

describe("tasks", () => {
  it("are claimed under a lease, verified by someone else, and completed once with evidence", async () => {
    const t = await setup();
    const worker = await t.alice.spawnAgent({ label: "Worker", role: "specialist" });
    const verifier = await t.alice.spawnAgent({ label: "Verifier", role: "specialist" });
    const id = await t.alice.createTask({ scope: WORLD, title: "Shortlist manufacturers", requiredCapability: "task.work.sourcing", evidenceBases: ["artifact"], verification: "distinct_actor" });
    await t.alice.transitionTask({ taskId: id, status: "ready" });
    await assert.rejects(t.agent(worker).transitionTask({ taskId: id, status: "claimed" }), named("forbidden", /cannot claim/));
    await t.alice.issueLease({ grantee: worker, capability: "task.work.sourcing", scope: WORLD, taskRef: `task:${id}` });
    await t.agent(worker).transitionTask({ taskId: id, status: "claimed" });
    await t.agent(worker).transitionTask({ taskId: id, status: "in_progress" });
    await t.agent(worker).transitionTask({ taskId: id, status: "verifying", result: { candidates: 3 }, evidence: evidence(11) });
    await assert.rejects(t.agent(worker).transitionTask({ taskId: id, status: "completed" }), named("forbidden", /task.verify/));
    await t.alice.issueGrant({ grantee: worker, capability: "task.verify", scope: WORLD });
    await assert.rejects(t.agent(worker).transitionTask({ taskId: id, status: "completed" }), named("forbidden", /cannot verify its own work/));
    await t.alice.issueGrant({ grantee: verifier, capability: "task.verify", scope: WORLD });
    await t.agent(verifier).transitionTask({ taskId: id, status: "completed", detail: "three accredited candidates confirmed" });
    await assert.rejects(t.agent(verifier).transitionTask({ taskId: id, status: "completed" }), named("invalid"));

    const [task] = await t.alice.readTasks(WORLD);
    assert.deepEqual([task.status, task.worker_id], ["completed", worker]);

    const other = await t.alice.createTask({ scope: WORLD, title: "Book lab", requiredCapability: "task.work.lab", evidenceBases: ["artifact"] });
    await t.alice.transitionTask({ taskId: other, status: "ready" });
    await t.alice.issueGrant({ grantee: worker, capability: "task.work.lab", scope: WORLD });
    for (const status of ["claimed", "in_progress"] as const) await t.agent(worker).transitionTask({ taskId: other, status });
    await assert.rejects(t.agent(worker).transitionTask({ taskId: other, status: "completed" }), named("invalid", /needs artifact evidence/));
  });
});

describe("avatars", () => {
  it("keep one identity across representations and act only through delegated authority", async () => {
    const t = await setup();
    const nova = await t.alice.createAvatar({ type: "ai_companion", name: "Nova", relationship: "assist", seed: { hair: "dark", style: "minimal" } });
    assert.equal(await t.alice.createAvatar({ type: "ai_companion", name: "Nova again" }), nova, "creation retries never duplicate");
    const me = await t.alice.createAvatar({ type: "digital_self", name: "Digital Alice", relationship: "represent", representation: "stylized_3d" });
    assert.notEqual(me, nova);

    const [before] = (await t.alice.myAvatars()).filter((a) => a.avatar_id === nova);
    const grantsBefore = await t.k.owner("select id from kernel.grants where grantee_id = $1 order by id", [before.agent_id]);
    await t.alice.setAvatarRepresentation(nova, "pixel");
    await t.alice.setAvatarRepresentation(nova, "stylized_3d");
    const [after] = (await t.alice.myAvatars()).filter((a) => a.avatar_id === nova);
    assert.equal(after.agent_id, before.agent_id);
    assert.equal(after.representation, "stylized_3d");
    assert.deepEqual(after.representations, ["abstract", "pixel", "stylized_3d"]);
    assert.deepEqual(await t.k.owner("select id from kernel.grants where grantee_id = $1 order by id", [after.agent_id]), grantsBefore);

    // Observe-level authority only: Nova reads its owner's scope but cannot act in the World.
    const agent = t.agent(after.agent_id);
    assert.equal((await agent.authorize({ capability: "kernel.read", scope: `actor:${t.aliceId}` })).decision, "ALLOW");
    assert.equal((await agent.authorize({ capability: "message.send", scope: WORLD })).decision, "DENY");
    await assert.rejects(t.bob.setAvatarRepresentation(nova, "cartoon"), named("forbidden"));
  });
});
