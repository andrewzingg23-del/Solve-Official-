// The steward's projection of SOV operating SOV: tasks, who worked and who verified them, the
// governed actions and their consequences, what was learned and what was proposed, read through
// kernel_api with the steward's own authority. It shows what needs a human and what is not built
// yet, so the steward sees the system as it is, not a summary that flatters it.
import type { Kernel } from "../kernel/client";
import { OPS_SCOPE } from "../ops/learning";
import { RECONCILE, railScope } from "../ops/reconcile";

export type OperationTask = {
  taskId: string;
  title: string;
  status: string;
  risk: string;
  verification: string;
  worker: string | null;
  verifier: string | null;
  decision: string | null;
  actionStatus: string | null;
  outcome: string | null;
  detail: string;
};

export type OperationProposal = {
  eventId: string;
  changeClass: string;
  problem: string;
  expected: string;
  promotion: string;
  reuse: string;
  evidence: number;
  status: string;
};

export type OperationsView = {
  rail: string;
  tasks: OperationTask[];
  learning: { eventId: string; observation: string }[];
  proposals: OperationProposal[];
  needsYou: string[];
  notBuilt: string[];
};

export async function loadOperations(steward: Kernel, chain = "litesvm"): Promise<OperationsView> {
  const rail = railScope(chain);
  const tasks = (await steward.readTasks(rail)).filter((t) => t.required_capability === RECONCILE.capability);
  const actions = await steward.readActions(rail, 500);
  const railEvents = await steward.readEvents(rail, { limit: 500 });
  const opsEvents = await steward.readEvents(OPS_SCOPE, { limit: 500 });
  const engineering = await steward.readTasks(OPS_SCOPE);

  const closedBy = new Map(railEvents.filter((e) => e.type === "kernel.task.completed").map((e) => [String(e.payload.task_id), e.actor_id]));
  const ids = new Set<string>();
  for (const t of tasks) if (t.worker_id) ids.add(t.worker_id);
  for (const id of closedBy.values()) ids.add(id);
  const actors = new Map((ids.size ? await steward.readActors([...ids]) : []).map((a) => [a.actor_id, a]));
  const name = (id: string | null | undefined) => {
    if (!id) return null;
    const a = actors.get(id);
    return a ? `${a.label || a.kind}${a.role ? ` (${a.role.replace(/_/g, " ")})` : ""}` : "unknown actor";
  };

  const view: OperationsView = {
    rail,
    tasks: tasks.map((t) => {
      const action = actions.find((a) => a.task_ref === `task:${t.task_id}`) ?? null;
      const outcome = t.result && typeof t.result === "object" ? (t.result as { status?: string; verdict?: string }) : null;
      return {
        taskId: t.task_id,
        title: t.title,
        status: t.status,
        risk: t.risk,
        verification: t.verification,
        worker: name(t.worker_id),
        verifier: name(closedBy.get(t.task_id)),
        decision: action?.decision ?? null,
        actionStatus: action?.status ?? null,
        outcome: outcome?.status ? `payment ${outcome.status}` : null,
        detail: t.detail,
      };
    }),
    learning: opsEvents.filter((e) => e.type === "ops.learning.recorded").map((e) => ({ eventId: e.id, observation: String(e.payload.observation ?? "") })),
    proposals: opsEvents
      .filter((e) => e.type === "ops.build_proposal.proposed")
      .map((e) => {
        const p = e.payload as { change_class?: string; problem?: string; expected_outcome?: string; promotion?: string; reuse?: { decision?: string }; evidence?: unknown[]; status?: string };
        return {
          eventId: e.id,
          changeClass: String(p.change_class ?? "?"),
          problem: String(p.problem ?? ""),
          expected: String(p.expected_outcome ?? ""),
          promotion: String(p.promotion ?? ""),
          reuse: String(p.reuse?.decision ?? ""),
          evidence: p.evidence?.length ?? 0,
          status: String(p.status ?? ""),
        };
      }),
    needsYou: [],
    notBuilt: [],
  };

  for (const t of view.tasks) {
    if (["escalated", "failed", "needs_reconciliation", "blocked"].includes(t.status)) view.needsYou.push(`${t.title}: ${t.status}${t.detail ? ` (${t.detail})` : ""}`);
  }
  // A proposal's life after it is recorded: its engineering task, CI, promotion and observation.
  for (const p of view.proposals) {
    const task = engineering.find((t) => t.cause_ref === `event:${p.eventId}`);
    const observed = task && opsEvents.find((e) => e.type === "ops.observation.recorded" && e.payload.task === task.task_id);
    if (task) p.status = observed ? `promoted and observed (${task.status})` : `building (${task.status})`;
    if (task && ["escalated", "failed", "blocked"].includes(task.status)) view.needsYou.push(`${task.title}: ${task.status}${task.detail ? ` (${task.detail})` : ""}`);
    if (p.changeClass === "C" || p.changeClass === "D") view.needsYou.push(`Class ${p.changeClass} proposal: ${p.problem} — ${p.promotion}`);
    if (!task && p.changeClass === "A") view.notBuilt.push(`No builder has taken the Class A proposal "${p.problem}" yet.`);
  }
  view.notBuilt.push("Promotion targets an isolated workspace, not this repository: promoting into a branch and pull request with preview deploys is not built yet.");
  const open = view.tasks.filter((t) => !["completed", "cancelled"].includes(t.status)).length;
  if (open > 0) view.needsYou.push(`${open} operational task${open === 1 ? "" : "s"} still open.`);
  return view;
}
