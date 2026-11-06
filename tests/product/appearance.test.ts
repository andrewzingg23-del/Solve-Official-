import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_APPEARANCE, normalizeAppearance, proposeAppearance } from "../../lib/product/appearance";

test("appearance schema strips injected CSS, HTML and unknown fields", () => {
  const clean = normalizeAppearance({ tone: "mint", density: "compact", shape: "square", priority: "projects", css: "*{display:none}", grants: "all", code: "<script>" });
  assert.deepEqual(clean, { tone: "mint", density: "compact", shape: "square", priority: "projects" });
  assert.equal("css" in clean, false);
});
test("unknown palette cannot become arbitrary CSS", () => {
  assert.equal(normalizeAppearance({ tone: "url(javascript:alert(1))", density: "explosive" }).tone, "graphite");
  assert.equal(normalizeAppearance({ tone: "url(javascript:alert(1))", density: "explosive" }).density, "comfortable");
});
test("natural language style becomes a preview, never an action", () => {
  const request = proposeAppearance("Make it like a vintage skate magazine, tight and with square cards", DEFAULT_APPEARANCE);
  assert.equal(request.next.density, "compact");
  assert.equal(request.next.shape, "square");
  assert.equal(request.next.priority, "creations");
  assert.ok(request.changes.length > 0);
});
test("specific color overrides defaults while privacy is out of scope", () => {
  const p = proposeAppearance("Skate magazine with mint colors, prioritize my friends", DEFAULT_APPEARANCE);
  assert.equal(p.next.tone, "mint");
  assert.equal(p.next.priority, "community");
  assert.deepEqual(Object.keys(p.next).sort(), ["density", "priority", "shape", "tone"].sort());
});
test("unsupported request never produces invented style or permission changes", () => {
  const p = proposeAppearance("Send money, publish my profile and invite everyone", DEFAULT_APPEARANCE);
  assert.equal(p.supported, false);
  assert.equal(p.changes.length, 0);
  assert.deepEqual(p.next, DEFAULT_APPEARANCE);
});
test("reset only changes appearance tokens", () => {
  const p = proposeAppearance("reset to original", { tone: "violet", density: "compact", shape: "square", priority: "community" });
  assert.deepEqual(p.next, DEFAULT_APPEARANCE);
});
test("oversized requests are rejected", () => {
  assert.equal(proposeAppearance("x".repeat(10000), DEFAULT_APPEARANCE).supported, false);
});
