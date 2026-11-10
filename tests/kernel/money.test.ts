import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { POLICY, solve, moneyKernel, verifyOutcome, worldWithOutcome, type Money } from "../support/money-fixture";
import { anon, createKernelDb, service, sha, sqlstate, user, type KernelDb } from "./harness";

const alice = user("auth-alice");
const bob = user("auth-bob");
const carol = user("auth-carol");
const WALLET_A = "4Nd1mYwqjQwVQ5hP3S7J9u8DPsgqvHXZvF2mXt6y5Dkq";
const WALLET_B = "7XSvdQ2Y8Yb2mR9n3qkTnF6pZcx1LwVH5eJtGhUa4KmB";
const SIG_1 = "5".repeat(88);
const SIG_2 = "6".repeat(88);

async function setup(options?: Parameters<typeof moneyKernel>[1]) {
  const k = await createKernelDb();
  const money = await moneyKernel(k, options);
  const aliceId = await k.value(alice, "register");
  const bobId = await k.value(bob, "register");
  return { k, money, aliceId, bobId };
}

const entitle = (k: KernelDb, money: Money, session = alice, ids: { obligation: string; outcome: string }, beneficiary: string, version = money.policyVersion) =>
  k.value(session, "create_entitlement", {
    p_obligation_event_id: ids.obligation,
    p_outcome_event_id: ids.outcome,
    p_beneficiary_id: beneficiary,
    p_policy_key: POLICY,
    p_policy_version: version,
  });

const record = (k: KernelDb, money: Money, settlementId: string, status: string, extra: Record<string, unknown> = {}) =>
  k.value(service, "record_settlement", {
    p_settlement_id: settlementId,
    p_status: status,
    p_as_actor: money.settlementService,
    ...extra,
  });

const chainEvidence = [{ basis: "externally_verified", content_hash: sha(77), description: "finalized transaction" }];

