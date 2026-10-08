// Receipts: a shared save is a signed snapshot. Only the person who saved it can make one, it holds
// only what they shared, any change to the link breaks it, and the public page draws it plainly.
import assert from "node:assert/strict";
import { it } from "node:test";
import { kernelClient, type Kernel } from "../../lib/kernel/client";
import { localSupabase } from "../../lib/kernel/local";
import { createConnector, type Session } from "../../lib/bot/connector";
import { approveConnection } from "../../lib/bot/memory";
import { buildReceipt, openReceipt, signReceipt, type Receipt } from "../../lib/bot/receipt";
import { saveBot } from "../../lib/bot/store";
import { setBotAccess } from "../../lib/bot/worlds";
import { createCreativeWorld } from "../../lib/world/creative";
import { createKernelDb, service, user } from "../kernel/harness";

const SECRET = "test-secret-not-a-real-key";
const STAND = [[0, 0], [80, 0], [80, 6], [30, 6], [60, 60], [54, 63], [22, 6], [10, 6], [10, 18], [4, 18], [4, 6], [0, 6]];

it("opens only links the server signed, unchanged", () => {
  const r: Receipt = { v: 1, n: 1042, what: "Printed the stand", basis: "self_reported", at: "2026-10-05T12:00:00Z", issued: "2026-10-05T13:00:00Z", title: "Phone stand", owner: "Ana" };
  const token = signReceipt(r, SECRET);
  assert.deepEqual(openReceipt(token, SECRET), r);
  assert.equal(openReceipt(token, "another-secret"), null, "another server's signature does not open it");
  const [payload, sig] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ ...r, what: "Sold 10,000 stands" })).toString("base64url");
  assert.equal(openReceipt(`${forged}.${sig}`, SECRET), null, "changing what it says breaks it");
  assert.equal(openReceipt(`${payload}.${sig.slice(0, -1)}x`, SECRET), null);
  assert.equal(openReceipt(`${payload}`, SECRET), null);
  const signedButBad = signReceipt({ ...r, basis: "made_up" as never }, SECRET);
  assert.equal(openReceipt(signedButBad, SECRET), null, "even a signed receipt must be well formed");
});

it("lets only the person who saved it share it, with the part drawn from the record", async () => {
  const db = await createKernelDb();
  const ana = kernelClient(localSupabase(db, user("auth:receipt-ana")));
  const ben = kernelClient(localSupabase(db, user("auth:receipt-ben")));
  const anaId = await ana.register("Ana");
  const benId = await ben.register("Ben");
  const anaBot = (await saveBot(ana, { name: "Nova" }, "persona-receipt-ana")).avatar!.agent_id;
  const botAs = (agentId: string) => kernelClient(localSupabase(db, service), { actAs: agentId });
  await approveConnection(ana, anaId, anaBot, { clientId: "00000000-0000-4000-8000-0000000c1a0d", clientName: "Claude", mode: "remember" }, "receipt-connect");
  const call = async (person: Kernel, name: string, args: Record<string, unknown>) => {
    const s: Session = { clientId: "00000000-0000-4000-8000-0000000c1a0d", person, botAs, appUrl: "https://sov.test" };
    return ((await createConnector(s).handle({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } })) as { result: { structuredContent?: Record<string, unknown> } }).result;
  };
  const worldId = "9c1d2c3b-4a59-4687-9a0b-1c2d3e4f5a6e";
  const world = await createCreativeWorld(ana, { worldId, title: "Desk" });
  await ana.issueGrant({ grantee: benId, capability: "kernel.read", scope: world.scope });
  await setBotAccess(ana, { scope: world.scope, botAgentId: anaBot, access: "add" }, "in");
  const { artifact_id } = (await call(ana, "design_part", { world_id: worldId, title: "Phone stand", purpose: "Holds a phone", profile: STAND, width_mm: 70, material: "PETG" })).structuredContent as { artifact_id: string };
  const { record_id } = (await call(ana, "add_proof", { world_id: worldId, artifact_id, what_happened: "Printed it, holds the phone", proof: "Photo on the desk" })).structuredContent as { record_id: string };

  const now = new Date("2026-10-05T15:00:00Z");
  const receipt = await buildReceipt(ana, worldId, record_id, now);
  assert.deepEqual(
    [receipt.what, receipt.basis, receipt.title, receipt.owner, receipt.issued, receipt.part?.size, receipt.part?.material],
    ["Printed it, holds the phone", "self_reported", "Phone stand", "Ana", now.toISOString(), "80 × 70 × 63", "PETG"],
  );
  assert.ok(receipt.n > 0);
  assert.equal(JSON.stringify(receipt).includes("Photo on the desk"), false, "the proof's private detail stays in the World");
  await assert.rejects(buildReceipt(ben, worldId, record_id), /only the person who saved it can share it/);
  await assert.rejects(buildReceipt(ana, worldId, "00000000-0000-4000-8000-000000000000"), /isn't in this World/);
});

it("draws the receipt on the dark floor, honest about whose word it is", async () => {
  process.env.SUPABASE_SECRET_KEY = SECRET;
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { default: SavedPage } = await import("../../app/saved/[token]/page");
  const r: Receipt = { v: 1, n: 1042, what: "Printed the stand", basis: "self_reported", at: "2026-10-05T12:00:00Z", issued: "2026-10-05T13:00:00Z", title: "Phone stand", owner: "Ana", part: { outline: STAND as never, size: "80 × 70 × 63", material: "PETG" } };
  const html = renderToStaticMarkup(await SavedPage({ params: Promise.resolve({ token: signReceipt(r, SECRET) }) } as never));
  assert.match(html, /Saved · No\. 1042/);
  assert.match(html, /On Ana&#x27;s word · Oct 5, 2026 · Phone stand/);
  assert.match(html, /80 × 70 × 63 mm · PETG/);
  assert.match(html, /Everything here is real\./);
  assert.match(html, /It rests on Ana&#x27;s word, not on an outside check\./);
  assert.match(html, /solve-wordmark-on-dark\.svg/);
  assert.equal(html.includes("bg-[#f2f7fb]"), false, "the white floor is gone");
});

it("renders the link-preview card as a PNG, for a real receipt and for a broken link", async () => {
  process.env.SUPABASE_SECRET_KEY = SECRET;
  const { default: Image, size } = await import("../../app/saved/[token]/opengraph-image");
  const r: Receipt = { v: 1, n: 1042, what: "Printed the stand", basis: "self_reported", at: "2026-10-05T12:00:00Z", issued: "2026-10-05T13:00:00Z", title: "Phone stand", owner: "Ana", part: { outline: STAND as never, holes: [[40, 3, 2]], size: "80 × 70 × 63", material: "PETG" } };
  for (const token of [signReceipt(r, SECRET), "broken"]) {
    const res = await Image({ params: Promise.resolve({ token }) });
    const png = new Uint8Array(await res.arrayBuffer());
    assert.equal(res.headers.get("content-type"), "image/png");
    assert.deepEqual([...png.slice(1, 4)].map((c) => String.fromCharCode(c)).join(""), "PNG");
    assert.ok(png.byteLength > 5000);
  }
  assert.deepEqual(size, { width: 1200, height: 630 });
});
