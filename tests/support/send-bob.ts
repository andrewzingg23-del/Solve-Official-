// "Send Bob $10" on test assets, as plain data for the script and the app.
// Kernel: the real migrations in PGlite. Chain: LiteSVM running the real SPL programs.
// DEV-USDC and ARC are test-only mints; DEV-SOLVE comes from the real genesis. None carries value.
import { solve, tokenAccountAddress } from "../../lib/chain/solve";
import { sendPayment } from "../../lib/money/payment";
import { paymentExecuted } from "../../lib/router/execute";
import { formatRatio } from "../../lib/router/math";
import type { Route } from "../../lib/router/types";
import { createKernelDb } from "../kernel/harness";
import { ARC, paymentMarket, paymentsKernel, USD } from "./payment-fixture";

const usd = (v: bigint) => `$${(Number(v) / 1e6).toFixed(6)}`;

export type SendBobRun = {
  setup: string;
  paymentId: string;
  recipient: string;
  expiresAt: string;
  routes: { label: string; input: string; cost: string; tradingFees: string; providerFees: string; slippage: string; best: boolean }[];
  legs: { venue: string; kind: string; operator: string; spot: string; twap: string; depth: string }[];
  identity: string;
  network: string;
  status: string;
  signature: string | null;
  alicePaid: string;
  limit: string;
  bob: string;
  bobAccount: string;
  marker: boolean;
  kernelStatus: string;
  retry: string;
  history: string;
  pass: boolean;
};

export async function runSendBob(): Promise<SendBobRun> {
  const market = await paymentMarket();
  const k = await createKernelDb();
  const p = await paymentsKernel(k, market);
  await market.fund(p.aliceWallet.address, "ARC", ARC(1_000));
  await market.fund(p.aliceWallet.address, "DEV_SOLVE", solve(1_000));
  const asset = market.assets;
  const amount = (code: string, v: bigint) =>
    `${(Number(v) / 10 ** asset[code].decimals).toLocaleString("en-US", { maximumFractionDigits: 6 })} ${asset[code].symbol}`;
  const price = (r: { num: bigint; den: bigint }, from: string, to: string) => formatRatio(r, asset[from].decimals, asset[to].decimals);

  const paymentId = await p.alice.createPaymentIntent({
    recipientId: p.bobId,
    chain: "litesvm",
    asset: "DEV_USDC",
    amount: USD(10),
    maxSlippageBps: 50,
    memo: "Send Bob $10",
  });
  const quote = await market.router.quote({
    payer: p.aliceWallet.address,
    recipient: p.bobWallet.address,
    denomination: "DEV_USDC",
    amount: USD(10),
    accepts: ["DEV_USDC"],
    maxSlippageBps: 50,
  });
  const label = (r: Route) => (r.legs.length ? `${r.input} ` + r.legs.map((l) => `-[${l.venue}]-> ${l.output}`).join(" ") : `${r.input} transfer`);
  const best = quote.best!;
  const c = best.costs;

  const result = await sendPayment({
    payerKernel: p.alice,
    rail: p.rail,
    router: market.router,
    payer: p.aliceWallet,
    sponsor: market.chain.sponsor,
    paymentId,
  });
  const payment = await p.bob.readPayment(paymentId);
  const bobAfter = await market.balance(p.bobWallet.address, "DEV_USDC");
  const marker = await paymentExecuted(market.chain.gateway, p.aliceWallet.address, paymentId);
  const again = await sendPayment({
    payerKernel: p.alice,
    rail: p.rail,
    router: market.router,
    payer: p.aliceWallet,
    sponsor: market.chain.sponsor,
    paymentId,
  });
  const bobFinal = await market.balance(p.bobWallet.address, "DEV_USDC");
  const integrity = await p.rail.kernel.verifyChain();

  return {
    setup: "Alice holds 1,000 ARC and 1,000 DEV-SOLVE, no DEV-USDC. Bob accepts DEV-USDC.",
    paymentId,
    recipient: p.bobWallet.address,
    expiresAt: quote.expiresAt,
    routes: quote.routes.map((r) => ({
      label: label(r),
      input: amount(r.input, r.inputAmount),
      cost: usd(r.costs.total),
      tradingFees: usd(r.costs.tradingFees),
      providerFees: usd(r.costs.providerFees),
      slippage: usd(r.costs.slippage),
      best: r === best,
    })),
    legs: best.legs.map((l) => ({
      venue: l.venue,
      kind: l.kind,
      operator: l.operator,
      spot: `${price(l.spot, l.input, l.output)} ${asset[l.output].symbol} per ${asset[l.input].symbol}`,
      twap: l.twap ? price(l.twap.price, l.input, l.output) : "none observed",
      depth: amount(l.output, l.depth.output),
    })),
    identity: `NetOutput ${usd(c.netOutput)} = Gross ${usd(c.gross)} − network ${usd(c.networkCost)} − fees ${usd(c.tradingFees)} − provider ${usd(c.providerFees)} − slippage ${usd(c.slippage)}`,
    network: `${best.network.lamports} lamports, paid by the sponsor`,
    status: result.status,
    signature: result.signature,
    alicePaid: amount(payment.input_asset!, BigInt(payment.executed_input!)),
    limit: amount(payment.input_asset!, BigInt(payment.max_input!)),
    bob: amount("DEV_USDC", bobAfter),
    bobAccount: await tokenAccountAddress(p.bobWallet.address, asset.DEV_USDC.mint),
    marker,
    kernelStatus: payment.status,
    retry: `${again.status}; Bob still holds ${amount("DEV_USDC", bobFinal)}`,
    history: `${integrity.ok ? "intact" : "BROKEN"} (${integrity.events_checked} events)`,
    pass: result.status === "confirmed" && marker && bobFinal === USD(10) && integrity.ok,
  };
}
