// Copies what the browser needs into public/: PGlite's untouched ESM, WASM and data files, and the
// kernel migrations as one JSON file, for the in-browser kernel tests. Runs before dev and build.
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const pgliteSrc = join(root, "node_modules/@electric-sql/pglite/dist");
const pgliteOut = join(root, "public/pglite");
rmSync(pgliteOut, { recursive: true, force: true });
mkdirSync(pgliteOut, { recursive: true });
let copied = 0;
for (const file of readdirSync(pgliteSrc)) {
  if (/\.(js|wasm|data)$/.test(file)) {
    copyFileSync(join(pgliteSrc, file), join(pgliteOut, file));
    copied++;
  }
}

const migrationsDir = join(root, "supabase/migrations");
const migrations = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((name) => ({ name, sql: readFileSync(join(migrationsDir, name), "utf8") }));
mkdirSync(join(root, "public/kernel"), { recursive: true });
writeFileSync(join(root, "public/kernel/migrations.json"), JSON.stringify(migrations));
console.log(`browser assets: ${copied} PGlite files, ${migrations.length} kernel migrations`);
