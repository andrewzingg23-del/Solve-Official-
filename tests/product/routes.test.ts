import test from "node:test";
import assert from "node:assert/strict";
import { launchRoute } from "../../lib/product/routes";

test("launch excludes nested legacy financial and experimental pages", () => {
  for (const path of ["/packs", "/packs/trading", "/packs/trading/argus", "/card", "/money", "/trading", "/insurance", "/solar/mine", "/meta-ads", "/studio", "/map", "/arcadia", "/zuber-pen"]) {
    assert.deepEqual(launchRoute(path, {}), { kind: "redirect", href: "/" }, path);
  }
  // An older view of a thing opens its rebuilt record rather than Home.
  assert.deepEqual(launchRoute("/world/example/studio", {}), { kind: "redirect", href: "/world/example/record" });
});

test("legacy HTTP APIs fail closed without redirecting a mutation", () => {
  for (const path of ["/api/market/sparkline", "/api/studio/propose", "/api/auth/meta/start", "/api/auth/meta/callback", "/api/avatar/generate"]) {
    assert.deepEqual(launchRoute(path, {}), { kind: "deny" }, path);
  }
});

test("the rebuilt destinations, links from other people, and every API stay reachable", () => {
  for (const path of ["/", "/account", "/space", "/workbench", "/control", "/login", "/world/id/record", "/confirm/token",
    "/world-invite/token", "/api/worlds/create", "/api/worlds/id/conversation", "/auth/callback", "/oauth/consent", "/mcp",
    "/.well-known/oauth-protected-resource", "/parts/id/file.stl"]) {
    assert.deepEqual(launchRoute(path, {}), { kind: "allow" }, path);
  }
});

test("every screen not yet rebuilt opens the rebuilt destination it belongs to, so nothing old is seen", () => {
  const expected: Array<[string, string]> = [
    ["/projects", "/space"], ["/communities", "/space"], ["/community/id", "/space"],
    ["/worlds", "/"], ["/worlds/new", "/"], ["/saved/token", "/"],
    ["/bot", "/account"], ["/onboarding", "/account"], ["/personalize/instagram", "/account"],
    ["/apps", "/control"],
    ["/world/id", "/world/id/record"], ["/world/id/room", "/world/id/record"], ["/world/id/ideas", "/world/id/record"],
    ["/world/id/workbench", "/world/id/record"], ["/world/id/studio", "/world/id/record"],
  ];
  for (const [path, href] of expected) assert.deepEqual(launchRoute(path, {}), { kind: "redirect", href }, path);
});

test("old identity and command links converge on the core homes", () => {
  assert.deepEqual(launchRoute("/sov-id", {}), { kind: "redirect", href: "/account" });
  assert.deepEqual(launchRoute("/start", {}), { kind: "redirect", href: "/account" });
  assert.deepEqual(launchRoute("/avatar", {}), { kind: "redirect", href: "/account" });
  assert.deepEqual(launchRoute("/command", {}), { kind: "redirect", href: "/" });
});

test("experimental opt-in never enables money without its financial flags", () => {
  const env = { ENABLE_EXPERIMENTAL_FEATURES: "true" };
  assert.deepEqual(launchRoute("/studio", env), { kind: "allow" });
  // The old studio view of a thing is not part of the rebuilt experience even with the flag on.
  assert.deepEqual(launchRoute("/world/id/studio", env), { kind: "redirect", href: "/world/id/record" });
  assert.deepEqual(launchRoute("/packs/trading", env), { kind: "redirect", href: "/" });
  assert.deepEqual(launchRoute("/card", env), { kind: "redirect", href: "/" });
  assert.deepEqual(launchRoute("/money", { ...env, ENABLE_MONEY: "true" }), { kind: "allow" });
});

test("prefix matching does not block unrelated routes", () => {
  for (const path of ["/cardinal", "/studio-notes", "/world/id/studio-notes", "/api/marketplace"]) {
    assert.deepEqual(launchRoute(path, {}), { kind: "allow" });
  }
});
