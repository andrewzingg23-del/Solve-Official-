// Real component, simulated transport. Tests UI provenance and request history; never claims live AI.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { chromiumPath } from "./acceptance/lib.mjs";
const out = join(process.cwd(), "test-results", "ai-console");
mkdirSync(out, { recursive: true });
await build({ entryPoints: ["tests/browser/ai-console.tsx"], bundle: true, format: "esm", platform: "browser", jsx: "automatic", outfile: join(out, "fixture.js"), define: { "process.env": "{}", "process.env.NODE_ENV": '"production"' } });
const server = createServer((req, res) => {
  if (req.url === "/fixture.js" || req.url === "/fixture.css") {
    res.setHeader("content-type", req.url.endsWith("css") ? "text/css" : "text/javascript");
    res.end(readFileSync(join(out, req.url.slice(1))));
  } else res.end('<!doctype html><html data-tone="light"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script type="module" src="/fixture.js"></script></html>');
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const browser = await chromium.launch({ executablePath: chromiumPath(), args: ["--no-sandbox"] });
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(8000);
  const requests = [], errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.route("**/api/ai/turn", async route => {
    assert.equal(route.request().headers()["x-solve-viewer"], "fixture-one");
    requests.push(route.request().postDataJSON());
    if (requests.length === 3) { await route.fulfill({ status: 409, json: { code: "session_changed", error: "Your account changed. Reopen AI." } }); return; }
    await route.fulfill({ json: requests.length === 1
      ? { reply: "A".repeat(6000), engine: { id: "anthropic", model: "claude-haiku-5-5" }, usage: { inputTokens: 100, outputTokens: 100 }, cost: { estimatedUsd: 0.00006, status: "estimated" }, metering: "recorded" }
      : { reply: "Second answer", engine: { id: "openai", model: "reported-openai" }, usage: { inputTokens: null, outputTokens: null }, cost: { estimatedUsd: null, status: "unknown" }, metering: "unknown" } });
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const panel = page.getByRole("dialog", { name: "Talk with AI" });
  const message = page.getByRole("textbox", { name: "Message to AI" });
  await message.fill("First question"); await page.getByRole("button", { name: "Send message" }).click();
  await panel.getByText("Anthropic · claude-haiku-5-5", { exact: true }).waitFor();
  assert.match(await panel.innerText(), /Est\. \$0\.000060/);
  await page.getByRole("button", { name: "Go to People" }).click();
  await message.fill("Next question"); await page.getByRole("button", { name: "Send message" }).click();
  await panel.getByText("OpenAI · reported-openai", { exact: true }).waitFor();
  assert.equal(requests[1].path, "/people");
  assert.equal(requests[1].history[1].content.length, 1400);
  assert.match(await panel.innerText(), /Cost unknown/);
  assert.match(await panel.innerText(), /Usage unavailable/);
  assert.equal(await panel.getByText("Anthropic · claude-haiku-5-5", { exact: true }).count(), 1);
  for (const tone of ["light", "dark"]) for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(t => window.fixtureTone(t), tone);
    await panel.getByText("OpenAI · reported-openai", { exact: true }).scrollIntoViewIfNeeded();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: join(out, `simulated-${tone}-${width}.png`) });
  }
  await message.fill("Stale-tab question"); await page.getByRole("button", { name: "Send message" }).click();
  await panel.getByRole("alert").filter({ hasText: "account changed" }).waitFor();
  assert.equal(await panel.getByText("OpenAI · reported-openai", { exact: true }).count(), 0);
  await page.getByRole("button", { name: "Switch fixture identity" }).click();
  assert.equal(await panel.getByText("OpenAI · reported-openai", { exact: true }).count(), 0);
  assert.deepEqual(errors, []);
  console.log("AI component browser checks passed: actual per-reply engine, unknown/estimated cost, bounded follow-up history, context navigation, identity reset, light/dark at 320/390/1440. SIMULATED provider transport only.");
} finally { await browser.close(); await new Promise(r => server.close(r)); }
