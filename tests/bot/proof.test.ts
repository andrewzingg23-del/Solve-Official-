// Proof becomes a save point, end to end on the embedded kernel: a person's assistant saves proof
// that a piece became real; the kernel records it on the piece's latest version, self-reported on
// the person's own piece and witnessed on someone else's, never as verified; a retry saves once;
// read access, missing proof, unsafe links and bots let in before proof existed are refused.
import assert from "node:assert/strict";
import { it } from "node:test";
import { kernelClient, type Kernel } from "../../lib/kernel/client";
import { localSupabase } from "../../lib/kernel/local";
import { createConnector, type Session } from "../../lib/bot/connector";
import { approveConnection } from "../../lib/bot/memory";
import { proofsIn } from "../../lib/bot/proof";
import { saveBot } from "../../lib/bot/store";
import { setBotAccess } from "../../lib/bot/worlds";
import { createCreativeArtifact, createCreativeWorld } from "../../lib/world/creative";
import { createKernelDb, service, user } from "../kernel/harness";

const CLAUDE = "00000000-0000-4000-8000-0000000c1a0d";
const WORLD = "7a1d2c3b-4a59-4687-9a0b-1c2d3e4f5a6c";
type Result = { content: { text: string }[]; isError?: boolean; structuredContent?: Record<string, unknown> };

async function setting() {
  const db = await createKernelDb();
  const ana = kernelClient(localSupabase(db, user("auth:proof-ana")));
  const ben = kernelClient(localSupabase(db, user("auth:proof-ben")));
  const anaId = await ana.register("Ana");
  const benId = await ben.register("Ben");
  const anaBot = (await saveBot(ana, { name: "Nova" }, "persona-proof-ana")).avatar!.agent_id;
  const botAs = (agentId: string) => kernelClient(localSupabase(db, service), { actAs: agentId });
  await approveConnection(ana, anaId, anaBot, { clientId: CLAUDE, clientName: "Claude", mode: "remember" }, "proof-connect-ana");
  let id = 0;
  const call = async (person: Kernel, name: string, args: Record<string, unknown> = {}) => {
    const s: Session = { clientId: CLAUDE, person, botAs, appUrl: "https://sov.test" };
    const res = (await createConnector(s).handle({ jsonrpc: "2.0", id: ++id, method: "tools/call", params: { name, arguments: args } })) as { result: Result };
    return res.result;
  };
  const world = await createCreativeWorld(ana, { worldId: WORLD, title: "Phone stand" });
  return { db, ana, ben, anaId, benId, anaBot, botAs, call, world };
}