describe("entitlements", () => {
  it("verifies an outcome, books it against the Earn allocation and settles exactly once", async () => {
    const { k, money, aliceId } = await setup();
    const ids = await worldWithOutcome(k, money, alice, aliceId);
    await verifyOutcome(k, money, ids.outcome);

    const entitlementId = await entitle(k, money, alice, ids, aliceId);
    const [mine] = await k.rpc(alice, "my_entitlements");
    assert.equal(mine.entitlement_id, entitlementId);
    assert.equal(mine.amount, solve(100).toString());
    assert.equal(mine.status, "unsettled");
    assert.match(String(mine.settlement_id), /^[0-9a-f]{64}$/);
    assert.match(String(mine.evidence_root), /^sha256:[0-9a-f]{64}$/);
    assert.equal(await money.balance(money.unallocated), solve(450_000_000) - solve(100));
    assert.equal(await money.balance(money.payable), solve(100));

    await k.rpc(alice, "link_wallet", { p_chain: "litesvm", p_address: WALLET_A });
    const settlementId = await k.value(alice, "prepare_settlement", { p_entitlement_id: entitlementId, p_recipient_address: WALLET_A });
    assert.equal(settlementId, mine.settlement_id);

    const pending = await k.rpc(service, "pending_settlements", { p_chain: "litesvm", p_as_actor: money.settlementService });
    assert.deepEqual(pending.map((p) => [p.settlement_id, p.status]), [[settlementId, "prepared"]]);

    await record(k, money, settlementId, "submitted", { p_tx_signature: SIG_1 });
    const confirmed = await record(k, money, settlementId, "confirmed", { p_tx_signature: SIG_1, p_slot: 42, p_evidence: chainEvidence });
    // Exact retry of the confirmation returns the same event and books nothing more.
    assert.equal(await record(k, money, settlementId, "confirmed", { p_tx_signature: SIG_1, p_slot: 42, p_evidence: chainEvidence }), confirmed);
    await assert.rejects(
      record(k, money, settlementId, "confirmed", { p_tx_signature: SIG_2, p_evidence: chainEvidence }),
      sqlstate("KA003"),
    );

    assert.equal(await money.balance(money.payable), BigInt(0));
    assert.equal(await money.balance(money.onchain), solve(450_000_000) - solve(100));
    const [settled] = await k.rpc(alice, "my_entitlements");
    assert.equal(settled.status, "confirmed");
    assert.equal(settled.tx_signature, SIG_1);
    assert.deepEqual(await k.rpc(service, "pending_settlements", { p_chain: "litesvm", p_as_actor: money.settlementService }), []);
    const [check] = await k.rpc(service, "verify_chain");
    assert.equal(check.ok, true);
  });

  it("refuses without independent evidence; the beneficiary's own evidence never counts", async () => {
    const { k, money, aliceId } = await setup();
    const ids = await worldWithOutcome(k, money, alice, aliceId);
    await assert.rejects(entitle(k, money, alice, ids, aliceId), sqlstate("KA003"));

    // Even an artifact-accepting policy ignores artifacts from the beneficiary's own party.
    await k.rpc(money.founder, "define_reward_policy", {
      p_policy_key: "artifact-only",
      p_chain: "litesvm",
      p_outcome_type: "outcome.completed",
      p_amount: solve(1).toString(),
      p_max_per_release: solve(1).toString(),
      p_total_cap: solve(10).toString(),
      p_required_bases: ["artifact"],
    });
    const obligation = await k.value(alice, "record_event", {
      p_type: "obligation.created",
      p_scope: ids.world,
      p_payload: { title: "self", policy_key: "artifact-only", beneficiaries: [{ actor_id: aliceId, attribution_bps: 10_000 }] },
    });
    const outcome = await k.value(alice, "record_event", {
      p_type: "outcome.completed",
      p_scope: ids.world,
      p_payload: { obligation_event_id: obligation },
      p_evidence: [{ basis: "artifact", content_hash: sha(3) }],
    });
    await assert.rejects(
      k.rpc(alice, "create_entitlement", {
        p_obligation_event_id: obligation, p_outcome_event_id: outcome, p_beneficiary_id: aliceId,
        p_policy_key: "artifact-only", p_policy_version: 1,
      }),
      sqlstate("KA003"),
    );
  });

  it("is reserved to World members holding entitlement.create", async () => {
    const { k, money, aliceId, bobId } = await setup();
    const ids = await worldWithOutcome(k, money, alice, aliceId);
    await verifyOutcome(k, money, ids.outcome);

    await assert.rejects(entitle(k, money, bob, ids, aliceId), sqlstate("KA002"));
    await assert.rejects(entitle(k, money, anon, ids, aliceId), sqlstate("42501"));
    await assert.rejects(entitle(k, money, user("auth-nobody"), ids, aliceId), sqlstate("KA001"));

    await k.rpc(alice, "issue_grant", { p_grantee: bobId, p_capability: "kernel.read", p_scope: ids.world });
    await assert.rejects(entitle(k, money, bob, ids, aliceId), sqlstate("KA002"));

    const grant = await k.value(alice, "issue_grant", { p_grantee: bobId, p_capability: "entitlement.create", p_scope: ids.world });
    await k.rpc(alice, "revoke_grant", { p_grant_id: grant });
    await assert.rejects(entitle(k, money, bob, ids, aliceId), sqlstate("KA002"));
  });

  it("settles one obligation once, whatever outcome or request repeats it", async () => {
    const { k, money, aliceId } = await setup();
    const ids = await worldWithOutcome(k, money, alice, aliceId);
    await verifyOutcome(k, money, ids.outcome);
    const first = await entitle(k, money, alice, ids, aliceId);
    assert.equal(await entitle(k, money, alice, ids, aliceId), first);

    const duplicateOutcome = await k.value(alice, "record_event", {
      p_type: "outcome.completed",
      p_scope: ids.world,
      p_payload: { obligation_event_id: ids.obligation, summary: "done again" },
    });
    await verifyOutcome(k, money, duplicateOutcome, 4);
    await assert.rejects(entitle(k, money, alice, { ...ids, outcome: duplicateOutcome }, aliceId), sqlstate("KA004"));
    assert.equal((await k.rpc(alice, "my_entitlements")).length, 1);
    assert.equal(await money.balance(money.payable), solve(100));
  });

  it("splits attribution from the obligation without multiplying value", async () => {
    const { k, money, aliceId, bobId } = await setup();
    const ids = await worldWithOutcome(k, money, alice, aliceId, {
      beneficiaries: [{ actor_id: aliceId, attribution_bps: 6_000 }, { actor_id: bobId, attribution_bps: 4_000 }],
    });
    await verifyOutcome(k, money, ids.outcome);
    await entitle(k, money, alice, ids, aliceId);
    await entitle(k, money, alice, ids, bobId);
    assert.equal((await k.rpc(alice, "my_entitlements"))[0].amount, solve(60).toString());
    assert.equal((await k.rpc(bob, "my_entitlements"))[0].amount, solve(40).toString());
    assert.equal(await money.balance(money.payable), solve(100));

    const inflated = await worldWithOutcome(k, money, alice, aliceId, {
      beneficiaries: [{ actor_id: aliceId, attribution_bps: 7_000 }, { actor_id: bobId, attribution_bps: 4_000 }],
    });
    await verifyOutcome(k, money, inflated.outcome);
    await assert.rejects(entitle(k, money, alice, inflated, aliceId), sqlstate("KA003"));
  });

  it("rejects stale and inactive policy versions", async () => {
    const { k, money, aliceId } = await setup();
    const ids = await worldWithOutcome(k, money, alice, aliceId);
    await verifyOutcome(k, money, ids.outcome);
    const redefine = (active: boolean) =>
      k.value<number>(money.founder, "define_reward_policy", {
        p_policy_key: POLICY, p_chain: "litesvm", p_outcome_type: "outcome.completed",
        p_amount: solve(100).toString(), p_max_per_release: solve(1_000).toString(),
        p_total_cap: solve(1_000_000).toString(), p_required_bases: ["system_observed"], p_active: active,
      });
    const v2 = await redefine(true);
    await assert.rejects(entitle(k, money, alice, ids, aliceId, money.policyVersion), sqlstate("KA003"));
    const v3 = await redefine(false);
    await assert.rejects(entitle(k, money, alice, ids, aliceId, v3), sqlstate("KA003"));
    assert.equal(v2, 2);
  });

  it("cannot exceed the policy cap or the observed Earn allocation", async () => {
    const capped = await setup({ policyCap: solve(150) });
    const first = await worldWithOutcome(capped.k, capped.money, alice, capped.aliceId);
    await verifyOutcome(capped.k, capped.money, first.outcome);
    await entitle(capped.k, capped.money, alice, first, capped.aliceId);
    const second = await worldWithOutcome(capped.k, capped.money, alice, capped.aliceId);
    await verifyOutcome(capped.k, capped.money, second.outcome);
    await assert.rejects(entitle(capped.k, capped.money, alice, second, capped.aliceId), sqlstate("KA005"));

    const thin = await setup({ observedEarn: solve(150) });
    const a = await worldWithOutcome(thin.k, thin.money, alice, thin.aliceId);
    await verifyOutcome(thin.k, thin.money, a.outcome);
    await entitle(thin.k, thin.money, alice, a, thin.aliceId);
    const b = await worldWithOutcome(thin.k, thin.money, alice, thin.aliceId);
    await verifyOutcome(thin.k, thin.money, b.outcome);
    await assert.rejects(entitle(thin.k, thin.money, alice, b, thin.aliceId), sqlstate("KA005"));
  });
});

