import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseWorkIntent, workStatusLabel } from "../../lib/work/intent";

const id = "46dad395-3ba1-4d2c-81cb-55e4d99c8167";
const input = () => ({ title: "Build a solar proposal", objective: "One usable proposal a customer can reopen.", independentReview: null, requestId: id });

test("a human intention becomes a bounded task input without starting a model", () => {
  const result = parseWorkIntent(input());
  assert.deepEqual(result, {
    title: "Build a solar proposal",
    objective: "One usable proposal a customer can reopen.",
    independentReview: false,
    requestId: id,
  });
});

test("blank objective reuses title and independent verification requires explicit choice", () => {
  const value = { ...input(), title: "   Create a project plan   ", objective: " ", independentReview: "yes" };
  assert.deepEqual(parseWorkIntent(value), {
    title: "Create a project plan", objective: "Create a project plan",
    independentReview: true, requestId: id,
  });
});

test("malformed, duplicated or overlarge human inputs never become kernel operations", () => {
  const changes = [
    { title: " " },
    { title: "ab" },
    { title: "a".repeat(161) },
    { objective: "x".repeat(2001) },
    { title: "bad\u0001text" },
    { objective: "bad\u0000text" },
    { independentReview: "no" },
    { requestId: "not-an-id" },
    { requestId: "" },
  ];
  for (const bad of changes) {
    assert.throws(() => parseWorkIntent({ ...input(), ...bad }), Error);
  }
});

test("all kernel task states have readable labels without inventing progress", () => {
  for (const status of ["created", "ready", "claimed", "in_progress", "blocked", "waiting_external", "verifying", "escalated", "completed", "failed", "needs_reconciliation", "cancelled"] as const) {
    assert.ok(workStatusLabel(status).length > 3, status);
  }
  assert.equal(workStatusLabel("created"), "Proposed");
  assert.equal(workStatusLabel("completed"), "Recorded complete");
});

test("the app consumes kernel authority and tasks without a parallel task store", () => {
  const action = readFileSync("app/world/[worldId]/work/actions.ts", "utf8");
  const page = readFileSync("app/world/[worldId]/work/page.tsx", "utf8");
  const room = readFileSync("app/world/[worldId]/room/view.tsx", "utf8");
  assert.match(action, /kernel\.authorize\(\{ capability: "task\.create"/);
  assert.match(action, /decision\.decision !== "ALLOW"/);
  assert.match(action, /kernel\.createTask\(/);
  assert.match(action, /requiredCapability: "task\.perform"/);
  assert.match(action, /risk: "medium"/);
  assert.match(action, /reversible: false/);
  assert.match(action, /riskAssessment: "unclassified"/);
  assert.match(action, /aiDispatch: "off"/);
  assert.match(action, /idempotencyKey: intent\.requestId/);
  assert.match(action, /verification: intent\.independentReview \? "distinct_actor" : "none"/);
  assert.match(page, /kernel\.readTasks\(world\.scope\)/);
  assert.match(page, /work\.tasks === null/);
  assert.match(page, /No AI has been started or given new permissions/);
  assert.match(room, /\$\{projectUrl\}\/work/);
});
