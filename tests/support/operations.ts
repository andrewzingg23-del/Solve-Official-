// The SOV operating collective (lib/ops/collective.ts) installed on the payment world, with a way
// to produce the failure it handles: a payment whose chain response is lost.
import { kernelClient, type Kernel } from "../../lib/kernel/client";
import { sendPayment } from "../../lib/money/payment";
import { installCollective } from "../../lib/ops/collective";
import { railScope } from "../../lib/ops/reconcile";
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

  const payments = p.rail.kernel;
  const { trustService, opsService, workerId, verifierId } = await installCollective(steward, { paymentService: p.paymentService, chain: "litesvm", as });
  const trust = as(trustService);
  const ops = as(opsService);

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
