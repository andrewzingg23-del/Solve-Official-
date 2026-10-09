import assert from "node:assert/strict";
import { it } from "node:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
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

it("requires the raw invitation token at the RPC boundary; a disclosed stored hash cannot grant access", async () => {
  const { db, owner, ben, cat, world } = await setup();
  const viewer = await createWorldInvitation(owner, worldId, "viewer", "hash-viewer");
  await acceptWorldInvitation(ben, viewer.token);
  const invite = await createWorldInvitation(owner, worldId, "editor", "hash-editor");
  const [stored] = await db.owner("select token_hash from kernel.world_invitations where id = $1", [invite.invitationId]);
  const hash = stored.token_hash as string;
  assert.equal(hash, createHash("sha256").update(invite.token).digest("hex"));
  assert.equal((await owner.createWorldInvitation({ worldId, tokenHash: hash, role: "editor", requestId: "hash-editor" })).invitation_id, invite.invitationId, "exact creation retries return the existing invitation");
  await assert.rejects(owner.createWorldInvitation({ worldId, tokenHash: "0".repeat(64), role: "editor", requestId: "hash-editor" }), denied, "a changed token is not an exact retry");
  await assert.rejects(owner.createWorldInvitation({ worldId, tokenHash: hash, role: "viewer", requestId: "hash-editor" }), denied);
  await assert.rejects(cat.acceptWorldInvitation(hash), denied, "the stored digest is not a bearer token");
  await assert.rejects(cat.readWorld(world.scope), denied);
  assert.ok(!JSON.stringify(await ben.readEvents(world.scope, { limit: 100 })).includes(hash), "new invitation history does not publish the stored digest");
  assert.equal(await cat.acceptWorldInvitation(invite.token), worldId, "the authoritative RPC hashes the raw token itself");
  await cat.postRoomMessage({ worldId, text: "Accepted with the real link", requestId: "raw-token-member" });
});

it("keeps pre-upgrade invitation links and exact creation retries working after the token-boundary migration", async () => {
  const { db, owner, ben, world } = await setup();
  // Install only the previous creation function in this isolated test database,
  // create its real event/projection, then apply the actual additive upgrade.
  const previous = readFileSync("supabase/migrations/20261009020000_world_invites_and_revisions.sql", "utf8");
  const start = previous.indexOf("create function kernel_api.create_world_invitation(");
  const end = previous.indexOf("\n$$;", start) + "\n$$;".length;
  await db.db.exec(previous.slice(start, end).replace("create function", "create or replace function"));
  const invite = await createWorldInvitation(owner, worldId, "editor", "legacy-invite");
  const hash = createHash("sha256").update(invite.token).digest("hex");
  assert.ok(JSON.stringify(await owner.readEvents(world.scope, { limit: 100 })).includes(hash), "the old event really contains the disclosed digest");
  await db.db.exec(readFileSync("supabase/migrations/20261009050000_room_boundary_guards.sql", "utf8"));
  assert.equal((await owner.createWorldInvitation({ worldId, tokenHash: hash, role: "editor", requestId: "legacy-invite" })).invitation_id, invite.invitationId);
  await assert.rejects(ben.acceptWorldInvitation(hash), denied);
  assert.equal(await acceptWorldInvitation(ben, invite.token), worldId);
});
