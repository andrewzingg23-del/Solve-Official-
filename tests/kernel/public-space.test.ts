// A person's public Space: anyone may read it with no identity, only while its owner shares it, and
// it shows only their name, their card look and pages they already published — nothing more.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { it } from "node:test";
import { kernelClient } from "../../lib/kernel/client";
import { localSupabase } from "../../lib/kernel/local";
import { setPublished, setSpaceShared } from "../../lib/product/page";
import { createCreativeWorld } from "../../lib/world/creative";
import { anon, createKernelDb, sqlstate, user } from "./harness";

type Space = { by: string; look: Record<string, unknown>; pages: Array<{ id: string; title: string; cover: string | null }> };

async function setup() {
  const db = await createKernelDb();
  const ana = kernelClient(localSupabase(db, user("auth:space-ana")));
  const eli = kernelClient(localSupabase(db, user("auth:space-eli")));
  await ana.register("Ana"); await eli.register("Eli");
  await ana.setPersonLabel("Ana Reyes", randomUUID());
  const anaId = (await ana.whoami()).actor_id;
  const eliId = (await eli.whoami()).actor_id;
  await ana.upsertEntity({ kind: "resource", scope: `actor:${anaId}`, title: "Card look", visibility: "private", idempotencyKey: "look",
    attributes: { sov: "solve.look", look: { expression: "personal", seed: "#2563eb", tone: "dark", finish: "metal" } } });
  const shown = await createCreativeWorld(ana, { worldId: randomUUID(), title: "Portfolio" });
  const hidden = await createCreativeWorld(ana, { worldId: randomUUID(), title: "Private journal" });
  const name = `${shown.worldId}/${randomUUID()}.jpg`;
  const photo = await ana.upsertEntity({ kind: "document", scope: shown.scope, title: "Photo", summary: "",
    attributes: { documentType: "photo", worldId: shown.worldId, caption: "Lake", file: { bucket: "things", name, type: "image/jpeg", bytes: 1, sha256: "0".repeat(64) } },
    visibility: "members", idempotencyKey: "photo" });
  await setPublished(ana, anaId, shown.worldId, true, "pub-shown", [photo]);
  const read = (actor: string) => db.rpc(anon, "read_space", { p_actor_id: actor }).then(r => r[0].read_space as Space);
  const page = (world: string) => db.rpc(anon, "read_page", { p_world_id: world }).then(r => r[0].read_page as { space: string | null });
  return { db, ana, eli, anaId, eliId, shown, hidden, name, read, page };
}

it("an unshared Space doesn't exist for anyone, and its pages don't point to it", async () => {
  const s = await setup();
  await assert.rejects(s.read(s.anaId), sqlstate("KA007"));
  assert.equal((await s.page(s.shown.worldId)).space, null);
});

it("shared, anyone sees the name, the card look and published pages — with a cover the page already shows", async () => {
  const s = await setup();
  await setSpaceShared(s.ana, s.anaId, true, "share");
  const space = await s.read(s.anaId);
  assert.equal(space.by, "Ana Reyes");
  assert.equal(space.look.seed, "#2563eb");
  assert.deepEqual(space.pages.map(p => p.title), ["Portfolio"], "only published pages; the journal stays private");
  assert.equal(space.pages[0].cover, s.name);
  assert.equal((await s.page(s.shown.worldId)).space, s.anaId, "the page now leads to its owner's Space");
  const json = JSON.stringify(space);
  assert.ok(!json.includes(s.hidden.worldId) && !json.includes("Private journal"));
});

it("a page that stops being shared leaves the Space; stopping the Space takes it offline", async () => {
  const s = await setup();
  await setSpaceShared(s.ana, s.anaId, true, "share");
  await setPublished(s.ana, s.anaId, s.shown.worldId, false, "unpub");
  assert.deepEqual((await s.read(s.anaId)).pages, []);
  await setSpaceShared(s.ana, s.anaId, false, "stop");
  await assert.rejects(s.read(s.anaId), sqlstate("KA007"));
});

it("no one else can share or list someone's Space, or slip their own page into it", async () => {
  const s = await setup();
  await assert.rejects(s.eli.upsertEntity({ kind: "resource", scope: `actor:${s.anaId}`, title: "Public Space",
    attributes: { sov: "solve.space", published: true }, visibility: "private", idempotencyKey: "forge" }), sqlstate("KA002"));
  // Eli publishes a record in his own scope naming Ana's thing: it is not his, so it never appears.
  await setSpaceShared(s.eli, s.eliId, true, "eli-share");
  await setPublished(s.eli, s.eliId, s.shown.worldId, true, "eli-claims", []);
  assert.deepEqual((await s.read(s.eliId)).pages, [], "a thing someone else started never appears in your Space");
  await assert.rejects(s.read(randomUUID()), sqlstate("KA007"), "a guessed id reveals nothing");
});
