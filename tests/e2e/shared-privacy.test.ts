import assert from "node:assert/strict";
import { it } from "node:test";
import { kernelClient } from "../../lib/kernel/client";
import { localSupabase } from "../../lib/kernel/local";
import { createCreativeWorld, updateCreativeArtifact } from "../../lib/world/creative";
import { grantWorldAccess } from "../../lib/world/collaboration";
import { createKernelDb, user } from "../kernel/harness";

it("editing a private text document preserves its visibility and denies a direct editor RPC without private-read access", async () => {
  const db = await createKernelDb();
  const owner = kernelClient(localSupabase(db, user("auth:private-edit-owner")));
  const ben = kernelClient(localSupabase(db, user("auth:private-edit-ben")));
  await owner.register("Ana");
  const benId = await ben.register("Ben");
  const world = await createCreativeWorld(owner, { worldId: "00000000-0000-4000-8000-000000000962", title: "Shared" });
  await grantWorldAccess(owner, { scope: world.scope, granteeActorId: benId, role: "editor", requestId: "ben" });
  const attributes = { worldId: world.worldId, documentType: "text", content: "Private", canvas: { x: 40, y: 50 } };
  const entityId = await owner.upsertEntity({ scope: world.scope, kind: "document", title: "Personal note", attributes, visibility: "private", idempotencyKey: "private-note" });
  await updateCreativeArtifact(owner, { scope: world.scope, entityId, expectedVersion: 1, requestId: "private-edit", title: "Personal note", body: "Still private", position: { x: 40, y: 50 } });
  assert.equal((await owner.readWorld(world.scope)).find(e => e.entity_id === entityId)?.visibility, "private");
  assert.ok(!(await ben.readWorld(world.scope)).some(e => e.entity_id === entityId));
  await assert.rejects(ben.updateDocument({ scope: world.scope, entityId, expectedVersion: 2, title: "Private", summary: "", attributes, idempotencyKey: "blind-update" }));
});
