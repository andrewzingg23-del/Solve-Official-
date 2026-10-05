// Crypto stage 2: a wallet is linked only with proof that the person controls it. The server issues a
// short-lived challenge bound to the person, the wallet signs it, and the server checks the signature
// before the kernel links the address. solve never holds a key.
import assert from "node:assert/strict";
import { it } from "node:test";
import { generateKeyPair, getAddressFromPublicKey, getBase58Decoder, getUtf8Encoder, signBytes } from "@solana/kit";
import { kernelClient } from "../../lib/kernel/client";
import { localSupabase } from "../../lib/kernel/local";
import { verifyWalletProof, walletChallenge } from "../../lib/chain/wallet-proof";
import { createKernelDb, user } from "../kernel/harness";

const SECRET = "test-secret-not-a-real-key";

async function wallet() {
  const keys = await generateKeyPair();
  const address = await getAddressFromPublicKey(keys.publicKey);
  const sign = async (message: string) => getBase58Decoder().decode(await signBytes(keys.privateKey, getUtf8Encoder().encode(message) as Uint8Array));
  return { address: String(address), sign };
}

it("accepts a wallet only when it signed the challenge issued to this person, recently", async () => {
  const mine = await wallet();
  const other = await wallet();
  const now = new Date("2026-10-05T08:00:00Z");
  const { message, token } = walletChallenge(SECRET, "actor-ana", "Ana", now);
  assert.match(message, /^solve: link this wallet to Ana\nSigning proves you control this wallet\. It moves nothing and costs nothing\.\nNonce: .+\nIssued: 2026-10-05T08:00:00\.000Z$/);
  const signature = await mine.sign(message);
  const proof = { secret: SECRET, actorId: "actor-ana", address: mine.address, message, signature, token, now };

  assert.equal(await verifyWalletProof(proof), mine.address);
  await assert.rejects(verifyWalletProof({ ...proof, actorId: "actor-ben" }), /wasn't issued to you/, "a challenge can't be reused by someone else");
  await assert.rejects(verifyWalletProof({ ...proof, token: token.slice(0, -2) + "xx" }), /wasn't issued to you/);
  await assert.rejects(verifyWalletProof({ ...proof, message: message.replace("Ana", "Mallory") }), /wasn't issued to you/, "the message can't be edited");
  await assert.rejects(verifyWalletProof({ ...proof, now: new Date(now.getTime() + 11 * 60_000) }), /expired/);
  await assert.rejects(verifyWalletProof({ ...proof, address: other.address }), /didn't sign this request/, "one wallet's signature doesn't prove another");
  await assert.rejects(verifyWalletProof({ ...proof, signature: await other.sign(message) }), /didn't sign this request/);
  await assert.rejects(verifyWalletProof({ ...proof, address: "not-an-address" }), /isn't a Solana address/);
  await assert.rejects(verifyWalletProof({ ...proof, signature: "zz" }), /isn't readable/);
});

it("links a proven wallet to one person only", async () => {
  const db = await createKernelDb();
  const ana = kernelClient(localSupabase(db, user("auth:wallet-ana")));
  const ben = kernelClient(localSupabase(db, user("auth:wallet-ben")));
  await ana.register("Ana");
  await ben.register("Ben");
  const w = await wallet();
  const me = await ana.whoami();
  const { message, token } = walletChallenge(SECRET, me.actor_id, me.label);
  const address = await verifyWalletProof({ secret: SECRET, actorId: me.actor_id, address: w.address, message, signature: await w.sign(message), token });
  await ana.linkWallet("solana-devnet", address);
  assert.deepEqual((await ana.myWallets()).map((x) => [x.chain, x.address]), [["solana-devnet", w.address]]);
  await ana.linkWallet("solana-devnet", address);
  assert.equal((await ana.myWallets()).length, 1, "linking again changes nothing");
  await assert.rejects(ben.linkWallet("solana-devnet", address), /linked to another actor/, "someone else can't take it");
});

it("shows the wallet part of the Command Center wherever it's given, even before a bot", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { createElement } = await import("react");
  const { CommandView } = await import("../../app/command/view");
  const html = renderToStaticMarkup(CommandView({ data: { name: "Ana", botName: null, worlds: [], journeys: [], connections: [], saves: [], wallet: createElement("p", null, "wallet-slot") } }));
  assert.match(html, /Make your bot.*wallet-slot/);
});
