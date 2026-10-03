// The payment worker. The payer's side quotes and signs; the payment service submits and records.
// Like the settlement worker, it records "submitted" (with the signed bytes) before sending, never
// infers an outcome from a timeout, and reconciles with the on-chain payment marker.
import { address, getBase64Encoder, getTransactionDecoder, type Address, type TransactionSigner } from "@solana/kit";
import type { ChainGateway } from "../chain/gateway";
import { KernelError, type Kernel, type Payment, type PaymentStatus } from "../kernel/client";
import { buildPaymentTransaction, paymentExecuted, paymentMarkerAddress, PaymentError, type BuiltPayment } from "../router/execute";
import type { PaymentRouter } from "../router/router";
import type { Quote, Route } from "../router/types";
import { sha256Hex } from "./settlement";

export type PaymentRail = {
  // The kernel as the payment service actor (service-role key, actAs the service actor).
  kernel: Kernel;
  gateway: ChainGateway;
};

export type PaymentResult = {
  paymentId: string;
  attempt: number;
  status: PaymentStatus;
  signature: string | null;
  detail?: string;
};

// JSON form of a route for the kernel record: bigints as strings, prices as "num/den".
export function routeRecord(quote: Quote, route: Route) {
  const json = JSON.stringify({ quote_id: quote.id, quoted_at: quote.quotedAt, expires_at: quote.expiresAt, route, marks: quote.marks }, (_, v) =>
    typeof v === "bigint" ? v.toString() : v,
  );
  return JSON.parse(json) as Record<string, unknown>;
}

async function confirm(rail: PaymentRail, payment: Payment, attempt: number, signature: string, slot: bigint | undefined, detail = "") {
  const marker = await paymentMarkerAddress(address(payment.payer_address!), payment.payment_id);
  await rail.kernel.recordPayment({
    paymentId: payment.payment_id,
    attempt,
    status: "confirmed",
    txSignature: signature,
    slot,
    detail,
    evidence: [
      {
        basis: "externally_verified",
        content_hash: `sha256:${await sha256Hex(`${rail.gateway.cluster}|${signature}|${marker}|${slot ?? ""}`)}`,
        description: `${rail.gateway.cluster} transaction ${signature}; payment marker ${marker}`,
      },
    ],
  });
  return { paymentId: payment.payment_id, attempt, status: "confirmed" as const, signature, detail };
}

// Sends one built payment transaction for the current attempt and records the outcome.
export async function submitPayment(rail: PaymentRail, paymentId: string, built: BuiltPayment): Promise<PaymentResult> {
  const payment = await rail.kernel.readPayment(paymentId);
  const attempt = payment.attempt;
  try {
    await rail.kernel.recordPayment({
      paymentId,
      attempt,
      status: "submitted",
      txSignature: built.signature,
      inputAmount: built.inputAmount,
      wireTransaction: built.wire,
    });
  } catch (error) {
    // Another worker moved this payment first. Report its state; never send twice.
    if (error instanceof KernelError && error.name === "invalid") {
      const current = await rail.kernel.readPayment(paymentId);
      return { paymentId, attempt: current.attempt, status: current.status, signature: current.tx_signature, detail: error.message };
    }
    throw error;
  }
  return send(rail, payment, attempt, built.transaction, built.signature);
}

async function send(rail: PaymentRail, payment: Payment, attempt: number, transaction: BuiltPayment["transaction"], signature: string) {
  const paymentId = payment.payment_id;
  let outcome;
  try {
    outcome = await rail.gateway.send(transaction);
  } catch (error) {
    const detail = `outcome unknown: ${error instanceof Error ? error.message : String(error)}`.slice(0, 2000);
    await rail.kernel.recordPayment({ paymentId, attempt, status: "needs_reconciliation", txSignature: signature, detail });
    return { paymentId, attempt, status: "needs_reconciliation" as const, signature, detail };
  }
  if (outcome.status === "confirmed") return confirm(rail, payment, attempt, signature, outcome.slot);

  // A rejected send does not prove the payment never happened: the same bytes may already have
  // landed (a lost response, a concurrent worker). Only an absent marker makes it a failure.
  if (await paymentExecuted(rail.gateway, address(payment.payer_address!), paymentId)) {
    const current = await rail.kernel.readPayment(paymentId);
    if (current.status === "confirmed") return { paymentId, attempt, status: "confirmed" as const, signature };
    return confirm(rail, payment, attempt, signature, undefined, "reconciled: marker present after a rejected send");
  }
  const detail = outcome.error.slice(0, 2000);
  await rail.kernel.recordPayment({ paymentId, attempt, status: "failed", txSignature: signature, detail });
  return { paymentId, attempt, status: "failed" as const, signature, detail };
}

