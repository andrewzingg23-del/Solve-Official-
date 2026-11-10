// Files that belong to a thing are reached only with the thing's own authority. Storage asks
// kernel_api.file_allowed; these tests ask it the same questions as each kind of person.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { it } from "node:test";
import { kernelClient } from "../../lib/kernel/client";
import { localSupabase } from "../../lib/kernel/local";
import { createCreativeWorld } from "../../lib/world/creative";
import { revokeWorldAccess } from "../../lib/world/collaboration";
import { acceptWorldInvitation, createWorldInvitation } from "../../lib/world/invitations";
import { createKernelDb, user } from "./harness";

type Db = Awaited<ReturnType<typeof createKernelDb>>;

async function allowed(db: Db, sub: string, name: string, capability: string): Promise<boolean> {
  const sb = localSupabase(db, user(sub)) as unknown as {
    schema: (s: string) => { rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };
  };
  const { data, error } = await sb.schema("kernel_api").rpc("file_allowed", { p_name: name, p_capability: capability });
  if (error) throw new Error(error.message);
  return data === true;
}

async function setup() {
  const db = await createKernelDb();
  const owner = kernelClient(localSupabase(db, user("auth:files-owner")));
  const editor = kernelClient(localSupabase(db, user("auth:files-editor")));
  const viewer = kernelClient(localSupabase(db, user("auth:files-viewer")));
  const stranger = kernelClient(localSupabase(db, user("auth:files-stranger")));
  for (const k of [owner, editor, viewer, stranger]) await k.register();
  const world = await createCreativeWorld(owner, { worldId: randomUUID(), title: "Backyard build" });
  const asEditor = await createWorldInvitation(owner, world.worldId, "editor", "inv-editor");
  const asViewer = await createWorldInvitation(owner, world.worldId, "viewer", "inv-viewer");
  await acceptWorldInvitation(editor, asEditor.token);
  await acceptWorldInvitation(viewer, asViewer.token);
  const photo = `${world.worldId}/${randomUUID()}.jpg`;
  return { db, owner, editor, world, photo };
}

it("the owner and anyone invited to build can add and see a thing's photos", async () => {
  const { db, photo } = await setup();
  assert.equal(await allowed(db, "auth:files-owner", photo, "world.entity.write"), true);
  assert.equal(await allowed(db, "auth:files-owner", photo, "kernel.read"), true);
  assert.equal(await allowed(db, "auth:files-editor", photo, "world.entity.write"), true);
  assert.equal(await allowed(db, "auth:files-editor", photo, "kernel.read"), true);
});

it("someone invited only to look can see the photos but not add one", async () => {
  const { db, photo } = await setup();
  assert.equal(await allowed(db, "auth:files-viewer", photo, "kernel.read"), true);
  assert.equal(await allowed(db, "auth:files-viewer", photo, "world.entity.write"), false);
});

it("a stranger can neither see nor add, and someone with no identity gets nothing", async () => {
  const { db, photo } = await setup();
  assert.equal(await allowed(db, "auth:files-stranger", photo, "kernel.read"), false);
  assert.equal(await allowed(db, "auth:files-stranger", photo, "world.entity.write"), false);
  assert.equal(await allowed(db, "auth:files-unregistered", photo, "kernel.read"), false);
});

it("removing someone takes their access to the photos with it", async () => {
  const { db, owner, editor, world, photo } = await setup();
  const editorId = (await editor.whoami()).actor_id;
  await revokeWorldAccess(owner, { scope: world.scope, granteeActorId: editorId, requestId: "remove-editor" });
  assert.equal(await allowed(db, "auth:files-editor", photo, "kernel.read"), false);
  assert.equal(await allowed(db, "auth:files-editor", photo, "world.entity.write"), false);
});

it("anything but a well-formed name inside one thing, and any other capability, is refused", async () => {
  const { db, world } = await setup();
  const file = randomUUID();
  for (const name of [
    `${world.worldId}/${file}.svg`, `${world.worldId}/${file}.jpg.html`, `${world.worldId}/../${file}.jpg`,
    `${world.worldId}/sub/${file}.jpg`, `${file}.jpg`, `world:${world.worldId}/${file}.jpg`, "", `${world.worldId.toUpperCase()}/${file}.jpg`,
  ]) {
    assert.equal(await allowed(db, "auth:files-owner", name, "kernel.read"), false, name || "(empty)");
  }
  assert.equal(await allowed(db, "auth:files-owner", `${world.worldId}/${file}.jpg`, "*"), false, "no wildcard");
  assert.equal(await allowed(db, "auth:files-owner", `${world.worldId}/${file}.jpg`, "kernel.grant"), false);
});
