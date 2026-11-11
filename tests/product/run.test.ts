// A capability run is a kernel task: the same path for a person and for an AI app, authorized at
// every step, retried only when worth it, resumable, and stopped the moment access is withdrawn.
// Real kernel migrations (PGlite); the network is a fake, so every provider answer is chosen here.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { it } from "node:test";
import { kernelClient } from "../../lib/kernel/client";
import { localSupabase } from "../../lib/kernel/local";
import { createCreativeWorld } from "../../lib/world/creative";
import { setBotAccess } from "../../lib/bot/worlds";
import { runCapability } from "../../lib/product/run";
import { linkAdapter } from "../../lib/product/adapters/link";
import { app, createKernelDb, user } from "../kernel/harness";

const PAGE = `<html><head><title>Alfama Guesthouse — rooms</title><meta name="description" content="Six rooms above the tram line."></head></html>`;
const ok = (body = PAGE, status = 200, headers: Record<string, string> = { "content-type": "text/html; charset=utf-8" }) => new Response(body, { status, headers });

async function setup() {
  const db = await createKernelDb();
  const sam = kernelClient(localSupabase(db, user("auth:run-sam")));
  await sam.register("Sam");
  const trip = await createCreativeWorld(sam, { worldId: randomUUID(), title: "Lisbon in June" });
  const agent = await sam.connectApp("tool-1", "Claude", "c-1");
  const asApp = kernelClient(localSupabase(db, app("auth:run-sam", "tool-1")));
  return { db, sam, trip, agent, asApp };
}
const tasksOf = async (k: ReturnType<typeof kernelClient>, scope: string) => (await k.readTasks(scope));

it("a person brings in a page: the real title, saved in the Space, the task completed with its fingerprint", async () => {
  const { sam, trip } = await setup();
  const run = await runCapability(sam, linkAdapter(async () => ok()), trip.worldId, { url: "https://alfama.example/rooms" }, "r-1");
  assert.ok(run.ok, JSON.stringify(run));
  const saved = (await sam.readWorld(trip.scope)).find(e => e.entity_id === (run.ok ? run.entityId : ""));
  assert.equal(saved?.attributes.title, "Alfama Guesthouse — rooms");
  assert.equal(saved?.attributes.description, "Six rooms above the tram line.");
  const [task] = await tasksOf(sam, trip.scope);
  assert.equal(task.status, "completed");
  assert.equal(task.result?.entity_id, saved?.entity_id);
  const m = task.result?.metering as { provider: string; attempts: number; estimated_cost_usd: number; bytes: number };
  assert.deepEqual([m.provider, m.attempts, m.estimated_cost_usd], ["web", 1, 0], "metered: provider, attempts, cost");
  assert.ok(m.bytes > 0);
});

it("the same request again resumes: one task, one resource, no second fetch", async () => {
  const { sam, trip } = await setup();
  let fetched = 0;
  const adapter = linkAdapter(async () => { fetched++; return ok(); });
  const a = await runCapability(sam, adapter, trip.worldId, { url: "https://alfama.example/rooms" }, "same");
  const b = await runCapability(sam, adapter, trip.worldId, { url: "https://alfama.example/rooms" }, "same");
  assert.ok(a.ok && b.ok && b.resumed && a.entityId === b.entityId);
  assert.equal(fetched, 1);
  assert.equal((await tasksOf(sam, trip.scope)).length, 1);
});

it("an AI app with Add access runs the very same capability, as itself", async () => {
  const { sam, trip, agent, asApp } = await setup();
  await setBotAccess(sam, { scope: trip.scope, botAgentId: agent, access: "add" }, "add");
  const run = await runCapability(asApp, linkAdapter(async () => ok()), trip.worldId, { url: "https://alfama.example/rooms" }, "app-1");
  assert.ok(run.ok, JSON.stringify(run));
  const created = (await sam.readEvents(trip.scope, { limit: 500 })).find(e => e.type === "kernel.entity.created" && (e.payload as { entity_id?: string }).entity_id === (run.ok ? run.entityId : ""));
  assert.equal(created?.actor_id, agent, "authored by the app's own agent");
});

it("an app with only Read access is refused before anything runs", async () => {
  const { sam, trip, agent, asApp } = await setup();
  await setBotAccess(sam, { scope: trip.scope, botAgentId: agent, access: "read" }, "read");
  let fetched = 0;
  const run = await runCapability(asApp, linkAdapter(async () => { fetched++; return ok(); }), trip.worldId, { url: "https://alfama.example/rooms" }, "app-2");
  assert.equal(run.ok, false);
  assert.equal(fetched, 0, "nothing was fetched");
});

it("switching the app Off mid-run stops it: nothing is saved and the task says why", async () => {
  const { sam, trip, agent, asApp } = await setup();
  await setBotAccess(sam, { scope: trip.scope, botAgentId: agent, access: "add" }, "add");
  const adapter = linkAdapter(async () => { await setBotAccess(sam, { scope: trip.scope, botAgentId: agent, access: "none" }, "off"); return ok(); });
  const run = await runCapability(asApp, adapter, trip.worldId, { url: "https://alfama.example/rooms" }, "app-3");
  assert.equal(run.ok, false);
  assert.match(run.ok ? "" : run.error, /withdrawn/);
  assert.ok(!(await sam.readWorld(trip.scope)).some(e => e.attributes?.documentType === "link"), "nothing was saved");
  // The app no longer has authority even to close its own task: the kernel refuses that too. The
  // task can never complete, and the person (who holds the Space) can still see and close it.
  const [task] = await tasksOf(sam, trip.scope);
  assert.notEqual(task.status, "completed");
  assert.equal(task.result, null);
});

it("an ordinary network blip is retried; a 404 is final and said plainly", async () => {
  const { sam, trip } = await setup();
  let calls = 0;
  const flaky = linkAdapter(async () => { calls++; if (calls < 3) throw new TypeError("fetch failed"); return ok(); });
  assert.ok((await runCapability(sam, flaky, trip.worldId, { url: "https://alfama.example/rooms" }, "flaky")).ok);
  assert.equal(calls, 3);
  const missing = await runCapability(sam, linkAdapter(async () => ok("gone", 404)), trip.worldId, { url: "https://alfama.example/nope" }, "404");
  assert.equal(missing.ok, false);
  assert.match(missing.ok ? "" : missing.error, /404/);
  assert.equal((await tasksOf(sam, trip.scope)).find(t => t.status === "failed")?.status, "failed");
});

it("refuses unsafe addresses before any task, and never follows a redirect inward", async () => {
  const { sam, trip } = await setup();
  for (const url of ["http://alfama.example", "https://localhost/x", "https://10.0.0.5/", "https://192.168.1.1/", "https://user:pw@alfama.example/", "https://metadata.internal/"]) {
    const run = await runCapability(sam, linkAdapter(async () => ok()), trip.worldId, { url }, url);
    assert.equal(run.ok, false, url);
  }
  assert.equal((await tasksOf(sam, trip.scope)).length, 0, "no task was even started");
  const inward = linkAdapter(async () => new Response(null, { status: 302, headers: { location: "https://169.254.169.254/latest" } }));
  const run = await runCapability(sam, inward, trip.worldId, { url: "https://alfama.example/go" }, "redirect");
  assert.equal(run.ok, false);
});
