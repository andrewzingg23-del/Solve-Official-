import assert from "node:assert/strict";
import { it } from "node:test";
import { kernelClient } from "../../lib/kernel/client";
import { localSupabase } from "../../lib/kernel/local";
import { createCreativeWorld } from "../../lib/world/creative";
import { handleRoomArtifact, handleRoomConversation } from "../../lib/world/http";
import { createKernelDb, user } from "../kernel/harness";

const worldId = "00000000-0000-4000-8000-000000000941";
function request(path: string, method: string, body?: unknown) {
  return new Request(`http://fixture${path}`, { method, ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }) });
}
async function setup() {
  const db = await createKernelDb();
  const owner = kernelClient(localSupabase(db, user("auth:http-owner")));
  const stranger = kernelClient(localSupabase(db, user("auth:http-stranger")));
  await owner.register("Ana"); await stranger.register("Stranger");
  await createCreativeWorld(owner, { worldId, title: "Shared HTTP" });
  return { owner, stranger };
}

it("shared HTTP filters malformed bodies/cursors and rejects unauthorized reads and writes", async () => {
  const { owner, stranger } = await setup();
  const path = `/api/worlds/${worldId}/conversation`;
  assert.equal((await handleRoomConversation(owner, worldId, request(path + "?beforeSeq=-2", "GET"))).status, 422);
  assert.equal((await handleRoomConversation(owner, worldId, request(path, "POST", { requestId: "bad", text: "x".repeat(8001), intent: "message" }))).status, 422);
  assert.equal((await handleRoomConversation(owner, worldId, request(path, "POST", { requestId: "big", text: "x".repeat(45000), intent: "message" }))).status, 422);
  assert.equal((await handleRoomConversation(stranger, worldId, request(path, "GET"))).status, 403);
  const saved = await handleRoomConversation(owner, worldId, request(path, "POST", { requestId: "good", text: "Shared only", intent: "ask_ai", actorId: "forged", history: ["PRIVATE"] }));
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).aiStatus, "unavailable");
  const page = await handleRoomConversation(owner, worldId, request(path, "GET"));
  assert.equal(page.headers.get("Cache-Control"), "private, no-store");
  const messages = (await page.json()).messages;
  assert.equal(messages[0].actor_label, "Ana");
  assert.ok(!JSON.stringify(messages).includes("PRIVATE"));
});

it("artifact HTTP requires an explicit edit version and returns the current saved content on conflict", async () => {
  const { owner, stranger } = await setup();
  const path = `/api/worlds/${worldId}/artifacts`;
  const body = { requestId: "create", title: "Spec", body: "Original", position: { x: 50, y: 50 } };
  const made = await handleRoomArtifact(owner, worldId, request(path, "POST", body));
  const { entityId } = await made.json();
  assert.equal((await handleRoomArtifact(owner, worldId, request(path, "PATCH", { ...body, entityId, requestId: "missing-version" }))).status, 422);
  assert.equal((await handleRoomArtifact(stranger, worldId, request(path, "PATCH", { ...body, entityId, expectedVersion: 1 }))).status, 403);
  assert.equal((await handleRoomArtifact(owner, worldId, request(path, "PATCH", { ...body, entityId, expectedVersion: 1, requestId: "edit", body: "Current saved version" }))).status, 200);
  const stale = await handleRoomArtifact(owner, worldId, request(path, "PATCH", { ...body, entityId, expectedVersion: 1, requestId: "stale", body: "My unsaved draft" }));
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).latest.body, "Current saved version");
});
