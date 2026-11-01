import assert from "node:assert/strict";
import { it } from "node:test";
import {
  BRAIN_OPTIONS,
  BRAIN_POLICY_KID,
  BRAIN_POLICY_OPEN,
  DEFAULT_BRAIN,
  FOUNDER_BRAIN,
  brainPolicyCompany,
  defaultBrainFor,
  freeModel,
  isFreeModel,
  resolveBrain,
} from "../../lib/bot/brain";

it("everyone defaults to free; the founder defaults to his own apps", () => {
  assert.deepEqual(defaultBrainFor(), DEFAULT_BRAIN);
  assert.equal(defaultBrainFor().kind, "free");
  assert.deepEqual(defaultBrainFor({ isFounder: true }), FOUNDER_BRAIN);
  assert.equal(defaultBrainFor({ isFounder: true }).kind, "own_app");
});

it("credits is honestly coming_soon; the other three are ready", () => {
  assert.equal(BRAIN_OPTIONS.credits.status, "coming_soon");
  for (const k of ["own_app", "byok", "free"] as const) assert.equal(BRAIN_OPTIONS[k].status, "ready");
});

it("free models are :free and env-overridable", () => {
  assert.ok(isFreeModel(freeModel("flash")));
  assert.ok(isFreeModel(freeModel("smart")));
  assert.equal(freeModel("flash", { OPENROUTER_FREE_MODEL: "x/y:free" }), "x/y:free");
  assert.equal(isFreeModel("anthropic/claude-sonnet-5.5"), false);
});

it("an open room allows any brain unchanged", () => {
  const byok = { kind: "byok", byokProvider: "anthropic" } as const;
  assert.deepEqual(resolveBrain(byok, BRAIN_POLICY_OPEN), { brain: byok, allowed: true });
});

it("a kid room forces Solve's free AI with a plain reason, and never blocks to nothing", () => {
  const r = resolveBrain({ kind: "byok", byokProvider: "openai" }, BRAIN_POLICY_KID);
  assert.equal(r.allowed, true);
  assert.equal(r.brain.kind, "free");
  assert.match(r.reason!, /only.*free|free AI/i);
});

it("a company room allows the connect methods it lists (free preserved as fallback)", () => {
  const policy = brainPolicyCompany(["anthropic/claude-sonnet-5.5"]);
  assert.equal(resolveBrain({ kind: "own_app" }, policy).allowed, true);
  assert.equal(resolveBrain({ kind: "credits" }, policy).brain.kind, "free", "credits not allowed → free fallback");
});
