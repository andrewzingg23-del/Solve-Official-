import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { capabilityById, listCapabilities } from "../../lib/capabilities/registry";
import { parseTaskRequest } from "../../lib/capabilities/contracts";

describe("SOLVE capability foundation", () => {
  it("exposes core World capabilities without requiring optional API providers", () => {
    const catalog = listCapabilities({});
    assert.equal(catalog.find(c => c.id === "solve.world.task")?.status, "available");
    assert.equal(catalog.find(c => c.id === "github.coding.worker")?.status, "disabled");
    assert.equal(catalog.find(c => c.id === "model.muse")?.status, "needs_connection");
    assert.ok(catalog.every(c => c.schema === "solve.capability.v1" && c.version === "1"));
  });
  it("never mistakes credentials for verified live connections", () => {
    const catalog = listCapabilities({ OPENROUTER_API_KEY:"test-token", ANTHROPIC_API_KEY:"test-token", GITHUB_TOKEN:"test-token" });
    assert.equal(catalog.find(c => c.id === "model.solve")?.status, "configured_unverified");
    assert.equal(catalog.find(c => c.id === "model.claude")?.status, "configured_unverified");
    assert.equal(catalog.find(c => c.id === "github.repository.read")?.status, "configured_unverified");
    assert.equal(catalog.find(c => c.id === "github.coding.worker")?.status, "disabled");
    assert.equal(capabilityById("https://untrusted", {}) , null);
  });
  it("rejects invalid untrusted task envelopes", () => {
    const request = { requestId:"abc_123", title:"Ship new feature", instructions:"Test in preview", capabilityId:"github.coding.worker" };
    assert.deepEqual(parseTaskRequest(request), request);
    assert.equal(parseTaskRequest({ ...request, capabilityId:"https://evil" }), null);
    assert.equal(parseTaskRequest({ ...request, requestId:"" }), null);
    assert.equal(parseTaskRequest({ ...request, title:"" }), null);
    assert.equal(parseTaskRequest({ ...request, instructions:"x".repeat(7001) }), null);
  });
});
