import assert from "node:assert/strict";
import { test } from "node:test";
import { needsGuestContext } from "../../lib/supabase/guest-page";

test("visiting a public SOV ID never creates an implicit account", () => {
  const id = "e5c7e24f-88ce-4cc2-8bdd-2f6881e32a67";
  assert.equal(needsGuestContext(`/id/${id}`, "GET"), false);
  assert.equal(needsGuestContext(`/id/${id}/`, "GET"), false);
  assert.equal(needsGuestContext(`/id/${id}`, "POST"), false);
  assert.equal(needsGuestContext("/id/not-a-valid-id", "GET"), false);
  assert.equal(needsGuestContext("/id", "GET"), true);
});

test("legitimate guest Spaces keep their previous behavior", () => {
  assert.equal(needsGuestContext("/space", "GET"), true);
  assert.equal(needsGuestContext("/card", "GET"), true);
  assert.equal(needsGuestContext("/world/demo", "POST"), true);
  assert.equal(needsGuestContext("/api/id/demo", "GET"), false);
  assert.equal(needsGuestContext("/login", "GET"), false);
  assert.equal(needsGuestContext("/auth/callback", "GET"), false);
  assert.equal(needsGuestContext("/favicon.ico", "GET"), false);
  assert.equal(needsGuestContext("/space", "HEAD"), false);
});
