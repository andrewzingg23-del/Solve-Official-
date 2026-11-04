import { KernelError, type Kernel } from "@/lib/kernel/client";
import { capabilityById } from "@/lib/capabilities/registry";
import { parseTaskRequest, WORLD_ID, type TaskPlan } from "@/lib/capabilities/contracts";
import { loadCreativeWorld } from "./creative";
import { loadRoomContext } from "./room";
import { createHash } from "node:crypto";

export type TaskList = { tasks: TaskPlan[]; complete: boolean };

/**
 * A World task is a kernel-native operational task, never an additional event
 * or shadow database. No work is dispatched by creating the task.
 */
export async function proposeWorldTask(kernel: Kernel, worldId: string, raw: unknown): Promise<{ taskId: string; status: "created" }> {
  if (!WORLD_ID.test(worldId)) throw new KernelError("invalid", "Invalid World ID", "");
  const input = parseTaskRequest(raw);
  if (!input) throw new KernelError("invalid", "Give the task a title and valid details", "");
  if (!capabilityById(input.capabilityId)) throw new KernelError("invalid", "That capability is not registered", "");
  const { world } = await loadCreativeWorld(kernel, worldId);
  const allowed = await kernel.authorize({ capability:"task.create", scope:world.scope });
  if (allowed.decision !== "ALLOW") throw new KernelError("forbidden", "You cannot create tasks in this World", "");

  const actor = await kernel.whoami();
  const context = await loadRoomContext(kernel, worldId);
  const contextSnapshot = {
    schema:"solve.task-context.v1" as const,
    worldId:world.worldId,
    actorId:actor.actor_id,
    recipient:input.capabilityId,
    sourceRefs:context.sourceRefs.map(source => ({
      id:source.entityId, version:String(source.version), kind:"document" as const, verified:false,
    })),
    omittedSources:context.omittedSources,
    grantRefs:[] as string[],
    createdAt:new Date().toISOString(),
    sha256:createHash("sha256").update(context.sharedText).digest("hex"),
  };

  const taskId = await kernel.createTask({
    scope: world.scope,
    title: input.title,
    objective: input.instructions,
    requiredCapability: input.capabilityId,
    inputs: { source:"solve.world", requestId:input.requestId, requestedFrom:"world.room", contextSnapshot },
    risk: "low",
    reversible: true,
    evidenceBases:["artifact", "system_observed"],
    verification:"none",
    idempotencyKey: `solve:task:${world.worldId}:${input.requestId}`,
  });
  return { taskId, status:"created" };
}

export async function readWorldTasks(kernel: Kernel, worldId: string): Promise<TaskList> {
  if (!WORLD_ID.test(worldId)) throw new KernelError("invalid", "Invalid World ID", "");
  const tasks = await kernel.readTasks("world:" + worldId.toLowerCase());
  return {
    tasks: tasks.map(t => ({
      schema:"solve.task.v1",
      id:t.task_id,
      worldId:worldId.toLowerCase(),
      authorId:t.created_by,
      title:t.title,
      instructions:t.objective,
      capabilityId:t.required_capability,
      status:t.status,
      requestId:typeof t.inputs.requestId === "string" ? t.inputs.requestId : t.task_id,
      createdAt:t.created_at,
      updatedAt:t.updated_at,
      context: t.inputs.contextSnapshot && typeof t.inputs.contextSnapshot === "object" &&
        (t.inputs.contextSnapshot as { schema?: unknown }).schema === "solve.task-context.v1"
        ? t.inputs.contextSnapshot as TaskPlan["context"] : undefined,
    })).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)),
    complete:true,
  };
}
