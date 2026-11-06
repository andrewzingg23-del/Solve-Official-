import test from "node:test";
import assert from "node:assert/strict";
import { OPTIONAL_INTEGRATIONS, OPTIONAL_INTEGRATION_CATEGORIES, connectionStateLabel } from "../../lib/product/optional-integrations";
import { launchRoute } from "../../lib/product/routes";

test("optional app catalog has stable unique IDs and only internal setup URLs", () => {
  const ids = OPTIONAL_INTEGRATIONS.map(app => app.id);
  assert.equal(new Set(ids).size, ids.length);
  const categories = new Set(OPTIONAL_INTEGRATION_CATEGORIES);
  for (const app of OPTIONAL_INTEGRATIONS) {
    assert.ok(categories.has(app.category), app.id);
    assert.ok(app.name.trim(), app.id);
    assert.ok(app.description.trim(), app.id);
    if (app.setupHref) {
      assert.ok(app.setupHref.startsWith("/") && !app.setupHref.startsWith("//"), app.id);
      assert.equal(app.setup, "guided_mcp", app.id);
    }
    assert.ok(!connectionStateLabel(app).toLowerCase().includes("connected"), app.id);
  }
});

test("only existing MCP assistant setup is presented as guided", () => {
  assert.deepEqual(
    OPTIONAL_INTEGRATIONS.filter(app => app.setup === "guided_mcp").map(app => app.id).sort(),
    ["chatgpt", "claude"],
  );
  for (const app of OPTIONAL_INTEGRATIONS.filter(app => app.setup === "adapter_required")) {
    assert.equal(app.setupHref, undefined, "must not falsely link to unimplemented OAuth: " + app.id);
  }
});

test("Space, Projects, Control and onboarding are launch-reachable", () => {
  for (const path of ["/", "/projects", "/control", "/onboarding", "/onboarding/"]) {
    assert.deepEqual(launchRoute(path, {}), { kind: "allow" }, path);
  }
});
