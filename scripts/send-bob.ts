// "Send Bob $10" on test assets, printed step by step.
//   npx tsx scripts/send-bob.ts
// Kernel: the real migrations in PGlite. Chain: LiteSVM running the real SPL programs.
// DEV-USDC and ARC are test-only mints; DEV-SOLVE comes from the real genesis. None carries value.
import { solve, tokenAccountAddress } from "../lib/chain/solve";
import { sendPayment } from "../lib/money/payment";
import { paymentExecuted } from "../lib/router/execute";
import { formatRatio } from "../lib/router/math";
import type { Route } from "../lib/router/types";
import { createKernelDb } from "../tests/kernel/harness";
import { ARC, paymentMarket, paymentsKernel, USD } from "../tests/support/payment-fixture";

const usd = (v: bigint) => `$${(Number(v) / 1e6).toFixed(6)}`;

async function main() {
  console.log("solve payment router: Send Bob $10 (local: PGlite kernel + LiteSVM chain, test assets)\n");
  const market = await paymentMarket();
  const k = await createKernelDb();
  const p = await paymentsKernel(k, market);
  await market.fund(p.aliceWallet.address, "ARC", ARC(1_000));
  await market.fund(p.aliceWallet.address, "DEV_SOLVE", solve(1_000));
  const amount = (code: string, v: bigint) => `${(Number(v) / 10 ** market.assets[code].decimals).toLocaleString("en-US", { maximumFractionDigits: 6 })} ${market.assets[code].symbol}`;

  console.log("Alice holds 1,000 ARC and 1,000 DEV-SOLVE, no DEV-USDC. Bob accepts DEV-USDC.\n");
  const paymentId = await p.alice.createPaymentIntent({ recipientId: p.bobId, chain: "litesvm", asset: "DEV_USDC", amount: USD(10), maxSlippageBps: 50, memo: "Send Bob $10" });
  console.log(`Intent    payment ${paymentId}\n          pays Bob's published address ${p.bobWallet.address}\n`);

  const quote = await market.router.quote({ payer: p.aliceWallet.address, recipient: p.bobWallet.address, denomination: "DEV_USDC", amount: USD(10), accepts: ["DEV_USDC"], maxSlippageBps: 50 });
  console.log(`Quote     ${quote.routes.length} routes compared (expires ${quote.expiresAt})`);
  const label = (r: Route) => (r.legs.length ? `${r.input} ` + r.legs.map((l) => `-[${l.venue}]-> ${l.output}`).join(" ") : `${r.input} transfer`);
  for (const r of quote.routes) {
    const c = r.costs;
    console.log(
      `  ${r === quote.best ? "*" : " "} ${label(r).padEnd(58)} in ${amount(r.input, r.inputAmount).padEnd(22)} cost ${usd(c.total)}  (fees ${usd(c.tradingFees)} + provider ${usd(c.providerFees)} + slippage ${usd(c.slippage)})`,
    );
  }
  const best = quote.best!;
  for (const leg of best.legs) {
    const twap = leg.twap ? formatRatio(leg.twap.price, market.assets[leg.input].decimals, market.assets[leg.output].decimals) : "none";
    console.log(
      `          ${leg.venue} (${leg.kind}, ${leg.operator}): spot ${formatRatio(leg.spot, market.assets[leg.input].decimals, market.assets[leg.output].decimals)} ${leg.output}/${leg.input}, TWAP ${twap}, depth ${amount(leg.output, leg.depth.output)}`,
    );
  }
  console.log(`          NetOutput ${usd(best.costs.netOutput)} = Gross ${usd(best.costs.gross)} − network ${usd(best.costs.networkCost)} − fees ${usd(best.costs.tradingFees)} − provider ${usd(best.costs.providerFees)} − slippage ${usd(best.costs.slippage)}`);
  console.log(`          network ${best.network.lamports} lamports, paid by the sponsor\n`);

  const result = await sendPayment({ payerKernel: p.alice, rail: p.rail, router: market.router, payer: p.aliceWallet, sponsor: market.chain.sponsor, paymentId });
  const payment = await p.bob.readPayment(paymentId);
  console.log(`Execute   ${result.status}; transaction ${result.signature}`);
  console.log(`          Alice paid ${amount(payment.input_asset!, BigInt(payment.executed_input!))} (limit ${amount(payment.input_asset!, BigInt(payment.max_input!))})`);
  console.log(`          Bob holds ${amount("DEV_USDC", await market.balance(p.bobWallet.address, "DEV_USDC"))} (read from chain at ${await tokenAccountAddress(p.bobWallet.address, market.assets.DEV_USDC.mint)})`);
  const marker = await paymentExecuted(market.chain.gateway, p.aliceWallet.address, paymentId);
  console.log(`Receipt   payment marker on chain: ${marker}; kernel status ${payment.status}`);

  const again = await sendPayment({ payerKernel: p.alice, rail: p.rail, router: market.router, payer: p.aliceWallet, sponsor: market.chain.sponsor, paymentId });
  const bob = await market.balance(p.bobWallet.address, "DEV_USDC");
  console.log(`Retry     ${again.status}; Bob still holds ${amount("DEV_USDC", bob)}`);
  const integrity = await p.rail.kernel.verifyChain();
  console.log(`History   ${integrity.ok ? "intact" : "BROKEN"} (${integrity.events_checked} events)`);

  const ok = result.status === "confirmed" && marker && bob === USD(10) && integrity.ok;
  console.log(`\n${ok ? "PASS" : "FAIL"}: payment ${paymentId}`);
  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
