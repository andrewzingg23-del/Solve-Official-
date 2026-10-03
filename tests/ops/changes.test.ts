// Change classes: the class comes from what a change touches, the most severe path wins, and the
// guardrails of autonomous creation cannot be lowered by the work they govern.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyChange, proposeBuild } from "../../lib/ops/changes";

const base = {
  problem: "p",
  cause: "c",
  evidence: ["event:00000000-0000-4000-8000-000000000000"],
  expected_outcome: "o",
  risk: "low" as const,
  reuse: { decision: "extend" as const, existing: ["lib/money/payment.ts"] },
  rollback: "revert",
};

describe("change classes", () => {
  it("tests and diagnostics alone are Class A", () => {
    assert.equal(classifyChange({ paths: ["tests/e2e/send-bob.test.ts", "scripts/diagnostics/lost-responses.ts"] }).cls, "A");
  });

  it("product code is B, and anything unnamed is never autonomous", () => {
    assert.equal(classifyChange({ paths: ["app/world/lenses.tsx"] }).cls, "B");
    assert.equal(classifyChange({ paths: ["README.md"] }).cls, "B");
  });

  it("payments, authority and identity are C; the most severe path wins", () => {
    assert.equal(classifyChange({ paths: ["tests/router/router.test.ts", "lib/router/router.ts"] }).cls, "C");
    assert.equal(classifyChange({ paths: ["lib/kernel/client.ts"] }).cls, "C");
    assert.equal(classifyChange({ paths: ["proxy.ts"] }).cls, "C");
    assert.equal(classifyChange({ paths: ["tests/x.test.ts"], capabilities: ["payment.send"] }).cls, "C");
  });

  it("kernel invariants, the constitution and the creation guardrails are D", () => {
    assert.equal(classifyChange({ paths: ["supabase/migrations/20270101000000_next.sql"] }).cls, "D");
    assert.equal(classifyChange({ paths: ["docs/MONETARY-CONSTITUTION.md"] }).cls, "D");
    assert.equal(classifyChange({ paths: ["lib/ops/changes.ts"] }).cls, "D", "no agent lowers its own bar");
    assert.equal(classifyChange({ paths: [".github/workflows/ci.yml"] }).cls, "D");
    assert.equal(classifyChange({ paths: ["tests/a.test.ts"], capabilities: ["kernel.policy.set"] }).cls, "D");
  });

  it("a proposal's class is computed, whatever it claims", () => {
    const sneaky = proposeBuild({ ...base, affected: { paths: ["tests/ops/changes.test.ts", "lib/ops/changes.ts"], capabilities: [] } });
    assert.equal(sneaky.change_class, "D");
    assert.match(sneaky.promotion, /never enact/);
    assert.ok(sneaky.class_reasons.some((r) => r.includes("lib/ops/changes.ts: D")));
  });

  it("a proposal needs evidence, a rollback path, and reuse before creation", () => {
    const affected = { paths: ["tests/a.test.ts"], capabilities: [] };
    assert.throws(() => proposeBuild({ ...base, affected, evidence: [] }), /causal evidence/);
    assert.throws(() => proposeBuild({ ...base, affected, rollback: " " }), /rollback/);
    assert.throws(() => proposeBuild({ ...base, affected, reuse: { decision: "create", existing: ["lib/money/payment.ts"] } }), /compose or extend/);
    assert.throws(() => classifyChange({ paths: [] }), /must name what it touches/);
  });
});
