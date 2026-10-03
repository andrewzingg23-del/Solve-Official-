// SOV operates SOV: a recurring internal failure (a payment whose chain response was lost) becomes
// an operational task, a bounded worker under a task-limited lease investigates and proposes, an
// independent verifier of another party authorizes, the payment service performs the consequence
// only for that authorized action, the verifier confirms it occurred, and the task closes. Repeated
// friction then becomes a learning event and a Class A build proposal.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { KernelError, kernelClient } from "../../lib/kernel/client";
import { learnFromReconciliations, OPS_SCOPE } from "../../lib/ops/learning";
import { actionFor, detectUnsettledPayments, leaseForTask, paymentReconciler, readTask, RECONCILE, runReconcileVerifier, runReconcileWorker } from "../../lib/ops/reconcile";
import { service } from "../kernel/harness";
import { USD } from "../support/payment-fixture";
import { pgliteSupabase } from "../support/pglite-supabase";
import { operationsWorld } from "../support/operations";

const forbidden = (error: unknown) => {
  assert.ok(error instanceof KernelError, `expected KernelError, got ${error}`);
  assert.equal(error.name, "forbidden", error.message);
  return true;
};

async function opened(w: Awaited<ReturnType<typeof operationsWorld>>) {
  const [taskId] = await detectUnsettledPayments(w.payments, "litesvm", { staleAfterMs: 0 });
  await leaseForTask(w.payments, { agentId: w.workerId, capability: RECONCILE.capability, scope: w.scope, taskId });
  await leaseForTask(w.trust, { agentId: w.verifierId, capability: "task.verify", scope: w.scope, taskId });
  await w.trust.issueLease({ grantee: w.verifierId, capability: RECONCILE.approve, scope: w.scope, taskRef: `task:${taskId}`, expiresAt: new Date(Date.now() + 900_000) });
  const work = () => runReconcileWorker(w.worker, { taskId, scope: w.scope, gateway: w.market.chain.gateway, enact: paymentReconciler(w.p.rail, w.scope) });
  const verify = () => runReconcileVerifier(w.verifier, { taskId, scope: w.scope, gateway: w.market.chain.gateway });
  return { taskId, work, verify };
}

