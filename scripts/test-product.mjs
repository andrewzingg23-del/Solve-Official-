// Real production UI interactions. Account authority is covered separately by real SQL tests.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";
const root = process.cwd(), out = join(root, "test-results", "product");
mkdirSync(out, { recursive: true });
// Playwright's cache lives somewhere different on macOS, and names the binary differently.
// Both are listed so this gate is runnable locally by a builder on a Mac, not only in CI.
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
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", port], { cwd: root, env: { ...process.env, ENABLE_EXPERIMENTAL_FEATURES: "false", ENABLE_MONEY: "false", ENABLE_EXTERNAL_FINANCIAL_ACTIONS: "false" }, stdio: ["ignore", "pipe", "pipe"] });
let serverLog = "", browser;
server.stdout.on("data", d => { serverLog = (serverLog + d).slice(-8000); });
server.stderr.on("data", d => { serverLog = (serverLog + d).slice(-8000); });
const waitValue = (page, id, value) => page.waitForFunction(({ id, value }) => document.getElementById(id)?.value === value, { id, value });
const fit = async page => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Horizontal overflow at ${page.viewportSize().width}px`);
try {
  let ready = false;
  for (let i = 0; i < 45; i++) { if (server.exitCode !== null) throw new Error(serverLog); try { if ((await fetch(url)).ok) { ready = true; break; } } catch {} await new Promise(resolve => setTimeout(resolve, 1000)); }
  if (!ready) throw new Error("Production app did not start: " + serverLog);
  browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  const page = await context.newPage(), errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(url);
  // Anchored to the form's accessible name and the field's id, not to headline copy:
  // the words on the home surface are expected to change, the mechanism is not.
  await page.getByRole("form", { name: "Start new work" }).waitFor();
  assert.deepEqual(await page.getByRole("navigation", { name: "Your environment", exact: true }).getByRole("link").allTextContents(), ["Space", "Workbench", "ID"]);
  assert.equal(await page.getByRole("link", { name: /trading|payment card|packs|studio|coming soon/i }).count(), 0);
  await fit(page);
  await page.getByRole("textbox", { name: "What do you want to accomplish?" }).fill("My brother and I want to develop our idea with our AIs.");
  // A guest's first words survive a reload before any account exists.
  await page.reload(); await waitValue(page, "reality-intention", "My brother and I want to develop our idea with our AIs.");
  await page.screenshot({ path: join(out, "home-desktop.png"), fullPage: true });
  await page.getByRole("button", { name: "Begin", exact: true }).click();
  await page.waitForURL(/\/login\?next=%2F$/);
  await page.getByRole("heading", { name: "Sign in to build together." }).waitFor();
  // Coming back from sign-in must not cost the guest their words.
  await page.getByRole("link", { name: "Back to your idea" }).click();
  await waitValue(page, "reality-intention", "My brother and I want to develop our idea with our AIs.");
  await page.goto(url + "/account");
  await page.getByRole("textbox", { name: "Your name", exact: true }).fill("Avery");
  await page.getByRole("textbox", { name: "Your AI’s name", exact: true }).fill("Mira");
  await page.getByRole("button", { name: "Choose Host portrait", exact: true }).click();
  await page.getByRole("button", { name: "Save on this device", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Profile saved on this device" }).waitFor();
  await page.reload(); await waitValue(page, "profile-name", "Avery"); await waitValue(page, "profile-bot-name", "Mira");
  assert.equal(await page.getByRole("button", { name: "Choose Host portrait", exact: true }).getAttribute("aria-pressed"), "true");
  await page.waitForFunction(() => [...document.querySelectorAll(".solve-profile-preview img,.solve-portrait-grid img")].every(img => img.complete && img.naturalWidth > 0));
  await page.screenshot({ path: join(out, "profile-desktop.png"), fullPage: true });
  await page.goto(url + "/bot"); await page.getByRole("heading", { name: "Your AI", exact: true }).waitFor();
  await page.getByRole("tab", { name: "Personality", exact: true }).click();
  await page.getByRole("textbox", { name: "Name", exact: true }).waitFor();
  assert.equal(await page.getByRole("textbox", { name: "Name", exact: true }).inputValue(), "Mira");
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Juno");
  await page.getByRole("button", { name: "Keep it on this device", exact: true }).click();
  await page.goto(url + "/account"); await waitValue(page, "profile-bot-name", "Juno");
  await page.getByRole("button", { name: "Save on this device", exact: true }).click();
  await page.reload(); await waitValue(page, "profile-bot-name", "Juno");
  await page.goto(url + "/communities"); await page.getByRole("heading", { name: "Build with people who share your goal." }).waitFor();
  assert.equal(await page.getByRole("link", { name: "Sign in to explore communities" }).count(), 1);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    // Home carries its own mobile navigation; the product shell supplies the rest.
    for (const [path, ready, navName, shot] of [
      ["/", page.getByRole("form", { name: "Start new work" }), "Mobile navigation", "home"],
      ["/account", page.getByRole("heading", { name: "Your profile. Your AI.", exact: true }), "Primary mobile", "account"],
      ["/communities", page.getByRole("heading", { name: "Build with people who share your goal.", exact: true }), "Primary mobile", "communities"],
      ["/bot", page.getByRole("heading", { name: "Your AI", exact: true }), "Primary mobile", "bot"],
    ]) {
      await page.goto(url + path); await ready.waitFor(); await fit(page);
      const navigation = page.getByRole("navigation", { name: navName, exact: true });
      assert.ok(await navigation.isVisible(), `${path} has mobile navigation`);
      for (const link of await navigation.getByRole("link").all()) { const box = await link.boundingBox(); assert.ok(box && box.height >= 44 && box.width >= 44, "Mobile navigation has touch targets"); }
      if (path === "/account") await page.waitForFunction(() => [...document.querySelectorAll(".solve-profile-preview img,.solve-portrait-grid img")].every(img => img.complete && img.naturalWidth > 0));
      await page.screenshot({ path: join(out, `${shot}-${width}.png`), fullPage: true });
    }
  }
  await page.goto(url); await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), "Skip to content");
  await page.keyboard.press("Enter"); assert.equal(await page.evaluate(() => document.activeElement?.id), "reality-main");
  for (const [path, location] of [["/card", "/"], ["/packs/trading/argus", "/"], ["/money", "/"], ["/studio", "/"], ["/world/example/studio", "/"], ["/sov-id", "/account"], ["/start", "/account"], ["/command", "/"]]) {
    const result = await fetch(url + path, { redirect: "manual" }); assert.equal(result.status, 307, path); assert.equal(new URL(result.headers.get("location"), url).pathname, location, path);
    const post = await fetch(url + path, { method: "POST", redirect: "manual" }); assert.equal(post.status, 404, `POST ${path}`);
  }
  for (const path of ["/api/market/sparkline", "/api/studio/propose", "/api/auth/meta/start", "/api/avatar/generate"]) { const result = await fetch(url + path, { method: "POST" }); assert.equal(result.status, 404, path); assert.equal(result.headers.get("cache-control"), "no-store"); }
  // Storage denial is a labelled browser failure case, not a simulated success.
  const blocked = await browser.newContext(); await blocked.addInitScript(() => { Storage.prototype.setItem = function () { throw new DOMException("Blocked for this test", "SecurityError"); }; });
  const failure = await blocked.newPage(); await failure.goto(url);
  await failure.getByRole("textbox", { name: "What do you want to accomplish?" }).fill("Keep this idea");
  await failure.getByRole("button", { name: "Begin", exact: true }).click();
  // Refused storage is told plainly and the guest's words are still on screen.
  await failure.getByRole("alert").filter({ hasText: "can't keep this" }).waitFor();
  assert.equal(new URL(failure.url()).pathname, "/");
  assert.equal(await failure.getByRole("textbox", { name: "What do you want to accomplish?" }).inputValue(), "Keep this idea");
  await failure.goto(url + "/account"); await failure.getByRole("textbox", { name: "Your name", exact: true }).fill("Storage test");
  await failure.getByRole("button", { name: "Save on this device" }).click(); await failure.getByRole("alert").filter({ hasText: "couldn't save the profile" }).waitFor();
  assert.equal(await failure.getByRole("status").filter({ hasText: "Profile saved" }).count(), 0); await blocked.close();
  assert.deepEqual(errors, []);
  console.log("Production product browser checks passed: navigation, drafts/sign-in return, profile/persona continuity, keyboard/mobile, hidden GET/POST routes and honest storage failures. Live sign-in/provider delivery is not simulated or claimed.");
} catch (error) { console.error(serverLog); throw error; } finally { await browser?.close(); server.kill("SIGTERM"); }
