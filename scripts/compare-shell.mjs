// Compares the empty Day One shell with the founder's canonical reference (docs/reference/
// approved-shell.png, IMG_0127.png, SHA-256 b5362dc7…). The reference is drawn as a desktop window:
// its inside, 1366 × 950 at (42, 62), is what the app renders, so that is what is compared — the
// window's own frame (traffic lights, edge, outer margin) belongs to the operating system.
//
// Writes test-results/compare/: reference.png, app.png, side-by-side.png, overlay.png (50/50) and
// difference.png (brighter = more different), and prints the mean difference per channel (0–255).
// A number to watch, not a pass mark: the reference is a rendered image, so anti-aliasing and font
// hinting can never reach zero.
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

const root = process.cwd(), out = join(root, "test-results", "compare");
mkdirSync(out, { recursive: true });
const ref = readFileSync(join(root, "docs/reference/approved-shell.png"));
const hash = createHash("sha256").update(ref).digest("hex");
if (hash !== "b5362dc7790cb5f90ff7dc81044e22f5cba3d3007399bf0614699dee774d3218") throw new Error("The reference image is not the approved one: " + hash);
const WINDOW = { x: 42, y: 62, width: 1366, height: 950 };

const cache = process.env.PLAYWRIGHT_BROWSERS_PATH || join(homedir(), process.platform === "darwin" ? "Library/Caches/ms-playwright" : ".cache/ms-playwright");
const binaries = ["chrome-linux/chrome", "chrome-linux64/chrome", "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
  "chrome-mac/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing", "chrome-headless-shell-mac-arm64/chrome-headless-shell"];
const executablePath = process.env.CHROMIUM_PATH || (existsSync(cache) ? readdirSync(cache).filter(d => /^chromium(?:_headless_shell)?-\d+$/.test(d)).sort().reverse()
  .flatMap(d => binaries.map(p => join(cache, d, p))).find(existsSync) : undefined);
if (!executablePath) throw new Error("Set CHROMIUM_PATH to an installed Chromium executable.");

const port = process.env.COMPARE_PORT || "3006", url = `http://localhost:${port}`;
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", port], { cwd: root, env: { ...process.env }, stdio: ["ignore", "pipe", "pipe"] });
let log = ""; server.stdout.on("data", d => { log += d; }); server.stderr.on("data", d => { log += d; });
let browser;
try {
  for (let i = 0; i < 45; i++) { try { if ((await fetch(url)).ok) break; } catch {} await new Promise(r => setTimeout(r, 1000)); }
  browser = await chromium.launch({ executablePath, args: ["--no-sandbox", "--font-render-hinting=none"] });
  const page = await browser.newPage({ viewport: { width: WINDOW.width, height: WINDOW.height }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  await page.goto(url);
  await page.getByRole("heading", { level: 1, name: "Your Space" }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  const app = await page.screenshot();
  writeFileSync(join(out, "app.png"), app);

  // All image work happens in the browser's canvas, so nothing beyond Playwright is needed.
  const results = await page.evaluate(async ({ refSrc, appSrc, w }) => {
    const load = async src => { const i = new Image(); i.src = src; await i.decode(); return i; };
    const [r, a] = await Promise.all([load(refSrc), load(appSrc)]);
    const canvas = (cw, ch) => { const c = document.createElement("canvas"); c.width = cw; c.height = ch; return c; };
    const refC = canvas(w.width, w.height); refC.getContext("2d").drawImage(r, w.x, w.y, w.width, w.height, 0, 0, w.width, w.height);
    const appC = canvas(w.width, w.height); appC.getContext("2d").drawImage(a, 0, 0);
    const rd = refC.getContext("2d").getImageData(0, 0, w.width, w.height).data, ad = appC.getContext("2d").getImageData(0, 0, w.width, w.height).data;
    const diffC = canvas(w.width, w.height), dctx = diffC.getContext("2d"), dd = dctx.createImageData(w.width, w.height);
    let sum = 0;
    for (let i = 0; i < rd.length; i += 4) {
      const d = (Math.abs(rd[i] - ad[i]) + Math.abs(rd[i + 1] - ad[i + 1]) + Math.abs(rd[i + 2] - ad[i + 2])) / 3;
      sum += d; const v = Math.min(255, d * 4); dd.data[i] = v; dd.data[i + 1] = v; dd.data[i + 2] = v; dd.data[i + 3] = 255;
    }
    dctx.putImageData(dd, 0, 0);
    const over = canvas(w.width, w.height), o = over.getContext("2d"); o.drawImage(refC, 0, 0); o.globalAlpha = 0.5; o.drawImage(appC, 0, 0);
    const side = canvas(w.width * 2 + 20, w.height), s = side.getContext("2d"); s.fillStyle = "#fff"; s.fillRect(0, 0, side.width, side.height);
    s.drawImage(refC, 0, 0); s.drawImage(appC, w.width + 20, 0);
    return { mean: sum / (rd.length / 4), ref: refC.toDataURL(), side: side.toDataURL(), overlay: over.toDataURL(), diff: diffC.toDataURL() };
  }, { refSrc: "data:image/png;base64," + ref.toString("base64"), appSrc: "data:image/png;base64," + app.toString("base64"), w: WINDOW });
  for (const [name, dataUrl] of [["reference", results.ref], ["side-by-side", results.side], ["overlay", results.overlay], ["difference", results.diff]]) {
    writeFileSync(join(out, `${name}.png`), Buffer.from(dataUrl.split(",")[1], "base64"));
  }
  console.log(`Compared the empty Day One shell at ${WINDOW.width}×${WINDOW.height} with the approved reference. Mean difference: ${results.mean.toFixed(2)} of 255 per channel. Images in test-results/compare/.`);
} catch (error) { console.error(log); throw error; } finally { await browser?.close(); server.kill("SIGTERM"); }
