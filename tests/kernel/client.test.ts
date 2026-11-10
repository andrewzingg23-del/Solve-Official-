import assert from "node:assert/strict";
import { it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { KernelError, kernelClient } from "../../lib/kernel/client";
import { createKernelDb } from "./harness";

type Call = { fn: string; args: Record<string, unknown> };

function fakeSupabase(respond: (call: Call) => { data: unknown; error: unknown } = () => ({ data: [{}], error: null })) {
  const calls: Call[] = [];
  const client = {
    schema(name: string) {
      assert.equal(name, "kernel_api");
      return {
        rpc: async (fn: string, args: Record<string, unknown>) => {
          const call = { fn, args };
          calls.push(call);
          return respond(call);
        },
      };
    },
  };
  return { calls, supabase: client as unknown as SupabaseClient };
}

async function exerciseEveryMethod(supabase: SupabaseClient, actAs?: string) {
  const k = kernelClient(supabase, { actAs });
  const evidence = { basis: "artifact", content_hash: `sha256:${"0".repeat(64)}` } as const;
  const id = "00000000-0000-4000-8000-000000000009";
  await k.register("label");
  await k.setPersonLabel("label", "person-label-001");
  await k.whoami();
  await k.createAgent("agent", "key");
  await k.createServiceActor("service", "key");
  await k.recordEvent({ type: "note.created", scope: "system", payload: {}, evidence: [evidence], corrects: id, idempotencyKey: "k", correlationId: id });
  await k.attachEvidence(id, evidence, "key");
  await k.issueGrant({ grantee: id, capability: "note.*", scope: "system", expiresAt: new Date(), idempotencyKey: "k" });
  await k.revokeGrant(id, "reason", "key");
  await k.claimScope("world:x");
  await k.defineAsset({ code: "SOLVE", issuerScope: "system", decimals: 9, label: "", idempotencyKey: "k" });
  await k.openAccount({ scope: "system", asset: "SOLVE", normalBalance: "credit", allowNegative: false, label: "", idempotencyKey: "k" });
  await k.postTransaction({ scope: "system", entries: [{ account_id: id, amount: BigInt(5) }, { account_id: id, amount: "-5" }], memo: "", evidence: [], idempotencyKey: "k", correlationId: id });
  await k.readEvents("system", { afterSeq: 1, limit: 5, newestFirst: true });
  await k.readEvidence(id);
  await k.sealKey(id, "A".repeat(43) + "=");
  await k.unsealKeys([id]);
  await k.destroyKey(id, "erased");
  await k.accountBalance(id);
  await k.myGrants();
  await k.verifyChain();
  await k.registerRail({ chain: "litesvm", mintAddress: "m", settlementAuthority: "s", onchainAccount: id, unallocatedAccount: id, payableAccount: id });
  await k.defineRewardPolicy({ policyKey: "p", chain: "litesvm", outcomeType: "outcome.completed", amount: BigInt(1), maxPerRelease: "1", totalCap: "1", requiredBases: ["system_observed"], minIndependentParties: 1, active: true });
  await k.readRail("litesvm");
  await k.linkWallet("litesvm", "addr");
  await k.myWallets();
  await k.createEntitlement({ obligationEventId: id, outcomeEventId: id, beneficiaryId: id, policyKey: "p", policyVersion: 1 });
  await k.myEntitlements();
  await k.prepareSettlement(id, "addr");
  await k.readSettlement("s");
  await k.pendingSettlements("litesvm", 10);
  await k.recordSettlement({ settlementId: "s", status: "confirmed", txSignature: "t", slot: BigInt(1), detail: "", evidence: [evidence] });
  await k.registerChainAsset("litesvm", "DEV_USDC", "m");
  await k.readChainAssets("litesvm");
  await k.setPaymentProfile({ chain: "litesvm", receiveAddress: "addr", acceptAssets: ["DEV_USDC"] });
  await k.readPaymentProfile(id, "litesvm");
  await k.createPaymentIntent({ recipientId: id, chain: "litesvm", asset: "DEV_USDC", amount: BigInt(10), maxSlippageBps: 50, memo: "", idempotencyKey: "k" });
  await k.selectPaymentRoute({ paymentId: "p", route: {}, payerAddress: "a", recipientAddress: "b", inputAsset: "ARC", inputAmount: BigInt(1), maxInput: "1", deliverAsset: "DEV_USDC", deliverAmount: "1", quotedAt: "t", expiresAt: "t" });
  await k.readPayment("p");
  await k.myPayments();
  await k.recordPayment({ paymentId: "p", attempt: 1, status: "submitted", txSignature: "t", inputAmount: BigInt(1), wireTransaction: "w", slot: BigInt(1), detail: "", evidence: [evidence] });
  await k.spawnAgent({ label: "a", role: "specialist", serves: "world:x", idempotencyKey: "k" });
  await k.issueLease({ grantee: id, capability: "payment.send", scope: "world:x", expiresAt: new Date(), maxAmount: BigInt(5), asset: "DEV_USDC", counterpartyRef: `actor:${id}`, taskRef: `task:${id}`, idempotencyKey: "k" });
  await k.authorize({ capability: "payment.send", scope: "world:x", amount: BigInt(1), asset: "DEV_USDC", counterpartyRef: `actor:${id}`, taskRef: `task:${id}` });
  await k.setActionPolicy({ scope: "world:x", capability: "payment.send", requirement: "quorum", approverCapability: "payment.approve", threshold: 2, signers: [id], delaySeconds: 1, distinctBy: "actor" });
  await k.proposeAction({ kind: "message.send", capability: "message.send", scope: "world:x", payload: {}, targetRef: `actor:${id}`, amount: BigInt(1), asset: "DEV_USDC", counterpartyRef: `actor:${id}`, taskRef: `task:${id}`, inReplyTo: id, idempotencyKey: "k" });
  await k.approveAction(id);
  await k.challengeAction(id, "r");
  await k.cancelAction(id, "r");
  await k.enactAction(id);
  await k.beginAction(id, "d");
  await k.settleAction({ actionId: id, status: "completed", result: {}, detail: "", evidence: [evidence] });
  await k.readAction(id);
  await k.readActions("world:x", 10);
  await k.inbox();
  await k.createWorldInvitation({ worldId: id, tokenHash: "0".repeat(64), role: "editor", requestId: "invite" });
  await k.acceptWorldInvitation("0".repeat(64));
  await k.cancelWorldInvitation(id);
  await k.readWorldInvitations(id);
  await k.readWorldPresence(`world:${id}`);
  await k.updateDocument({ entityId: id, scope: `world:${id}`, expectedVersion: 1, title: "t", summary: "", attributes: {}, idempotencyKey: "update" });
  await k.postRoomMessage({ worldId: id, text: "t", requestId: "room", kind: "message", askAi: true });
  await k.readRoomMessages(id, { beforeSeq: 10, limit: 51, kind: "decision" });
  await k.claimRoomReply(id);
  await k.finishRoomReply({ messageId: id, leaseToken: id, text: "t", model: "test", sourceRefs: [] });
  await k.failRoomReply(id, id);
  await k.upsertEntity({ entityId: id, kind: "place", scope: "world:x", title: "t", summary: "", attributes: {}, latitude: 1, longitude: 2, altitudeM: 3, locationTruth: "declared", visibility: "public", importance: 50, idempotencyKey: "k" });
  await k.relate({ kind: "supplies", fromRef: `entity:${id}`, toRef: `entity:${id}`, scope: "world:x", attributes: {}, idempotencyKey: "k" });
  await k.endRelation(id, "r");
  await k.readWorld("world:x");
  await k.publicWorld();
  await k.readRelations("world:x", true);
  await k.createTask({ scope: "world:x", title: "t", requiredCapability: "task.work", objective: "", causeRef: `entity:${id}`, risk: "low", reversible: true, budgetAmount: BigInt(1), budgetAsset: "DEV_USDC", evidenceBases: ["artifact"], verification: "distinct_actor", idempotencyKey: "k" });
  await k.transitionTask({ taskId: id, status: "claimed", detail: "", result: {}, evidence: [evidence] });
  await k.readTasks("world:x");
  await k.createAvatar({ type: "ai_companion", name: "Nova", relationship: "assist", seed: {}, representation: "abstract" });
  await k.setAvatarRepresentation(id, "pixel", "sov-1", "ref");
  await k.myAvatars();
  await k.defineType({ type: "candidate", scope: "world:x", fields: { name: { type: "text", required: true } }, label: "l", idempotencyKey: "k" });
  await k.putObject({ type: "candidate", scope: "world:x", title: "t", data: { name: "n" }, objectId: id, visibility: "private", idempotencyKey: "k" });
  await k.exportMine();
  await k.requestConfirmation({ entityId: id, tokenHash: "a".repeat(64), askedOf: "The homeowner", question: "Done?", requestId: "r" });
  await k.readConfirmationRequest("a".repeat(64));
  await k.answerConfirmation({ tokenHash: "a".repeat(64), decision: "confirmed", note: "yes", requestId: "r" });
  await k.cancelConfirmation(id);
  await k.readConfirmations(id);
  await k.readWorldInvitation("a".repeat(64));
  await k.fileAllowed("x", "kernel.read");
  await k.readActors([id]);
}

it("calls only real kernel_api functions with their real argument names", async () => {
  const k = await createKernelDb();
  const rows = await k.owner(`
    select p.proname as name,
           coalesce(p.proargnames[1:p.pronargs], '{}') as inputs,
           p.pronargs - p.pronargdefaults as required
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'kernel_api'
  `);
  const signatures = new Map(rows.map((r) => [r.name as string, r]));

  const asUser = fakeSupabase();
  await exerciseEveryMethod(asUser.supabase);
  const asAgent = fakeSupabase();
  await exerciseEveryMethod(asAgent.supabase, "00000000-0000-4000-8000-00000000000a");

  for (const { fn, args } of [...asUser.calls, ...asAgent.calls]) {
    const signature = signatures.get(fn);
    assert.ok(signature, `kernel_api.${fn} does not exist`);
    const inputs = signature.inputs as string[];
    for (const name of Object.keys(args)) {
      assert.ok(inputs.includes(name), `kernel_api.${fn} has no argument ${name}`);
    }
    for (const name of inputs.slice(0, signature.required as number)) {
      assert.ok(name in args, `kernel_api.${fn} call is missing ${name}`);
    }
  }

  // Every function in the interface is reachable from the client.
  assert.deepEqual([...new Set(asUser.calls.map((c) => c.fn))].sort(), [...signatures.keys()].sort());
});

it("acts as an agent only when asked, and never on functions that are user-only", async () => {
  const { calls, supabase } = fakeSupabase();
  await exerciseEveryMethod(supabase, "00000000-0000-4000-8000-00000000000a");
  const register = calls.find((c) => c.fn === "register");
  assert.equal(register && "p_as_actor" in register.args, false);
  assert.equal(calls.find((c) => c.fn === "record_event")?.args.p_as_actor, "00000000-0000-4000-8000-00000000000a");

  const plain = fakeSupabase();
  await exerciseEveryMethod(plain.supabase);
  assert.ok(plain.calls.every((c) => !("p_as_actor" in c.args)));
});

it("sends amounts as integer strings so no precision is lost", async () => {
  const { calls, supabase } = fakeSupabase();
  await kernelClient(supabase).postTransaction({
    scope: "system",
    entries: [
      { account_id: "a", amount: BigInt("900719925474099312345") },
      { account_id: "b", amount: "-900719925474099312345" },
    ],
  });
  assert.deepEqual(calls[0].args.p_entries, [
    { account_id: "a", amount: "900719925474099312345" },
    { account_id: "b", amount: "-900719925474099312345" },
  ]);
});

it("turns kernel SQLSTATEs into named errors", async () => {
  const { supabase } = fakeSupabase(() => ({ data: null, error: { code: "KA002", message: "no active grant" } }));
  await assert.rejects(kernelClient(supabase).myGrants(), (error: unknown) => {
    assert.ok(error instanceof KernelError);
    assert.equal(error.name, "forbidden");
    assert.equal(error.code, "KA002");
    return true;
  });
});
