import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GET } from "../../app/api/reason/route";

describe("reason route Vercel OIDC fallback", () => {
  it("recognizes the deployment OIDC token without exposing it", async () => {
    const names = ["ANTHROPIC_API_KEY", "AI_GATEWAY_API_KEY", "VERCEL_OIDC_TOKEN"] as const;
    const previous = new Map(names.map((name) => [name, process.env[name]]));

    try {
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.AI_GATEWAY_API_KEY;
      process.env.VERCEL_OIDC_TOKEN = "test-vercel-oidc-token";

      const response = await GET();
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.deepEqual(body, {
        available: false,
        reason: "sign in to use the reasoning model",
      });
      assert.doesNotMatch(JSON.stringify(body), /test-vercel-oidc-token/);
    } finally {
      for (const name of names) {
        const value = previous.get(name);
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  });
});
