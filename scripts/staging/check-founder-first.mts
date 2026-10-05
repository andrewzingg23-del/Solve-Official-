// Checks scripts/staging/2026-10-05-founder-first.sql before the founder pastes it: applies the migrations staging
// already has (up to v4) to an embedded Postgres, runs the file, prints its check, and confirms a second run is refused.
// Run: npx tsx scripts/staging/check-founder-first.mts
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { migrate } from "../../lib/kernel/local";
const dir = new URL("../../supabase/migrations", import.meta.url).pathname;
const before = readdirSync(dir).filter((f) => f.endsWith(".sql") && f < "20261004040000").sort();
const db = new PGlite();
await migrate(db as never, before.map((f) => readFileSync(`${dir}/${f}`, "utf8")));
console.log("applied first:", before.join(", "));
const res = await db.exec(readFileSync(new URL("./2026-10-05-founder-first.sql", import.meta.url).pathname, "utf8"));
console.log("check:", JSON.stringify(res.at(-1)?.rows));
try {
  await db.exec(readFileSync(new URL("./2026-10-05-founder-first.sql", import.meta.url).pathname, "utf8"));
  console.log("second run: applied again (unexpected)");
} catch (e) {
  console.log("second run refused, as expected:", (e as Error).message);
}
