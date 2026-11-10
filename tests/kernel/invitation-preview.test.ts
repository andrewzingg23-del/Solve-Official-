// What a person holding an invitation link may see before joining: who invited them, and to what.
// The preview must not accept, must not grant, and must reveal nothing to a guessed link.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { it } from "node:test";
import { kernelClient } from "../../lib/kernel/client";
import { localSupabase } from "../../lib/kernel/local";
import { createCreativeWorld } from "../../lib/world/creative";
import { acceptWorldInvitation, createWorldInvitation } from "../../lib/world/invitations";
import { createKernelDb, user } from "./harness";

type Preview = { title: string; invited_by: string; role: string; expired: boolean; used: boolean; used_by_you: boolean; is_yours: boolean };

async function setup() {
  const db = await createKernelDb();
  const owner = kernelClient(localSupabase(db, user("auth:invite-owner")));
  const friend = kernelClient(localSupabase(db, user("auth:invite-friend")));
  const stranger = kernelClient(localSupabase(db, user("auth:invite-stranger")));
  await owner.register("Ana");
  await friend.register("Dana");
  await stranger.register("Eli");
  await owner.setPersonLabel("Ana the builder", "label-ana");
  const world = await createCreativeWorld(owner, { worldId: randomUUID(), title: "Summer road trip", goal: "Plan it together" });
  const { token } = await createWorldInvitation(owner, world.worldId, "editor", "invite-1");
  return { db, owner, friend, stranger, world, token };
}

async function callPreview(db: Awaited<ReturnType<typeof createKernelDb>>, sub: string, token: string): Promise<Preview> {
  const sb = localSupabase(db, user(sub)) as unknown as {
    schema: (s: string) => { rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };
  };
  const { data, error } = await sb.schema("kernel_api").rpc("read_world_invitation", { p_token: token, p_as_actor: null });
  if (error) throw new Error(error.message);
  return data as Preview;
}

it("shows a friend who invited them and to what, before they join", async () => {
  const { db, token } = await setup();
  const seen = await callPreview(db, "auth:invite-friend", token);
  assert.equal(seen.title, "Summer road trip");
  assert.equal(seen.invited_by, "Ana the builder", "the inviter's chosen name");
  assert.equal(seen.role, "editor");
  assert.equal(seen.used, false);
  assert.equal(seen.is_yours, false);
  assert.equal((await callPreview(db, "auth:invite-owner", token)).is_yours, true, "the inviter is told it's their own link");
});

it("looking does not join: the friend can still accept afterwards, and gains nothing by looking", async () => {
  const { db, friend, world, token } = await setup();
  await callPreview(db, "auth:invite-friend", token);
  await assert.rejects(friend.readWorld(`world:${world.worldId}`).then(rows => {
    if (rows.length === 0) throw new Error("nothing readable");
  }), "a preview grants no access to the thing");
  const joined = await acceptWorldInvitation(friend, token);
  assert.equal(joined, world.worldId, "the invitation was still unused after the preview");
  const after = await callPreview(db, "auth:invite-friend", token);
  assert.equal(after.used, true);
  assert.equal(after.used_by_you, true, "the friend is told it was them");
  const other = await callPreview(db, "auth:invite-stranger", token);
  assert.equal(other.used, true);
  assert.equal(other.used_by_you, false, "nobody else is told it was them");
});

it("a guessed or malformed link reveals nothing and looks like any unavailable one", async () => {
  const { db } = await setup();
  for (const bad of [randomBytes(32).toString("hex"), "not-a-token", "", "A".repeat(64)]) {
    await assert.rejects(callPreview(db, "auth:invite-stranger", bad), /Invitation is unavailable/, bad || "(empty)");
  }
});
