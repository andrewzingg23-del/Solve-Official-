import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { KernelError, type Kernel } from "../../lib/kernel/client";
import { submitRoomTurn, type RoomTurnInput } from "../../lib/world/room";

const worldId = "4a862a51-0e5f-4c5d-8150-efc314ef2b87";
const question = (): RoomTurnInput => ({worldId,requestId:"diagnostics-1",intent:"ask_ai",text:"What is happening?"});

function fakeKernel(onSave?: () => Promise<string>): Kernel {
  const world = { entity_id:"11111111-1111-4111-8111-111111111111", kind:"world", scope:`world:${worldId}`,
    title:"Building SOLVE", summary:"Make the World useful", attributes:{worldId}, visibility:"members",
    version:1, updated_at:"2026-11-03T00:00:00Z" };
  return {
    readWorld: async () => [world],
    readRoomMessages: async () => [],
    postRoomMessage: async () => "message-id",
    claimRoomReply: async () => ({ state:"claimed", lease_token:"lease-id", reply_id:null }),
    finishRoomReply: onSave ?? (async () => "reply-id"),
    failRoomReply: async () => undefined,
  } as unknown as Kernel;
}

describe("World AI safe failure diagnostics", () => {
  it("returns a success receipt when the provider and kernel save work", async () => {
    const result = await submitRoomTurn(fakeKernel(),question(), async () => ({ text:"Useful answer", model:"test-model" }));
    assert.equal(result.aiStatus,"complete");
    assert.equal(result.replyId,"reply-id");
    assert.equal(result.diagnostic,undefined);
  });
  it("classifies provider authentication failure without leaking raw errors", async () => {
    const result = await submitRoomTurn(fakeKernel(),question(), async () => { throw new Error("provider_auth"); });
    assert.equal(result.aiStatus,"failed");
    assert.deepEqual(result.diagnostic,{stage:"provider",code:"provider_auth"});
  });
  it("classifies kernel save failure", async () => {
    const kernel=fakeKernel(async () => { throw new KernelError("conflict","secret lease message","KA004"); });
    const result = await submitRoomTurn(kernel,question(),async () => ({text:"Answer",model:"m"}));
    assert.equal(result.aiStatus,"failed");
    assert.deepEqual(result.diagnostic,{stage:"save",code:"lease_conflict"});
    assert.equal(JSON.stringify(result).includes("secret lease message"),false);
  });
});
