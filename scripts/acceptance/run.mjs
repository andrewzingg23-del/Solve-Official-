// Runs SOLVE's acceptance scenarios against the real app on solve-staging.
//
//   node scripts/acceptance/run.mjs                 build for staging, then run every scenario
//   node scripts/acceptance/run.mjs --no-build      reuse the last staging build
//   node scripts/acceptance/run.mjs home            run one scenario
//
// The build is exactly what a Vercel preview gets: VERCEL_ENV=preview selects solve-staging in
// lib/supabase/config.ts. It goes to .next-acceptance so the database-free build used by
// scripts/test-product.mjs is never overwritten. Results and screenshots land in
// test-results/acceptance/<run>/.
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { Evidence, RUN, chromiumPath } from "./lib.mjs";
import { home } from "./scenarios/home.mjs";
import { confirm } from "./scenarios/confirm.mjs";
import { card } from "./scenarios/card.mjs";
import { control } from "./scenarios/control.mjs";
import { together } from "./scenarios/together.mjs";
import { page } from "./scenarios/page.mjs";

const SCENARIOS = { home, confirm, card, control, together, page };
const args = process.argv.slice(2);
const build = !args.includes("--no-build");
const only = args.filter(a => !a.startsWith("--"));
const port = process.env.ACCEPTANCE_PORT || "3007";
const base = `http://localhost:${port}`;
const distDir = ".next-acceptance";
const env = { ...process.env, VERCEL_ENV: "preview", SOLVE_DIST_DIR: distDir, NEXT_TELEMETRY_DISABLED: "1" };

if (build || !existsSync(join(distDir, "BUILD_ID"))) {
  console.log(`Building for solve-staging into ${distDir} …`);
  const result = spawnSync(process.execPath, ["node_modules/next/dist/bin/next", "build"], { env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const executablePath = chromiumPath();
if (!executablePath) throw new Error("No Chromium found. Run: npx playwright install chromium");

const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", port], { env, stdio: ["ignore", "pipe", "pipe"] });
let log = "";
server.stdout.on("data", d => { log = (log + d).slice(-12000); });
server.stderr.on("data", d => { log = (log + d).slice(-12000); });

const evidence = new Evidence(join("test-results", "acceptance", RUN));
let browser;
try {
  let ready = false;
  for (let i = 0; i < 60 && !ready; i++) {
    if (server.exitCode !== null) throw new Error("Server exited:\n" + log);
    try { ready = (await fetch(base)).status < 500; } catch {}
    if (!ready) await new Promise(r => setTimeout(r, 1000));
  }
  if (!ready) throw new Error("Server never became ready:\n" + log);
  browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] });
  for (const [name, scenario] of Object.entries(SCENARIOS)) {
    if (only.length && !only.includes(name)) continue;
    try {
      await scenario({ browser, base, evidence });
    } catch (error) {
      evidence.record(name, "harness", "scenario ran to completion", false, error.stack ?? error.message);
    }
  }
} finally {
  evidence.write({ target: "solve-staging (taeikshnbcsjlgbattyp)", build: distDir });
  await browser?.close();
  server.kill("SIGTERM");
}

const failed = evidence.failures.length;
console.log(`\n${failed === 0 ? "PASS" : `FAIL — ${failed} of ${evidence.checks.length} checks`}. Evidence: ${evidence.dir}`);
if (failed) { console.log("\nServer log tail:\n" + log.slice(-3000)); process.exit(1); }
