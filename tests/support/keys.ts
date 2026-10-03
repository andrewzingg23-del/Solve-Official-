// Key material and ids for fixtures. Random by default; reproducible once a generator seeds it, so
// the same seed always yields the same wallets, mints and venues (Arcadia's determinism).
import { createKeyPairSignerFromPrivateKeyBytes, generateKeyPairSigner, type KeyPairSigner } from "@solana/kit";
import { randomUUID } from "node:crypto";

let seeded: { seed: string; n: number } | null = null;

export function seedKeys(seed: string | null) {
  seeded = seed === null ? null : { seed, n: 0 };
}

async function nextBytes(purpose: string) {
  const s = seeded!;
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${s.seed}:${purpose}:${s.n++}`)));
}

export async function newSigner(): Promise<KeyPairSigner> {
  if (!seeded) return generateKeyPairSigner();
  return createKeyPairSignerFromPrivateKeyBytes(await nextBytes("key"));
}

export async function newId(): Promise<string> {
  if (!seeded) return randomUUID();
  const b = await nextBytes("id");
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = Array.from(b.slice(0, 16), (x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