// Settles a payment whose outcome is unknown. The marker answers whether it executed; if not, the
// recorded transaction is resent byte for byte, so it can land at most once.
export async function reconcilePayment(rail: PaymentRail, paymentId: string): Promise<PaymentResult> {
  const payment = await rail.kernel.readPayment(paymentId);
  const { attempt, status } = payment;
  if (status !== "submitted" && status !== "needs_reconciliation") {
    return { paymentId, attempt, status, signature: payment.tx_signature };
  }
  const signature = payment.tx_signature!;
  if (await paymentExecuted(rail.gateway, address(payment.payer_address!), paymentId)) {
    return confirm(rail, payment, attempt, signature, undefined, "reconciled: payment marker present on chain");
  }
  const transaction = getTransactionDecoder().decode(getBase64Encoder().encode(payment.wire_transaction!));
  return send(rail, payment, attempt, transaction as BuiltPayment["transaction"], signature);
}

export type AttemptLog = { attempt: number; route: string | null; outcome: string };

// Pays one payment intent end to end: quote, choose, build, submit, and on a definite failure
// re-quote around the venues that failed. Safe to call again for the same payment.
export async function sendPayment(input: {
  payerKernel: Kernel;
  rail: PaymentRail;
  router: PaymentRouter;
  payer: TransactionSigner;
  sponsor: TransactionSigner;
  paymentId: string;
  maxAttempts?: number;
  // Hook for tests: runs after the route is built and co-signed, before it is submitted.
  beforeSubmit?: (built: BuiltPayment) => Promise<void>;
}): Promise<PaymentResult & { log: AttemptLog[] }> {
  const { payerKernel, rail, router, payer, sponsor, paymentId } = input;
  const maxAttempts = input.maxAttempts ?? 3;
  const excluded = new Set<string>();
  const log: AttemptLog[] = [];
  let last: PaymentResult | null = null;

  for (let i = 0; i < maxAttempts; i++) {
    const payment = await payerKernel.readPayment(paymentId);
    if (payment.status === "confirmed") return { ...(last ?? { paymentId, attempt: payment.attempt, status: "confirmed", signature: payment.tx_signature }), log };
    if (payment.status === "submitted" || payment.status === "needs_reconciliation") {
      last = await reconcilePayment(rail, paymentId);
      log.push({ attempt: last.attempt, route: null, outcome: `reconciled: ${last.status}` });
      if (last.status !== "failed") return { ...last, log };
      continue;
    }
    if (payment.status === "routed") {
      // A route was chosen but never submitted (the payer stopped). Fail it so a fresh quote can run.
      await rail.kernel.recordPayment({ paymentId, attempt: payment.attempt, status: "failed", detail: "abandoned before submission" });
      continue;
    }

    const quote = await router.quote({
      payer: payer.address,
      recipient: address(payment.recipient_address) as Address,
      denomination: payment.asset,
      amount: BigInt(payment.amount),
      accepts: payment.accept_assets,
      maxSlippageBps: payment.max_slippage_bps,
      excludeVenues: [...excluded],
    });
    const route = quote.best;
    if (!route) {
      const detail = `no route: ${quote.rejected.map((r) => `${r.path} (${r.reason})`).join("; ")}`.slice(0, 2000);
      log.push({ attempt: payment.attempt, route: null, outcome: detail });
      return { paymentId, attempt: payment.attempt, status: payment.status, signature: null, detail, log };
    }
    const label = route.legs.length ? route.legs.map((l) => `${l.input}-[${l.venue}]->${l.output}`).join(" ") : `${route.input} transfer`;
    const attempt = await payerKernel.selectPaymentRoute({
      paymentId,
      route: routeRecord(quote, route),
      payerAddress: payer.address,
      recipientAddress: quote.request.recipient,
      inputAsset: route.input,
      inputAmount: route.inputAmount,
      maxInput: route.maxInput,
      deliverAsset: route.deliver,
      deliverAmount: route.deliverAmount,
      quotedAt: quote.quotedAt,
      expiresAt: quote.expiresAt,
    });

    let built: BuiltPayment;
    try {
      built = await buildPaymentTransaction({
        router,
        route,
        quote,
        paymentId,
        recipient: address(payment.recipient_address),
        payer,
        sponsor,
      });
      await input.beforeSubmit?.(built);
    } catch (error) {
      if (!(error instanceof PaymentError)) throw error;
      const detail = `${error.reason}: ${error.message}`.slice(0, 2000);
      await rail.kernel.recordPayment({ paymentId, attempt, status: "failed", detail });
      if (error.venue) excluded.add(error.venue);
      last = { paymentId, attempt, status: "failed", signature: null, detail };
      log.push({ attempt, route: label, outcome: detail });
      continue;
    }

    last = await submitPayment(rail, paymentId, built);
    log.push({ attempt, route: label, outcome: last.status + (last.detail ? `: ${last.detail.split("\n")[0]}` : "") });
    if (last.status !== "failed") return { ...last, log };
    // The route failed on chain and nothing moved. Route around its venues next time.
    for (const leg of route.legs) excluded.add(leg.venue);
  }
  const final = await payerKernel.readPayment(paymentId);
  return { ...(last ?? { paymentId, attempt: final.attempt, status: final.status, signature: final.tx_signature }), log };
}
