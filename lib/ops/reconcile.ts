// SOV operating SOV, first loop: a payment whose outcome is unknown becomes an operational task.
//
//   monitor (deterministic code)  detects the unsettled payment and opens one task for it
//   worker (agent, payment party) claims it under a lease limited to that task, observes the
//                                 chain and proposes the reconciliation as a governed action
//   verifier (agent, trust party) re-derives everything itself and authorizes the action
//   payment service (code)        performs the reconciliation only for that authorized action
//   verifier                      checks the consequence occurred, then closes the task
//
// Each step is a kernel event with provenance, and each run reads its state back from the kernel,
// so a crash anywhere resumes without repeating a consequence.
import { address } from "@solana/kit";
import type { ChainGateway } from "../chain/gateway";
import type { Action, Evidence, Kernel, KernelEvent, Task } from "../kernel/client";
import { reconcilePayment, type PaymentRail, type PaymentResult } from "../money/payment";
import { sha256Hex } from "../money/settlement";
import { paymentMarkerAddress } from "../router/execute";

export const RECONCILE = {
  kind: "payment.reconcile",
  capability: "payment.reconcile",
  // Held by the verifying party; the action policy names it as the second authority.
  approve: "payment.reconcile.verify",
} as const;

export const railScope = (chain: string) => `system/chain:${chain}`;

// What the monitor hands the worker. Set by the task's creator; the worker cannot change it, so the
// verifier can check the worker against it.
export type ReconcileInputs = {
  payment_id: string;
  attempt: number;
  chain: string;
  payer_address: string;
  tx_signature: string;
  // The detail recorded with the unsettled status: why the outcome is unknown.
  signal: string;
};

export type Observation = { cluster: string; marker: string; executed: boolean };

export class OpsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpsError";
  }
}

async function readAllEvents(k: Kernel, scope: string) {
  const events: KernelEvent[] = [];
  for (let after = 0; ; ) {
    const page = await k.readEvents(scope, { afterSeq: after, limit: 500 });
    events.push(...page);
    if (page.length < 500) return events;
    after = page[page.length - 1].seq;
  }
}

async function latestPaymentEvents(k: Kernel, scope: string) {
  const latest = new Map<string, KernelEvent>();
  for (const e of await readAllEvents(k, scope)) {
    const id = e.payload.payment_id;
    if (e.type.startsWith("kernel.payment.") && typeof id === "string") latest.set(id, e);
  }
  return latest;
}

export async function readTask(k: Kernel, scope: string, taskId: string) {
  const task = (await k.readTasks(scope)).find((t) => t.task_id === taskId);
  if (!task) throw new OpsError(`task ${taskId} not found in ${scope}`);
  return task;
}

// The reconciliation action for a task, if one was proposed.
export async function actionFor(k: Kernel, scope: string, taskId: string): Promise<Action | null> {
  const summary = (await k.readActions(scope, 500)).find((a) => a.kind === RECONCILE.kind && a.task_ref === `task:${taskId}`);
  return summary ? k.readAction(summary.action_id) : null;
}

// Whether the payment executed, from the chain: the payment marker exists exactly when it did.
export async function observePayment(gateway: ChainGateway, inputs: ReconcileInputs): Promise<Observation> {
  const marker = await paymentMarkerAddress(address(inputs.payer_address), inputs.payment_id);
  return { cluster: gateway.cluster, marker, executed: (await gateway.getAccount(marker)) !== null };
}

async function observed(what: string, facts: Record<string, unknown>): Promise<Evidence> {
  return {
    // Agents attach their observations as artifacts; system_observed and externally_verified stay
    // with service actors (the payment service attaches the chain evidence when it records).
    basis: "artifact",
    content_hash: `sha256:${await sha256Hex(JSON.stringify(facts))}`,
    description: what.slice(0, 500),
  };
}

// The monitor. Deterministic code is the least-powerful worker for detection: a payment whose latest
// record is submitted or needs_reconciliation for longer than `staleAfterMs` gets one task per
// attempt. Scanning again opens nothing new. Runs as the payment service, which alone can read
// the payment's wallet address.
export async function detectUnsettledPayments(payments: Kernel, chain: string, { staleAfterMs = 60_000, now = Date.now() } = {}) {
  const scope = railScope(chain);
  const existing = (await payments.readTasks(scope)).filter((t) => t.required_capability === RECONCILE.capability);
  const opened: string[] = [];
  for (const [paymentId, event] of await latestPaymentEvents(payments, scope)) {
    const status = event.payload.status;
    if (status !== "submitted" && status !== "needs_reconciliation") continue;
    if (now - Date.parse(event.occurred_at) < staleAfterMs) continue;
    const payment = await payments.readPayment(paymentId);
    if (payment.status !== status || payment.attempt !== event.payload.attempt || !payment.payer_address || !payment.tx_signature) continue;
    const prior = existing.find((t) => {
      const inputs = t.inputs as Partial<ReconcileInputs>;
      return inputs.payment_id === paymentId && inputs.attempt === payment.attempt;
    });
    if (prior) continue;

    const inputs: ReconcileInputs = {
      payment_id: paymentId,
      attempt: payment.attempt,
      chain,
      payer_address: payment.payer_address,
      tx_signature: payment.tx_signature,
      signal: String(event.payload.detail ?? ""),
    };
    const taskId = await payments.createTask({
      scope,
      title: `Reconcile payment: ${payment.memo || `${payment.amount} ${payment.asset}`}`.slice(0, 200),
      objective: "Find out from the chain whether this payment executed, and record the outcome exactly once.",
      causeRef: `event:${event.id}`,
      requiredCapability: RECONCILE.capability,
      risk: "medium",
      reversible: false,
      evidenceBases: ["artifact"],
      verification: "distinct_party",
      inputs,
      idempotencyKey: `reconcile:${paymentId}:${payment.attempt}`,
    });
    await payments.transitionTask({ taskId, status: "ready", detail: "opened by the payment monitor" });
    opened.push(taskId);
  }
  return opened;
}

