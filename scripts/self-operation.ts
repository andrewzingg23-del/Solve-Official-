// SOV operating SOV, printed step by step.
//   npx tsx scripts/self-operation.ts
// A payment's chain response is lost; SOV detects it, works it under a task-limited lease, verifies
// it with an agent of another party, reconciles it exactly once and closes the task. After two such
// failures it records what it learned and one Class A build proposal. Kernel: the real migrations
// in PGlite. Chain: LiteSVM running the real SPL programs. Test assets only.
import { learnFromReconciliations } from "../lib/ops/learning";
import { actionFor, detectUnsettledPayments, leaseForTask, paymentReconciler, readTask, RECONCILE, runReconcileVerifier, runReconcileWorker } from "../lib/ops/reconcile";
import { operationsWorld } from "../tests/support/operations";

const short = (id: string) => id.slice(0, 8);

async function main() {
  console.log("SOV self-operation (local: PGlite kernel + LiteSVM chain, test assets)\n");
  const w = await operationsWorld();
  console.log(`Actors    payment service ${short(w.p.paymentService)} with worker agent ${short(w.workerId)}`);
  console.log(`          trust service ${short(w.trustService)} with verifier agent ${short(w.verifierId)} (a distinct party)`);
  console.log(`          policy: ${RECONCILE.capability} on ${w.scope} needs a second authority holding ${RECONCILE.approve}\n`);

  let pass = true;
  for (let round = 1; round <= 2; round++) {
    const paymentId = await w.lostPayment();
    const before = await w.p.alice.readPayment(paymentId);
    console.log(`Signal ${round}  payment ${short(paymentId)}: ${before.status} (the transaction executed; its response was lost)`);

    const [taskId] = await detectUnsettledPayments(w.payments, "litesvm", { staleAfterMs: 0 });
    const task = await readTask(w.payments, w.scope, taskId);
    console.log(`Task      ${short(taskId)} "${task.title}" opened by the monitor; caused by ${task.cause_ref}`);
    console.log(`          risk ${task.risk}, ${task.reversible ? "reversible" : "irreversible"}, evidence ${task.evidence_bases.join(", ")}, verification ${task.verification}`);

    const { expiresAt } = await leaseForTask(w.payments, { agentId: w.workerId, capability: RECONCILE.capability, scope: w.scope, taskId });
    await leaseForTask(w.trust, { agentId: w.verifierId, capability: "task.verify", scope: w.scope, taskId });
    await w.trust.issueLease({ grantee: w.verifierId, capability: RECONCILE.approve, scope: w.scope, taskRef: `task:${taskId}`, expiresAt });
    const outside = await w.worker.authorize({ capability: RECONCILE.capability, scope: w.scope });
    console.log(`Lease     worker: ${RECONCILE.capability} for task ${short(taskId)} only, until ${expiresAt.toISOString()}`);
    console.log(`          outside the task: ${outside.decision} (${outside.reasons.join("; ")})`);

    const work = () => runReconcileWorker(w.worker, { taskId, scope: w.scope, gateway: w.market.chain.gateway, enact: paymentReconciler(w.p.rail, w.scope) });
    const verify = () => runReconcileVerifier(w.verifier, { taskId, scope: w.scope, gateway: w.market.chain.gateway });

    const proposed = await work();
    const finding = proposed.action!.payload.finding as { marker: string; executed: boolean };
    console.log(`Work      worker observed marker ${finding.marker}: ${finding.executed ? "present" : "absent"}`);
    console.log(`          proposed ${RECONCILE.kind}: ${proposed.action!.decision}; waiting for ${proposed.waiting}`);

    const approval = await verify();
    console.log(`Verify    verifier re-derived the marker, read the chain and the kernel: ${approval.approved ? "consistent; authorized" : approval.reasons.join("; ")}`);

    const enacted = await work();
    const payment = await w.p.alice.readPayment(paymentId);
    console.log(`Enact     payment service reconciled for the authorized action: payment ${payment.status}`);
    console.log(`          action ${enacted.action!.status}; task ${enacted.task.status}`);

    const closing = await verify();
    const action = (await actionFor(w.payments, w.scope, taskId))!;
    console.log(`Close     verifier checked the consequence: ${closing.closed ? closing.task.detail : closing.reasons.join("; ")}`);
    console.log(`          task ${closing.task.status}; action ${action.status}\n`);
    pass &&= closing.closed && payment.status === "confirmed";
  }

  const learned = await learnFromReconciliations(w.ops, { railScope: w.scope });
  if (!learned) throw new Error("no learning recorded");
  console.log(`Learn     ${learned.tasks.length} completed reconciliations after lost responses -> learning event ${short(learned.learningEventId)}`);
  console.log(`Proposal  ${short(learned.proposalEventId)} Class ${learned.proposal.change_class}: ${learned.proposal.expected_outcome}`);
  console.log(`          reuse: ${learned.proposal.reuse.decision} ${learned.proposal.reuse.existing.join(", ")}`);
  for (const r of learned.proposal.class_reasons) console.log(`          ${r}`);
  console.log(`          promotion: ${learned.proposal.promotion}`);
  console.log(`          rollback: ${learned.proposal.rollback}`);

  const bob = await w.bobUsd();
  console.log(`\nBob holds ${bob} DEV-USDC minor units: two payments, each paid exactly once.`);
  pass &&= learned.proposal.change_class === "A" && bob === BigInt(20_000_000);
  console.log(`\n${pass ? "PASS" : "FAIL"}: SOV operated SOV`);
  process.exit(pass ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
