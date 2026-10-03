// SOV learning from its own operation. Repeated friction (here: payments whose chain response was
// lost and needed reconciliation) becomes a learning event; the learning event becomes a build
// proposal with causal evidence, classified by what it would touch. Recording a proposal changes
// nothing in the product: building and promoting it is a separate, gated loop.
import type { Kernel } from "../kernel/client";
import { sha256Hex } from "../money/settlement";
import { proposeBuild, type BuildProposal } from "./changes";
import { RECONCILE, type ReconcileInputs } from "./reconcile";

export const OPS_SCOPE = "system/ops";

export type Learning = { learningEventId: string; proposalEventId: string; proposal: BuildProposal; tasks: string[] };

// Runs as the operations service: reads completed reconciliation tasks on a rail and, once lost
// responses recur (`threshold` or more), records what was learned and one Class A proposal. The
// same set of tasks always yields the same two events.
export async function learnFromReconciliations(ops: Kernel, input: { railScope: string; threshold?: number }): Promise<Learning | null> {
  const tasks = (await ops.readTasks(input.railScope)).filter(
    (t) => t.required_capability === RECONCILE.capability && t.status === "completed" && /outcome unknown/.test(String((t.inputs as Partial<ReconcileInputs>).signal)),
  );
  if (tasks.length < (input.threshold ?? 2)) return null;
  const refs = tasks.map((t) => `task:${t.task_id}`).sort();
  const key = await sha256Hex(refs.join(","));

  const learningEventId = await ops.recordEvent({
    type: "ops.learning.recorded",
    scope: OPS_SCOPE,
    payload: {
      signal: "payment.lost_response",
      observation: `${tasks.length} payments executed on chain but their responses were lost; each needed a reconciliation task.`,
      rail: input.railScope,
      tasks: refs,
      resolved: true,
    },
    evidence: [{ basis: "system_observed", content_hash: `sha256:${key}`, description: `${tasks.length} completed reconciliation tasks on ${input.railScope}` }],
    idempotencyKey: `learning:${key}`,
  });

  const proposal = proposeBuild({
    problem: "Payments lose their chain response and wait for reconciliation before the payer sees the outcome.",
    cause: "The RPC send returned no response although the transaction executed (outcome unknown).",
    evidence: [`event:${learningEventId}`, ...refs],
    expected_outcome:
      "The lost-response path stays covered by a regression test, and its rate is reported per rail so a rise is seen before users wait.",
    affected: { paths: ["tests/e2e/send-bob.test.ts", "scripts/diagnostics/lost-responses.ts"], capabilities: [] },
    risk: "low",
    reuse: {
      decision: "extend",
      existing: ["lib/money/payment.ts reconcilePayment", "tests/support/litesvm-gateway.ts loseNextResponse", "lib/ops/reconcile.ts"],
    },
    rollback: "Revert the commit; it changes no runtime behaviour.",
  });

  const proposalEventId = await ops.recordEvent({
    type: "ops.build_proposal.proposed",
    scope: OPS_SCOPE,
    payload: { ...proposal, learning_event_id: learningEventId },
    idempotencyKey: `proposal:${key}`,
  });
  return { learningEventId, proposalEventId, proposal, tasks: refs };
}
