import assert from "node:assert/strict";
import { it } from "node:test";
import { createHash } from "node:crypto";
import { kernelClient, KernelError } from "../../lib/kernel/client";
import { localSupabase } from "../../lib/kernel/local";
import { createCreativeWorld } from "../../lib/world/creative";
import { listWorldCollaborators, revokeWorldAccess } from "../../lib/world/collaboration";
import { acceptWorldInvitation, cancelWorldInvitation, createWorldInvitation } from "../../lib/world/invitations";
import { createKernelDb, user } from "../kernel/harness";

const worldId = "00000000-0000-4000-8000-000000000911";
const denied = (e: unknown) => e instanceof KernelError && ["forbidden", "conflict", "not_found"].includes(e.name);
async function setup() {
  const db = await createKernelDb();
  const owner = kernelClient(localSupabase(db, user("auth:invite-owner")));
  const ben = kernelClient(localSupabase(db, user("auth:invite-ben")));
  const cat = kernelClient(localSupabase(db, user("auth:invite-cat")));
  await owner.register("Ana");
  const benId = await ben.register("Ben");
  await cat.register("Cat");
  const world = await createCreativeWorld(owner, { worldId, title: "Shared idea" });
  return { db, owner, ben, benId, cat, world };
}

it("accepts an editor invitation once, preserves actual acceptor provenance, and supports member revocation", async () => {
  const { owner, ben, benId, cat, world } = await setup();
  const invite = await createWorldInvitation(owner, worldId, "editor", "invite-1");
  assert.ok(/^[a-f0-9]{64}$/.test(invite.token));
  assert.equal(await acceptWorldInvitation(ben, invite.token), worldId);
  assert.equal(await acceptWorldInvitation(ben, invite.token), worldId);
  await assert.rejects(acceptWorldInvitation(cat, invite.token), denied);
  const [member] = await listWorldCollaborators(owner, world.scope);
  assert.equal(member.actorId, benId);
  assert.equal(member.role, "editor");
  const events = await owner.readEvents(world.scope, { limit: 100 });
  const issued = events.filter(e => e.type === "kernel.grant.issued" && e.payload.invitation_event_id);
  assert.equal(issued.length, 2);
  assert.ok(issued.every(e => e.actor_id === benId), "events name the authenticated acceptor, without impersonating the owner");
  assert.ok(!JSON.stringify(events).includes(invite.token), "raw bearer token never enters shared history");
  await revokeWorldAccess(owner, { scope: world.scope, granteeActorId: benId, requestId: "remove" });
  await assert.rejects(ben.readWorld(world.scope), denied);
  await assert.rejects(acceptWorldInvitation(ben, invite.token), denied, "consumed token cannot regrant revoked access");
  assert.deepEqual(await listWorldCollaborators(owner, world.scope), []);
});

it("enforces owner-only creation/cancellation, viewer rights, cancellation, expiry and invitation event authenticity", async () => {
  const { db, owner, ben, cat, world } = await setup();
  await assert.rejects(createWorldInvitation(ben, worldId, "editor", "not-owner"), denied);
  const viewer = await createWorldInvitation(owner, worldId, "viewer", "viewer");
  await acceptWorldInvitation(ben, viewer.token);
  await assert.rejects(ben.postRoomMessage({ worldId, requestId: "viewer-post", text: "No" }), denied);
  await assert.rejects(createWorldInvitation(ben, worldId, "editor", "viewer-invite"), denied);
  const cancelled = await createWorldInvitation(owner, worldId, "editor", "cancel");
  await assert.rejects(cancelWorldInvitation(ben, cancelled.invitationId), denied);
  await cancelWorldInvitation(owner, cancelled.invitationId);
  await assert.rejects(acceptWorldInvitation(cat, cancelled.token), denied);
  const expired = await createWorldInvitation(owner, worldId, "editor", "expired");
  await db.owner("update kernel.world_invitations set expires_at = now() - interval '1 second' where id = $1", [expired.invitationId]);
  await assert.rejects(acceptWorldInvitation(cat, expired.token), denied);
  await owner.recordEvent({ type: "world.invitation.created", scope: world.scope, payload: { token_hash: createHash("sha256").update("0".repeat(64)).digest("hex"), role: "editor" } });
  await assert.rejects(acceptWorldInvitation(cat, "0".repeat(64)), denied);
});

it("rechecks the owner's delegation authority when a link is accepted", async () => {
  const { owner, ben, world } = await setup();
  const invite = await createWorldInvitation(owner, worldId, "editor", "authority");
  const root = (await owner.myGrants()).find(g => g.scope === world.scope && g.capability === "*")!;
  await owner.revokeGrant(root.id);
  await assert.rejects(acceptWorldInvitation(ben, invite.token), denied);
});

it("honors a changed delegation policy at acceptance instead of bypassing it with stored consent", async () => {
  const { owner, ben, world } = await setup();
  const invite = await createWorldInvitation(owner, worldId, "editor", "policy");
  await owner.setActionPolicy({ scope: world.scope, capability: "kernel.grant.issue", requirement: "deny" });
  await assert.rejects(acceptWorldInvitation(ben, invite.token), denied);
  await assert.rejects(createWorldInvitation(owner, worldId, "viewer", "denied-new-invite"), denied);
});
