import assert from "node:assert/strict";
import { it } from "node:test";
import { kernelClient, KernelError, type Kernel } from "../../lib/kernel/client";
import { localSupabase } from "../../lib/kernel/local";
import { createCreativeWorld, createCreativeArtifact, loadCreativeWorld } from "../../lib/world/creative";
import { grantWorldAccess } from "../../lib/world/collaboration";
import { createKernelDb, user } from "../kernel/harness";
import { parseProjectBackup, exportProjectBackup, restoreProjectBackup } from "../../lib/world/backup";

const fixture = () => ({ format: "solve-project-backup", version: 1, project: { title: "My project", goal: "Build a useful thing" }, documents: [{ title: "Notes", body: "A first step", visibility: "private" }] });
const requestId = "00000000-0000-4000-8000-000000000a11";
async function setup() {
  const db = await createKernelDb();
  const owner = kernelClient(localSupabase(db, user("auth:backup-owner")));
  const other = kernelClient(localSupabase(db, user("auth:backup-other")));
  const actorId = await owner.register("Owner");
  const otherId = await other.register("Other");
  return { db, owner, other, actorId, otherId };
}

it("accepts bounded content and rejects authority, credential and malformed fields", () => {
  assert.equal(parseProjectBackup(JSON.stringify(fixture())).documents[0].visibility, "private");
  for (const bad of [
    { ...fixture(), grants: [{ capability: "*" }] },
    { ...fixture(), project: { ...fixture().project, goal: "x".repeat(2001) } },
    { ...fixture(), credentials: "secret" },
    { ...fixture(), project: { ...fixture().project, ownerId: "someone" } },
    { ...fixture(), documents: [{ ...fixture().documents[0], actor_id: "forged" }] },
    { ...fixture(), documents: [{ ...fixture().documents[0], body: "x".repeat(7201) }] },
    { ...fixture(), documents: [{ ...fixture().documents[0], visibility: "public" }] },
    { ...fixture(), documents: Array.from({ length: 51 }, () => fixture().documents[0]) },
    { ...fixture(), documents: [{ ...fixture().documents[0], body: "bad\u0000text" }] },
  ]) assert.throws(() => parseProjectBackup(JSON.stringify(bad)), KernelError);
  assert.throws(() => parseProjectBackup(" ".repeat(1_000_001)), KernelError);
});

it("exports only the caller's authorized text content and no authority or Auth state", async () => {
  const { owner, other, otherId } = await setup();
  const world = await createCreativeWorld(owner, { worldId: "00000000-0000-4000-8000-000000000a12", title: "Original", goal: "Shared goal" });
  await createCreativeArtifact(owner, { scope: world.scope, worldEntityId: world.entityId, requestId: "public-notes", title: "Shared", body: "SHARED_TEXT", position: { x: 20, y: 20 } });
  await owner.upsertEntity({ scope: world.scope, kind: "document", title: "Private", attributes: { documentType: "text", worldId: world.worldId, content: "PRIVATE_TEXT", canvas: { x: 1, y: 1 } }, visibility: "private", idempotencyKey: "backup-private" });
  await assert.rejects(exportProjectBackup(other, world.worldId));
  await grantWorldAccess(owner, { scope: world.scope, granteeActorId: otherId, role: "viewer", requestId: "backup-view" });
  const shared = JSON.stringify(await exportProjectBackup(other, world.worldId));
  assert.match(shared, /SHARED_TEXT/);
  assert.doesNotMatch(shared, /PRIVATE_TEXT|actor_id|grants|auth:|entity_id|scope/);
  assert.ok((await exportProjectBackup(owner, world.worldId)).documents.some(doc => doc.body === "PRIVATE_TEXT" && doc.visibility === "private"));
});

it("restores one owned copy across a partial failure, keeps private flags and rejects changed or cross-account retries", async () => {
  const { owner, other, actorId, otherId } = await setup();
  const backup = parseProjectBackup(JSON.stringify(fixture()));
  let fail = true;
  const flaky = { ...owner, upsertEntity: async (input: Parameters<Kernel["upsertEntity"]>[0]) => {
    if (input.kind === "document" && input.attributes?.documentType === "text" && fail) { fail = false; throw new Error("interrupted"); }
    return owner.upsertEntity(input);
  } };
  await assert.rejects(restoreProjectBackup(flaky, { backup, requestId, expectedActorId: actorId }));
  const world = await restoreProjectBackup(owner, { backup, requestId, expectedActorId: actorId });
  await restoreProjectBackup(owner, { backup, requestId, expectedActorId: actorId });
  const loaded = await loadCreativeWorld(owner, world.worldId);
  assert.equal(loaded.artifacts.length, 1);
  assert.equal(loaded.artifacts[0].visibility, "private");
  assert.match(loaded.artifacts[0].title, /reference/i);
  assert.match(loaded.artifacts[0].body, /Imported reference.*unverified/);
  assert.ok(loaded.artifacts[0].body.endsWith("A first step"));
  await assert.rejects(restoreProjectBackup(owner, { backup: { ...backup, project: { ...backup.project, goal: "Changed" } }, requestId, expectedActorId: actorId }));
  await assert.rejects(restoreProjectBackup(other, { backup, requestId, expectedActorId: otherId }));
  await assert.rejects(restoreProjectBackup(other, { backup, requestId: "00000000-0000-4000-8000-000000000a13", expectedActorId: actorId }), /account|identity/i);
  assert.equal((await other.myGrants()).some(g => g.scope === "world:00000000-0000-4000-8000-000000000a13"), false);
});

it("refuses to append an import to an existing normal project even for its owner", async () => {
  const { owner, actorId } = await setup();
  await createCreativeWorld(owner, { worldId: requestId, title: "Existing" });
  await assert.rejects(restoreProjectBackup(owner, { backup: parseProjectBackup(JSON.stringify(fixture())), requestId, expectedActorId: actorId }));
  assert.equal((await loadCreativeWorld(owner, requestId)).artifacts.length, 0);
});
