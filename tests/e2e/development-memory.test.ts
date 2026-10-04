import assert from "node:assert/strict";
import { it } from "node:test";
import { KernelError, kernelClient } from "../../lib/kernel/client";
import { localSupabase } from "../../lib/kernel/local";
import { createIdea, readIdeaGraph, relateIdeas, updateIdeaStatus } from "../../lib/world/ideas";
import { createCreativeWorld } from "../../lib/world/creative";
import { createKernelDb, user } from "../kernel/harness";

const worldId = "00000000-0000-4000-8000-000000000201";

it("stores ideas, typed lineage and status history through the governed World kernel", async () => {
  const db = await createKernelDb();
  const alice = kernelClient(localSupabase(db, user("auth:ideas-alice")));
  const bob = kernelClient(localSupabase(db, user("auth:ideas-bob")));
  const aliceId = await alice.register("Alice");
  await bob.register("Bob");
  const world = await createCreativeWorld(alice, { worldId, title: "Development memory" });

  const root = await createIdea(alice, {
    scope: world.scope,
    requestId: "root-1",
    title: "Give people the paintbrush",
    description: "Creation should start from the person's intent.",
    assumptions: ["People need an open canvas"],
    openQuestions: ["How do agents extend an idea safely?"],
  });
  assert.equal(await createIdea(alice, {
    scope: world.scope,
    requestId: "root-1",
    title: "Give people the paintbrush",
    description: "Creation should start from the person's intent.",
    assumptions: ["People need an open canvas"],
    openQuestions: ["How do agents extend an idea safely?"],
  }), root, "the same request replays to one canonical idea");

  const child = await createIdea(alice, {
    scope: world.scope,
    requestId: "child-1",
    title: "Continue prior ideation",
    description: "Store explicit idea lineage in the World graph.",
  });
  const edgeId = await relateIdeas(alice, {
    scope: world.scope,
    fromId: child,
    toId: root,
    kind: "idea_derived_from",
    requestId: "edge-1",
  });
  assert.equal(await relateIdeas(alice, {
    scope: world.scope,
    fromId: child,
    toId: root,
    kind: "idea_derived_from",
    requestId: "edge-2",
  }), edgeId, "a duplicate semantic edge reuses its canonical relation");

  await assert.rejects(
    relateIdeas(alice, { scope: world.scope, fromId: root, toId: child, kind: "idea_derived_from", requestId: "cycle-1" }),
    (error: unknown) => error instanceof KernelError && error.name === "invalid",
    "derived-from lineage cannot form cycles",
  );

  await updateIdeaStatus(alice, { scope: world.scope, ideaId: child, status: "explored", requestId: "status-1" });
  const afterExplore = await alice.readEvents(world.scope, { limit: 50 });
  await updateIdeaStatus(alice, { scope: world.scope, ideaId: child, status: "explored", requestId: "status-1" });
  assert.equal((await alice.readEvents(world.scope, { limit: 50 })).length, afterExplore.length, "retrying a status write creates no duplicate event");
  await updateIdeaStatus(alice, { scope: world.scope, ideaId: child, status: "proposed", requestId: "status-2" });
  await assert.rejects(
    updateIdeaStatus(alice, { scope: world.scope, ideaId: child, status: "rejected", requestId: "status-3" }),
    (error: unknown) => error instanceof KernelError && error.name === "invalid",
    "a rejected idea must keep its reason",
  );
  await updateIdeaStatus(alice, {
    scope: world.scope,
    ideaId: child,
    status: "rejected",
    requestId: "status-4",
    reason: "Staging collaboration is not verified yet.",
  });

  const graph = await readIdeaGraph(alice, world.scope);
  assert.equal(graph.ideas.length, 2);
  assert.equal(graph.ideas.find((idea) => idea.id === child)?.status, "rejected");
  assert.equal(graph.links.length, 1);
  assert.equal(graph.links[0].id, edgeId);
  const [supportA, supportB] = await Promise.all([
    relateIdeas(alice, { scope: world.scope, fromId: root, toId: child, kind: "idea_supports", requestId: "support-a" }),
    relateIdeas(alice, { scope: world.scope, fromId: root, toId: child, kind: "idea_supports", requestId: "support-b" }),
  ]);
  assert.equal(supportA, supportB, "concurrent duplicate semantic edges converge on one canonical relation");
  const history = await alice.readEvents(world.scope, { limit: 50 });
  assert.ok(history.some((event) => event.type === "kernel.entity.created" && event.actor_id === aliceId));
  assert.ok(history.filter((event) => event.type === "kernel.entity.updated").length >= 2, "status changes are versioned kernel events");

  const expansion = await createIdea(alice, {
    scope: world.scope,
    requestId: "accepted-expansion",
    title: "Keep source lineage",
    description: "An accepted model draft becomes a proposed idea.",
    origin: { kind: "assistant_expansion", model: "test-model", parentIdeaId: root },
  });
  const afterExpansion = await readIdeaGraph(alice, world.scope);
  assert.equal(afterExpansion.ideas.find((idea) => idea.id === expansion)?.status, "proposed");
  assert.deepEqual(afterExpansion.ideas.find((idea) => idea.id === expansion)?.origin, {
    kind: "assistant_expansion",
    model: "test-model",
    parentIdeaId: root,
  });
  assert.ok(afterExpansion.links.some((link) => link.kind === "idea_derived_from" && link.fromId === expansion && link.toId === root));

  await assert.rejects(readIdeaGraph(bob, world.scope), (error: unknown) => error instanceof KernelError && error.name === "forbidden");
});

it("rejects malformed idea inputs before writing", async () => {
  const db = await createKernelDb();
  const alice = kernelClient(localSupabase(db, user("auth:ideas-invalid")));
  await alice.register("Alice");
  const world = await createCreativeWorld(alice, { worldId, title: "Validation" });
  await assert.rejects(
    createIdea(alice, { scope: world.scope, requestId: "bad-title", title: "  ", description: "" }),
    (error: unknown) => error instanceof KernelError && error.name === "invalid",
  );
  await assert.rejects(readIdeaGraph(alice, "world:not-a-uuid"), (error: unknown) => error instanceof KernelError && error.name === "invalid");
});
