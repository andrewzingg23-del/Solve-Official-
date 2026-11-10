// SOLVE Connect, increment 1. The proof the founder asked for: authorize an outside app to one
// chosen thing, let it do one permitted act, disconnect it, and prove it is refused afterwards —
// enforced by the kernel itself, whatever calls it.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { it } from "node:test";
import { kernelClient } from "../../lib/kernel/client";
import { localSupabase } from "../../lib/kernel/local";
import { createCreativeArtifact, createCreativeWorld } from "../../lib/world/creative";
import { app, createKernelDb, sqlstate, user } from "./harness";

const CLAUDE = "claude-ai-connector";

async function setup() {
  const db = await createKernelDb();
  const ana = kernelClient(localSupabase(db, user("auth:conn-ana")));
  await ana.register("Ana");
  const anaId = (await ana.whoami()).actor_id;
  const shared = await createCreativeWorld(ana, { worldId: randomUUID(), title: "Tree job, Oak St" });
  const secret = await createCreativeWorld(ana, { worldId: randomUUID(), title: "Private journal" });
  const asApp = (clientId = CLAUDE) => (fn: string, args: Record<string, unknown> = {}) => db.rpc(app("auth:conn-ana", clientId), fn, args);
  const asAna = (fn: string, args: Record<string, unknown> = {}) => db.rpc(user("auth:conn-ana"), fn, args);
  return { db, ana, anaId, shared, secret, asApp, asAna };
}

it("an app that was never connected gets nothing — not even the person's own things", async () => {
  const { asApp, shared } = await setup();
  await assert.rejects(asApp()("whoami"), sqlstate("KA002"));
  await assert.rejects(asApp()("read_world", { p_scope: shared.scope }), sqlstate("KA002"));
});

it("a connected app is its own actor, accountable to the person, and starts with nothing", async () => {
  const { asApp, asAna, anaId, shared } = await setup();
  const agentId = (await asAna("connect_app", { p_client_id: CLAUDE, p_label: "Claude" }))[0].connect_app as string;
  const [me] = await asApp()("whoami");
  assert.equal(me.actor_id, agentId, "the app acts as its connection agent");
  assert.notEqual(me.actor_id, anaId, "never as the person");
  await assert.rejects(asApp()("read_world", { p_scope: shared.scope }), sqlstate("KA002"), "nothing granted yet");
  const [{ connect_app: again }] = await asAna("connect_app", { p_client_id: CLAUDE, p_label: "Claude" });
  assert.equal(again, agentId, "connecting again is the same connection");
});

it("given one thing, the app can read and add to that thing — and nothing else of the person's", async () => {
  const { asApp, asAna, ana, shared, secret } = await setup();
  const agentId = (await asAna("connect_app", { p_client_id: CLAUDE, p_label: "Claude" }))[0].connect_app as string;
  await ana.issueGrant({ grantee: agentId, capability: "kernel.read", scope: shared.scope, idempotencyKey: "g-read" });
  await ana.issueGrant({ grantee: agentId, capability: "world.entity.write", scope: shared.scope, idempotencyKey: "g-write" });

  const rows = await asApp()("read_world", { p_scope: shared.scope });
  assert.ok(rows.some(r => r.title === "Tree job, Oak St"));
  const [{ upsert_entity: pieceId }] = await asApp()("upsert_entity", {
    p_kind: "document", p_scope: shared.scope, p_title: "Estimate draft", p_summary: "",
    p_attributes: { documentType: "text", worldId: shared.worldId, content: "Two oaks, one stump", canvas: { x: 0, y: 0 } },
    p_visibility: "members", p_idempotency_key: "app-piece",
  });
  assert.ok(pieceId, "the one permitted act happened");
  const [created] = (await asAna("read_events", { p_scope: shared.scope, p_limit: 200 }))
    .filter(e => e.type === "kernel.entity.created" && (e.payload as { entity_id?: string }).entity_id === pieceId);
  assert.equal(created.actor_id, agentId, "the record says the app did it");
  assert.notEqual(created.on_behalf_of, null, "on the person's behalf");

  await assert.rejects(asApp()("read_world", { p_scope: secret.scope }), sqlstate("KA002"), "the journal stays private");
  await assert.rejects(asApp()("read_world", { p_scope: `actor:${(await ana.whoami()).actor_id}` }), sqlstate("KA002"));
  await assert.rejects(asApp()("issue_grant", { p_grantee: agentId, p_capability: "kernel.read", p_scope: secret.scope }), sqlstate("KA002"),
    "it cannot grant itself more");
  await assert.rejects(asApp()("connect_app", { p_client_id: "another-app" }), sqlstate("KA002"), "it cannot connect other apps");
  await assert.rejects(asApp()("disconnect_app", { p_client_id: "another-app" }), sqlstate("KA002"));
  await assert.rejects(asApp()("my_connections"), sqlstate("KA002"));
  await assert.rejects(asApp("some-other-client")("read_world", { p_scope: shared.scope }), sqlstate("KA002"),
    "a different app holding the same person's token is not this app");
});

it("disconnecting revokes everything and the app's tokens are refused from then on", async () => {
  const { asApp, asAna, ana, shared } = await setup();
  const agentId = (await asAna("connect_app", { p_client_id: CLAUDE, p_label: "Claude" }))[0].connect_app as string;
  await ana.issueGrant({ grantee: agentId, capability: "kernel.read", scope: shared.scope, idempotencyKey: "g-read" });
  assert.ok((await asApp()("read_world", { p_scope: shared.scope })).length > 0);

  await asAna("disconnect_app", { p_client_id: CLAUDE });
  await assert.rejects(asApp()("whoami"), sqlstate("KA002"), "the same token now resolves to nothing");
  await assert.rejects(asApp()("read_world", { p_scope: shared.scope }), sqlstate("KA002"));
  const [listed] = await asAna("my_connections");
  assert.ok(listed.disconnected_at, "the person sees it disconnected");
  assert.deepEqual(listed.scopes, [], "with no live grants left");
  await asAna("disconnect_app", { p_client_id: CLAUDE }); // disconnecting twice is harmless

  // Reconnecting is a fresh start: a new agent, with nothing.
  const [{ connect_app: fresh }] = await asAna("connect_app", { p_client_id: CLAUDE, p_label: "Claude" });
  assert.notEqual(fresh, agentId);
  await assert.rejects(asApp()("read_world", { p_scope: shared.scope }), sqlstate("KA002"), "old grants do not come back");
});

it("the person's own session is unchanged, and connection records cannot be rewritten", async () => {
  const { db, ana, asAna, anaId, shared } = await setup();
  assert.equal((await ana.whoami()).actor_id, anaId);
  await createCreativeArtifact(ana, { scope: shared.scope, worldEntityId: shared.entityId, requestId: "own", title: "Mine", body: "Mine", position: { x: 0, y: 0 } });
  await asAna("connect_app", { p_client_id: CLAUDE, p_label: "Claude" });
  await assert.rejects(db.owner("update kernel.connections set client_id = 'x'"), sqlstate("KA006"));
  await asAna("disconnect_app", { p_client_id: CLAUDE });
  await assert.rejects(db.owner("delete from kernel.disconnections"), sqlstate("KA006"), "a disconnection can't be erased to revive an app");
  await assert.rejects(asAna("connect_app", { p_client_id: "bad id with spaces" }), sqlstate("KA003"));
});
