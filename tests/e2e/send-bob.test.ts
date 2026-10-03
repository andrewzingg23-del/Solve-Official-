// "Send Bob $10" on test assets: the kernel (real migrations in PGlite) records intent, route and
// outcome; LiteSVM executes the real SPL programs. Every adversarial case ends with Bob paid at
// most once and the payer whole whenever a payment did not execute.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { address, generateKeyPairSigner, getBase64Encoder, getTransactionDecoder, type Transaction } from "@solana/kit";
import { solve } from "../../lib/chain/solve";
import { KernelError } from "../../lib/kernel/client";
import { reconcilePayment, routeRecord, sendPayment, submitPayment } from "../../lib/money/payment";
import { buildPaymentTransaction, paymentExecuted, PaymentError } from "../../lib/router/execute";
import { QuoteError } from "../../lib/router/math";
import { createKernelDb } from "../kernel/harness";
import { ARC, paymentMarket, paymentsKernel, USD } from "../support/payment-fixture";

async function world() {
  const market = await paymentMarket();
  const k = await createKernelDb();
  const p = await paymentsKernel(k, market);
  await market.fund(p.aliceWallet.address, "ARC", ARC(1_000));
  await market.fund(p.aliceWallet.address, "DEV_SOLVE", solve(1_000));

  const intent = (idempotencyKey?: string) =>
    p.alice.createPaymentIntent({
      recipientId: p.bobId,
      chain: "litesvm",
      asset: "DEV_USDC",
      amount: USD(10),
      maxSlippageBps: 50,
      memo: "Send Bob $10",
      idempotencyKey,
    });
  const pay = (paymentId: string, extra: Partial<Parameters<typeof sendPayment>[0]> = {}) =>
    sendPayment({ payerKernel: p.alice, rail: p.rail, router: market.router, payer: p.aliceWallet, sponsor: market.chain.sponsor, paymentId, ...extra });

  // Quote and choose a route by hand, for cases that interfere between steps.
  const choose = async (paymentId: string, recipient?: string) => {
    const payment = await p.alice.readPayment(paymentId);
    const quote = await market.router.quote({
      payer: p.aliceWallet.address,
      recipient: address(recipient ?? payment.recipient_address),
      denomination: payment.asset,
      amount: BigInt(payment.amount),
      accepts: payment.accept_assets,
      maxSlippageBps: payment.max_slippage_bps,
    });
    const route = quote.best!;
    const select = () =>
      p.alice.selectPaymentRoute({
        paymentId,
        route: routeRecord(quote, route),
        payerAddress: p.aliceWallet.address,
        recipientAddress: quote.request.recipient,
        inputAsset: route.input,
        inputAmount: route.inputAmount,
        maxInput: route.maxInput,
        deliverAsset: route.deliver,
        deliverAmount: route.deliverAmount,
        quotedAt: quote.quotedAt,
        expiresAt: quote.expiresAt,
      });
    const build = () =>
      buildPaymentTransaction({
        router: market.router,
        route,
        quote,
        paymentId,
        recipient: address(payment.recipient_address),
        payer: p.aliceWallet,
        sponsor: market.chain.sponsor,
      });
    return { payment, quote, route, select, build };
  };

  const bobUsd = () => market.balance(p.bobWallet.address, "DEV_USDC");
  const aliceArc = () => market.balance(p.aliceWallet.address, "ARC");
  const executed = (paymentId: string) => paymentExecuted(market.chain.gateway, p.aliceWallet.address, paymentId);
  const transitions = async (paymentId: string) =>
    (await k.owner("select attempt, status, tx_signature from kernel.payment_transitions where payment_id = $1 order by id", [paymentId])).map(
      (r) => `${r.attempt}:${r.status}`,
    );
  return { market, k, ...p, intent, pay, choose, bobUsd, aliceArc, executed, transitions };
}

const failsWith = (reason: string) => (error: unknown) => {
  assert.ok(error instanceof PaymentError, `expected PaymentError, got ${error}`);
  assert.equal(error.reason, reason);
  return true;
};
const kernelInvalid = (pattern: RegExp) => (error: unknown) => {
  assert.ok(error instanceof KernelError && error.name === "invalid", `expected invalid, got ${error}`);
  assert.match(error.message, pattern);
  return true;
};

