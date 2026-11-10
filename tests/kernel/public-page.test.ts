// A thing's public page: anyone may read it, with no identity, only while its owner has published
// it — and it shows only what the owner made. Never a friend's contribution, never a private piece.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { it } from "node:test";
import { kernelClient } from "../../lib/kernel/client";
import { localSupabase } from "../../lib/kernel/local";
import { setPublished } from "../../lib/product/page";
import { createCreativeArtifact, createCreativeWorld } from "../../lib/world/creative";
import { acceptWorldInvitation, createWorldInvitation } from "../../lib/world/invitations";
import { anon, createKernelDb, sqlstate, user } from "./harness";

type Page = { title: string; summary: string; by: string; look: Record<string, unknown>; pieces: Array<{ kind: string; text: string; file: string | null }> };

async function setup() {
  const db = await createKernelDb();
  const owner = kernelClient(localSupabase(db, user("auth:page-owner")));
  const friend = kernelClient(localSupabase(db, user("auth:page-friend")));
  await owner.register("Ana"); await friend.register("Dana");
  await owner.setPersonLabel("Ana Reyes", "label-ana");
  const ownerId = (await owner.whoami()).actor_id;
  const friendId = (await friend.whoami()).actor_id;
  const world = await createCreativeWorld(owner, { worldId: randomUUID(), title: "My garden", goal: "What I grew this year" });
  const { token } = await createWorldInvitation(owner, world.worldId, "editor", "inv");
  await acceptWorldInvitation(friend, token);

  const text = (k: typeof owner, body: string) => createCreativeArtifact(k, { scope: world.scope, worldEntityId: world.entityId, requestId: randomUUID(), title: body, body, position: { x: 0, y: 0 } });
  const photo = (k: typeof owner, caption: string, visibility: "members" | "private" = "members") => {
    const name = `${world.worldId}/${randomUUID()}.jpg`;
    return k.upsertEntity({ kind: "document", scope: world.scope, title: "Photo", summary: caption,
      attributes: { documentType: "photo", worldId: world.worldId, caption, file: { bucket: "things", name, type: "image/jpeg", bytes: 1, sha256: "0".repeat(64) } },
      visibility, idempotencyKey: `p:${name}` }).then(id => ({ id, name }));
  };
  const ownersText = await text(owner, "Tomatoes came in early");
  await text(friend, "Dana's private note on Ana's garden");
  const ownersPhoto = await photo(owner, "The tomato bed");
  const friendsPhoto = await photo(friend, "Dana's selfie");
  const privatePhoto = await photo(owner, "Not for the page", "private");
  const read = () => db.rpc(anon, "read_page", { p_world_id: world.worldId }).then(rows => rows[0].read_page as Page);
  const isPublic = (name: string) => db.rpc(anon, "file_public", { p_name: name }).then(rows => rows[0].file_public as boolean);
  return { db, owner, friend, ownerId, friendId, world, ownersText, ownersPhoto, friendsPhoto, privatePhoto, read, isPublic };
}

it("an unpublished thing has no page, and none of its photos are public", async () => {
  const { read, isPublic, ownersPhoto } = await setup();
  await assert.rejects(read(), sqlstate("KA007"));
  assert.equal(await isPublic(ownersPhoto.name), false);
});

it("once the owner publishes, anyone with no account sees exactly what the owner made", async () => {
  const s = await setup();
  await setPublished(s.owner, s.ownerId, s.world.worldId, true, "publish");
  const page = await s.read();
  assert.equal(page.title, "My garden");
  assert.equal(page.by, "Ana Reyes");
  const texts = page.pieces.map(p => p.text);
  assert.ok(texts.includes("Tomatoes came in early"));
  assert.ok(texts.includes("The tomato bed"));
  assert.ok(!texts.some(t => t.includes("Dana")), "a friend's contributions are never published by the owner");
  assert.ok(!texts.includes("Not for the page"), "a private piece is never shown");
  assert.equal(await s.isPublic(s.ownersPhoto.name), true);
  assert.equal(await s.isPublic(s.friendsPhoto.name), false, "the friend's photo stays private");
  assert.equal(await s.isPublic(s.privatePhoto.name), false);
  assert.equal(await s.isPublic(`${s.world.worldId}/${randomUUID()}.jpg`), false, "a guessed name is not public");
  const json = JSON.stringify(page);
  for (const id of [s.ownerId, s.friendId]) assert.ok(!json.includes(id), "no one's identifier is on the page");
});

it("someone invited to build cannot publish the owner's thing, nor slip their edits onto the page", async () => {
  const s = await setup();
  await setPublished(s.friend, s.friendId, s.world.worldId, true, "friend-publish");
  await assert.rejects(s.read(), sqlstate("KA007"), "a friend's own publication record means nothing");
  await assert.rejects(s.friend.upsertEntity({ kind: "resource", scope: `actor:${s.ownerId}`, title: "Public page",
    attributes: { sov: "solve.page", worldId: s.world.worldId, published: true }, visibility: "private", idempotencyKey: "forge" }));
  await setPublished(s.owner, s.ownerId, s.world.worldId, true, "publish");
  // The friend rewrites the owner's piece. It is no longer purely the owner's, so it leaves the page.
  await s.friend.upsertEntity({ entityId: s.ownersText, kind: "document", scope: s.world.scope, title: "Tomatoes came in early",
    attributes: { documentType: "text", worldId: s.world.worldId, content: "Dana was here", canvas: { x: 0, y: 0 } }, visibility: "members", idempotencyKey: "rewrite" });
  const texts = (await s.read()).pieces.map(p => p.text);
  assert.ok(!texts.includes("Dana was here") && !texts.includes("Tomatoes came in early"));
});

it("withdrawing the page takes it, and its photos, offline again", async () => {
  const s = await setup();
  await setPublished(s.owner, s.ownerId, s.world.worldId, true, "publish");
  await setPublished(s.owner, s.ownerId, s.world.worldId, false, "withdraw");
  await assert.rejects(s.read(), sqlstate("KA007"));
  assert.equal(await s.isPublic(s.ownersPhoto.name), false);
});
