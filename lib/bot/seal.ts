// Encryption for content a person may later erase (kernel v5). Each sealed item gets its own random
// key: the ciphertext goes into history, the key into the kernel's key store. Destroying the key
// erases the content for good, while history keeps that it existed. AES-256-GCM through WebCrypto.
export const SEAL_ALG = "A256GCM";
export type Sealed = { v: 1; alg: typeof SEAL_ALG; iv: string; data: string };

function b64(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

const aesKey = (key: string, usage: "encrypt" | "decrypt") => crypto.subtle.importKey("raw", unb64(key), "AES-GCM", false, [usage]);

export function isSealed(v: unknown): v is Sealed {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  return s.v === 1 && s.alg === SEAL_ALG && typeof s.iv === "string" && typeof s.data === "string";
}

export async function seal(value: unknown): Promise<{ sealed: Sealed; key: string }> {
  const key = b64(crypto.getRandomValues(new Uint8Array(32)));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(key, "encrypt"), new TextEncoder().encode(JSON.stringify(value)));
  return { sealed: { v: 1, alg: SEAL_ALG, iv: b64(iv), data: b64(new Uint8Array(data)) }, key };
}

// The sealed value, or null when it cannot be opened with this key (wrong key, tampered or malformed).
export async function unseal(sealed: unknown, key: string): Promise<unknown> {
  if (!isSealed(sealed)) return null;
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(sealed.iv) }, await aesKey(key, "decrypt"), unb64(sealed.data));
    return JSON.parse(new TextDecoder().decode(plain));
  } catch {
    return null;
  }
}
