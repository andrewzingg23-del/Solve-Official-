// The rebuilt experience with no database at all (rewritten from zero, 2026-11-10).
//
// scripts/acceptance/ proves behaviour against the real staging kernel. This suite proves what a
// person meets when there is no identity and no database: the shell, the five destinations at
// 320/390/1440, keyboard use, honest failure when the browser refuses storage, and every older
// address landing on a rebuilt destination. It never claims anything was saved, because nothing can be.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

const root = process.cwd(), out = join(root, "test-results", "product");
mkdirSync(out, { recursive: true });
const cache = process.env.PLAYWRIGHT_BROWSERS_PATH
  || join(homedir(), process.platform === "darwin" ? "Library/Caches/ms-playwright" : ".cache/ms-playwright");
const binaries = [
  "chrome-linux/chrome", "chrome-linux64/chrome", "chrome-linux/headless_shell", "chrome-linux64/headless_shell",
  "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
  "chrome-mac/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
  "chrome-headless-shell-mac-arm64/chrome-headless-shell", "chrome-headless-shell-mac/chrome-headless-shell",
];
const candidates = existsSync(cache) ? readdirSync(cache).filter(d => /^chromium(?:_headless_shell)?-\d+$/.test(d)).sort().reverse().flatMap(d => binaries.map(p => join(cache, d, p))) : [];
const executablePath = process.env.CHROMIUM_PATH || candidates.find(existsSync);
if (!executablePath) throw new Error("Set CHROMIUM_PATH to an installed Chromium executable.");

const port = process.env.PRODUCT_TEST_PORT || "3005", url = `http://localhost:${port}`;
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", port], {
  cwd: root, env: { ...process.env, ENABLE_EXPERIMENTAL_FEATURES: "false", ENABLE_MONEY: "false", ENABLE_EXTERNAL_FINANCIAL_ACTIONS: "false" },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "", browser;
server.stdout.on("data", d => { serverLog = (serverLog + d).slice(-8000); });
server.stderr.on("data", d => { serverLog = (serverLog + d).slice(-8000); });

const fits = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
const DESTINATIONS = ["Home", "ID", "Space", "Bench", "Control"];
const words = "Plan the garden for spring";

