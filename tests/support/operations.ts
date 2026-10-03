// The SOV operating collective on the payment world: the payment service runs reconciliation (it
// opens tasks and leases its own worker agent), a separate trust service verifies (its agent is a
// distinct party), and the operations service learns from completed work. The steward grants each
// service only what its role needs and makes reconciliation a governed action.
import { kernelClient, type Kernel } from "../../lib/kernel/client";
import { sendPayment } from "../../lib/money/payment";
import { OPS_SCOPE } from "../../lib/ops/learning";
import { RECONCILE, railScope } from "../../lib/ops/reconcile";
import { solve } from "../../lib/chain/solve";
import { createKernelDb, service } from "../kernel/harness";
import { ARC, paymentMarket, paymentsKernel, USD } from "./payment-fixture";
import { pgliteSupabase } from "./pglite-supabase";

export async function operationsWorld() {
  const market = await paymentMarket();
  const k = await createKernelDb();
  const p = await paymentsKernel(k, market);
  await market.fund(p.aliceWallet.address, "ARC", ARC(1_000));
  await market.fund(p.aliceWallet.address, "DEV_SOLVE", solve(1_000));
  const as = (actorId: string): Kernel => kernelClient(pgliteSupabase(k, service), { actAs: actorId });
  const scope = railScope("litesvm");
  const steward = p.founder;

  // Payment service: detects unsettled payments, opens tasks, leases its worker.
  for (const capability of ["task.create", "kernel.read", RECONCILE.capability, "kernel.grant.issue"]) {
    await steward.issueGrant({ grantee: p.paymentService, capability, scope });
  }
  await steward.issueGrant({ grantee: p.paymentService, capability: "kernel.actor.create", scope: `actor:${p.paymentService}` });

  // Trust service: verifies and authorizes; never performs payments.
  const trustService = await steward.createServiceActor("SOV trust");
  for (const capability of ["task.verify", RECONCILE.approve, "kernel.read", "kernel.grant.issue"]) {
    await steward.issueGrant({ grantee: trustService, capability, scope });
  }
  await steward.issueGrant({ grantee: trustService, capability: "kernel.actor.create", scope: `actor:${trustService}` });

  // Operations service: reads completed work, records learning and build proposals.
  const opsService = await steward.createServiceActor("SOV operations");
  await steward.issueGrant({ grantee: opsService, capability: "kernel.read", scope });
  await steward.issueGrant({ grantee: opsService, capability: "ops.*", scope: OPS_SCOPE });
  await steward.issueGrant({ grantee: opsService, capability: "kernel.read", scope: OPS_SCOPE });

  // Reconciliation is governed: the worker proposes, a distinct party must authorize.
  await steward.setActionPolicy({ scope, capability: RECONCILE.capability, requirement: "second_authority", approverCapability: RECONCILE.approve, distinctBy: "party" });

  const payments = p.rail.kernel;
  const trust = as(trustService);
  const ops = as(opsService);
  const workerId = await payments.spawnAgent({ label: "Reconciler", role: "system_agent", idempotencyKey: "reconciler" });
  const verifierId = await trust.spawnAgent({ label: "Verifier", role: "system_agent", idempotencyKey: "verifier" });

  // A payment from Alice to Bob whose chain response is lost: it executes, but the payment service
  // cannot tell, so it records needs_reconciliation.
  let n = 0;
  const lostPayment = async () => {
    const paymentId = await p.alice.createPaymentIntent({
      recipientId: p.bobId,
      chain: "litesvm",
      asset: "DEV_USDC",
      amount: USD(10),
      maxSlippageBps: 50,
      memo: "Send Bob $10",
      idempotencyKey: `lost-${++n}`,
    });
    const result = await sendPayment({
      payerKernel: p.alice,
      rail: p.rail,
      router: market.router,
      payer: p.aliceWallet,
      sponsor: market.chain.sponsor,
      paymentId,
      beforeSubmit: async () => {
        market.chain.gateway.loseNextResponse = true;
      },
    });
    if (result.status !== "needs_reconciliation") throw new Error(`expected an unknown outcome, got ${result.status}`);
    return paymentId;
  };

  return {
    k,
    market,
    p,
    scope,
    steward,
    payments,
    trust,
    ops,
    trustService,
    opsService,
    workerId,
    verifierId,
    worker: as(workerId),
    verifier: as(verifierId),
    as,
    lostPayment,
    bobUsd: () => market.balance(p.bobWallet.address, "DEV_USDC"),
  };
}
