import type { Task } from "@/lib/kernel/client";

/**
 * A bounded, read-only projection of kernel Work for World-scoped AI context.
 *
 * The caller must have already received tasks from kernel_api.read_tasks under
 * its own authenticated actor/World grants. This function grants nothing and
 * never includes inputs, results, budgets, private memory, or credentials.
 */
export function summarizeWorldWork(tasks: Task[] | null, limit = 8) {
  if (tasks === null) {
    return { state: "unavailable" as const, entries: [], omitted: null };
  }
  const cap = Number.isSafeInteger(limit) ? Math.max(0, Math.min(limit, 12)) : 8;
  const selected = tasks.slice(-cap || tasks.length).reverse().slice(0, cap);
  return {
    state: "available" as const,
    entries: selected.map(task => ({
      taskId: task.task_id,
      title: task.title.slice(0, 160),
      objective: task.objective.slice(0, 220),
      status: task.status,
      verification: task.verification,
      workerAssigned: task.worker_id !== null,
    })),
    omitted: tasks.length - selected.length,
  };
}