it("saves the person's proof on their own piece as self-reported, once, and shows it in the World", async () => {
  const { ana, anaId, anaBot, call, world } = await setting();
  await setBotAccess(ana, { scope: world.scope, botAgentId: anaBot, access: "add" }, "in");
  const piece = (await call(ana, "add_to_world", { world_id: WORLD, title: "Stand v2", body: "PETG, 15° tilt, 120 mm wide." })).structuredContent as { artifact_id: string };

  const args = { world_id: WORLD, artifact_id: piece.artifact_id, what_happened: "Printed the stand in PETG", proof: "Photo shows the printed stand holding a phone", link: "https://photos.example.com/stand.jpg" };
  const saved = await call(ana, "add_proof", args);
  assert.equal(saved.isError, undefined, saved.content[0].text);
  assert.match(saved.content[0].text, /^Saved\. No\. \d+: Printed the stand in PETG\. On your word\. See it: https:\/\/sov\.test\/world\//);
  const info = saved.structuredContent as { number: number; basis: string; verified: boolean };
  assert.deepEqual([info.basis, info.verified], ["self_reported", false]);
  assert.ok(info.number > 0, "a save is numbered by its place in the record");
  const again = await call(ana, "add_proof", { ...args, what_happened: "Printed the stand in PETG" });
  assert.equal((again.structuredContent as { number: number }).number, info.number, "a retried save is one save");

  const proofs = await proofsIn(ana, world.scope);
  assert.equal(proofs.length, 1);
  assert.equal(proofs[0].number, info.number);
  assert.deepEqual(
    [proofs[0].pieceId, proofs[0].what, proofs[0].proof, proofs[0].link, proofs[0].basis, proofs[0].by],
    [piece.artifact_id, "Printed the stand in PETG", "Photo shows the printed stand holding a phone", "https://photos.example.com/stand.jpg", "self_reported", anaId],
  );
  const attached = (await ana.readEvents(world.scope)).filter((e) => e.type === "kernel.evidence.attached");
  assert.deepEqual(attached.map((e) => [e.actor_id, e.on_behalf_of]), [[anaBot, anaId]], "the bot saved it, for Ana, once");

  const read = await call(ana, "read_world", { world_id: WORLD });
  assert.match(read.content[0].text, /Stand v2: PETG, 15° tilt, 120 mm wide\. \[saved No\. \d+: Printed the stand in PETG \(on its maker's word\)\]/);
  const pieces = (read.structuredContent as { pieces: { saves: { basis: string; number: number; verified: boolean }[] }[] }).pieces;
  assert.deepEqual(pieces[0].saves.map((p) => [p.basis, p.number, p.verified]), [["self_reported", info.number, false]]);
});

it("records proof on someone else's piece as witnessed, never as verified", async () => {
  const { ana, ben, benId, anaBot, call, world } = await setting();
  await ana.issueGrant({ grantee: benId, capability: "kernel.read", scope: world.scope });
  await ana.issueGrant({ grantee: benId, capability: "world.entity.write", scope: world.scope });
  const benPiece = await createCreativeArtifact(ben, { scope: world.scope, worldEntityId: world.entityId, requestId: "ben-piece", title: "Order 1042", body: "Ben ordered 20 stands from the print farm.", position: { x: 20, y: 20 } });
  await setBotAccess(ana, { scope: world.scope, botAgentId: anaBot, access: "add" }, "in");

  const saved = await call(ana, "add_proof", { world_id: WORLD, artifact_id: benPiece, what_happened: "The 20 stands arrived", proof: "Tracking 1Z999AA10123456784 shows delivered" });
  assert.equal(saved.isError, undefined, saved.content[0].text);
  assert.match(saved.content[0].text, /^Saved\. No\. \d+: The 20 stands arrived\. Seen by you\./);
  assert.equal((await proofsIn(ana, world.scope))[0].basis, "witnessed");
});

it("refuses read access, missing proof, unsafe links, unknown pieces, and bots let in before proof existed", async () => {
  const { ana, anaBot, call, world } = await setting();
  await setBotAccess(ana, { scope: world.scope, botAgentId: anaBot, access: "add" }, "in");
  const piece = (await call(ana, "add_to_world", { world_id: WORLD, title: "Stand", body: "Draft" })).structuredContent as { artifact_id: string };
  const base = { world_id: WORLD, artifact_id: piece.artifact_id, what_happened: "Printed it" };

  assert.match((await call(ana, "add_proof", base)).content[0].text, /Nothing was saved: proof needs a link, a number or a description/);
  assert.match((await call(ana, "add_proof", { ...base, link: "javascript:alert(1)" })).content[0].text, /Nothing was saved: the link must start with https:\/\//);
  assert.match((await call(ana, "add_proof", { ...base, artifact_id: "nope", proof: "x" })).content[0].text, /Nothing was saved: no such piece/);

  await setBotAccess(ana, { scope: world.scope, botAgentId: anaBot, access: "read" }, "down");
  assert.match((await call(ana, "add_proof", { ...base, proof: "photo" })).content[0].text, /may not add proof in that World/);

  // A bot let in to add before proof existed holds read and write, but not evidence.
  await setBotAccess(ana, { scope: world.scope, botAgentId: anaBot, access: "none" }, "out");
  await ana.issueGrant({ grantee: anaBot, capability: "kernel.read", scope: world.scope });
  await ana.issueGrant({ grantee: anaBot, capability: "world.entity.write", scope: world.scope });
  assert.match((await call(ana, "add_proof", { ...base, proof: "photo" })).content[0].text, /set it to Add again/);
  assert.deepEqual(await proofsIn(ana, world.scope), [], "nothing was saved by any refused call");
});

it("draws a save point only with its words, and never a link that is not a web address", async () => {
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { SavePoint, PracticeLabel } = await import("../../app/save-point");
  const base = { what: "Printed the stand", basis: "self_reported" as const, at: `${new Date().getUTCFullYear()}-10-05T12:00:00Z`, number: 1042 };
  const html = renderToStaticMarkup(createElement(SavePoint, { ...base, link: "https://photos.example.com/stand.jpg" }));
  assert.match(html, /bg-accent/, "a save gets the point");
  assert.match(html, /Saved · No\. 1042/);
  assert.match(html, /On your word · Oct 5 · /);
  assert.match(renderToStaticMarkup(createElement(SavePoint, { ...base, basis: "witnessed", who: "Ana" })), /Seen by Ana · Oct 5/);
  assert.match(renderToStaticMarkup(createElement(SavePoint, { ...base, at: "2024-03-01T00:00:00Z" })), /On your word · Mar 1, 2024/, "an older save shows its year");
  assert.match(html, /href="https:\/\/photos\.example\.com\/stand\.jpg"[^>]*>See proof</);
  assert.doesNotMatch(renderToStaticMarkup(createElement(SavePoint, { ...base, link: "javascript:alert(1)" })), /href=/, "only web links");
  const practice = renderToStaticMarkup(createElement(PracticeLabel, {}));
  assert.match(practice, /Practice/);
  assert.doesNotMatch(practice, /bg-accent/, "Practice never gets the point");
});

it("refuses a memory where the kernel cannot keep its key, before writing anything", async () => {
  const { KernelError } = await import("../../lib/kernel/client");
  const { noteMemory, MemoryUnavailableError } = await import("../../lib/bot/memory");
  let recorded = false;
  const noSealing = {
    unsealKeys: async () => {
      throw new KernelError("unavailable", "Could not find the function kernel_api.unseal_keys(p_event_ids) in the schema cache", "PGRST202");
    },
    recordEvent: async () => {
      recorded = true;
      return "00000000-0000-4000-8000-000000000001";
    },
    sealKey: async () => undefined,
  } as unknown as Kernel;
  await assert.rejects(
    noteMemory(noSealing, "owner", { text: "Prefers PETG" }, { client_id: "c", client_name: "Claude" }, { recent: [] }),
    (e: unknown) => e instanceof MemoryUnavailableError,
  );
  assert.equal(recorded, false, "nothing unreadable was written");
});
