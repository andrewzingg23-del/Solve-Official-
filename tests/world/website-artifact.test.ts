import test from "node:test";
import assert from "node:assert/strict";
import { kernelClient, KernelError } from "../../lib/kernel/client";
import { localSupabase } from "../../lib/kernel/local";
import { createKernelDb, user } from "../kernel/harness";
import { createCreativeWorld, createCreativeArtifact, updateCreativeArtifact, loadCreativeWorld } from "../../lib/world/creative";

// A generated website draft is a full HTML page — larger than the 7000-char note limit. The
// "website" document type must accept it, round-trip through loadCreativeWorld, and revise.
test("website-draft documents accept a large HTML body, list, and revise; notes keep the 7000 cap", async () => {
  const db = await createKernelDb();
  const alice = kernelClient(localSupabase(db, user("auth:web-alice")));
  await alice.register("Alice");
  const world = await createCreativeWorld(alice, { worldId: "00000000-0000-4000-8000-0000000009e1", title: "Reef Cafe" });

  const bigHtml = `<!DOCTYPE html><html><head><title>Reef Cafe</title></head><body><h1>Reef Cafe</h1><p>${"Fresh coffee by the sea. ".repeat(340)}</p></body></html>`;
  assert.ok(bigHtml.length > 7000 && bigHtml.length < 12000, "fixture is a realistic over-7000, kernel-safe page");

  // A plain note still rejects an over-7000 body.
  await assert.rejects(
    createCreativeArtifact(alice, { scope: world.scope, worldEntityId: world.entityId, requestId: "note-too-big", title: "Note", body: bigHtml, position: { x: 10, y: 10 } }),
    (e) => e instanceof KernelError && e.name === "invalid",
    "a text note over 7000 chars is rejected",
  );

  // A website document accepts it.
  const createInput = {
    scope: world.scope, worldEntityId: world.entityId, requestId: "draft-1",
    title: "Reef Cafe — first draft", body: bigHtml, position: { x: 50, y: 30 },
    via: { clientId: null, clientName: "SOLVE" }, documentType: "website" as const,
  };
  const id = await createCreativeArtifact(alice, createInput);
  assert.equal(await createCreativeArtifact(alice, createInput), id, "idempotent per requestId");

  const loaded = await loadCreativeWorld(alice, world.worldId);
  const draft = loaded.artifacts.find((a) => a.entityId === id);
  assert.ok(draft, "website draft is returned by loadCreativeWorld");
  assert.equal(draft!.body, bigHtml, "full HTML round-trips");

  // Revising (refine → new version) keeps the larger cap.
  const revised = bigHtml.replace("Reef Cafe</h1>", "Reef Cafe — now open</h1>");
  await updateCreativeArtifact(alice, { scope: world.scope, entityId: id, requestId: "draft-edit", expectedVersion: 1, title: "Reef Cafe — first draft", body: revised, position: { x: 50, y: 30 } });
  const after = await loadCreativeWorld(alice, world.worldId);
  const draft2 = after.artifacts.find((a) => a.entityId === id)!;
  assert.equal(draft2.version, 2, "refine creates a new version");
  assert.match(draft2.body, /now open/, "revision saved");
});
