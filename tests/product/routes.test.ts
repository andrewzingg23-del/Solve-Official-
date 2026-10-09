import test from "node:test";
import assert from "node:assert/strict";
import { launchRoute } from "../../lib/product/routes";

test("launch excludes nested legacy financial and experimental pages", () => {
  for (const path of ["/packs", "/packs/trading", "/packs/trading/argus", "/card", "/money", "/trading", "/insurance", "/solar/mine", "/meta-ads", "/studio", "/map", "/arcadia", "/zuber-pen", "/world/example/studio"]) {
    assert.deepEqual(launchRoute(path, {}), { kind: "redirect", href: "/" }, path);
  }
});

test("legacy HTTP APIs fail closed without redirecting a mutation", () => {
  for (const path of ["/api/market/sparkline", "/api/studio/propose", "/api/auth/meta/start", "/api/auth/meta/callback", "/api/avatar/generate"]) {
    assert.deepEqual(launchRoute(path, {}), { kind: "deny" }, path);
  }
});

test("project, invitations and assistant authorization routes remain reachable", () => {
  for (const path of ["/", "/worlds", "/worlds/new", "/world/id/room", "/world/id", "/world-invite/token", "/api/worlds/create", "/api/worlds/id/conversation", "/account", "/bot", "/communities", "/community/id", "/auth/callback", "/oauth/consent", "/mcp", "/.well-known/oauth-protected-resource", "/saved/token", "/parts/id/file.stl"]) {
    assert.deepEqual(launchRoute(path, {}), { kind: "allow" }, path);
  }
});

test("old identity and command links converge on the core homes", () => {
  assert.deepEqual(launchRoute("/sov-id", {}), { kind: "redirect", href: "/account" });
  assert.deepEqual(launchRoute("/start", {}), { kind: "redirect", href: "/account" });
  assert.deepEqual(launchRoute("/avatar", {}), { kind: "redirect", href: "/bot" });
  assert.deepEqual(launchRoute("/command", {}), { kind: "redirect", href: "/" });
});

test("experimental opt-in never enables money without its financial flags", () => {
  const env = { ENABLE_EXPERIMENTAL_FEATURES: "true" };
  assert.deepEqual(launchRoute("/studio", env), { kind: "allow" });
  assert.deepEqual(launchRoute("/world/id/studio", env), { kind: "allow" });
  assert.deepEqual(launchRoute("/packs/trading", env), { kind: "redirect", href: "/" });
  assert.deepEqual(launchRoute("/card", env), { kind: "redirect", href: "/" });
  assert.deepEqual(launchRoute("/money", { ...env, ENABLE_MONEY: "true" }), { kind: "allow" });
});

test("prefix matching does not block unrelated routes", () => {
  for (const path of ["/cardinal", "/studio-notes", "/world/id/studio-notes", "/api/marketplace"]) {
    assert.deepEqual(launchRoute(path, {}), { kind: "allow" });
  }
});
