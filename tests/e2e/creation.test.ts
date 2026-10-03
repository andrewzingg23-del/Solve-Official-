// SOV improving SOV: a Class A build proposal becomes an engineering task; a builder writes the
// change in an isolated workspace; CI runs it against a fresh Arcadia simulation; a reviewer of
// another party authorizes promotion; promotion applies exactly the reviewed change; the promoted
// change is observed against the live kernel; the task closes. Anything above Class A stops at a
// human because no agent holds the capability to promote it.
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { kernelClient, type Kernel } from "../../lib/kernel/client";
import { localSupabase, user } from "../../lib/kernel/local";
import { superviseReconciliation } from "../../lib/ops/collective";
import { installCreation, leaseEngineering, openEngineeringTask, promoteAndObserve, runBuilder, runCi, runReviewer, type ChangeSet, type EngineeringInputs } from "../../lib/ops/creation";
import { learnFromReconciliations, OPS_SCOPE } from "../../lib/ops/learning";
import { readTask } from "../../lib/ops/reconcile";
import { buildArcadia, PERSONAS } from "../support/arcadia";
import { operationsWorld } from "../support/operations";
import { directoryWorkspace as directory } from "../support/workspace";

// One Arcadia simulation for every CI run in this file: same seed, so the same civilization.
let simulation: Kernel;
before(async () => {
  const { k } = await buildArcadia();
  simulation = kernelClient(localSupabase(k, user(PERSONAS.steward)));
});

async function world() {
  const w = await operationsWorld();
  for (let i = 0; i < 2; i++) await w.lostPayment();
  const collective = { trustService: w.trustService, opsService: w.opsService, workerId: w.workerId, verifierId: w.verifierId };
  await superviseReconciliation({ rail: w.p.rail, chain: "litesvm", collective, as: w.as, staleAfterMs: 0 });
  const learned = (await learnFromReconciliations(w.ops, { railScope: w.scope }))!;
  const creation = await installCreation(w.steward, { opsService: w.opsService, trustService: w.trustService, as: w.as, read: [w.scope] });
  const taskId = await openEngineeringTask(w.ops, learned.proposalEventId);
  await leaseEngineering(w.ops, w.trust, { taskId, builderId: creation.builderId, reviewerId: creation.reviewerId, rail: w.scope });
  const workspace = directory();
  const target = directory();
  const builder = w.as(creation.builderId);
  const reviewer = w.as(creation.reviewerId);
  const ci = w.as(creation.ciService);
  return { w, learned, taskId, workspace, target, builder, reviewer, ci, creation, simulate: async () => simulation };
}

