// Addresses from before the rebuild land where that thing lives now; retired APIs are refused; and
// nothing can switch an old surface back on, because the code behind it is gone.
import assert from "node:assert/strict";
import { it } from "node:test";
import { launchRoute, rebuiltRoute } from "../../lib/product/routes";

const LIVE = ["/", "/account", "/space", "/workbench", "/control", "/login", "/world/id", "/world/id/record",
  "/confirm/token", "/world-invite/token", "/p/id", "/s/id", "/oauth/consent", "/mcp", "/auth/callback"];

it("lets every live address through untouched", () => {
  for (const path of LIVE) assert.deepEqual(launchRoute(path), { kind: "allow" }, path);
});

it("sends every retired address to where that thing lives now", () => {
  for (const [path, to] of [
    ["/projects", "/space"], ["/communities", "/space"], ["/community/abc", "/space"], ["/worlds/new", "/"],
    ["/bot", "/account"], ["/onboarding", "/account"], ["/sov-id", "/account"], ["/avatar", "/account"],
    ["/apps", "/control"], ["/money", "/"], ["/packs/trading", "/"], ["/studio", "/"], ["/map", "/"], ["/card", "/"],
    ["/world/id/room", "/world/id"], ["/world/id/ideas", "/world/id"], ["/world/id/studio", "/world/id"], ["/world/id/workbench", "/world/id"],
  ]) {
    assert.deepEqual(launchRoute(path), { kind: "redirect", href: to }, path);
    assert.equal(rebuiltRoute(path), to, path);
  }
});

it("refuses retired APIs outright", () => {
  for (const path of ["/api/market/sparkline", "/api/studio/propose", "/api/auth/meta/start", "/api/avatar/generate",
    "/api/bot/chat", "/api/ideas/expand", "/api/passport/connect", "/api/reason", "/api/worlds/create"]) {
    assert.deepEqual(launchRoute(path), { kind: "deny" }, path);
  }
});

it("matches whole path segments only, so a live address that merely starts the same is never caught", () => {
  for (const path of ["/spacecraft", "/moneyball", "/cardinal", "/studios-of-ours", "/api/bots"]) {
    assert.deepEqual(launchRoute(path), { kind: "allow" }, path);
  }
});
