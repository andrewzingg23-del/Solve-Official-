import test from "node:test";
import assert from "node:assert/strict";
import { isStandalonePublicIdentityRoute } from "../../lib/product/public-identity-route";

const cardId = "ad0ca8ae-e206-4d1c-a3b5-2b8e3cb714fd";

test("public SOV identity route uses the stand-alone visitor surface", () => {
  assert.equal(isStandalonePublicIdentityRoute(`/id/${cardId}`), true);
  assert.equal(isStandalonePublicIdentityRoute(`/id/${cardId}/`), true);
  assert.equal(isStandalonePublicIdentityRoute("/id/AD0CA8AE-E206-4D1C-A3B5-2B8E3CB714FD"), true);
});

test("private and unrelated routes keep their normal shell", () => {
  for (const pathname of ["/", "/space", "/projects", "/account", "/sov-id", "/onboarding", "/id", "/id/not-a-valid-card", `/id/${cardId}/settings`, "/id/../../space"]) {
    assert.equal(isStandalonePublicIdentityRoute(pathname), false, pathname);
  }
});