describe("the Class A creation loop", () => {
  it("builds, tests in Arcadia, reviews, promotes and observes a change from a recorded proposal", async () => {
    const c = await world();
    const task = await readTask(c.w.ops, OPS_SCOPE, c.taskId);
    assert.equal(task.cause_ref, `event:${c.learned.proposalEventId}`, "why was this built? the proposal, and through it the friction");
    assert.equal((task.inputs as EngineeringInputs).change_class, "A");

    const built = await runBuilder(c.builder, { taskId: c.taskId, workspace: c.workspace });
    assert.equal(built.changeClass, "A");
    assert.equal(built.decision, "REQUIRE_SECOND_AUTHORITY");

    // Review needs CI first; CI runs the change against a fresh Arcadia.
    assert.match((await runReviewer(c.reviewer, { taskId: c.taskId, workspace: c.workspace, target: c.target })).reasons.join(), /no CI record/);
    const ci = await runCi(c.ci, { taskId: c.taskId, workspace: c.workspace, simulate: c.simulate });
    assert.deepEqual(ci.problems, []);
    assert.equal(ci.observed?.reconciliations, 2, "the simulation's own lost replies");

    // The builder cannot authorize its own promotion; the reviewer's party can.
    assert.equal(await c.builder.approveAction(built.actionId!), "proposed");
    const review = await runReviewer(c.reviewer, { taskId: c.taskId, workspace: c.workspace, target: c.target });
    assert.deepEqual(review.reasons, []);
    assert.equal(review.approved, true);

    const observed = await promoteAndObserve(c.builder, { taskId: c.taskId, workspace: c.workspace, target: c.target, live: c.builder });
    assert.equal(observed.matches, true);
    assert.deepEqual([observed.observed.reconciliations, observed.observed.open], [2, 0]);
    assert.equal(await c.target.read("scripts/diagnostics/lost-responses.ts"), await c.workspace.read("scripts/diagnostics/lost-responses.ts"));

    const closing = await runReviewer(c.reviewer, { taskId: c.taskId, workspace: c.workspace, target: c.target });
    assert.deepEqual(closing.reasons, []);
    assert.equal(closing.closed, true);
    const transitions = await c.w.k.owner("select status, actor_id from kernel.task_transitions where task_id = $1 order by id", [c.taskId]);
    assert.deepEqual(transitions.map((t) => t.status), ["created", "ready", "claimed", "in_progress", "verifying", "completed"]);
    assert.equal(transitions.at(-1)!.actor_id, c.creation.reviewerId);
    const types = (await c.w.ops.readEvents(OPS_SCOPE, { limit: 500 })).map((e) => e.type).filter((t) => t.startsWith("ops."));
    assert.deepEqual(types, ["ops.learning.recorded", "ops.build_proposal.proposed", "ops.ci.completed", "ops.observation.recorded"]);
  });

  it("stops at a human when the change is above Class A", async () => {
    for (const [path, cls] of [["lib/money/payment.ts", "C"], ["lib/ops/changes.ts", "D"]] as const) {
      const c = await world();
      const sneaky = (inputs: EngineeringInputs): ChangeSet => ({ files: [{ path, content: "// widened\n" }, { path: inputs.allowed_paths[1], content: "export {};\n" }], summary: "more than asked" });
      const built = await runBuilder(c.builder, { taskId: c.taskId, workspace: c.workspace, build: sneaky });
      assert.equal(built.changeClass, cls);
      assert.equal(built.decision, "DENY", `no agent holds engineering.promote.${cls.toLowerCase()}`);
      const task = await readTask(c.w.ops, OPS_SCOPE, c.taskId);
      assert.equal(task.status, "escalated");
      assert.match(task.detail, new RegExp(`Class ${cls}`));
      assert.equal(await c.target.read(path), null, "nothing was promoted");
    }
  });

  it("never promotes a change that differs from the one CI and review saw", async () => {
    const c = await world();
    await runBuilder(c.builder, { taskId: c.taskId, workspace: c.workspace });
    await runCi(c.ci, { taskId: c.taskId, workspace: c.workspace, simulate: c.simulate });
    await c.workspace.write([{ path: "scripts/diagnostics/lost-responses.ts", content: "export async function diagnose() { return { reconciliations: 99 }; }\n" }]);
    const review = await runReviewer(c.reviewer, { taskId: c.taskId, workspace: c.workspace, target: c.target });
    assert.equal(review.approved, false);
    assert.match(review.reasons.join(), /workspace differs/);
  });

  it("fails CI for a diagnostic that writes", async () => {
    const c = await world();
    const writer = (inputs: EngineeringInputs): ChangeSet => ({
      files: [{ path: inputs.allowed_paths[1], content: "export async function diagnose(kernel) { await kernel.recordEvent({ type: 'x.y', scope: 'system' }); return {}; }\n" }],
      summary: "a diagnostic that writes",
    });
    await runBuilder(c.builder, { taskId: c.taskId, workspace: c.workspace, build: writer });
    const ci = await runCi(c.ci, { taskId: c.taskId, workspace: c.workspace, simulate: c.simulate });
    assert.equal(ci.passed, false);
    assert.match(ci.problems.join(), /calls a kernel write/);
    assert.match((await runReviewer(c.reviewer, { taskId: c.taskId, workspace: c.workspace, target: c.target })).reasons.join(), /CI failed/);
  });
});
