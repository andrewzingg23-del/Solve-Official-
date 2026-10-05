// Crypto stage 1: a World's history anchored on chain as a Merkle root (only the fingerprint, never
// content). A shared save carries its inclusion proof, so anyone can check it against the root. The
// chain here is LiteSVM, the real Memo program in-process. Nothing is sent to a public network.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { it } from "node:test";
import { kernelClient, type Kernel } from "../../lib/kernel/client";
import { localSupabase } from "../../lib/kernel/local";
import { anchorMemo, explorerUrl, leafHash, merkleProof, merkleRoot, verifyProof } from "../../lib/chain/anchor";
import { anchorChainFromEnv, anchorsIn, anchorWorld, inclusionOf } from "../../lib/bot/anchor";
import { createConnector, type Session } from "../../lib/bot/connector";
import { approveConnection } from "../../lib/bot/memory";
import { buildReceipt, openReceipt, signReceipt } from "../../lib/bot/receipt";
import { saveBot } from "../../lib/bot/store";
import { setBotAccess } from "../../lib/bot/worlds";
import { createCreativeWorld } from "../../lib/world/creative";
import { createKernelDb, service, user } from "../kernel/harness";
import { newSigner } from "../support/keys";
import { LiteSvmGateway } from "../support/litesvm-gateway";

const SECRET = "test-secret-not-a-real-key";
const hex = (s: string) => createHash("sha256").update(s).digest("hex");

it("proves any leaf against its root, and nothing it shouldn't", () => {
  assert.throws(() => merkleRoot([]), /nothing to anchor/);
  for (let n = 1; n <= 9; n++) {
    const leaves = Array.from({ length: n }, (_, i) => hex(`leaf ${n}.${i}`));
    const root = merkleRoot(leaves);
    for (let i = 0; i < n; i++) {
      const proof = merkleProof(leaves, i);
      assert.ok(verifyProof(leaves[i], proof, root), `leaf ${i} of ${n}`);
      assert.equal(verifyProof(hex("another leaf"), proof, root), false, "a different leaf fails");
      if (proof.length) assert.equal(verifyProof(leaves[i], [{ ...proof[0], hash: hex("forged") }, ...proof.slice(1)], root), false, "a forged step fails");
    }
  }
  assert.equal(anchorMemo("ab".repeat(32), 7), `solve:anchor:v1:${"ab".repeat(32)}:7`, "only the root and the count go on chain");
  assert.equal(explorerUrl("litesvm", "x"), null);
  assert.match(explorerUrl("solana-devnet", "sig")!, /cluster=devnet/);
});

