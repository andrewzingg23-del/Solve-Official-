// Generates the Arcadia sandbox: the real kernel, chain and router code build the test
// civilization, and the kernel's Postgres data directory is written for the browser to boot from.
//   npx tsx scripts/build-arcadia.ts [--seed <seed>]
// Output (generated, not committed): public/arcadia/snapshot.tgz and public/arcadia/manifest.json.
// The snapshot is reloaded and must reproduce the kernel's semantic digest before it is written:
// it is a faithful projection of canonical state, never a second model of it.
import { PGlite } from "@electric-sql/pglite";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { kernelDigest } from "../lib/sandbox/digest";
import { buildArcadia } from "../tests/support/arcadia";

async function main() {
  const seedFlag = process.argv.indexOf("--seed");
  const seed = seedFlag > 0 ? process.argv[seedFlag + 1] : undefined;
  const { k, manifest } = await buildArcadia({ seed });

  const dumpStarted = Date.now();
  const dump = await (k.db as unknown as { dumpDataDir(c: "gzip"): Promise<Blob> }).dumpDataDir("gzip");
  const bytes = new Uint8Array(await dump.arrayBuffer());
  const snapshotSha = createHash("sha256").update(bytes).digest("hex");
  manifest.version = snapshotSha.slice(0, 16);
  manifest.arcadia.snapshot = snapshotSha;
  manifest.metrics.dumpMs = Date.now() - dumpStarted;
  manifest.metrics.snapshotBytes = bytes.length;

  const reloaded = new PGlite({ loadDataDir: new Blob([bytes]) });
  const parity = await kernelDigest(async (sql) => (await reloaded.query<Record<string, unknown>>(sql)).rows);
  await reloaded.close();
  if (parity.digest !== manifest.arcadia.digest) {
    throw new Error(`the snapshot does not reproduce the kernel: ${parity.digest} != ${manifest.arcadia.digest}`);
  }

  const out = join(process.cwd(), "public/arcadia");
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "snapshot.tgz"), bytes);
  writeFileSync(join(out, "manifest.json"), JSON.stringify(manifest, null, 2));
  const { arcadia, metrics } = manifest;
  console.log(
    `arcadia: ${arcadia.generator}, seed ${arcadia.seed}, digest ${arcadia.digest.slice(0, 12)}, ` +
      `${arcadia.tables.events} events, ${Object.keys(manifest.orgs).length} organizations, ` +
      `snapshot ${(bytes.length / 1e6).toFixed(1)} MB (version ${manifest.version}), generated in ${(metrics.generationMs / 1000).toFixed(1)} s`,
  );
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
