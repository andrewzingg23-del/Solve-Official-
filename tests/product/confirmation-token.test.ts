// The bearer token in a confirmation link is the only thing standing between a stranger and one
// person's record, so its properties are tested rather than assumed.
import assert from "node:assert/strict";
import { it } from "node:test";
import { hashConfirmationToken, isPlausibleToken, newConfirmationToken, requestIdFor } from "../../lib/product/confirmation-token";

it("mints an unguessable token whose hash fits the kernel's token_hash column", () => {
  const { token, hash } = newConfirmationToken();
  assert.match(token, /^[A-Za-z0-9_-]{43}$/, "32 random bytes, URL-safe");
  assert.match(hash, /^[0-9a-f]{64}$/, "the kernel's check constraint");
  assert.equal(hashConfirmationToken(token), hash, "the hash is reproducible from the link alone");
  assert.ok(!hash.includes(token), "the stored value does not contain the link");
});

it("never repeats a token", () => {
  const seen = new Set(Array.from({ length: 500 }, () => newConfirmationToken().token));
  assert.equal(seen.size, 500);
});

it("treats anything that is not a plausible token exactly like an unknown one", () => {
  assert.equal(isPlausibleToken(newConfirmationToken().token), true);
  for (const bad of ["", "short", "a".repeat(42), "a".repeat(44), "has space in it but is the right length ok?", "../../etc/passwd"]) {
    assert.equal(isPlausibleToken(bad), false, bad);
  }
});

it("derives idempotency keys from the token, so a retry can never mint a second request", () => {
  const a = newConfirmationToken();
  const b = newConfirmationToken();
  assert.equal(requestIdFor(a.hash), requestIdFor(a.hash), "same link, same request");
  assert.notEqual(requestIdFor(a.hash), requestIdFor(b.hash), "a new link is a new request");
  assert.notEqual(requestIdFor(a.hash, "confirmed"), requestIdFor(a.hash, "disputed"), "different answers are different acts");
  assert.ok(requestIdFor(a.hash, "confirmed").length <= 100, "fits the kernel's request id limit");
});
