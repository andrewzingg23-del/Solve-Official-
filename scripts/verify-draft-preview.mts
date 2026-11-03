// Local Chromium regression for the real DraftPreview component. No model or database calls.
// Run: node --import tsx scripts/verify-draft-preview.mts
// Optional: CHROMIUM_PATH=/path/to/chromium SHOT_DIR=/path/to/evidence
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "playwright-core";
import { DraftPreview } from "../app/world/[worldId]/draft-preview";

const cache = process.env.PLAYWRIGHT_BROWSERS_PATH || join(homedir(), "Library/Caches/ms-playwright");
const candidates = existsSync(cache) ? readdirSync(cache).sort().reverse().flatMap(dir => [
  "chrome-headless-shell-mac-arm64/chrome-headless-shell", "chrome-linux/headless_shell", "chrome-linux64/chrome",
].map(file => join(cache, dir, file))) : [];
const executablePath = process.env.CHROMIUM_PATH || candidates.find(existsSync);
assert.ok(executablePath, "Set CHROMIUM_PATH or install a cached Chromium");
const received: string[] = [];
let fixture = "";
const server = createServer((req, res) => {
  if (req.url === "/") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    // Render the production component. Only the host layout styles are fixture scaffolding.
    res.end(`<!doctype html><style>iframe{width:100%;height:480px}body{margin:20px;font-family:system-ui}</style>${renderToStaticMarkup(createElement(DraftPreview, { html: fixture, title: "Reef Cafe" }))}`);
  } else {
    received.push(req.url || "unknown");
    res.setHeader("Content-Type", "text/css");
    res.end("h1{color:red}");
  }
});
await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address !== "string");
const base = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ executablePath });
try {
  const page = await browser.newPage();
  const attempts: string[] = [];
  await page.route("**/*", route => {
    const url = route.request().url();
    if (url === `${base}/`) return route.continue();
    attempts.push(url);
    return route.fulfill({ contentType: "text/css", body: "h1{color:red}" });
  });
  // URLs are intercepted locally so this test never sends data to outside services.
  fixture = `<!doctype html><html><head>
    <meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' data:">
    <style>@import url('${base}/import');
      body{font-family:system-ui;background:#fff8eb}h1{color:rgb(8,145,178)}
      .remote{background-image:url('${base}/css-image');height:10px}
      @media(max-width:500px){h1{font-size:24px}}
    </style></head><body>
    <h1>Reef Cafe</h1><p>Fresh coffee and warm pastries by the beach. A useful local draft with opening hours, a seasonal menu and a friendly place to meet.</p>
    <img src="${base}/image" alt="Remote image"><img src="/relative-image" alt="Relative image">
    <img src="https://preview-test.invalid/tracker" alt="External image">
    <div class="remote"></div>
    <img id="local" alt="Embedded pixel" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=">
    <script>parent.document.body.dataset.escaped='yes'</script>
    <form action="${base}/submit"><button>Submit fixture</button></form>
    <a href="${base}/escape" target="_top">Leave preview</a>
    </body></html>`;
  for (const width of [1280, 390]) {
    attempts.length = 0;
    received.length = 0;
    await page.setViewportSize({ width, height: 840 });
    await page.goto(base, { waitUntil: "networkidle" });
    const frame = page.frameLocator("iframe");
    await frame.getByRole("heading", { name: "Reef Cafe" }).waitFor();
    assert.deepEqual(attempts, [], "Generated content must not request remote or application resources");
    assert.deepEqual(received, [], "No generated subresource reaches the host");
    assert.equal(await page.locator("iframe").getAttribute("sandbox"), "");
    assert.equal(await frame.locator("h1").evaluate(el => getComputedStyle(el).color), "rgb(8, 145, 178)");
    assert.equal(await frame.locator("#local").evaluate(el => (el as HTMLImageElement).naturalWidth), 1);
    assert.equal(await page.locator("body").getAttribute("data-escaped"), null);
    await frame.getByRole("button", { name: "Submit fixture" }).click();
    await frame.getByRole("link", { name: "Leave preview" }).click();
    assert.equal(page.url(), `${base}/`, "The frame cannot navigate the application");
    assert.deepEqual(attempts, [], "Form and top navigation stay blocked");
    if (process.env.SHOT_DIR) {
      mkdirSync(process.env.SHOT_DIR, { recursive: true });
      await page.screenshot({ path: join(process.env.SHOT_DIR, `draft-preview-${width}.png`), fullPage: true });
    }
    console.log(`PASS width=${width}: styled content and embedded image; no resource requests, scripts, form submission or top navigation`);
  }
  // A reopened or manually revised document also passes through the render-time boundary.
  fixture = `<img src="${base}/before-html"><html><head><style>h1{color:teal}</style></head><body><h1>Revised cafe</h1><img src="${base}/revision"></body></html>`;
  attempts.length = 0;
  await page.reload({ waitUntil: "networkidle" });
  await page.frameLocator("iframe").getByRole("heading", { name: "Revised cafe" }).waitFor();
  assert.deepEqual(attempts, [], "Revised source and resources before <html> are constrained");
  console.log("PASS revised document: render-time policy precedes all supplied markup");
} finally {
  await browser.close();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