it("anchors a World on chain, and a shared save carries a proof anyone can check", async () => {
  const db = await createKernelDb();
  const ana = kernelClient(localSupabase(db, user("auth:anchor-ana")));
  const ben = kernelClient(localSupabase(db, user("auth:anchor-ben")));
  const anaId = await ana.register("Ana");
  const benId = await ben.register("Ben");
  const anaBot = (await saveBot(ana, { name: "Nova" }, "persona-anchor-ana")).avatar!.agent_id;
  const botAs = (agentId: string) => kernelClient(localSupabase(db, service), { actAs: agentId });
  const clientId = "00000000-0000-4000-8000-0000000c1a15";
  await approveConnection(ana, anaId, anaBot, { clientId, clientName: "Claude", mode: "remember" }, "anchor-connect");
  const call = async (person: Kernel, name: string, args: Record<string, unknown>) => {
    const s: Session = { clientId, person, botAs, appUrl: "https://sov.test" };
    return ((await createConnector(s).handle({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } })) as { result: { structuredContent?: Record<string, unknown> } }).result;
  };
  const world = await createCreativeWorld(ana, { worldId: "9c1d2c3b-4a59-4687-9a0b-1c2d3e4f5ae0", title: "Desk" });
  await setBotAccess(ana, { scope: world.scope, botAgentId: anaBot, access: "add" }, "in");
  await ana.issueGrant({ grantee: benId, capability: "kernel.read", scope: world.scope });
  const { artifact_id } = (await call(ana, "add_to_world", { world_id: world.worldId, title: "Phone stand", body: "Printed in PETG" })).structuredContent as { artifact_id: string };
  const { record_id, number } = (await call(ana, "add_proof", { world_id: world.worldId, artifact_id, what_happened: "Printed the stand", proof: "Photo on the desk" })).structuredContent as { record_id: string; number: number };

  const gateway = new LiteSvmGateway();
  const payer = await newSigner();
  gateway.airdrop(payer.address, 1);
  assert.equal(await inclusionOf(ana, world.scope, number), null, "nothing is covered before an anchor");

  await assert.rejects(anchorWorld(ben, world.worldId, { gateway, payer }), (e: Error) => e.name === "forbidden", "a member who can only read can't anchor");
  const balanceBefore = (await gateway.getAccount(payer.address))!.lamports;
  assert.ok(balanceBefore > BigInt(0));

  const checkpoint = await anchorWorld(ana, world.worldId, { gateway, payer });
  assert.equal(checkpoint.cluster, "litesvm");
  assert.equal(checkpoint.url, null);
  assert.ok(checkpoint.count >= 4 && checkpoint.to >= number);
  assert.match(checkpoint.root, /^[0-9a-f]{64}$/);
  assert.deepEqual((await anchorsIn(ben, world.scope)).map((c) => c.root), [checkpoint.root], "a member who can read sees the anchor on the record");

  const inclusion = (await inclusionOf(ana, world.scope, number))!;
  assert.ok(verifyProof(leafHash({ seq: inclusion.seq, hash: inclusion.hash }), inclusion.proof, inclusion.root));
  assert.equal(inclusion.root, checkpoint.root);

  const receipt = await buildReceipt(ana, world.worldId, record_id, new Date("2026-10-05T15:00:00Z"));
  assert.equal(receipt.anchor?.root, checkpoint.root);
  assert.equal(receipt.anchor?.signature, checkpoint.signature);
  assert.equal(JSON.stringify(receipt).includes("Photo on the desk"), false, "the anchor adds no private detail");
  const opened = openReceipt(signReceipt(receipt, SECRET), SECRET)!;
  assert.deepEqual(opened.anchor, receipt.anchor, "the proof survives the link");

  process.env.SUPABASE_SECRET_KEY = SECRET;
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { default: SavedPage } = await import("../../app/saved/[token]/page");
  const html = renderToStaticMarkup(await SavedPage({ params: Promise.resolve({ token: signReceipt(receipt, SECRET) }) } as never));
  assert.match(html, /Anchored on a local test chain on \w{3} \d{1,2}(, \d{4})?: its proof checks out against the root written there/);
  const forged = { ...receipt, anchor: { ...receipt.anchor!, hash: "0".repeat(64) } };
  const bad = renderToStaticMarkup(await SavedPage({ params: Promise.resolve({ token: signReceipt(forged, SECRET) }) } as never));
  assert.match(bad, /does not check out, so treat this receipt with care/);

  const later = (await call(ana, "add_proof", { world_id: world.worldId, artifact_id, what_happened: "Gave one to a friend", proof: "They have it" })).structuredContent as { number: number };
  assert.equal(await inclusionOf(ana, world.scope, later.number), null, "a save after the anchor waits for the next one");
});

it("anchors only when this deployment is set up, and only on devnet", async () => {
  const env = (vars: Record<string, string>) => vars as NodeJS.ProcessEnv;
  assert.equal(await anchorChainFromEnv(env({})), null);
  await assert.rejects(anchorChainFromEnv(env({ ANCHOR_CLUSTER: "solana-mainnet", SOLANA_RPC_URL: "https://x", ANCHOR_PAYER_KEY: "[]" })), /devnet until the founder decides/);
  await assert.rejects(anchorChainFromEnv(env({ ANCHOR_CLUSTER: "solana-devnet", SOLANA_RPC_URL: "https://x", ANCHOR_PAYER_KEY: "[1,2,3]" })), /64-byte keypair/);
});
