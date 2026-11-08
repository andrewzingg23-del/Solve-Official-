/**
 * Human intention -> governed kernel task.
 *
 * This is an input/presentation contract, not a task database, scheduler,
 * authorization policy or model dispatcher. kernel_api remains authoritative.
 * The same operation works for home projects and SOLVE's own engineering.
 */
import type { TaskStatus } from "@/lib/kernel/client";

export type WorkIntent = {
  title: string;
  objective: string;
  independentReview: boolean;
  requestId: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UNSAFE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/;

export function parseWorkIntent(input: {
  title: unknown; objective: unknown; independentReview: unknown; requestId: unknown;
}): WorkIntent {
  if (typeof input.title !== "string") throw new Error("title");
  const title = input.title.trim().replace(/\s+/g, " ");
  if (title.length < 3 || title.length > 160 || UNSAFE.test(title)) throw new Error("title");

  if (typeof input.objective !== "string") throw new Error("objective");
  const objective = input.objective.trim();
  if (objective.length > 2000 || UNSAFE.test(objective)) throw new Error("objective");

  const independentReview = input.independentReview === "yes";
  if (input.independentReview !== "yes" && input.independentReview !== null && input.independentReview !== undefined) {
    throw new Error("review");
  }
  if (typeof input.requestId !== "string" || !UUID.test(input.requestId)) throw new Error("requestId");
  return { title, objective: objective || title, independentReview, requestId: input.requestId };
}

export const WORK_STATUS: Record<TaskStatus, string> = {
  created: "Proposed",
  ready: "Ready",
  claimed: "Claimed",
  in_progress: "In progress",
  blocked: "Blocked",
  waiting_external: "Waiting externally",
  verifying: "Needs verification",
  escalated: "Needs review",
  completed: "Recorded complete",
  failed: "Failed",
  needs_reconciliation: "Needs reconciliation",
  cancelled: "Cancelled",
};

export function workStatusLabel(status: TaskStatus): string {
  return WORK_STATUS[status] ?? "Unknown state";
}
