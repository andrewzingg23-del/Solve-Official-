// Wayfinder: lean venture plans, honest numbers, titled from the objective.
import assert from "node:assert/strict";
import { it } from "node:test";
import { planVenture, ventureTitle } from "../../lib/world/wayfinder";

it("plans a lean venture with small honest numbers", () => {
  const plan = planVenture("Help me launch my insurance agency with the least upfront capital", true);
  assert.equal(plan.domain, "venture");
  assert.equal(plan.strategy, "lean");
  assert.deepEqual(plan.milestones.map((m) => m.title), ["Idea", "Validate", "First customers", "Systematize"]);
  assert.ok(plan.capitalUsd < 10_000, `lean stays under $10k, got $${plan.capitalUsd}`);
  assert.ok(plan.capitalUsd < plan.alternative.capitalUsd, "lean beats funded on capital");
  assert.ok(plan.missing.includes("customer_discovery"), "first missing capability is customers, not factories");
  assert.ok(plan.source.includes("ESTIMATE") || plan.source.includes("estimates"), "numbers labelled as estimates");
});

it("the funded path adds scale", () => {
  const plan = planVenture("launch my agency", false);
  assert.equal(plan.strategy, "funded");
  assert.ok(plan.milestones.some((m) => m.title === "Scale"));
});

it("titles the venture from the objective", () => {
  assert.equal(ventureTitle("Help me launch my insurance agency with the least upfront capital"), "Your Insurance Agency");
  assert.equal(ventureTitle("build my newsletter business from scratch"), "Your Newsletter Business");
  assert.equal(ventureTitle("do something"), "Your venture");
});
