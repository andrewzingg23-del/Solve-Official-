// Linking a wallet the person controls (crypto stage 2). solve never holds keys: the person proves
// control of a Solana address by signing a short message in their own wallet. Signing moves nothing
// and costs nothing. The server issues the message (bound to who is asking, signed with a server key
// so it can't be forged or reused by someone else, and short-lived), then checks the wallet's
// signature before the kernel links the address.
//
// Known limit: the kernel's link_wallet itself doesn't require this proof, so a direct API call could
// link an address without it. A kernel change to require it is proposed in ACTIVE-WORK.md.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getBase58Encoder, getPublicKeyFromAddress, getUtf8Encoder, isAddress, verifySignature, type Address, type SignatureBytes } from "@solana/kit";

export const CHALLENGE_MINUTES = 10;
export class WalletProofError extends Error {}

const keyFrom = (secret: string) => createHmac("sha256", secret).update("solve wallet proofs v1").digest();
const mac = (secret: string, actorId: string, message: string) => createHmac("sha256", keyFrom(secret)).update(`${actorId}\n${message}`).digest("base64url");

export function walletChallenge(secret: string, actorId: string, label: string, now = new Date()): { message: string; token: string } {
  const message = [
    `solve: link this wallet to ${label || "my solve account"}`,
    "Signing proves you control this wallet. It moves nothing and costs nothing.",
    `Nonce: ${randomBytes(12).toString("base64url")}`,
    `Issued: ${now.toISOString()}`,
  ].join("\n");
  return { message, token: mac(secret, actorId, message) };
}

// Checks a signed challenge. Returns the address, or throws with a reason a person can act on.
export async function verifyWalletProof(input: { secret: string; actorId: string; address: string; message: string; signature: string; token: string; now?: Date }): Promise<Address> {
  const { secret, actorId, address, message, signature, token, now = new Date() } = input;
  const want = Buffer.from(mac(secret, actorId, message));
  const got = Buffer.from(token);
  if (want.length !== got.length || !timingSafeEqual(want, got)) throw new WalletProofError("that request wasn't issued to you; start again");
  const issued = /^Issued: (.+)$/m.exec(message)?.[1];
  const age = issued ? now.getTime() - new Date(issued).getTime() : NaN;
  if (!Number.isFinite(age) || age < 0 || age > CHALLENGE_MINUTES * 60_000) throw new WalletProofError("that request expired; start again");
  if (!isAddress(address)) throw new WalletProofError("that isn't a Solana address");
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(getBase58Encoder().encode(signature));
  } catch {
    throw new WalletProofError("the signature isn't readable");
  }
  if (bytes.length !== 64) throw new WalletProofError("the signature isn't readable");
  const ok = await verifySignature(await getPublicKeyFromAddress(address as Address), bytes as SignatureBytes, getUtf8Encoder().encode(message) as Uint8Array);
  if (!ok) throw new WalletProofError("that wallet didn't sign this request");
  return address as Address;
}
