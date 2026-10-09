import assert from "node:assert/strict";
import { it } from "node:test";
import { kernelClient } from "../../lib/kernel/client";
import { localSupabase } from "../../lib/kernel/local";
import { createCreativeWorld } from "../../lib/world/creative";
import { grantWorldAccess } from "../../lib/world/collaboration";
import { heartbeat, PRESENCE_EVENT, readPresence } from "../../lib/world/presence";
import { createKernelDb, user } from "../kernel/harness";

async function setup() {
  const db = await createKernelDb();
  const owner = kernelClient(localSupabase(db, user("auth:presence-owner")));
  const viewer = kernelClient(localSupabase(db, user("auth:presence-viewer")));
  await owner.register("Drew");
  const viewerId = await viewer.register("Viewer");
  const world = await createCreativeWorld(owner, { worldId: "00000000-0000-4000-8000-000000000931", title: "Presence" });
  await grantWorldAccess(owner, { scope: world.scope, granteeActorId: viewerId, role: "viewer", requestId: "view" });
  return { db, owner, viewer, world };
}

it("heartbeat records an authenticated event in the World and repeated heartbeat is idempotent", async () => {
  const { owner, world } = await setup();
  await heartbeat(owner, world.scope);
  await heartbeat(owner, world.scope);
  const events = (await owner.readEvents(world.scope, { limit: 100 })).filter(e => e.type === PRESENCE_EVENT);
  assert.equal(events.length, 1);
  assert.equal(events[0].actor_id, (await owner.whoami()).actor_id);
});

it("presence uses canonical identity, ignores supplied labels and unrelated events, and permits authorized viewers to read", async () => {
  const { owner, viewer, world } = await setup();
  await owner.recordEvent({ type: PRESENCE_EVENT, scope: world.scope, payload: { label: "Forged person" } });
  await owner.recordEvent({ type: "world.note.added", scope: world.scope, payload: {} });
  const present = await readPresence(viewer, world.scope);
  assert.equal(present.length, 1);
  assert.equal(present[0].label, "Drew");
});

it("presence becomes stale according to the database clock and denies an unauthorized scope", async () => {
  const { db, owner, world } = await setup();
  await heartbeat(owner, world.scope);
  // Advance only this isolated fixture's SQL clock; no waits or event-history edits.
  await db.owner("create or replace function pg_catalog.now() returns timestamptz language sql volatile as $$ select clock_timestamp() + interval '2 minutes' $$");
  assert.deepEqual(await readPresence(owner, world.scope), []);
  const outsider = kernelClient(localSupabase(db, user("auth:presence-outsider")));
  await outsider.register("Outsider");
  await assert.rejects(readPresence(outsider, world.scope));
});
