import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Kernel } from "../../lib/kernel/client";
import { proposeWorldTask, readWorldTasks } from "../../lib/world/tasks";

const worldId = "4a862a51-0e5f-4c5d-8150-efc314ef2b87";
const actorId = "11111111-1111-4111-8111-111111111111";
const worldEntity = {
  entity_id:"22222222-2222-4222-8222-222222222222",
  kind:"world",
  scope:`world:${worldId}`,
  title:"Building SOLVE",
  summary:"Keep the app self-building",
  attributes:{ worldId },
  visibility:"members", version:1, updated_at:"2026-11-03T00:00:00Z",
};

function kernel(decision: "ALLOW" | "DENY", recorded: Record<string, unknown>[]): Kernel {
  return {
    readWorld: async () => [worldEntity],
    readRoomMessages: async () => [],
    authorize: async () => ({ decision }),
    whoami: async () => ({ actor_id:actorId }),
    createTask: async (input: Record<string, unknown>) => { recorded.push(input); return "33333333-3333-4333-8333-333333333333"; },
    readTasks: async () => [],
  } as unknown as Kernel;
}

describe("Kernel-native World task boundary", () => {
  it("creates one real kernel task with World-only context references", async () => {
    const recorded: Record<string, unknown>[]=[];
    const result = await proposeWorldTask(kernel("ALLOW",recorded),worldId,{
      requestId:"task1",title:"Build a better editor",instructions:"Provide a testable preview",
      capabilityId:"github.coding.worker",
    });
    assert.equal(result.status,"created");
    assert.equal(recorded.length,1);
    assert.equal(recorded[0].requiredCapability,"github.coding.worker");
    assert.equal(recorded[0].idempotencyKey,`solve:task:${worldId}:task1`);
    const input=recorded[0].inputs as Record<string,unknown>;
    const context=input.contextSnapshot as Record<string, unknown>;
    assert.equal(context.schema,"solve.task-context.v1");
    assert.match(context.sha256 as string,/^[0-9a-f]{64}$/);
    assert.ok(Array.isArray(context.sourceRefs));
    assert.ok(!JSON.stringify(context).includes("personal memory"));
    assert.equal((await readWorldTasks(kernel("ALLOW",[]),worldId)).tasks.length,0);
  });
  it("requires the task.create grant, not just a model selection", async () => {
    const recorded: Record<string, unknown>[]=[];
    await assert.rejects(() => proposeWorldTask(kernel("DENY",recorded),worldId,{
      requestId:"task2",title:"Test",instructions:"",capabilityId:"github.coding.worker",
    }),/cannot create tasks/i);
    assert.equal(recorded.length,0);
  });
  it("rejects unrecognized remote capabilities", async () => {
    await assert.rejects(() => proposeWorldTask(kernel("ALLOW",[]),worldId,{
      requestId:"task3",title:"Test",instructions:"",capabilityId:"https://unsafe-service",
    }));
  });
});
