// Run: node --import tsx scripts/test-shared-room.mts
// Two browser contexts, real migrated SQL permissions/persistence, fixture
// authentication and deterministic inference. No live provider claims.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { chromium } from "playwright-core";
import { kernelClient } from "../lib/kernel/client";
import { localSupabase } from "../lib/kernel/local";
import { createKernelDb, user } from "../tests/kernel/harness";
import { createCreativeArtifact, createCreativeWorld, loadCreativeWorld } from "../lib/world/creative";
import { acceptWorldInvitation, cancelWorldInvitation, createWorldInvitation } from "../lib/world/invitations";
import { handleRoomArtifact, handleRoomConversation } from "../lib/world/http";
import { readRoomConversation } from "../lib/world/room";

const root = process.cwd();
const out = join(root, ".browser-tests/shared-room");
await mkdir(out, { recursive: true });
await build({ entryPoints: [join(root, "tests/browser/shared-room-entry.tsx")], bundle: true, format: "esm", platform: "browser", target: "es2022",
  outfile: join(out, "app.js"), logLevel: "warning", alias: { "next/navigation": join(root, "tests/browser/shared-room-shims.tsx"), "next/link": join(root, "tests/browser/shared-room-shims.tsx") } });
const css = await postcss([tailwind()]).process(await readFile(join(root, "app/globals.css"), "utf8"), { from: join(root, "app/globals.css") });
await writeFile(join(out, "style.css"), css.css);