// Leases an agent for one task: the capability limited to the task, and a read lease on the scope
// (reads cannot be limited to a task), both expiring. The issuer can only pass on what it holds.
export async function leaseForTask(issuer: Kernel, input: { agentId: string; capability: string; scope: string; taskId: string; ttlMs?: number }) {
  const expiresAt = new Date(Date.now() + (input.ttlMs ?? 15 * 60_000));
  const lease = await issuer.issueLease({ grantee: input.agentId, capability: input.capability, scope: input.scope, taskRef: `task:${input.taskId}`, expiresAt });
  const read = await issuer.issueLease({ grantee: input.agentId, capability: "kernel.read", scope: input.scope, expiresAt });
  return { lease, read, expiresAt };
}

// The payment service's side of enactment. It performs a reconciliation only for an action the
// kernel authorized for a reconciliation task and is now enacting, and it re-checks the chain itself
// (reconcilePayment), so a wrong finding cannot record a wrong outcome.
export function paymentReconciler(rail: PaymentRail, scope: string) {
  return async (actionId: string): Promise<PaymentResult> => {
    const action = await rail.kernel.readAction(actionId);
    if (action.kind !== RECONCILE.kind || action.scope !== scope || !action.task_ref) {
      throw new OpsError("not a reconciliation action on this rail");
    }
    if (action.status !== "enacting" && action.status !== "needs_reconciliation") {
      throw new OpsError(`the action is ${action.status}; only an authorized action being enacted is performed`);
    }
    const task = await readTask(rail.kernel, scope, action.task_ref.slice("task:".length));
    const inputs = task.inputs as ReconcileInputs;
    if (action.payload.payment_id !== inputs.payment_id || action.proposer_id !== task.worker_id) {
      throw new OpsError("the action does not match its task");
    }
    return reconcilePayment(rail, inputs.payment_id);
  };
}

export type Step = { task: Task; action: Action | null; waiting?: string };

// One run of the worker. It continues from whatever the kernel says: claims, observes and proposes;
// once authorized, enacts through the payment service and records the outcome with evidence;
// then hands the task to verification.
export async function runReconcileWorker(
  worker: Kernel,
  input: { taskId: string; scope: string; gateway: ChainGateway; enact: (actionId: string) => Promise<PaymentResult> },
): Promise<Step> {
  const { taskId, scope } = input;
  let task = await readTask(worker, scope, taskId);
  if (task.status === "ready") {
    await worker.transitionTask({ taskId, status: "claimed", detail: "claimed by the reconciliation worker" });
    task = await readTask(worker, scope, taskId);
  }
  if (task.status === "claimed") {
    await worker.transitionTask({ taskId, status: "in_progress", detail: "observing the chain" });
    task = await readTask(worker, scope, taskId);
  }
  if (task.status !== "in_progress") return { task, action: await actionFor(worker, scope, taskId), waiting: `the task is ${task.status}` };
  const inputs = task.inputs as ReconcileInputs;

  let action = await actionFor(worker, scope, taskId);
  if (!action) {
    const finding = await observePayment(input.gateway, inputs);
    const id = await worker.proposeAction({
      kind: RECONCILE.kind,
      capability: RECONCILE.capability,
      scope,
      taskRef: `task:${taskId}`,
      payload: { payment_id: inputs.payment_id, attempt: inputs.attempt, tx_signature: inputs.tx_signature, finding },
      idempotencyKey: `reconcile:${taskId}`,
    });
    action = await worker.readAction(id);
  }
  if (action.status === "proposed") return { task, action, waiting: "a second authority" };

  if (action.status === "authorized") {
    await worker.beginAction(action.action_id, "asking the payment service to reconcile");
    action = await worker.readAction(action.action_id);
  }
  if (action.status === "enacting" || action.status === "needs_reconciliation") {
    const outcome = await input.enact(action.action_id);
    if (outcome.status !== "confirmed" && outcome.status !== "failed") {
      await worker.settleAction({ actionId: action.action_id, status: "needs_reconciliation", detail: outcome.detail ?? `payment ${outcome.status}` });
      return { task, action: await worker.readAction(action.action_id), waiting: "the payment outcome is still unknown" };
    }
    const facts = { payment_id: inputs.payment_id, attempt: outcome.attempt, status: outcome.status, signature: outcome.signature };
    await worker.settleAction({
      actionId: action.action_id,
      status: "completed",
      result: facts,
      detail: `payment ${outcome.status}`,
      evidence: [await observed(`Payment service recorded ${inputs.payment_id} as ${outcome.status}`, facts)],
    });
    action = await worker.readAction(action.action_id);
  }

  if (action.status === "completed") {
    const finding = action.payload.finding as Observation;
    await worker.transitionTask({
      taskId,
      status: "verifying",
      detail: "reconciled; awaiting independent verification",
      result: { finding, outcome: action.result },
      evidence: [await observed(`Marker ${finding.marker} on ${finding.cluster}: ${finding.executed ? "present" : "absent"}`, finding)],
    });
  } else if (action.status === "failed" || action.status === "cancelled" || action.status === "rejected") {
    await worker.transitionTask({ taskId, status: "failed", detail: `the reconciliation action ${action.status}` });
  }
  return { task: await readTask(worker, scope, taskId), action };
}