try {
  let ready = false;
  for (let i = 0; i < 45; i++) { if (server.exitCode !== null) throw new Error(serverLog); try { if ((await fetch(url)).ok) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 1000)); }
  if (!ready) throw new Error("Production app did not start: " + serverLog);
  browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  const page = await context.newPage(), errors = [];
  page.on("pageerror", e => errors.push(e.message));

  // --- One shell, five destinations, Home marked.
  await page.goto(url);
  const primary = page.getByRole("navigation", { name: "Primary", exact: true });
  assert.deepEqual(await primary.getByRole("link").allTextContents(), DESTINATIONS);
  assert.equal(await primary.getByRole("link", { name: "Home" }).getAttribute("aria-current"), "page");
  assert.equal(await page.getByRole("link", { name: /trading|payment card|packs|studio|coming soon/i }).count(), 0, "nothing hidden is linked");
  assert.ok(await fits(page), "no horizontal overflow at 1440");

  // --- A person's words survive a reload before anything is saved.
  const field = page.getByRole("textbox", { name: "What do you want to do?" });
  await field.fill(words);
  await page.reload();
  await page.waitForFunction(w => document.getElementById("home-words")?.value === w, words);
  await page.screenshot({ path: join(out, "home-1440.png"), fullPage: true });

  // --- With no identity, beginning leads to sign-in, and coming back costs nothing.
  await page.getByRole("button", { name: "Begin", exact: true }).click();
  await page.waitForURL(/\/login\?next=%2F$/);
  await page.getByRole("heading", { level: 1 }).waitFor();
  await page.getByRole("link", { name: "← Back to your idea" }).click();
  await page.waitForFunction(w => document.getElementById("home-words")?.value === w, words);

  // --- ID shows the card, at the true card shape, even before there is an identity.
  await page.goto(url + "/account");
  const card = page.locator("main figure[data-card]");
  await card.waitFor();
  const box = await card.boundingBox();
  assert.ok(box && Math.abs(box.width / box.height - 85.6 / 53.98) < 0.012, "the card is ID-1 shaped");
  assert.equal(await page.locator("main [data-card-name]").textContent(), "Add your name", "an unnamed card invites a name");

  // --- Every destination, at the smallest phone and a normal phone.
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const [path, slug] of [["/", "home"], ["/account", "id"], ["/space", "space"], ["/workbench", "bench"], ["/control", "control"]]) {
      await page.goto(url + path);
      await page.getByRole("heading", { level: 1 }).waitFor();
      assert.ok(await fits(page), `${path} overflows at ${width}px`);
      const tabs = page.getByRole("navigation", { name: "Primary mobile", exact: true });
      assert.ok(await tabs.isVisible(), `${path} has mobile navigation at ${width}px`);
      const rows = new Set();
      for (const link of await tabs.getByRole("link").all()) {
        const b = await link.boundingBox();
        assert.ok(b && b.height >= 44 && b.width >= 44, "touch targets are at least 44px");
        rows.add(Math.round(b.y));
      }
      assert.equal(rows.size, 1, `${path} at ${width}px: every destination on one row`);
      await page.screenshot({ path: join(out, `${slug}-${width}.png`), fullPage: true });
    }
  }

  // --- Keyboard: the first Tab reaches the skip link, which moves focus to the content.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(url);
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), "Skip to content");
  await page.keyboard.press("Enter");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "main");

  // --- Every older address lands on a rebuilt destination; mutations to them are refused.
  for (const [path, location] of [
    ["/projects", "/space"], ["/communities", "/space"], ["/bot", "/account"], ["/onboarding", "/account"], ["/apps", "/control"],
    ["/worlds/new", "/"], ["/world/example/room", "/world/example"], ["/card", "/"], ["/money", "/"], ["/studio", "/"], ["/sov-id", "/account"],
  ]) {
    const r = await fetch(url + path, { redirect: "manual" });
    assert.equal(r.status, 307, path);
    assert.equal(new URL(r.headers.get("location"), url).pathname, location, path);
    assert.equal((await fetch(url + path, { method: "POST", redirect: "manual" })).status, 404, `POST ${path}`);
  }
  for (const path of ["/api/market/sparkline", "/api/studio/propose", "/api/auth/meta/start", "/api/avatar/generate"]) {
    const r = await fetch(url + path, { method: "POST" });
    assert.equal(r.status, 404, path);
    assert.equal(r.headers.get("cache-control"), "no-store");
  }

  // --- A browser that refuses storage is told so, and the person keeps their words on screen.
  const blocked = await browser.newContext();
  await blocked.addInitScript(() => { Storage.prototype.setItem = function () { throw new DOMException("Blocked for this test", "SecurityError"); }; });
  const failure = await blocked.newPage();
  await failure.goto(url);
  await failure.getByRole("textbox", { name: "What do you want to do?" }).fill("Keep this idea");
  await failure.getByRole("button", { name: "Begin", exact: true }).click();
  await failure.locator("main [role=alert]").filter({ hasText: "can't keep this" }).waitFor();
  assert.equal(new URL(failure.url()).pathname, "/");
  assert.equal(await failure.getByRole("textbox", { name: "What do you want to do?" }).inputValue(), "Keep this idea");
  await blocked.close();

  assert.deepEqual(errors, []);
  console.log("Product browser checks passed on the rebuilt experience: one shell and five destinations at 320/390/1440, keyboard, a draft surviving reload and the trip to sign-in, the card's true shape, every older address landing on a rebuilt destination, and honest storage failure. No database was present, so nothing is claimed as saved.");
} catch (error) { console.error(serverLog); throw error; } finally { await browser?.close(); server.kill("SIGTERM"); }
