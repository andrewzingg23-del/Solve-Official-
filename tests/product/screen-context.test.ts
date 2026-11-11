// Screen context: the console tells the bot where the person stands, so "this"
// and "here" resolve. Pure derivation — it describes a place, never grants one.
import assert from "node:assert/strict";
import { it } from "node:test";
import {
  describeScreen,
  screenFromPath,
  validateScreenContext,
  worldIdFromPath,
  SCREEN_LIMITS,
} from "../../lib/product/screen-context";

it("names the place for each known route, longest prefix winning", () => {
  assert.equal(screenFromPath("/").label, "their projects list");
  assert.equal(screenFromPath("/world/abc").label, "a project workspace");
  assert.equal(screenFromPath("/world/abc/room").label, "a project's shared room");
  assert.equal(screenFromPath("/world/abc/studio").label, "a project's studio");
  assert.equal(screenFromPath("/bot").label, "their personal AI's page");
  assert.equal(screenFromPath("/communities").label, "communities");
});

it("falls back to a generic label rather than failing on an unknown route", () => {
  assert.equal(screenFromPath("/some/new/surface").label, "a page in solve");
  assert.equal(screenFromPath("").path, "/");
});

it("carries the project id only when the route has an id-shaped one", () => {
  assert.equal(screenFromPath("/world/abc-123").worldId, "abc-123");
  assert.equal(screenFromPath("/bot").worldId, undefined);
  assert.equal(worldIdFromPath("/world/../etc/passwd"), null);
  assert.equal(worldIdFromPath("/world/" + "x".repeat(SCREEN_LIMITS.worldId + 1)), null);
});

it("clamps the focus to its limit and drops an empty one", () => {
  assert.equal(screenFromPath("/bot", "   ").focus, undefined);
  assert.equal(screenFromPath("/bot", "the draft card").focus, "the draft card");
  assert.equal(screenFromPath("/bot", "x".repeat(SCREEN_LIMITS.focus + 1)).focus, undefined);
});

it("validates a context off the wire and rejects a malformed one", () => {
  const ok = validateScreenContext({ path: "/world/abc", label: "a project workspace", worldId: "abc" });
  assert.ok(ok);
  assert.equal(ok.worldId, "abc");
  assert.equal(validateScreenContext(null), null);
  assert.equal(validateScreenContext("/world/abc"), null);
  assert.equal(validateScreenContext([]), null);
  assert.equal(validateScreenContext({ path: "/world/abc" }), null);
  assert.equal(validateScreenContext({ path: "x".repeat(SCREEN_LIMITS.path + 1), label: "a" }), null);
});

it("drops a worldId that is not id-shaped instead of rejecting the context", () => {
  const ctx = validateScreenContext({ path: "/world/x", label: "a project workspace", worldId: "../../etc" });
  assert.ok(ctx);
  assert.equal(ctx.worldId, undefined);
});

it("describes the place as position, explicitly not as instructions", () => {
  const text = describeScreen(screenFromPath("/world/abc/room", "a draft website"));
  assert.match(text, /shared room/);
  assert.match(text, /\/world\/abc\/room/);
  assert.match(text, /abc/);
  assert.match(text, /a draft website/);
  assert.match(text, /not an instruction/);
  assert.equal(describeScreen(null), "");
});