export type Verdict = { task: Task; action: Action | null; approved: boolean; closed: boolean; reasons: string[] };

// Independent verification. It never takes the worker's word: it re-derives the marker from the
// task's inputs (set by the monitor, not the worker), observes the chain itself and reads the
// kernel's own records. Before the consequence it checks the finding and authorizes; after, it
// checks the consequence actually occurred and closes the task.
export async function runReconcileVerifier(verifier: Kernel, input: { taskId: string; scope: string; gateway: ChainGateway }): Promise<Verdict> {
  const { taskId, scope } = input;
  const task = await readTask(verifier, scope, taskId);
  const action = await actionFor(verifier, scope, taskId);
  const inputs = task.inputs as ReconcileInputs;
  const reasons: string[] = [];
  if (!action) return { task, action, approved: false, closed: false, reasons: ["nothing proposed yet"] };

  if (action.proposer_id !== task.worker_id) reasons.push("the proposal does not come from the task's worker");
  if (action.payload.payment_id !== inputs.payment_id) reasons.push("the proposal names a different payment");
  const seen = await observePayment(input.gateway, inputs);
  const record = (await latestPaymentEvents(verifier, scope)).get(inputs.payment_id);
  if (!record) reasons.push("the kernel has no record of this payment");

  if (action.status === "proposed") {
    const finding = action.payload.finding as Partial<Observation> | undefined;
    if (finding?.marker !== seen.marker || finding?.executed !== seen.executed) {
      reasons.push(`the worker's finding does not match the chain (marker ${seen.executed ? "present" : "absent"})`);
    }
    if (record && record.payload.status !== "submitted" && record.payload.status !== "needs_reconciliation") {
      reasons.push(`the payment is already ${String(record.payload.status)}`);
    }
    if (record && record.payload.tx_signature !== inputs.tx_signature) reasons.push("the recorded transaction differs from the task's");
    if (reasons.length > 0) return { task, action, approved: false, closed: false, reasons };
    await verifier.approveAction(action.action_id);
    return { task, action: await verifier.readAction(action.action_id), approved: true, closed: false, reasons };
  }

  if (task.status !== "verifying") return { task, action, approved: false, closed: false, reasons: [`the task is ${task.status}`] };
  // Did the consequence actually occur, and does the kernel agree with the chain?
  if (action.status !== "completed") reasons.push(`the action is ${action.status}`);
  const status = record?.payload.status;
  if (status !== "confirmed" && status !== "failed") reasons.push(`the payment is still ${String(status)}`);
  if (status === "confirmed" && !seen.executed) reasons.push("the kernel says confirmed but the chain has no marker");
  if (status === "failed" && seen.executed) reasons.push("the kernel says failed but the payment executed");
  if (status === "confirmed" && !(await verifier.readEvidence(record!.id)).some((e) => e.basis === "externally_verified")) {
    reasons.push("the confirmation carries no chain evidence");
  }
  if (reasons.length > 0) return { task, action, approved: false, closed: false, reasons };

  const facts = { payment_id: inputs.payment_id, status, marker: seen.marker, executed: seen.executed, record: record!.id };
  await verifier.transitionTask({
    taskId,
    status: "completed",
    detail: `verified: payment ${String(status)}, marker ${seen.executed ? "present" : "absent"} on ${seen.cluster}`,
    result: { verdict: "consistent", ...facts },
    evidence: [await observed(`Independent check of ${inputs.payment_id}: kernel ${String(status)}, chain marker ${seen.executed ? "present" : "absent"}`, facts)],
  });
  return { task: await readTask(verifier, scope, taskId), action, approved: false, closed: true, reasons };
}
