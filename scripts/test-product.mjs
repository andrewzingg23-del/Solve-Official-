// The rebuilt experience with no database at all (rewritten from zero, 2026-11-10).
//
// scripts/acceptance/ proves behaviour against the real staging kernel. This suite proves what a
// person meets when there is no identity and no database: the approved shell and its four places at
// 320/390/1440, keyboard use, honest failure when the browser refuses storage, and removed screens
// staying gone. It never claims anything was saved, because nothing can be.
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
  cwd: root, env: { ...process.env },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "", browser;
server.stdout.on("data", d => { serverLog = (serverLog + d).slice(-8000); });
server.stderr.on("data", d => { serverLog = (serverLog + d).slice(-8000); });

const fits = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
const PLACES = ["Space", "People", "Apps", "Control"];
const words = "Plan the garden for spring";
const BOX = "Ask, create, or add anything";

try {
  let ready = false;
  for (let i = 0; i < 45; i++) { if (server.exitCode !== null) throw new Error(serverLog); try { if ((await fetch(url)).ok) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 1000)); }
  if (!ready) throw new Error("Production app did not start: " + serverLog);
  browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  const page = await context.newPage(), errors = [];
  page.on("pageerror", e => errors.push(e.message));

  // --- The approved shell: four places with Space marked; Search, Add, AI, Private and you in reach.
  await page.goto(url);
  const primary = page.getByRole("navigation", { name: "Primary", exact: true });
  assert.deepEqual((await primary.getByRole("link").allTextContents()).map(t => t.trim()), PLACES);
  assert.equal(await primary.getByRole("link", { name: "Space" }).getAttribute("aria-current"), "page");
  assert.ok(await page.getByRole("searchbox", { name: "Search your Spaces" }).isVisible(), "Search");
  assert.ok(await page.locator("summary", { hasText: "Add" }).isVisible(), "Add");
  assert.ok(await page.getByRole("link", { name: "AI", exact: true }).isVisible(), "AI");
  assert.ok(await page.getByRole("link", { name: /Your Space is private/ }).isVisible(), "who can see your Space");
  assert.ok(await page.getByRole("heading", { level: 1, name: "Your Space" }).isVisible());
  for (const chip of ["Add people", "Connect apps", "Add to Space"]) assert.ok(await page.locator("main").getByText(chip, { exact: true }).isVisible(), chip);
  assert.equal(await page.getByRole("link", { name: /trading|payment card|packs|studio|coming soon/i }).count(), 0, "nothing hidden is linked");
  assert.ok(await fits(page), "no horizontal overflow at 1440");
  await page.screenshot({ path: join(out, "space-1440.png") });

  // --- Add opens a real menu; every entry goes somewhere that exists.
  await page.locator("summary", { hasText: "Add" }).click();
  for (const item of ["New Space", "Add people", "Connect apps"]) assert.ok(await page.getByRole("menuitem", { name: item }).isVisible(), item);
  await page.keyboard.press("Escape");

  // --- A person's words survive a reload before anything is saved.
  const field = page.getByRole("textbox", { name: BOX });
  await field.fill(words);
  await page.reload();
  await page.waitForFunction(w => document.getElementById("home-words")?.value === w, words);

  // --- With no identity and no database, the box never sends anyone to sign in: it tries to make a
  // guest here, says plainly that it couldn't, and the words stay.
  await page.getByRole("button", { name: "Make it a Space" }).click();
  await page.locator("main [role=alert]").filter({ hasText: "couldn't get you set up" }).waitFor();
  assert.equal(new URL(page.url()).pathname, "/", "no sign-in screen");
  assert.equal(await page.getByRole("textbox", { name: BOX }).inputValue(), words);

  // --- Your ID shows the card at the true card shape, even before there is an identity.
  await page.goto(url + "/account");
  const card = page.locator("main figure[data-id-card]");
  await card.waitFor();
  const box = await card.boundingBox();
  assert.ok(box && Math.abs(box.width / box.height - 85.6 / 53.98) < 0.02, "the card is ID-1 shaped");
  assert.equal(await page.locator("main figure[data-id-card] [data-card-name]").textContent(), "Your Name", "an unnamed card invites a name");
  await page.screenshot({ path: join(out, "id-1440.png"), fullPage: true });

  // --- Apps says how to connect your own AI, with the real address; no catalogue is pretended.
  await page.goto(url + "/apps");
  assert.match(await page.locator("[data-mcp-address]").innerText(), /\/mcp$/);
  assert.match(await page.locator("main").innerText(), /Solve has no AI of its own/);
  // Who the connections belong to is stated, never left for the person to infer from a fallback.
  const custody = page.locator("[data-custody]");
  assert.ok(["device", "browser", "durable"].includes(await custody.getAttribute("data-custody")), "Apps names which of the three it is");
  assert.ok((await custody.innerText()).trim().length > 20, "and says it in words");

  // --- Every place, at the smallest phone and a normal phone.
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const [path, slug] of [["/", "space"], ["/people", "people"], ["/apps", "apps"], ["/control", "control"], ["/account", "id"], ["/space", "share"], ["/search?q=garden", "search"]]) {
      await page.goto(url + path);
      await page.getByRole("heading", { level: 1 }).first().waitFor();
      assert.ok(await fits(page), `${path} overflows at ${width}px`);
      const tabs = page.getByRole("navigation", { name: "Primary mobile", exact: true });
      assert.ok(await tabs.isVisible(), `${path} has mobile navigation at ${width}px`);
      // Every control in the top bar keeps its name when a narrow screen hides its words.
      for (const name of ["AI", "Your ID"]) assert.ok(await page.getByRole("link", { name, exact: true }).first().isVisible(), `${name} is reachable by name at ${width}px`);
      const rows = new Set();
      for (const link of await tabs.getByRole("link").all()) {
        const b = await link.boundingBox();
        assert.ok(b && b.height >= 44 && b.width >= 44, "touch targets are at least 44px");
        rows.add(Math.round(b.y));
      }
      assert.equal(rows.size, 1, `${path} at ${width}px: every place on one row`);
      await page.screenshot({ path: join(out, `${slug}-${width}.png`), fullPage: true });
    }
  }

  // --- Keyboard: the first Tab reaches the skip link, which moves focus to the content.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(url);
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), "Skip to content");
  await page.waitForFunction(() => (document.activeElement?.getBoundingClientRect().top ?? -1) >= 0);
  await page.keyboard.press("Enter");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "main");

  // --- What was removed is gone, not redirected: no Bench, no confirm screen.
  for (const path of ["/workbench", "/confirm/abc"]) assert.equal((await fetch(url + path, { redirect: "manual" })).status, 404, path);

  // --- The connector's approval screen: with no request waiting it says so plainly, in the bare frame.
  await page.goto(url + "/oauth/consent");
  assert.match(await page.locator("main").innerText(), /Nothing is waiting/);
  assert.equal(await page.getByRole("navigation", { name: "Primary", exact: true }).count(), 0, "someone else's link gets the bare frame");

  // --- A browser that refuses storage is told so, and the person keeps their words on screen.
  const blocked = await browser.newContext();
  await blocked.addInitScript(() => { Storage.prototype.setItem = function () { throw new DOMException("Blocked for this test", "SecurityError"); }; });
  const failure = await blocked.newPage();
  await failure.goto(url);
  await failure.getByRole("textbox", { name: BOX }).fill("Keep this idea");
  await failure.getByRole("button", { name: "Make it a Space" }).click();
  await failure.locator("main [role=alert]").filter({ hasText: "can't keep this" }).waitFor();
  assert.equal(new URL(failure.url()).pathname, "/");
  assert.equal(await failure.getByRole("textbox", { name: BOX }).inputValue(), "Keep this idea");
  await blocked.close();

  assert.deepEqual(errors, []);
  console.log("Product browser checks passed on the approved shell: four places and Search, Add, AI, visibility and Your ID in reach at 320/390/1440, the Add menu, keyboard, a draft surviving reload and a failed start with no sign-in screen, the ID card's true shape, Apps' real connector address, removed screens gone, and honest storage failure. No database was present, so nothing is claimed as saved.");
} catch (error) { console.error(serverLog); throw error; } finally { await browser?.close(); server.kill("SIGTERM"); }