describe("Send Bob $10", () => {
  it("routes, executes atomically, and records the payment with chain evidence", async () => {
    const w = await world();
    const paymentId = await w.intent();
    const arcBefore = await w.aliceArc();
    const poolArcBefore = await w.market.balance(w.market.venueSigners["arc-usdc"].address, "ARC");

    const result = await w.pay(paymentId);
    assert.equal(result.status, "confirmed");
    assert.deepEqual(result.log.map((l) => l.route), ["ARC-[arc-usdc]->DEV_USDC"]);

    assert.equal(await w.bobUsd(), USD(10));
    const payment = await w.bob.readPayment(paymentId);
    assert.equal(payment.status, "confirmed");
    assert.equal(payment.deliver_amount, USD(10).toString());
    assert.equal(payment.tx_signature, result.signature);
    const paid = BigInt(payment.executed_input!);
    assert.equal(arcBefore - (await w.aliceArc()), paid);
    assert.ok(paid <= BigInt(payment.max_input!));
    assert.equal((await w.market.balance(w.market.venueSigners["arc-usdc"].address, "ARC")) - poolArcBefore, paid);

    // The payment id is derived from the intent and names the on-chain marker.
    assert.equal(paymentId, createHash("sha256").update(`solve:payment:v1|${payment.intent_id}`).digest("hex"));
    assert.equal(await w.executed(paymentId), true);
    // Fees were sponsored: Alice's wallet has never held SOL.
    assert.equal(await w.market.chain.gateway.getAccount(w.aliceWallet.address), null);

    // The kernel keeps the executable quote that justified the route, and the evidence.
    const [row] = await w.k.owner("select route from kernel.payment_routes where payment_id = $1", [paymentId]);
    const record = row.route as { route: { costs: Record<string, string>; legs: { spot: { num: string }; depth: object }[] } };
    assert.equal(record.route.costs.netOutput, USD(10).toString());
    assert.ok(BigInt(record.route.costs.gross) > USD(10));
    assert.ok(record.route.legs[0].spot.num && record.route.legs[0].depth);
    assert.deepEqual(await w.transitions(paymentId), ["1:routed", "1:submitted", "1:confirmed"]);
    const [evidence] = await w.k.owner(
      `select ev.basis from kernel.evidence ev join kernel.payment_transitions t on t.event_id = ev.event_id
       where t.payment_id = $1 and t.status = 'confirmed'`,
      [paymentId],
    );
    assert.equal(evidence.basis, "externally_verified");

    const [sent] = await w.alice.myPayments();
    const [received] = await w.bob.myPayments();
    assert.equal(sent.direction, "sent");
    assert.equal(received.direction, "received");
    assert.equal(received.counterparty_id, w.aliceId);
    assert.equal((await w.rail.kernel.verifyChain()).ok, true);
  });

  it("never pays twice: retries, replays and rebuilt transactions do nothing", async () => {
    const w = await world();
    const paymentId = await w.intent("send-bob-10");
    assert.equal(await w.intent("send-bob-10"), paymentId, "the same request with the same key is the same payment");
    await w.pay(paymentId);
    const arcAfter = await w.aliceArc();

    const again = await w.pay(paymentId);
    assert.equal(again.status, "confirmed");
    assert.deepEqual(await w.transitions(paymentId), ["1:routed", "1:submitted", "1:confirmed"]);

    // Resending the recorded bytes is rejected by the cluster.
    const payment = await w.alice.readPayment(paymentId);
    const replay = getTransactionDecoder().decode(getBase64Encoder().encode(payment.wire_transaction!)) as Transaction;
    assert.equal((await w.market.chain.gateway.send(replay as never)).status, "failed");

    // A freshly built transaction for the same payment cannot execute: the marker exists.
    const { build } = await w.choose(paymentId);
    const rebuilt = await build();
    assert.equal((await w.market.chain.gateway.send(rebuilt.transaction)).status, "failed");

    assert.equal(await w.bobUsd(), USD(10));
    assert.equal(await w.aliceArc(), arcAfter);
    await assert.rejects(w.choose(paymentId).then((c) => c.select()), kernelInvalid(/confirmed and cannot take a new route/));
  });

  it("refuses a stale quote, then pays on a fresh one", async () => {
    const w = await world();
    const paymentId = await w.intent();
    const first = await w.choose(paymentId);
    const attempt = await first.select();
    w.market.advance(31);
    await assert.rejects(first.build(), failsWith("stale_quote"));
    assert.equal(await w.executed(paymentId), false);
    w.market.clock.offset = 0;
    await w.rail.kernel.recordPayment({ paymentId, attempt, status: "failed", detail: "stale quote" });

    // The kernel refuses expired quotes on its own clock too.
    const expired = { quotedAt: new Date(Date.now() - 60_000).toISOString(), expiresAt: new Date(Date.now() - 30_000).toISOString() };
    await assert.rejects(
      w.alice.selectPaymentRoute({
        paymentId,
        route: {},
        payerAddress: w.aliceWallet.address,
        recipientAddress: w.bobWallet.address,
        inputAsset: "ARC",
        inputAmount: "1",
        maxInput: "1",
        deliverAsset: "DEV_USDC",
        deliverAmount: USD(10),
        ...expired,
      }),
      kernelInvalid(/stale quote/),
    );

    const result = await w.pay(paymentId);
    assert.equal(result.status, "confirmed");
    assert.equal(result.attempt, 2);
    assert.equal(await w.bobUsd(), USD(10));
  });

  it("refuses to execute when the price moved beyond the slippage tolerance", async () => {
    const w = await world();
    const paymentId = await w.intent();
    const first = await w.choose(paymentId);
    const attempt = await first.select();

    // The pool loses 5% of its DEV-USDC after the quote: the same $10 now costs about 5% more ARC.
    await w.market.withdraw(w.market.venueSigners["arc-usdc"], "DEV_USDC", USD(5_000));
    const arcBefore = await w.aliceArc();
    await assert.rejects(first.build(), failsWith("slippage"));
    assert.equal(await w.aliceArc(), arcBefore);
    await w.rail.kernel.recordPayment({ paymentId, attempt, status: "failed", detail: "slippage" });

    const result = await w.pay(paymentId);
    assert.equal(result.status, "confirmed");
    const payment = await w.alice.readPayment(paymentId);
    assert.ok(BigInt(payment.executed_input!) <= BigInt(payment.max_input!));
    assert.equal(await w.bobUsd(), USD(10));
  });

  it("falls back to another venue when one stops responding mid-payment", async () => {
    const w = await world();
    const pool = w.market.venue("arc-usdc");
    pool.cosign = async () => {
      pool.offline = true;
      throw new QuoteError("provider_unavailable", "arc-usdc stopped responding");
    };
    const paymentId = await w.intent();
    const result = await w.pay(paymentId);

    assert.equal(result.status, "confirmed");
    assert.equal(result.log.length, 2);
    assert.match(result.log[0].outcome, /^provider_unavailable/);
    assert.ok(!result.log[1].route!.includes("arc-usdc"));
    assert.deepEqual(await w.transitions(paymentId), ["1:routed", "1:failed", "2:routed", "2:submitted", "2:confirmed"]);
    assert.equal(await w.bobUsd(), USD(10));
  });

  it("a leg that fails on chain fails the whole route and the payer keeps everything", async () => {
    const w = await world();
    const paymentId = await w.intent();
    const arcBefore = await w.aliceArc();
    let drained = false;
    // After the venue co-signs, its DEV-USDC inventory disappears before the transaction lands.
    const result = await w.pay(paymentId, {
      maxAttempts: 1,
      beforeSubmit: async () => {
        if (drained) return;
        drained = true;
        await w.market.withdraw(w.market.venueSigners["arc-usdc"], "DEV_USDC", USD(100_000), { sameBlock: true });
      },
    });
    assert.equal(result.status, "failed");
    assert.match(result.detail!, /insufficient funds/);
    assert.equal(await w.aliceArc(), arcBefore, "the first leg was rolled back with the failed one");
    assert.equal(await w.bobUsd(), BigInt(0));
    assert.equal(await w.executed(paymentId), false);
    const failed = await w.alice.readPayment(paymentId);
    assert.equal(failed.status, "failed");
    assert.equal(failed.tx_signature, result.signature);

    const retry = await w.pay(paymentId);
    assert.equal(retry.status, "confirmed");
    assert.equal(retry.attempt, 2);
    assert.equal(await w.bobUsd(), USD(10));
  });

  it("a lost response is reconciled from the marker, exactly once", async () => {
    const w = await world();
    const paymentId = await w.intent();
    const arcBefore = await w.aliceArc();
    const first = await w.pay(paymentId, {
      beforeSubmit: async () => {
        w.market.chain.gateway.loseNextResponse = true;
      },
    });
    assert.equal(first.status, "needs_reconciliation");
    assert.equal(await w.bobUsd(), USD(10), "it executed; only the reply was lost");

    const second = await w.pay(paymentId);
    assert.equal(second.status, "confirmed");
    assert.equal(second.signature, first.signature);
    assert.match(second.detail!, /marker present/);
    assert.equal(await w.bobUsd(), USD(10));
    const paid = BigInt((await w.alice.readPayment(paymentId)).executed_input!);
    assert.equal(arcBefore - (await w.aliceArc()), paid);
  });

  it("an RPC outage leaves the outcome open until the recorded bytes are resent", async () => {
    const w = await world();
    const paymentId = await w.intent();
    const first = await w.pay(paymentId, {
      beforeSubmit: async () => {
        w.market.chain.gateway.offline = true;
      },
    });
    assert.equal(first.status, "needs_reconciliation");
    assert.equal(await w.bobUsd(), BigInt(0));

    w.market.chain.gateway.offline = false;
    const settled = await reconcilePayment(w.rail, paymentId);
    assert.equal(settled.status, "confirmed");
    assert.equal(settled.signature, first.signature, "the same transaction, not a new one");
    assert.equal(await w.bobUsd(), USD(10));
  });

  it("concurrent workers submitting the same payment settle it once", async () => {
    const w = await world();
    const paymentId = await w.intent();
    const { select, build } = await w.choose(paymentId);
    await select();
    const built = await build();
    const results = await Promise.all([submitPayment(w.rail, paymentId, built), submitPayment(w.rail, paymentId, built)]);
    assert.ok(results.every((r) => r.status === "confirmed"), JSON.stringify(results));
    assert.equal(await w.bobUsd(), USD(10));
    const confirmed = (await w.transitions(paymentId)).filter((t) => t.endsWith("confirmed"));
    assert.equal(confirmed.length, 1);
  });

  it("refuses to pay anyone but the address the recipient published", async () => {
    const w = await world();
    const paymentId = await w.intent();
    const mallory = await generateKeyPairSigner();
    const wrong = await w.choose(paymentId, mallory.address);
    await assert.rejects(wrong.select(), kernelInvalid(/recipient mismatch/));
    await assert.rejects(wrong.build(), failsWith("recipient_mismatch"));
    assert.equal(await w.market.balance(mallory.address, "DEV_USDC"), BigInt(0));
  });

  it("a venue refuses to sign a leg that underpays it", async () => {
    const w = await world();
    const pool = w.market.venue("arc-usdc");
    const honest = pool.quoteExactOut.bind(pool);
    // A faulty router quote: 1% less input than the curve requires.
    pool.quoteExactOut = async (...args) => {
      const leg = await honest(...args);
      return { ...leg, amountIn: (leg.amountIn * BigInt(99)) / BigInt(100) };
    };
    const paymentId = await w.intent();
    const arcBefore = await w.aliceArc();
    const result = await w.pay(paymentId, { maxAttempts: 1 });
    assert.equal(result.status, "failed");
    assert.match(result.detail!, /^venue_refused: arc-usdc refuses/);
    assert.equal(await w.aliceArc(), arcBefore);
    assert.equal(await w.executed(paymentId), false);
  });
});
