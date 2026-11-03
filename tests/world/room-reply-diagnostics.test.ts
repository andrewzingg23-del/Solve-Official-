// Issue #47: room AI reply failures are classified by stage, the saved
// question is preserved, and no raw error text leaks into the result.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { KernelError, type Kernel } from "../../lib/kernel/client";
import { ProviderError } from "../../lib/bot/openrouter";
import {
  classifyRoomReplyError,
  submitRoomTurn,
  type RoomTurnInput,
} from "../../lib/world/room";

const WORLD_ID = "4a862a51-0e5f-4c5d-8150-efc314ef2b87";
const WORLD_ENTITY_ID = "11111111-1111-4111-8111-111111111111";

type FakeState = {
  completeCalls: number;
  failCalls: number;
  finished: boolean;
  readWorldError?: Error;
};

function fakeKernel(state: FakeState) {
  const worldEntity = {
    entity_id: WORLD_ENTITY_ID,
    kind: "world",
    scope: `world:${WORLD_ID}`,
    title: "Building SOLVE",
    summary: "Move daily SOLVE development into SOLVE itself.",
    attributes: { worldId: WORLD_ID },
    version: 1,
    updated_at: "2026-11-03T00:00:00.000Z",
    visibility: "members",
  };
  return {
    readWorld: async () => {
      if (state.readWorldError) throw state.readWorldError;
      return [worldEntity];
    },
    readRoomMessages: async () => [],
    postRoomMessage: async () => "message-1",
    claimRoomReply: async () => {
      if (state.finished) return { state: "complete", lease_token: null, reply_id: "reply-1" };
      return { state: "claimed", lease_token: "lease-1", reply_id: null };
    },
    finishRoomReply: async () => {
      state.finished = true;
      return "reply-1";
    },
    failRoomReply: async () => {
      state.failCalls += 1;
    },
  } as unknown as Kernel;
}

function turn(): RoomTurnInput {
  return { worldId: WORLD_ID, requestId: "request-1", text: "What should be built next?", intent: "ask_ai" };
}

describe("room reply diagnostics (Issue #47)", () => {
  it("classifies a provider 401 without leaking raw error text", async () => {
    const state: FakeState = { completeCalls: 0, failCalls: 0, finished: false };
    const error = new ProviderError(401, "sk-secret provider body");
    (error as Error & { model?: string }).model = "anthropic/claude-haiku-4.5";
    const result = await submitRoomTurn(fakeKernel(state), turn(), async () => {
      state.completeCalls += 1;
      throw error;
    });
    assert.equal(result.aiStatus, "failed");
    assert.equal(result.diagnostic?.stage, "provider");
    assert.equal(result.diagnostic?.code, "provider_401");
    assert.equal(result.diagnostic?.providerStatus, 401);
    assert.equal(result.diagnostic?.model, "anthropic/claude-haiku-4.5");
    assert.equal(state.failCalls, 1);
    assert.ok(result.error?.includes("provider rejected"));
    assert.ok(!result.error?.includes("sk-secret"));
    assert.ok(!JSON.stringify(result).includes("sk-secret"));
  });

  it("classifies the hourly budget guard separately from the provider", async () => {
    const state: FakeState = { completeCalls: 0, failCalls: 0, finished: false };
    const result = await submitRoomTurn(fakeKernel(state), turn(), async () => {
      throw new Error("Room AI budget exhausted");
    });
    assert.equal(result.diagnostic?.stage, "budget");
    assert.equal(result.diagnostic?.code, "budget_exhausted");
    assert.ok(result.error?.includes("budget"));
    assert.equal(state.failCalls, 1);
  });

  it("classifies a context load failure and never calls the provider", async () => {
    const state: FakeState = { completeCalls: 0, failCalls: 0, finished: false, readWorldError: new Error("context boom") };
    const result = await submitRoomTurn(fakeKernel(state), turn(), async () => {
      state.completeCalls += 1;
      return { text: "should not happen", model: "m" };
    });
    assert.equal(result.diagnostic?.stage, "context");
    assert.equal(result.diagnostic?.code, "context_failed");
    assert.equal(state.completeCalls, 0);
    assert.equal(state.failCalls, 1);
  });

  it("classifies a lease conflict at save time as a lease failure", async () => {
    const state: FakeState = { completeCalls: 0, failCalls: 0, finished: false };
    const kernel = fakeKernel(state) as unknown as Record<string, unknown>;
    kernel.finishRoomReply = async () => {
      throw new KernelError("conflict", "AI reply lease expired or changed", "KA004");
    };
    const result = await submitRoomTurn(kernel as unknown as Kernel, turn(), async () => {
      return { text: "draft", model: "anthropic/claude-haiku-4.5" };
    });
    assert.equal(result.diagnostic?.stage, "lease");
    assert.equal(result.diagnostic?.code, "reply_lease_expired");
    assert.ok(result.error?.includes("lease expired"));
    assert.equal(state.failCalls, 1);
  });

  it("classifies an invalid AI draft at save time", async () => {
    const state: FakeState = { completeCalls: 0, failCalls: 0, finished: false };
    const kernel = fakeKernel(state) as unknown as Record<string, unknown>;
    kernel.finishRoomReply = async () => {
      throw new KernelError("invalid", "Invalid AI draft", "KA003");
    };
    const result = await submitRoomTurn(kernel as unknown as Kernel, turn(), async () => {
      return { text: "draft", model: "anthropic/claude-haiku-4.5" };
    });
    assert.equal(result.diagnostic?.stage, "save");
    assert.equal(result.diagnostic?.code, "save_invalid");
    assert.equal(state.failCalls, 1);
  });

  it("reports a missing provider as unavailable, not failed", async () => {
    const state: FakeState = { completeCalls: 0, failCalls: 0, finished: false };
    const result = await submitRoomTurn(fakeKernel(state), turn(), undefined);
    assert.equal(result.aiStatus, "unavailable");
    assert.equal(result.diagnostic?.stage, "config");
    assert.equal(result.diagnostic?.code, "provider_missing");
    assert.equal(state.failCalls, 1);
  });

  it("does not duplicate work on retry: a completed reply is returned without a second provider call", async () => {
    const state: FakeState = { completeCalls: 0, failCalls: 0, finished: false };
    const kernel = fakeKernel(state);
    const first = await submitRoomTurn(kernel, turn(), async () => {
      state.completeCalls += 1;
      return { text: "grounded draft", model: "anthropic/claude-haiku-4.5" };
    });
    assert.equal(first.aiStatus, "complete");
    assert.equal(first.replyId, "reply-1");
    const second = await submitRoomTurn(kernel, turn(), async () => {
      state.completeCalls += 1;
      return { text: "second draft", model: "anthropic/claude-haiku-4.5" };
    });
    assert.equal(second.aiStatus, "complete");
    assert.equal(second.replyId, "reply-1");
    assert.equal(state.completeCalls, 1);
  });

  it("classifies a provider timeout by name, not by raw message", () => {
    const error = new Error("socket hangup after 60000ms");
    error.name = "TimeoutError";
    const diagnostic = classifyRoomReplyError(error, "provider");
    assert.equal(diagnostic.stage, "provider");
    assert.equal(diagnostic.code, "provider_timeout");
  });
});
