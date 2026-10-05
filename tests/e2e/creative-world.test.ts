import assert from "node:assert/strict";
import { it } from "node:test";
import { KernelError, kernelClient } from "../../lib/kernel/client";
import { localSupabase } from "../../lib/kernel/local";
import { createCreativeArtifact, createCreativeResourceEntry, createCreativeWorld, listCreativeWorlds, loadCreativeWorld, updateCreativeArtifact, updateCreativeResourceEntry } from "../../lib/world/creative";
import { createKernelDb, user } from "../kernel/harness";

const worldId = "00000000-0000-4000-8000-000000000101";
const denied = (error: unknown) => error instanceof KernelError && error.name === "forbidden";

it("creates a private World, records artifact revisions, and grants write access explicitly", async () => {
  const db = await createKernelDb();
  const alice = kernelClient(localSupabase(db, user("auth:creative-alice")));
  const bob = kernelClient(localSupabase(db, user("auth:creative-bob")));
  const aliceId = await alice.register("Alice");
  const bobId = await bob.register("Bob");

  const world = await createCreativeWorld(alice, { worldId, title: "A new idea" });
  assert.deepEqual((await listCreativeWorlds(alice)).map((row) => row.worldId), [worldId]);
  const firstEvents = await alice.readEvents(world.scope, { limit: 20 });
  const retry = await createCreativeWorld(alice, { worldId, title: "A new idea" });
  assert.deepEqual(retry, world, "retrying the same create request returns the same World");
  assert.equal((await alice.readEvents(world.scope, { limit: 20 })).length, firstEvents.length, "retry adds no duplicate events");
  await assert.rejects(
    createCreativeWorld(bob, { worldId, title: "Try to take over" }),
    (error: unknown) => error instanceof KernelError && error.name === "conflict",
    "another person cannot claim or rename the existing World",
  );

  const artifactId = await createCreativeArtifact(alice, {
    scope: world.scope,
    worldEntityId: world.entityId,
    requestId: "artifact-create-1",
    title: "The first thing",
    body: "A blank World can begin with anything.",
    position: { x: 35, y: 40 },
  });
  const artifactEvents = await alice.readEvents(world.scope, { limit: 20 });
  assert.equal(await createCreativeArtifact(alice, {
    scope: world.scope,
    worldEntityId: world.entityId,
    requestId: "artifact-create-1",
    title: "The first thing",
    body: "A blank World can begin with anything.",
    position: { x: 35, y: 40 },
  }), artifactId, "a retried artifact form returns the same canonical document");
  assert.equal((await alice.readEvents(world.scope, { limit: 20 })).length, artifactEvents.length, "retry adds no duplicate artifact revision");

  await assert.rejects(bob.readWorld(world.scope), denied, "a different signed-in person sees nothing by default");
  await assert.rejects(
    createCreativeArtifact(bob, {
      scope: world.scope,
      worldEntityId: world.entityId,
      requestId: "bob-without-access",
      title: "Not allowed",
      body: "",
      position: { x: 10, y: 10 },
    }),
    denied,
  );

  await alice.issueGrant({ grantee: bobId, capability: "kernel.read", scope: world.scope });
  assert.deepEqual((await listCreativeWorlds(bob)).map((row) => row.worldId), [worldId], "a scoped read grant adds the World to the collaborator's list");
  assert.ok((await bob.readWorld(world.scope)).some((entity) => entity.entity_id === artifactId));
  await assert.rejects(
    updateCreativeArtifact(bob, {
      scope: world.scope,
      entityId: artifactId,
      requestId: "bob-read-only-edit",
      title: "Unauthorized edit",
      body: "",
      position: { x: 35, y: 40 },
    }),
    denied,
    "read authority does not imply write authority",
  );

  await alice.issueGrant({ grantee: bobId, capability: "world.entity.write", scope: world.scope });
  await updateCreativeArtifact(bob, {
    scope: world.scope,
    entityId: artifactId,
    requestId: "bob-edit-1",
    title: "An idea in progress",
    body: "Bob added a thought.",
    position: { x: 55, y: 48 },
  });

  const entities = await alice.readWorld(world.scope);
  const artifact = entities.find((entity) => entity.entity_id === artifactId)!;
  assert.deepEqual([artifact.kind, artifact.version, artifact.title], ["document", 2, "An idea in progress"]);
  assert.deepEqual(artifact.attributes.canvas, { x: 55, y: 48 });
  const loaded = await loadCreativeWorld(alice, worldId);
  assert.deepEqual(loaded.artifacts.map(({ title, body, position, version }) => ({ title, body, position, version })), [
    { title: "An idea in progress", body: "Bob added a thought.", position: { x: 55, y: 48 }, version: 2 },
  ]);
  const history = await alice.readEvents(world.scope, { limit: 30 });
  assert.ok(history.some((event) => event.type === "kernel.entity.created" && event.actor_id === aliceId));
  assert.ok(history.some((event) => event.type === "kernel.entity.updated" && event.actor_id === bobId));
  assert.ok(history.some((event) => event.type === "kernel.grant.issued" && event.actor_id === aliceId));
});