describe("SOV self-operation", () => {
  it("a lost payment response is detected, worked, verified by another party, reconciled once and closed", async () => {
    const w = await operationsWorld();
    const paymentId = await w.lostPayment();
    assert.equal(await w.bobUsd(), USD(10), "it executed; only the reply was lost");

    // Detection is deterministic and idempotent: one task per unsettled payment attempt.
    const { taskId, work, verify } = await opened(w);
    assert.deepEqual(await detectUnsettledPayments(w.payments, "litesvm", { staleAfterMs: 0 }), []);
    const task = await readTask(w.payments, w.scope, taskId);
    assert.equal(task.status, "ready");
    assert.equal(task.verification, "distinct_party");
    assert.equal((task.inputs as { payment_id: string }).payment_id, paymentId);
    assert.match(task.cause_ref!, /^event:/);

    // Work: claim, observe, propose. Reconciliation is governed, so it waits for a second authority.
    const first = await work();
    assert.equal(first.waiting, "a second authority");
    assert.equal(first.action!.decision, "REQUIRE_SECOND_AUTHORITY");
    assert.deepEqual(first.action!.payload.finding, { cluster: "litesvm", marker: (first.action!.payload.finding as { marker: string }).marker, executed: true });

    // The worker cannot authorize itself, and its lease reaches nothing beyond this task.
    // (The proposer already counts as the first authority: approving again changes nothing.)
    assert.equal(await w.worker.approveAction(first.action!.action_id), "proposed");
    assert.equal((await w.worker.readAction(first.action!.action_id)).status, "proposed");
    await assert.rejects(w.worker.recordPayment({ paymentId, attempt: 1, status: "failed", detail: "no" }), forbidden);
    await assert.rejects(w.worker.readPayment(paymentId), forbidden);
    const elsewhere = await w.worker.authorize({ capability: RECONCILE.capability, scope: w.scope });
    assert.equal(elsewhere.decision, "DENY", "outside its task the lease does not apply");
    // The payment service performs nothing for an action that is not authorized.
    await assert.rejects(paymentReconciler(w.p.rail, w.scope)(first.action!.action_id), /only an authorized action/);

    // Verify: independent observation, then authorization.
    const approval = await verify();
    assert.deepEqual(approval.reasons, []);
    assert.equal(approval.approved, true);
    assert.equal(approval.action!.status, "authorized");

    // Consequence: enacted through the payment service, recorded with chain evidence.
    const second = await work();
    assert.equal(second.task.status, "verifying");
    assert.equal(second.action!.status, "completed");
    const payment = await w.p.alice.readPayment(paymentId);
    assert.equal(payment.status, "confirmed");

    // The verifier checks the consequence happened, then closes the task.
    const closing = await verify();
    assert.deepEqual(closing.reasons, []);
    assert.equal(closing.closed, true);
    assert.equal(closing.task.status, "completed");
    assert.equal(await w.bobUsd(), USD(10), "paid exactly once");

    const transitions = await w.k.owner(
      "select status, actor_id from kernel.task_transitions where task_id = $1 order by id",
      [taskId],
    );
    assert.deepEqual(transitions.map((t) => t.status), ["created", "ready", "claimed", "in_progress", "verifying", "completed"]);
    assert.equal(transitions.at(-1)!.actor_id, w.verifierId, "closed by the verifier, not the worker");
    const after = await w.worker.authorize({ capability: RECONCILE.capability, scope: w.scope, taskRef: `task:${taskId}` });
    assert.equal(after.decision, "DENY", "authority limited to a task ends with it");
    assert.match(after.reasons.join(), /is closed/);
    const confirmations = await w.k.owner("select count(*)::int as n from kernel.payment_transitions where payment_id = $1 and status = 'confirmed'", [paymentId]);
    assert.equal(confirmations[0].n, 1);
    assert.equal((await kernelClient(pgliteSupabase(w.k, service)).verifyChain()).ok, true);
  });

  it("a finding that does not match the chain is never authorized", async () => {
    const w = await operationsWorld();
    await w.lostPayment();
    const { taskId, verify } = await opened(w);
    await w.worker.transitionTask({ taskId, status: "claimed" });
    await w.worker.transitionTask({ taskId, status: "in_progress" });
    const task = await readTask(w.worker, w.scope, taskId);
    const inputs = task.inputs as { payment_id: string; attempt: number; tx_signature: string };
    await w.worker.proposeAction({
      kind: RECONCILE.kind,
      capability: RECONCILE.capability,
      scope: w.scope,
      taskRef: `task:${taskId}`,
      payload: { payment_id: inputs.payment_id, attempt: inputs.attempt, tx_signature: inputs.tx_signature, finding: { cluster: "litesvm", marker: "11111111111111111111111111111111", executed: false } },
    });
    const verdict = await verify();
    assert.equal(verdict.approved, false);
    assert.match(verdict.reasons.join(), /does not match the chain/);
    assert.equal((await actionFor(w.verifier, w.scope, taskId))!.status, "proposed");
  });

  it("a crash after the payment is recorded resumes without recording it again", async () => {
    const w = await operationsWorld();
    const paymentId = await w.lostPayment();
    const { taskId, work, verify } = await opened(w);
    await work();
    await verify();
    // The worker begins, the payment service reconciles, then the worker dies before settling.
    const action = (await actionFor(w.worker, w.scope, taskId))!;
    await w.worker.beginAction(action.action_id);
    await paymentReconciler(w.p.rail, w.scope)(action.action_id);

    const resumed = await work();
    assert.equal(resumed.action!.status, "completed");
    assert.equal(resumed.task.status, "verifying");
    assert.equal((await verify()).closed, true);
    const confirmations = await w.k.owner("select count(*)::int as n from kernel.payment_transitions where payment_id = $1 and status = 'confirmed'", [paymentId]);
    assert.equal(confirmations[0].n, 1);
  });

  it("a revoked lease stops the worker before the consequence", async () => {
    const w = await operationsWorld();
    await w.lostPayment();
    const [taskId] = await detectUnsettledPayments(w.payments, "litesvm", { staleAfterMs: 0 });
    const { lease } = await leaseForTask(w.payments, { agentId: w.workerId, capability: RECONCILE.capability, scope: w.scope, taskId });
    await leaseForTask(w.trust, { agentId: w.verifierId, capability: "task.verify", scope: w.scope, taskId });
    await w.trust.issueLease({ grantee: w.verifierId, capability: RECONCILE.approve, scope: w.scope, taskRef: `task:${taskId}` });
    const run = () => runReconcileWorker(w.worker, { taskId, scope: w.scope, gateway: w.market.chain.gateway, enact: paymentReconciler(w.p.rail, w.scope) });
    await run();
    assert.equal((await runReconcileVerifier(w.verifier, { taskId, scope: w.scope, gateway: w.market.chain.gateway })).approved, true);

    await w.payments.revokeGrant(lease, "worker reassigned");
    await assert.rejects(run(), forbidden);
    const action = (await actionFor(w.payments, w.scope, taskId))!;
    assert.equal(action.status, "authorized", "nothing was enacted");
  });

  it("repeated friction becomes a learning event and a Class A build proposal", async () => {
    const w = await operationsWorld();
    for (let i = 0; i < 2; i++) {
      await w.lostPayment();
      const { work, verify } = await opened(w);
      await work();
      await verify();
      await work();
      assert.equal((await verify()).closed, true);
    }
    const learned = await learnFromReconciliations(w.ops, { railScope: w.scope });
    assert.ok(learned);
    assert.equal(learned.tasks.length, 2);
    assert.equal(learned.proposal.change_class, "A");
    assert.equal(learned.proposal.reuse.decision, "extend");
    assert.ok(learned.proposal.evidence.includes(`event:${learned.learningEventId}`));

    const again = await learnFromReconciliations(w.ops, { railScope: w.scope });
    assert.equal(again!.proposalEventId, learned.proposalEventId, "the same evidence yields the same proposal");
    const events = await w.ops.readEvents(OPS_SCOPE);
    assert.deepEqual(events.filter((e) => e.type.startsWith("ops.")).map((e) => e.type), ["ops.learning.recorded", "ops.build_proposal.proposed"]);
  });
});
