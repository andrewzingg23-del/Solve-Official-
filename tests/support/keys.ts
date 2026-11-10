// Ids and wallet-shaped addresses for kernel fixtures. The kernel's money tables accept chain
// addresses as text; tests need only valid-looking, distinct ones, so no chain library is involved.
import { randomUUID } from "node:crypto";

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** A random 32-byte value in base58: the shape of a Solana address, which the kernel stores. */
export function newAddress(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let n = BigInt("0x" + Array.from(bytes, b => b.toString(16).padStart(2, "0")).join(""));
  let out = "";
  while (n > BigInt(0)) { out = ALPHABET[Number(n % BigInt(58))] + out; n /= BigInt(58); }
  for (const b of bytes) { if (b !== 0) break; out = "1" + out; }
  return out;
}

export async function newId(): Promise<string> {
  return randomUUID();
}
