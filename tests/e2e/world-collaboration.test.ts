import assert from "node:assert/strict";
import { it } from "node:test";
import { KernelError, kernelClient } from "../../lib/kernel/client";
import { localSupabase } from "../../lib/kernel/local";
import { createCreativeArtifact, createCreativeWorld, loadCreativeWorld } from "../../lib/world/creative";
import { grantWorldAccess, listWorldCollaborators, revokeWorldAccess } from "../../lib/world/collaboration";
import { createKernelDb, user } from "../kernel/harness";

const editorWorldId = "00000000-0000-4000-8000-000000000301";
const viewerWorldId = "00000000-0000-4000-8000-000000000302";

it("grants a scoped editor access, records the role, and revokes both read and write", async () => {
  const db = await createKernelDb();
  const owner = kernelClient(localSupabase(db, user("auth:share-owner")));
  const brother = kernelClient(localSupabase(db, user("auth:share-brother")));
  await owner.register("Owner");
  const brotherId = await brother.register("Brother");
  const world = await createCreativeWorld(owner, { worldId: editorWorldId, title: "Shared project" });
  const botId = await owner.createAgent("Owned bot", "share-owner-bot");
  await assert.rejects(
    grantWorldAccess(owner, { scope: world.scope, granteeActorId: botId, role: "editor", requestId: "grant-bot-1" }),
    (error: unknown) => error instanceof KernelError && error.name === "invalid",
    "human collaboration grants cannot target an agent ID",
  );

  await assert.rejects(
    brother.readWorld(world.scope),
    (error: unknown) => error instanceof KernelError && error.name === "forbidden",
  );
  const access = await grantWorldAccess(owner, {
    scope: world.scope,
    granteeActorId: brotherId,
    role: "editor",
    requestId: "grant-editor-1",
  });
  assert.equal(access.role, "editor");
  assert.deepEqual(new Set(access.capabilities), new Set(["kernel.read", "world.entity.write"]));
  assert.equal((await listWorldCollaborators(owner, world.scope)).length, 1);

  const artifactId = await createCreativeArtifact(brother, {
    scope: world.scope,
    worldEntityId: world.entityId,
    requestId: "brother-artifact-1",
    title: "Brother's contribution",
    body: "A separate person can add to this World.",
    position: { x: 45, y: 40 },
  });
  assert.ok((await loadCreativeWorld(owner, editorWorldId)).artifacts.some((artifact) => artifact.entityId === artifactId));

  await revokeWorldAccess(owner, { scope: world.scope, granteeActorId: brotherId, requestId: "remove-editor-1" });
  assert.deepEqual(await listWorldCollaborators(owner, world.scope), []);
  await assert.rejects(
    brother.readWorld(world.scope),
    (error: unknown) => error instanceof KernelError && error.name === "forbidden",
  );
  await assert.rejects(
    createCreativeArtifact(brother, {
      scope: world.scope,
      worldEntityId: world.entityId,
      requestId: "brother-artifact-2",
      title: "After revocation",
      body: "",
      position: { x: 55, y: 40 },
    }),
    (error: unknown) => error instanceof KernelError && error.name === "forbidden",
  );
});

it("keeps viewer access read-only and prevents a collaborator from delegating it", async () => {
  const db = await createKernelDb();
  const owner = kernelClient(localSupabase(db, user("auth:viewer-owner")));
  const brother = kernelClient(localSupabase(db, user("auth:viewer-brother")));
  await owner.register("Owner");
  const brotherId = await brother.register("Brother");
  const world = await createCreativeWorld(owner, { worldId: viewerWorldId, title: "Read-only project" });

  const first = await grantWorldAccess(owner, { scope: world.scope, granteeActorId: brotherId, role: "viewer", requestId: "grant-viewer-1" });
  const replay = await grantWorldAccess(owner, { scope: world.scope, granteeActorId: brotherId, role: "viewer", requestId: "grant-viewer-2" });
  assert.equal(first.grantIds[0], replay.grantIds[0], "repeated same-role grants reuse existing access");
  assert.ok((await brother.readWorld(world.scope)).some((entity) => entity.entity_id === world.entityId));

  await assert.rejects(
    createCreativeArtifact(brother, {
      scope: world.scope,
      worldEntityId: world.entityId,
      requestId: "viewer-artifact-1",
      title: "Not allowed",
      body: "",
      position: { x: 50, y: 50 },
    }),
    (error: unknown) => error instanceof KernelError && error.name === "forbidden",
  );
  await assert.rejects(
    grantWorldAccess(brother, { scope: world.scope, granteeActorId: brotherId, role: "editor", requestId: "delegate-1" }),
    (error: unknown) => error instanceof KernelError && error.name === "forbidden",
  );
  await revokeWorldAccess(owner, { scope: world.scope, granteeActorId: brotherId, requestId: "remove-viewer-1" });
  assert.deepEqual(await listWorldCollaborators(owner, world.scope), []);
});
