import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { solve, settlementExecuted, walletBalance } from "../../lib/chain/solve";
import { KernelError, kernelClient } from "../../lib/kernel/client";
import { settle } from "../../lib/money/settlement";
import { anon, service } from "../kernel/harness";
import { pgliteSupabase } from "../support/pglite-supabase";
import {
  approveEarnCapacity,
  clientFor,
  earnMirror,
  preparedSettlement,
  proofEnvironment,
  runProofOfLife,
} from "../support/proof-of-life";

describe("monetary proof-of-life", () => {
  it("carries one outcome from identity to on-chain ownership and back into the record", async () => {
    const run = await runProofOfLife();
    assert.equal(run.steps.length, 16);
    assert.equal(run.prepared.settlementId, run.expectedSettlement);
    assert.equal(run.entitlement.amount, solve(100).toString());
    assert.equal(run.result.status, "confirmed");
    assert.equal(run.marker, true);
    assert.equal(run.settled.status, "confirmed");
    assert.equal(run.settled.tx_signature, run.result.signature);
    assert.equal(run.aliceBalance, solve(100));
    assert.equal(run.transfer.status, "confirmed");
    assert.equal(run.bobBalance, solve(40));
    assert.equal(run.aliceAfter, solve(60));
    assert.equal(run.reloaded.status, "confirmed");
    assert.equal(run.mirror.match, true);
    assert.equal(run.mirror.chain, solve(450_000_000) - solve(100));
    assert.equal(run.integrity.ok, true);
    assert.equal(await run.env.money.balance(run.env.money.payable), BigInt(0));
  });
});

describe("settlement under retries, races and failures", () => {
  async function setup(options?: Parameters<typeof proofEnvironment>[0]) {
    const env = await proofEnvironment(options);
    const alice = clientFor(env.k, "auth-alice");
    const aliceId = await alice.register();
    return { env, alice, aliceId };
  }

  it("settles once under exact retries and concurrent workers", async () => {
    const { env, alice, aliceId } = await setup();
    const prepared = await preparedSettlement(env, alice, aliceId);
    const results = await Promise.all([settle(env.rail, prepared.settlementId), settle(env.rail, prepared.settlementId)]);
    assert.ok(results.some((r) => r.status === "confirmed"));
    const again = await settle(env.rail, prepared.settlementId);
    assert.equal(again.status, "confirmed");
    assert.equal(await walletBalance(env.chain.gateway, prepared.wallet.address, env.chain.manifest.mint), solve(100));
    assert.equal((await earnMirror(env)).match, true);
  });

  it("never records a failed release as completed, and retries safely once capacity exists", async () => {
    const { env, alice, aliceId } = await setup({ releaseCapacity: solve(150) });
    const first = await preparedSettlement(env, alice, aliceId);
    assert.equal((await settle(env.rail, first.settlementId)).status, "confirmed");

    const second = await preparedSettlement(env, alice, aliceId);
    const failed = await settle(env.rail, second.settlementId);
    assert.equal(failed.status, "failed");
    assert.equal(await walletBalance(env.chain.gateway, second.wallet.address, env.chain.manifest.mint), BigInt(0));
    assert.equal(await env.money.balance(env.money.payable), solve(100), "the obligation is still owed");
    assert.equal((await earnMirror(env)).match, true);

    assert.equal((await approveEarnCapacity(env, solve(1_000))).status, "confirmed");
    assert.equal((await settle(env.rail, second.settlementId)).status, "confirmed");
    assert.equal(await walletBalance(env.chain.gateway, second.wallet.address, env.chain.manifest.mint), solve(100));
    assert.equal(await env.money.balance(env.money.payable), BigInt(0));
  });

  it("survives an RPC outage before submission without losing the obligation", async () => {
    const { env, alice, aliceId } = await setup();
    const prepared = await preparedSettlement(env, alice, aliceId);
    env.chain.gateway.offline = true;
    assert.equal((await settle(env.rail, prepared.settlementId)).status, "needs_reconciliation");
    assert.equal(await settlementExecuted(env.chain.gateway, env.chain.manifest.settlementAuthority, prepared.settlementId), false);
    env.chain.gateway.offline = false;
    assert.equal((await settle(env.rail, prepared.settlementId)).status, "confirmed");
    assert.equal(await walletBalance(env.chain.gateway, prepared.wallet.address, env.chain.manifest.mint), solve(100));
  });

  it("reconciles a release whose response was lost, without sending again", async () => {
    const { env, alice, aliceId } = await setup();
    const prepared = await preparedSettlement(env, alice, aliceId);
    env.chain.gateway.loseNextResponse = true;
    const lost = await settle(env.rail, prepared.settlementId);
    assert.equal(lost.status, "needs_reconciliation");
    assert.equal(await settlementExecuted(env.chain.gateway, env.chain.manifest.settlementAuthority, prepared.settlementId), true);

    const reconciled = await settle(env.rail, prepared.settlementId);
    assert.equal(reconciled.status, "confirmed");
    assert.equal(reconciled.signature, lost.signature);
    assert.equal(await walletBalance(env.chain.gateway, prepared.wallet.address, env.chain.manifest.mint), solve(100));
    assert.equal((await earnMirror(env)).match, true);
  });

  it("gives client-supplied actor ids no authority", async () => {
    const { env, alice, aliceId } = await setup();
    const prepared = await preparedSettlement(env, alice, aliceId);
    const impersonating = kernelClient(pgliteSupabase(env.k, { role: "authenticated", sub: "auth-alice" }), {
      actAs: env.money.settlementService,
    });
    await assert.rejects(
      impersonating.recordSettlement({ settlementId: prepared.settlementId, status: "submitted", txSignature: "5".repeat(88) }),
      (e: unknown) => e instanceof KernelError && e.name === "forbidden",
    );
    await assert.rejects(
      kernelClient(pgliteSupabase(env.k, anon)).prepareSettlement(prepared.entitlementId, prepared.wallet.address),
      (e: unknown) => e instanceof KernelError,
    );
    const bob = clientFor(env.k, "auth-bob");
    await bob.register();
    await assert.rejects(
      bob.prepareSettlement(prepared.entitlementId, prepared.wallet.address),
      (e: unknown) => e instanceof KernelError && e.name === "forbidden",
    );
    await assert.rejects(bob.readEvents(prepared.world), (e: unknown) => e instanceof KernelError && e.name === "forbidden");
    // The service key cannot pose as Alice either.
    await assert.rejects(
      kernelClient(pgliteSupabase(env.k, service), { actAs: aliceId }).myEntitlements(),
      (e: unknown) => e instanceof KernelError && e.name === "forbidden",
    );
  });
});
