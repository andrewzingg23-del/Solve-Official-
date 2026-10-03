// The SOV operating collective, installed on a rail by its steward. Each service gets only what its
// role needs: the payment service runs reconciliation (opens tasks, leases its own worker agent), a
// separate trust service verifies (its agent is a distinct party), and the operations service learns
// from completed work. Reconciliation is a governed action that needs the trust party's approval.
import type { Kernel } from "../kernel/client";
import type { PaymentRail } from "../money/payment";
import { OPS_SCOPE } from "./learning";
import { detectUnsettledPayments, leaseForTask, paymentReconciler, RECONCILE, railScope, runReconcileVerifier, runReconcileWorker } from "./reconcile";

export type Collective = { trustService: string; opsService: string; workerId: string; verifierId: string };

export async function installCollective(steward: Kernel, input: { paymentService: string; chain: string; as(actorId: string): Kernel }): Promise<Collective> {
  const scope = railScope(input.chain);
  for (const capability of ["task.create", "kernel.read", RECONCILE.capability, "kernel.grant.issue"]) {
    await steward.issueGrant({ grantee: input.paymentService, capability, scope });
  }
  await steward.issueGrant({ grantee: input.paymentService, capability: "kernel.actor.create", scope: `actor:${input.paymentService}` });

  const trustService = await steward.createServiceActor("SOV trust");
  for (const capability of ["task.verify", RECONCILE.approve, "kernel.read", "kernel.grant.issue"]) {
    await steward.issueGrant({ grantee: trustService, capability, scope });
  }
  await steward.issueGrant({ grantee: trustService, capability: "kernel.actor.create", scope: `actor:${trustService}` });

  const opsService = await steward.createServiceActor("SOV operations");
  await steward.issueGrant({ grantee: opsService, capability: "kernel.read", scope });
  await steward.issueGrant({ grantee: opsService, capability: "ops.*", scope: OPS_SCOPE });
  await steward.issueGrant({ grantee: opsService, capability: "kernel.read", scope: OPS_SCOPE });

  await steward.setActionPolicy({ scope, capability: RECONCILE.capability, requirement: "second_authority", approverCapability: RECONCILE.approve, distinctBy: "party" });

  const workerId = await input.as(input.paymentService).spawnAgent({ label: "Reconciler", role: "system_agent", idempotencyKey: "reconciler" });
  const verifierId = await input.as(trustService).spawnAgent({ label: "Verifier", role: "system_agent", idempotencyKey: "verifier" });
  return { trustService, opsService, workerId, verifierId };
}

export type Supervised = { taskId: string; closed: boolean; reasons: string[] };

// One supervision pass: open a task for every unsettled payment, lease the worker and verifier for
// it, and run work and verification until it closes or stops with reasons.
export async function superviseReconciliation(input: {
  rail: PaymentRail;
  chain: string;
  collective: Collective;
  as(actorId: string): Kernel;
  staleAfterMs?: number;
}): Promise<Supervised[]> {
  const { rail, chain, collective } = input;
  const scope = railScope(chain);
  const trust = input.as(collective.trustService);
  const worker = input.as(collective.workerId);
  const verifier = input.as(collective.verifierId);
  const results: Supervised[] = [];
  for (const taskId of await detectUnsettledPayments(rail.kernel, chain, { staleAfterMs: input.staleAfterMs ?? 60_000 })) {
    const { expiresAt } = await leaseForTask(rail.kernel, { agentId: collective.workerId, capability: RECONCILE.capability, scope, taskId });
    await leaseForTask(trust, { agentId: collective.verifierId, capability: "task.verify", scope, taskId });
    await trust.issueLease({ grantee: collective.verifierId, capability: RECONCILE.approve, scope, taskRef: `task:${taskId}`, expiresAt });
    const work = () => runReconcileWorker(worker, { taskId, scope, gateway: rail.gateway, enact: paymentReconciler(rail, scope) });
    const verify = () => runReconcileVerifier(verifier, { taskId, scope, gateway: rail.gateway });
    let verdict = await verify();
    for (let step = 0; step < 4 && !verdict.closed; step++) {
      await work();
      verdict = await verify();
    }
    results.push({ taskId, closed: verdict.closed, reasons: verdict.reasons });
  }
  return results;
}
