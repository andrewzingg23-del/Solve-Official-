import { KernelError, type Kernel } from "@/lib/kernel/client";
import { capabilityById } from "@/lib/capabilities/registry";
import { parseTaskRequest, WORLD_ID, type TaskPlan } from "@/lib/capabilities/contracts";
import { loadCreativeWorld } from "./creative";

export const TASK_PROPOSED = "solve.task.proposed";

export type TaskList = { tasks: TaskPlan[]; complete: boolean };
const asRecord = (input: unknown): Record<string, unknown> =>
  input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};

/**
 * The existing kernel is the durable task record. Never mark work as running
 * because a request was accepted. Execution requires a separately authorized,
 * actually connected worker with its own idempotent receipt.
 */
export async function proposeWorldTask(kernel: Kernel, worldId: string, raw: unknown): Promise<{ taskId: string; eventId: string; status: "proposed" }> {
  if (!WORLD_ID.test(worldId)) throw new KernelError("invalid", "Invalid World ID", "");
  const input = parseTaskRequest(raw);
  if (!input) throw new KernelError("invalid", "Give this task a title and valid details", "");
  if (!capabilityById(input.capabilityId)) throw new KernelError("invalid", "That capability is not installed", "");
  const { world } = await loadCreativeWorld(kernel, worldId);
  const allowed = await kernel.authorize({ capability: "world.entity.write", scope: world.scope });
  if (allowed.decision !== "ALLOW") throw new KernelError("forbidden", "You cannot create tasks in this World", "");
  const actor = await kernel.whoami();
  const taskId = input.requestId;
  const eventId = await kernel.recordEvent({
    type: TASK_PROPOSED,
    scope: world.scope,
    payload: { taskId, worldId, title: input.title, instructions: input.instructions,
      capabilityId: input.capabilityId, schema: "solve.task.v1" },
    idempotencyKey: `solve:task:${input.requestId}`,
  });
  return { taskId, eventId, status: "proposed" };
}

export async function readWorldTasks(kernel: Kernel, worldId: string): Promise<TaskList> {
  if (!WORLD_ID.test(worldId)) throw new KernelError("invalid", "Invalid World ID", "");
  const scope = "world:" + worldId.toLowerCase();
  // Read chronologically: no recent-event-only reconstruction that drops
  // old task creation after lots of ordinary room activity.
  const tasks = new Map<string, TaskPlan>();
  let cursor = 0;
  const maxPages = 12; // bounded reads; signal incomplete rather than lying.
  for (let pageNo = 0; pageNo < maxPages; pageNo++) {
    const page = await kernel.readEvents(scope, { afterSeq: cursor, limit: 500 });
    for (const e of page) {
      if (e.type !== TASK_PROPOSED) continue;
      const p = asRecord(e.payload);
      if (typeof p.taskId !== "string" || typeof p.title !== "string" ||
        typeof p.instructions !== "string" || typeof p.capabilityId !== "string") continue;
      tasks.set(p.taskId, {
        schema: "solve.task.v1", id: p.taskId, worldId: worldId.toLowerCase(),
        title: p.title, instructions: p.instructions, capabilityId: p.capabilityId,
        authorId: e.actor_id, requestId: p.taskId,
        status: "proposed", createdAt: e.occurred_at, updatedAt: e.occurred_at,
      });
    }
    if (page.length < 500) return { tasks: [...tasks.values()].reverse(), complete: true };
    if (page.at(-1)!.seq <= cursor) throw new KernelError("unavailable", "Task history paging failed", "");
    cursor = page.at(-1)!.seq;
  }
  return { tasks: [...tasks.values()].reverse(), complete: false };
}
