import { createHash, randomBytes } from "node:crypto";

// The bearer token in a confirmation link. Only its SHA-256 hash is ever sent to the kernel, which
// stores nothing else — exactly as world invitations work — so a database read never yields a
// working link. The token itself exists in two places only: the link the owner shares, and the
// address bar of the person they shared it with.

/** 32 random bytes, URL-safe. Unguessable, and short enough to paste into a text message. */
export function newConfirmationToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashConfirmationToken(token) };
}

/** The 64-hex-character SHA-256 the kernel's `token_hash` column requires. */
export function hashConfirmationToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** A plausible token is 43 URL-safe characters. Anything else fails exactly like an unknown one. */
export function isPlausibleToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

/**
 * The idempotency key for a request or an answer, derived from the token itself, so retrying the
 * same submission can never mint a second request — and a fresh token always makes a new one.
 * A replay therefore always returns the request whose hash matches the link being shown.
 */
export function requestIdFor(hash: string, suffix = ""): string {
  return `c-${hash.slice(0, 40)}${suffix ? `-${suffix}` : ""}`;
}