it("starts a private World with its goal as the first piece and retries without duplicates", async () => {
  const db = await createKernelDb();
  const alice = kernelClient(localSupabase(db, user("auth:creative-goal")));
  const goalWorldId = "00000000-0000-4000-8000-000000000102";
  await alice.register("Alice");
  const input = {
    worldId: goalWorldId,
    title: "Mom's 60th",
    goal: "Plan a 60th birthday celebration that feels personal and stays within budget.",
  };

  const world = await createCreativeWorld(alice, input);
  const first = await loadCreativeWorld(alice, goalWorldId);
  assert.deepEqual(first.artifacts.map(({ title, body, position }) => ({ title, body, position })), [
    {
      title: "Goal",
      body: input.goal,
      position: { x: 50, y: 25 },
    },
  ]);
  const firstEvents = await alice.readEvents(world.scope, { limit: 20 });

  const retried = await createCreativeWorld(alice, input);
  const afterRetry = await loadCreativeWorld(alice, goalWorldId);
  assert.deepEqual(retried, world);
  assert.equal(afterRetry.artifacts.length, 1, "the same goal request creates one first piece");
  assert.equal((await alice.readEvents(world.scope, { limit: 20 })).length, firstEvents.length, "retry adds no duplicate World or goal events");
});

it("maps project offers and needs with provenance, idempotency, privacy, and author-owned revisions", async () => {
  const db = await createKernelDb();
  const alice = kernelClient(localSupabase(db, user("auth:resource-alice")));
  const bob = kernelClient(localSupabase(db, user("auth:resource-bob")));
  const aliceId = await alice.register("Alice");
  const bobId = await bob.register("Bob");
  const resourceWorldId = "00000000-0000-4000-8000-000000000103";
  const world = await createCreativeWorld(alice, { worldId: resourceWorldId, title: "Repair the community workshop" });

  const offerInput = {
    scope: world.scope,
    worldEntityId: world.entityId,
    requestId: "resource-offer-1",
    entryType: "offer" as const,
    category: "skill" as const,
    title: "CAD modeling help",
    description: "I can review and adjust the replacement bracket model.",
    timeWindow: "Four hours on Saturday",
    sourceUrl: "https://example.com/portfolio",
  };
  const offerId = await createCreativeResourceEntry(alice, offerInput);
  const afterOffer = await alice.readEvents(world.scope, { limit: 30 });
  await assert.rejects(
    createCreativeResourceEntry(alice, {
      ...offerInput,
      requestId: "unsafe-resource-source",
      sourceUrl: "javascript:alert(1)",
    }),
    (error: unknown) => error instanceof KernelError && error.name === "invalid",
    "a source pointer cannot use a script URL",
  );
  assert.equal(await createCreativeResourceEntry(alice, offerInput), offerId, "retry returns the same offer");
  assert.equal((await alice.readEvents(world.scope, { limit: 30 })).length, afterOffer.length, "retry creates no duplicate entity or relation");

  await alice.issueGrant({ grantee: bobId, capability: "kernel.read", scope: world.scope });
  await alice.issueGrant({ grantee: bobId, capability: "world.entity.write", scope: world.scope });
  const needId = await createCreativeResourceEntry(bob, {
    scope: world.scope,
    worldEntityId: world.entityId,
    requestId: "resource-need-1",
    entryType: "need",
    category: "resource",
    title: "Replacement filament",
    description: "Need one spool of PETG, black, before Saturday.",
    timeWindow: "Needed by Saturday",
    sourceUrl: "",
  });
  const loaded = await loadCreativeWorld(alice, resourceWorldId);
  const offer = loaded.resources.find((entry) => entry.entityId === offerId);
  const need = loaded.resources.find((entry) => entry.entityId === needId);
  assert.equal(offer?.entryType, "offer");
  assert.equal(offer?.category, "skill");
  assert.equal(offer?.reportedBy, aliceId);
  assert.equal(offer?.sourceUrl, "https://example.com/portfolio");
  assert.equal(offer?.status, "open");
  assert.equal(need?.entryType, "need");
  assert.equal(need?.category, "resource");
  assert.equal(need?.reportedBy, bobId);
  assert.equal(need?.updatedBy, bobId);
  assert.equal(need?.status, "open");
  assert.equal(offer?.updatedBy, aliceId);

  // Simulate a valid direct kernel write with a forged editable reporter attribute.
  // Event authorship must remain the source of truth for attribution and edit rights.
  await alice.upsertEntity({
    entityId: needId,
    kind: "need",
    scope: world.scope,
    title: "Replacement filament",
    summary: "Need one spool of PETG, black, before Saturday.",
    attributes: {
      worldId: resourceWorldId,
      resourceType: "need",
      resourceCategory: "resource",
      description: "Need one spool of PETG, black, before Saturday.",
      timeWindow: "Needed by Saturday",
      sourceUrl: "",
      sourceStatus: "none",
      status: "open",
      basis: "self_reported",
      reportedBy: aliceId,
    },
    visibility: "members",
    idempotencyKey: "resource-forged-reporter",
  });
  const attributedNeed = (await loadCreativeWorld(alice, resourceWorldId)).resources.find((entry) => entry.entityId === needId);
  assert.equal(attributedNeed?.reportedBy, bobId, "editable entity fields cannot replace the original event author");
  assert.equal(attributedNeed?.updatedBy, aliceId, "the latest revision is attributed to its real actor");

  await assert.rejects(
    updateCreativeResourceEntry(alice, {
      scope: world.scope,
      entityId: needId,
      requestId: "alice-revise-bob-need",
      title: "Changed without Bob",
      description: "A different requirement.",
      timeWindow: "Later",
      sourceUrl: "",
      status: "withdrawn",
    }),
    denied,
    "a World owner cannot rewrite a contributor's self-reported need",
  );
  await updateCreativeResourceEntry(bob, {
    scope: world.scope,
    entityId: needId,
    requestId: "bob-withdraw-need",
    title: "Replacement filament",
    description: "No longer needed; a local shop supplied it.",
    timeWindow: "Resolved by the contributor",
    sourceUrl: "",
    status: "withdrawn",
  });
  const revised = (await loadCreativeWorld(alice, resourceWorldId)).resources.find((entry) => entry.entityId === needId);
  assert.equal(revised?.status, "withdrawn");
  assert.equal(revised?.reportedBy, bobId, "revision preserves the original reporter");
  assert.ok((await alice.readEvents(world.scope, { limit: 50 })).some((event) => event.type === "kernel.entity.updated" && event.actor_id === bobId));
  const stranger = kernelClient(localSupabase(db, user("auth:resource-stranger")));
  await stranger.register("Stranger");
  await assert.rejects(
    loadCreativeWorld(stranger, resourceWorldId),
    denied,
    "an unrelated person cannot read the resource map",
  );
});
