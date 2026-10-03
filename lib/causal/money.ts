// Money as a provider: a payment through the existing router, performed for a route step that
// authorizes `payment.send` for an amount the kernel's leases and policies have decided on. The
// payment itself is the proven payment physics (intent, route, atomic execution, exactly-once
// settlement, reconciliation from the chain marker); this file only turns a step into one payment
// intent per action and reports the outcome as evidence. It needs a chain and a router, so it is
// registered where those exist (Node, a server); a browser sandbox without them says so.
import type { TransactionSigner } from "@solana/kit";
import type { Kernel } from "../kernel/client";
import { sendPayment, type PaymentRail } from "../money/payment";
import { sha256Hex } from "../money/settlement";
import type { PaymentRouter } from "../router/router";
import type { Provider } from "./providers";

export type Treasury = {
  // The payer's own kernel session (the payment intent is theirs).
  payerKernel: Kernel;
  rail: PaymentRail;
  router: PaymentRouter;
  payer: TransactionSigner;
  sponsor: TransactionSigner;
};

export function routerPayment(treasury: Treasury): Provider {
  return {
    id: "router.payment",
    capability: "payment.send",
    async perform({ actionId, step, world }) {
      const org = step.binding.org;
      const title = world.entities.get(org)?.title ?? org;
      // Payments go to principals: the one the World Graph records as controlling the organization.
      const recipient = world.relations.find((r) => r.kind === "controls" && r.to_ref === org)?.from_ref ?? null;
      if (!recipient?.startsWith("actor:")) return { provider: this.id, status: "failed", result: {}, evidence: [], detail: `no principal controls ${title} on record` };
      const amount = String(step.payload.amount);
      const asset = String(step.payload.asset);
      // One intent per action: a retry after a crash or a lost reply continues the same payment.
      const paymentId = await treasury.payerKernel.createPaymentIntent({
        recipientId: recipient.slice("actor:".length),
        chain: "litesvm",
        asset,
        amount: BigInt(amount),
        maxSlippageBps: 50,
        memo: `${String(step.payload.purpose ?? "payment")} for ${title}`.slice(0, 120),
        idempotencyKey: `payment:${actionId}`,
      });
      const paid = await sendPayment({ payerKernel: treasury.payerKernel, rail: treasury.rail, router: treasury.router, payer: treasury.payer, sponsor: treasury.sponsor, paymentId });
      const result = { payment_id: paymentId, tx_signature: paid.signature, amount, asset, recipient, provider: this.id };
      if (paid.status === "confirmed") {
        return {
          provider: this.id,
          status: "succeeded",
          result,
          evidence: [
            {
              basis: "artifact",
              content_hash: `sha256:${await sha256Hex(`${paymentId}|${paid.signature}`)}`,
              description: `Payment ${paymentId} confirmed on ${treasury.rail.gateway.cluster}, transaction ${paid.signature}; the kernel's payment record carries the chain evidence`.slice(0, 500),
            },
          ],
          detail: `paid ${title}`,
        };
      }
      if (paid.status === "failed") return { provider: this.id, status: "failed", result, evidence: [], detail: paid.detail ?? "the payment failed" };
      // Submitted or needs_reconciliation: the chain will say; the action waits for reconciliation.
      return { provider: this.id, status: "unknown", result, evidence: [], detail: `payment ${paid.status}${paid.detail ? `: ${paid.detail}` : ""}` };
    },
  };
}
