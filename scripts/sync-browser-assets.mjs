// Copies what the browser needs into public/: PGlite's untouched ESM, WASM and data files, the
// kernel migrations as one JSON file, and the CesiumJS build. Runs before dev and build.
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
// Supabase-hosted identity projections rely on auth.users and must not run
// inside the standalone browser PGlite kernel.
const scope = JSON.parse(readFileSync(join(root, "supabase/migration-scope.json"), "utf8"));
const supabaseOnly = new Set(scope.supabaseOnly);
const migrations = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql") && !supabaseOnly.has(f))
  .sort()
  .map((name) => ({ name, sql: readFileSync(join(migrationsDir, name), "utf8") }));
mkdirSync(join(root, "public/kernel"), { recursive: true });
writeFileSync(join(root, "public/kernel/migrations.json"), JSON.stringify(migrations));
// CesiumJS: the untouched UMD build, loaded with a script tag so no bundler transforms it.
const cesiumSrc = join(root, "node_modules/cesium/Build/Cesium");
const cesiumOut = join(root, "public/cesium");
rmSync(cesiumOut, { recursive: true, force: true });
for (const part of ["Cesium.js", "Assets", "ThirdParty", "Widgets", "Workers"]) {
  cpSync(join(cesiumSrc, part), join(cesiumOut, part), { recursive: true });
}

// The renderer's runtime topology must arrive whole: runtime, workers, assets, third-party code,
// widget styles, and the imagery the offline Earth uses. A partial copy fails here, not in a browser.
for (const required of ["Cesium.js", "Workers", "Assets/Textures/NaturalEarthII/tilemapresource.xml", "ThirdParty", "Widgets/widgets.css"]) {
  if (!existsSync(join(cesiumOut, required))) throw new Error(`CesiumJS runtime incomplete: missing ${required}`);
}

console.log(`browser assets: ${copied} PGlite files, ${migrations.length} kernel migrations, CesiumJS`);
