import assert from "node:assert/strict";
import { it } from "node:test";
import { kernelClient, KernelError } from "../../lib/kernel/client";
import { localSupabase } from "../../lib/kernel/local";
import { createCreativeArtifact, createCreativeWorld, loadCreativeWorld, updateCreativeArtifact } from "../../lib/world/creative";
import { heartbeat, readPresence } from "../../lib/world/presence";
import { createKernelDb, user } from "../kernel/harness";

it("rejects stale document edits atomically while completed retries remain idempotent", async () => {
  const db = await createKernelDb();
  const k = kernelClient(localSupabase(db, user("auth:revisions")));
  await k.register("Ana");
  const world = await createCreativeWorld(k, { worldId: "00000000-0000-4000-8000-000000000921", title: "Ideas" });
  const entityId = await createCreativeArtifact(k, { scope: world.scope, worldEntityId: world.entityId, requestId: "create", title: "Spec", body: "Original", position: { x: 50, y: 50 } });
  const update = { scope: world.scope, entityId, requestId: "first", title: "Spec", body: "Saved revision", expectedVersion: 1, position: { x: 50, y: 50 } };
  await updateCreativeArtifact(k, update);
  await updateCreativeArtifact(k, update);
  await assert.rejects(updateCreativeArtifact(k, { ...update, requestId: "stale", body: "Unsaved other revision" }),
    (e: unknown) => e instanceof KernelError && e.name === "conflict");
  const artifact = (await loadCreativeWorld(k, world.worldId)).artifacts.find(a => a.entityId === entityId)!;
  assert.equal(artifact.body, "Saved revision");
  assert.equal(artifact.version, 2);
});

it("finds current presence even after more than 200 unrelated World events", async () => {
  const db = await createKernelDb();
  const k = kernelClient(localSupabase(db, user("auth:long-presence")));
  await k.register("Present person");
  const world = await createCreativeWorld(k, { worldId: "00000000-0000-4000-8000-000000000922", title: "Busy room" });
  for (let i = 0; i < 205; i++) await k.recordEvent({ type: "world.note.added", scope: world.scope, payload: { before: i } });
  await heartbeat(k, world.scope);
  for (let i = 0; i < 205; i++) await k.recordEvent({ type: "world.note.added", scope: world.scope, payload: { i } });
  assert.equal((await readPresence(k, world.scope))[0]?.label, "Present person");
});
