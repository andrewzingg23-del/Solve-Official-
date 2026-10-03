// Generates the Arcadia sandbox: the real kernel, chain and router code build the test
// civilization, and the kernel's Postgres data directory is written for the browser to boot from.
//   npx tsx scripts/build-arcadia.ts
// Output (generated, not committed): public/arcadia/snapshot.tgz and public/arcadia/manifest.json.
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildArcadia } from "../tests/support/arcadia";

async function main() {
  const started = Date.now();
  const { k, manifest, integrity } = await buildArcadia();
  const dump = await (k.db as unknown as { dumpDataDir(c: "gzip"): Promise<Blob> }).dumpDataDir("gzip");
  const bytes = new Uint8Array(await dump.arrayBuffer());
  manifest.version = createHash("sha256").update(bytes).digest("hex").slice(0, 16);

  const out = join(process.cwd(), "public/arcadia");
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "snapshot.tgz"), bytes);
  writeFileSync(join(out, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(
    `arcadia: ${integrity.events_checked} events, ${Object.keys(manifest.orgs).length} organizations, ` +
      `snapshot ${(bytes.length / 1e6).toFixed(1)} MB, version ${manifest.version}, ${((Date.now() - started) / 1000).toFixed(1)} s`,
  );
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