const db = await createKernelDb();
const ana = kernelClient(localSupabase(db, user("auth:browser-ana")));
const ben = kernelClient(localSupabase(db, user("auth:browser-ben")));
const anaId = await ana.register("Ana");
const benId = await ben.register("Ben");
const worldId = "00000000-0000-4000-8000-000000000951";
const world = await createCreativeWorld(ana, { worldId, title: "Zuber Pen", goal: "Work out the prototype and its cost together" });
const specId = await createCreativeArtifact(ana, { scope: world.scope, worldEntityId: world.entityId, requestId: "spec", title: "Spec", body: "Original specification", position: { x: 40, y: 50 } });
const privateWorld = await createCreativeWorld(ana, { worldId: "00000000-0000-4000-8000-000000000952", title: "Private notes" });
await createCreativeArtifact(ana, { scope: privateWorld.scope, worldEntityId: privateWorld.entityId, requestId: "private", title: "Private", body: "PRIVATE_BROWSER_SECRET", position: { x: 50, y: 50 } });
let providerFails = false;
let providerCalls = 0;
const server = createServer(async (incoming, outgoing) => {
  try {
    const path = incoming.url!;
    if (path === "/app.js" || path === "/style.css") {
      outgoing.setHeader("Content-Type", path.endsWith(".js") ? "text/javascript" : "text/css");
      outgoing.end(await readFile(join(out, path.slice(1)))); return;
    }
    const session = incoming.headers.cookie?.includes("fixture=ben") ? "ben" : "ana";
    const kernel = session === "ben" ? ben : ana;
    let raw = "";
    for await (const chunk of incoming) raw += chunk;
    const req = new Request(`http://fixture${path}`, { method: incoming.method, headers: { "Content-Type": "application/json" }, ...(raw ? { body: raw } : {}) });
    let response: Response;
    if (path.startsWith(`/api/worlds/${worldId}/conversation`)) {
      response = await handleRoomConversation(kernel, worldId, req, async context => {
        providerCalls++;
        assert.ok(!context.sharedText.includes("PRIVATE_BROWSER_SECRET"));
        if (providerFails) throw new Error("Fixture provider unavailable");
        assert.ok(context.sharedText.includes("replaceable cartridge"));
        return { text: "Prototype the replaceable cartridge first. This is a simulated browser-test reply.", model: "fixture-only" };
      });
    } else if (path === `/api/worlds/${worldId}/artifacts`) response = await handleRoomArtifact(kernel, worldId, req);
    else if (path === "/fixture/state") {
      const { artifacts } = await loadCreativeWorld(kernel, worldId);
      const access = await kernel.authorize({ capability: "world.entity.write", scope: world.scope });
      const owner = session === "ana";
      response = Response.json({ owner, artifact: artifacts.find(a => a.entityId === specId), invitations: owner ? await ana.readWorldInvitations(worldId) : [],
        data: { worldId, title: world.title, goal: world.summary, now: new Date().toISOString(), lens: "pieces", currentActorId: owner ? anaId : benId,
          pieces: artifacts.map(a => ({ id: a.entityId, title: a.title, x: a.position.x, y: a.position.y, kind: "text", detail: a.body.slice(0, 60), saved: false })),
          people: [{ id: anaId, label: "Ana", kind: "human", you: owner }, { id: benId, label: "Ben", kind: "human", you: !owner }],
          botName: null, assistants: [], journeys: [], waiting: [], gaps: [], saves: [], activity: [], repo: null,
          conversation: await readRoomConversation(kernel, worldId), canWrite: access.decision === "ALLOW" } });
    } else if (path === "/fixture/invite") {
      const invite = await createWorldInvitation(kernel, worldId, JSON.parse(raw).role, randomUUID());
      response = Response.json({ path: `/world-invite/${invite.token}`, invitationId: invite.invitationId, expiresAt: invite.expiresAt });
    } else if (path === "/fixture/accept") {
      response = Response.json({ worldId: await acceptWorldInvitation(kernel, JSON.parse(raw).token) });
    } else if (path === "/fixture/cancel") {
      await cancelWorldInvitation(kernel, JSON.parse(raw).invitationId); response = Response.json({});
    } else {
      outgoing.setHeader("Content-Type", "text/html");
      outgoing.end('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Shared room fixture</title><link rel="stylesheet" href="/style.css"><body><div id="app"></div><script type="module" src="/app.js"></script></body></html>'); return;
    }
    outgoing.writeHead(response.status, { "Content-Type": "application/json", "Cache-Control": "no-store" }); outgoing.end(await response.text());
  } catch (error) {
    outgoing.writeHead(500, { "Content-Type": "application/json" }); outgoing.end(JSON.stringify({ error: error instanceof Error ? error.message : "Fixture error" }));
  }
});
await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address !== "string");
const base = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox"] });
const errors: string[] = [];
try {
  const anaContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const benContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await anaContext.addCookies([{ name: "fixture", value: "ana", url: base }]);
  await benContext.addCookies([{ name: "fixture", value: "ben", url: base }]);
  const a = await anaContext.newPage(); const b = await benContext.newPage();
  for (const page of [a, b]) page.on("pageerror", e => { errors.push(e.message); console.error("Browser fixture error:", e.message); });
  await a.goto(base);
  await a.getByRole("heading", { name: "Shared conversation" }).waitFor();
  await a.getByRole("button", { name: "Open access and documents" }).click();
  await a.getByLabel("Invitation role").selectOption("editor");
  await a.getByRole("button", { name: "Create invite link" }).click();
  await a.getByLabel("Invite link", { exact: true }).waitFor();
  const inviteLink = await a.getByLabel("Invite link", { exact: true }).inputValue();
  assert.ok(inviteLink.startsWith(base + "/world-invite/"), "share field contains an absolute link");
  const token = inviteLink.split("/").at(-1)!;
  const accepted = await benContext.request.post(base + "/fixture/accept", { data: { token } }); assert.equal(accepted.status(), 200);
  await b.goto(base);
  await b.getByLabel("Message or question").waitFor();
  await a.getByRole("button", { name: "Open room", exact: true }).click();
  await a.getByLabel("Message or question").fill("Zuber Pen idea: let us build the prototype.");
  await a.getByRole("button", { name: "Send to room", exact: true }).click();
  await a.getByText("Zuber Pen idea: let us build the prototype.", { exact: true }).waitFor();
  await b.getByRole("button", { name: "Refresh shared state" }).click();
  await b.getByText("Zuber Pen idea: let us build the prototype.", { exact: true }).waitFor();
  await b.getByLabel("Message or question").fill("Prototype before tooling.");
  await b.getByRole("button", { name: "Record decision", exact: true }).click();
  await b.getByText("Ben · recorded decision", { exact: true }).waitFor();
  await a.getByText("Bring selected AI knowledge into this room", { exact: true }).click();
  await a.getByLabel("Source title").fill("Selected Claude knowledge");
  await a.getByLabel("Selected knowledge").fill("A replaceable cartridge makes the prototype easier to test.");
  await a.getByRole("button", { name: "Publish shared source" }).click();
  await a.getByText("Shared document saved. People and authorized AIs in this room can use it.", { exact: true }).waitFor();
  await b.getByLabel("Message or question").fill("What should we prototype?");
  await b.getByRole("button", { name: "Ask AI", exact: true }).click();
  await b.getByText("AI draft · requested by Ben", { exact: true }).waitFor();
  assert.equal(await b.getByRole("list", { name: "Room messages" }).evaluate(el => el.scrollHeight - el.scrollTop - el.clientHeight < 2), true, "a newly saved AI reply is shown at the end of the conversation");
  await b.getByText(/^Shared sources used ·/).click();
  await b.getByRole("link", { name: "Selected Claude knowledge · v1" }).waitFor();
  providerFails = true;
  await b.getByLabel("Message or question").fill("Try this when the provider is down.");
  await b.getByRole("button", { name: "Ask AI", exact: true }).click();
  await b.getByText("Your question is saved. AI could not answer; you can retry.", { exact: true }).waitFor();
  await b.reload();
  await b.getByRole("button", { name: "Retry saved question", exact: true }).waitFor();
  providerFails = false;
  await b.getByRole("button", { name: "Retry saved question", exact: true }).click();
  await b.waitForFunction(() => document.querySelectorAll("li").length > 0 && document.body.textContent?.match(/AI draft · requested by Ben/g)?.length === 2);
  assert.equal((await readRoomConversation(ana, worldId)).messages.filter(m => m.text === "Try this when the provider is down.").length, 1);
  await a.getByRole("button", { name: "Open access and documents" }).click();
  await b.getByRole("button", { name: "Open access and documents" }).click();
  await a.getByLabel("Text", { exact: true }).fill("Ana's unsaved merged draft");
  await b.getByLabel("Text", { exact: true }).fill("Ben's newer saved specification");
  await b.getByRole("button", { name: "Save revision", exact: true }).click();
  await b.getByText("Revision saved.", { exact: true }).waitFor();
  await a.getByRole("button", { name: "Save revision", exact: true }).click();
  await a.getByText("A newer version is saved: v2. Your draft is still here.", { exact: true }).waitFor();
  assert.equal(await a.getByLabel("Text", { exact: true }).inputValue(), "Ana's unsaved merged draft");
  await a.getByText("Compare saved revision", { exact: true }).click();
  await a.getByText("Ben's newer saved specification", { exact: true }).waitFor();
  await a.getByRole("button", { name: "I have compared it — use v2 as the base for my draft", exact: true }).click();
  await a.getByRole("button", { name: "Save revision", exact: true }).click();
  await a.getByText("Revision saved.", { exact: true }).waitFor();
  await a.getByRole("button", { name: "Open room", exact: true }).click();
  await a.getByText("Component cost worksheet", { exact: true }).click();
  await a.getByLabel("Component 1", { exact: true }).fill("Cartridge");
  await a.getByLabel("Per unit", { exact: true }).fill("2");
  await a.getByLabel("Price · USD", { exact: true }).fill("1.25");
  await a.getByRole("button", { name: "Add component", exact: true }).click();
  await a.getByLabel("Component 2", { exact: true }).fill("Clip");
  await a.getByLabel("Price · USD", { exact: true }).nth(1).fill("0.10");
  await a.getByLabel("Batch size · units", { exact: true }).fill("100");
  await a.getByLabel("Material waste · %", { exact: true }).fill("10");
  await a.getByLabel("Fixed overhead for the batch · USD", { exact: true }).fill("25.00");
  await a.getByLabel("Assumptions and excluded costs", { exact: true }).fill("Estimate; excludes shipping.");
  await a.getByText("$311.00", { exact: true }).waitFor();
  await a.getByRole("button", { name: "Save estimate to room", exact: true }).click();
  await a.getByText("Estimate and assumptions saved as a shared document.", { exact: true }).waitFor();
  for (let i = 0; i < 52; i++) await ana.postRoomMessage({ worldId, text: `History message ${i}`, requestId: `history-${i}` });
  await a.getByRole("button", { name: "Refresh shared state" }).click();
  await a.getByRole("button", { name: "Load earlier messages", exact: true }).click();
  await a.getByText("Zuber Pen idea: let us build the prototype.", { exact: true }).waitFor();
  await a.getByText("Component cost worksheet", { exact: true }).click();
  await a.screenshot({ path: join(out, "desktop.png") });
  await a.setViewportSize({ width: 390, height: 844 });
  assert.equal(await a.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "mobile content does not overflow horizontally");
  await a.screenshot({ path: join(out, "mobile.png"), fullPage: true });
  const artifacts = (await loadCreativeWorld(ana, worldId)).artifacts;
  assert.equal(artifacts.find(a => a.entityId === specId)?.version, 3);
  assert.ok(artifacts.some(a => a.title === "Component cost estimate" && a.body.includes("$311.00")));
  assert.equal(providerCalls, 3);
  assert.deepEqual(errors, []);
  console.log("Shared room browser journey passed: two users, invitation, persistence, human decision, shared source, AI context, retry after reload, stale-edit retention, cost worksheet, history pagination, mobile layout. Auth and inference were fixtures; SQL permissions and persistence were real.");
} finally {
  await browser.close();
  await new Promise<void>(resolve => server.close(() => resolve()));
}