describe("settlements", () => {
  async function entitled() {
    const ctx = await setup();
    const ids = await worldWithOutcome(ctx.k, ctx.money, alice, ctx.aliceId);
    await verifyOutcome(ctx.k, ctx.money, ids.outcome);
    const entitlementId = await entitle(ctx.k, ctx.money, alice, ids, ctx.aliceId);
    return { ...ctx, ids, entitlementId };
  }

  it("pays only a wallet the beneficiary linked, and never re-targets", async () => {
    const { k, entitlementId } = await entitled();
    await assert.rejects(
      k.rpc(alice, "prepare_settlement", { p_entitlement_id: entitlementId, p_recipient_address: WALLET_A }),
      sqlstate("KA003"),
    );
    await k.rpc(bob, "link_wallet", { p_chain: "litesvm", p_address: WALLET_B });
    await assert.rejects(k.rpc(alice, "link_wallet", { p_chain: "litesvm", p_address: WALLET_B }), sqlstate("KA004"));
    await assert.rejects(
      k.rpc(alice, "prepare_settlement", { p_entitlement_id: entitlementId, p_recipient_address: WALLET_B }),
      sqlstate("KA003"),
    );

    await k.rpc(alice, "link_wallet", { p_chain: "litesvm", p_address: WALLET_A });
    const id = await k.value(alice, "prepare_settlement", { p_entitlement_id: entitlementId, p_recipient_address: WALLET_A });
    assert.equal(await k.value(alice, "prepare_settlement", { p_entitlement_id: entitlementId, p_recipient_address: WALLET_A }), id);
    await assert.rejects(
      k.rpc(bob, "prepare_settlement", { p_entitlement_id: entitlementId, p_recipient_address: WALLET_A }),
      sqlstate("KA002"),
    );
  });

  it("follows the state machine, and only the settlement service records it", async () => {
    const { k, money, entitlementId } = await entitled();
    await k.rpc(alice, "link_wallet", { p_chain: "litesvm", p_address: WALLET_A });
    const id = await k.value(alice, "prepare_settlement", { p_entitlement_id: entitlementId, p_recipient_address: WALLET_A });

    await assert.rejects(record(k, money, id, "confirmed", { p_tx_signature: SIG_1, p_evidence: chainEvidence }), sqlstate("KA003"));
    await assert.rejects(
      k.rpc(alice, "record_settlement", { p_settlement_id: id, p_status: "submitted", p_tx_signature: SIG_1 }),
      sqlstate("KA002"),
    );
    await record(k, money, id, "submitted", { p_tx_signature: SIG_1 });
    await assert.rejects(record(k, money, id, "confirmed", { p_tx_signature: SIG_1 }), sqlstate("KA003"));
    await record(k, money, id, "failed", { p_tx_signature: SIG_1, p_detail: "chain rejected" });
    assert.equal(await money.balance(money.payable), solve(100), "a failure books nothing");
    await record(k, money, id, "submitted", { p_tx_signature: SIG_2 });
    await record(k, money, id, "needs_reconciliation", { p_tx_signature: SIG_2, p_detail: "rpc timeout" });
    await record(k, money, id, "confirmed", { p_tx_signature: SIG_2, p_evidence: chainEvidence });
    assert.equal(await money.balance(money.payable), BigInt(0));
  });

  it("stops a revoked settlement service", async () => {
    const { k, money, entitlementId } = await entitled();
    await k.rpc(alice, "link_wallet", { p_chain: "litesvm", p_address: WALLET_A });
    const id = await k.value(alice, "prepare_settlement", { p_entitlement_id: entitlementId, p_recipient_address: WALLET_A });
    const grants = await k.rpc(service, "my_grants", { p_as_actor: money.settlementService });
    const recordGrant = grants.find((g) => g.capability === "kernel.settlement.record");
    await k.rpc(money.founder, "revoke_grant", { p_grant_id: recordGrant!.id });
    await assert.rejects(record(k, money, id, "submitted", { p_tx_signature: SIG_1 }), sqlstate("KA002"));
  });

  it("keeps one actor's settlements and World private from another", async () => {
    const { k, money, ids, entitlementId } = await entitled();
    await k.rpc(alice, "link_wallet", { p_chain: "litesvm", p_address: WALLET_A });
    const id = await k.value(alice, "prepare_settlement", { p_entitlement_id: entitlementId, p_recipient_address: WALLET_A });
    await assert.rejects(k.rpc(bob, "read_settlement", { p_settlement_id: id }), sqlstate("KA002"));
    await assert.rejects(k.rpc(bob, "read_events", { p_scope: ids.world }), sqlstate("KA002"));
    await assert.rejects(k.rpc(bob, "read_evidence", { p_event_id: ids.outcome }), sqlstate("KA002"));
    assert.deepEqual(await k.rpc(bob, "my_entitlements"), []);
    assert.equal((await k.rpc(alice, "read_settlement", { p_settlement_id: id }))[0].status, "prepared");
    assert.equal((await k.rpc(service, "read_settlement", { p_settlement_id: id, p_as_actor: money.settlementService }))[0].status, "prepared");
  });
});

describe("idempotency", () => {
  it("rejects a reused key with a changed payload", async () => {
    const { k, aliceId } = await setup();
    const scope = `actor:${aliceId}`;
    const args = { p_type: "note.created", p_scope: scope, p_payload: { n: 1 }, p_idempotency_key: "k1" };
    const first = await k.value(alice, "record_event", args);
    assert.equal(await k.value(alice, "record_event", args), first);
    await assert.rejects(k.rpc(alice, "record_event", { ...args, p_payload: { n: 2 } }), sqlstate("KA004"));
  });

  it("lets carol do nothing in a World she was never granted", async () => {
    const { k, money, aliceId } = await setup();
    await k.value(carol, "register");
    const ids = await worldWithOutcome(k, money, alice, aliceId);
    await assert.rejects(
      k.rpc(carol, "record_event", { p_type: "outcome.completed", p_scope: ids.world, p_payload: { obligation_event_id: ids.obligation } }),
      sqlstate("KA002"),
    );
  });
});
