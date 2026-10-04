import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { REASONING_MODEL, GATEWAY_REASONING_MODEL } from "../../lib/world/claude";
import { reasonerForRequest, reasonerFromEnv } from "../../lib/world/reasoning-config";

describe("reasoning provider configuration", () => {
  it("uses the Vercel function OIDC header for AI Gateway without exposing it", () => {
    const token = "test-vercel-oidc-token";
    const request = new Request("https://solve.invalid/api/reason", {
      headers: { "x-vercel-oidc-token": token },
    });

    const reasoner = reasonerForRequest(request, {});

    assert.equal(reasoner?.model, GATEWAY_REASONING_MODEL);
    assert.doesNotMatch(JSON.stringify(reasoner), /test-vercel-oidc-token/);
  });

  it("accepts the Vercel OIDC environment token in local and build environments", () => {
    const reasoner = reasonerFromEnv({ VERCEL_OIDC_TOKEN: "test-build-oidc-token" });

    assert.equal(reasoner?.model, GATEWAY_REASONING_MODEL);
    assert.doesNotMatch(JSON.stringify(reasoner), /test-build-oidc-token/);
  });

  it("prefers the direct Anthropic credential when both providers are configured", () => {
    const reasoner = reasonerFromEnv({
      ANTHROPIC_API_KEY: "test-anthropic-key",
      AI_GATEWAY_API_KEY: "test-gateway-key",
      VERCEL_OIDC_TOKEN: "test-oidc-token",
    });

    assert.equal(reasoner?.model, REASONING_MODEL);
    assert.doesNotMatch(JSON.stringify(reasoner), /test-(?:anthropic|gateway|oidc)/);
  });

  it("leaves reasoning unavailable when no provider credential exists", () => {
    assert.equal(reasonerFromEnv({}), null);
  });
});
