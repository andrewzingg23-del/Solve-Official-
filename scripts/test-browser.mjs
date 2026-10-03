// Runs the kernel test files in Chromium against PGlite loaded natively from /pglite.
//   npm run test:browser
// Bundles only our test code (esbuild); PGlite's own files are served untouched.
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";
import { chromium } from "playwright-core";

const root = process.cwd();
execFileSync("node", ["scripts/sync-browser-assets.mjs"], { stdio: "inherit" });

const outDir = join(root, ".browser-tests");
mkdirSync(outDir, { recursive: true });
const shims = join(root, "tests/browser/shims");
await build({
  entryPoints: [join(root, "tests/browser/entry.ts")],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  outfile: join(outDir, "kernel-tests.js"),
  logLevel: "warning",
  alias: {
    "node:test": join(shims, "node-test.ts"),
    "node:assert/strict": join(shims, "node-assert.ts"),
    "node:crypto": join(shims, "node-crypto.ts"),
    "node:fs": join(shims, "node-stub.ts"),
    "node:path": join(shims, "node-stub.ts"),
  },
  plugins: [
    {
      name: "pglite-external",
      setup(b) {
        // The harness's Node runtime imports PGlite; the browser uses /pglite/index.js instead.
        b.onResolve({ filter: /^@electric-sql\/pglite$/ }, () => ({ path: "/pglite/index.js", external: true }));
        b.onResolve({ filter: /^\/pglite\// }, (args) => ({ path: args.path, external: true }));
      },
    },
  ],
});
writeFileSync(
  join(outDir, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>kernel tests</title><pre id="out"></pre><script type="module" src="/kernel-tests.js"></script>`,
);

const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".wasm": "application/wasm", ".data": "application/octet-stream" };
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  for (const base of [outDir, join(root, "public")]) {
    const file = resolve(base, "." + (path === "/" ? "/index.html" : path));
    if (file.startsWith(base) && existsSync(file) && statSync(file).isFile()) {
      res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
      res.end(readFileSync(file));
      return;
    }
  }
  res.writeHead(404).end();
});
await new Promise((r) => server.listen(0, r));
const url = `http://localhost:${server.address().port}/`;

function chromiumPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH ?? "/opt/pw-browsers";
  if (!existsSync(base)) return undefined;
  const dir = readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort().at(-1);
  return dir ? join(base, dir, "chrome-linux/chrome") : undefined;
}

const browser = await chromium.launch({ executablePath: chromiumPath() });
const page = await browser.newPage();
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(url);
await page.waitForFunction(() => window.__kernelTests?.done, null, { timeout: 15 * 60_000, polling: 1000 });
const results = await page.evaluate(() => window.__kernelTests.results);
await browser.close();
server.close();

for (const r of results) if (!r.ok) console.log(`FAIL ${r.name}\n${r.error}\n`);
const failed = results.filter((r) => !r.ok).length;
console.log(`browser kernel tests: ${results.length - failed} pass, ${failed} fail (${results.length} total)`);
process.exit(failed === 0 && results.length > 0 ? 0 : 1);
