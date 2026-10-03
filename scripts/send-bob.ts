// "Send Bob $10" on test assets, printed step by step.
//   npx tsx scripts/send-bob.ts
// Kernel: the real migrations in PGlite. Chain: LiteSVM running the real SPL programs.
// DEV-USDC and ARC are test-only mints; DEV-SOLVE comes from the real genesis. None carries value.
import { runSendBob } from "../tests/support/send-bob";

async function main() {
  console.log("solve payment router: Send Bob $10 (local: PGlite kernel + LiteSVM chain, test assets)\n");
  const run = await runSendBob();
  console.log(`${run.setup}\n`);
  console.log(`Intent    payment ${run.paymentId}\n          pays Bob's published address ${run.recipient}\n`);
  console.log(`Quote     ${run.routes.length} routes compared (expires ${run.expiresAt})`);
  for (const r of run.routes) {
    console.log(
      `  ${r.best ? "*" : " "} ${r.label.padEnd(58)} in ${r.input.padEnd(22)} cost ${r.cost}  (fees ${r.tradingFees} + provider ${r.providerFees} + slippage ${r.slippage})`,
    );
  }
  for (const l of run.legs) console.log(`          ${l.venue} (${l.kind}, ${l.operator}): spot ${l.spot}, TWAP ${l.twap}, depth ${l.depth}`);
  console.log(`          ${run.identity}`);
  console.log(`          network ${run.network}\n`);
  console.log(`Execute   ${run.status}; transaction ${run.signature}`);
  console.log(`          Alice paid ${run.alicePaid} (limit ${run.limit})`);
  console.log(`          Bob holds ${run.bob} (read from chain at ${run.bobAccount})`);
  console.log(`Receipt   payment marker on chain: ${run.marker}; kernel status ${run.kernelStatus}`);
  console.log(`Retry     ${run.retry}`);
  console.log(`History   ${run.history}`);
  console.log(`\n${run.pass ? "PASS" : "FAIL"}: payment ${run.paymentId}`);
  process.exit(run.pass ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
