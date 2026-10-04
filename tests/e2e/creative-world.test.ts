import assert from "node:assert/strict";
import { it } from "node:test";
import { KernelError, kernelClient } from "../../lib/kernel/client";
import { localSupabase } from "../../lib/kernel/local";
import { createCreativeArtifact, createCreativeWorld, listCreativeWorlds, loadCreativeWorld, updateCreativeArtifact } from "../../lib/world/creative";
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
