// Runs the monetary proof-of-life locally and prints each step of the causal chain.
//   npx tsx scripts/proof-of-life.ts
// Kernel: the real migrations in PGlite. Chain: LiteSVM running the real SPL programs (DEV-SOLVE).
import { runProofOfLife } from "../tests/support/proof-of-life";

async function main() {
  console.log("solve monetary proof-of-life (local: PGlite kernel + LiteSVM chain, DEV-SOLVE)\n");
  const run = await runProofOfLife(({ n, title, detail }) => {
    console.log(`${String(n).padStart(2, " ")}. ${title.padEnd(20)} ${detail}`);
  });
  const ok =
    run.result.status === "confirmed" && run.settled.status === "confirmed" && run.mirror.match && run.integrity.ok;
  console.log(`\n${ok ? "PASS" : "FAIL"}: settlement ${run.prepared.settlementId}`);
  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
