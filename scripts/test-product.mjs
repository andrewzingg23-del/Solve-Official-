// Real production UI interactions. Account authority is covered separately by real SQL tests.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";
const root = process.cwd(), out = join(root, "test-results", "product");
mkdirSync(out, { recursive: true });
const cache = process.env.PLAYWRIGHT_BROWSERS_PATH || join(homedir(), ".cache/ms-playwright");
const candidates = existsSync(cache) ? readdirSync(cache).filter(d => /^chromium(?:_headless_shell)?-\d+$/.test(d)).sort().reverse().flatMap(d => ["chrome-linux/chrome", "chrome-linux64/chrome", "chrome-linux/headless_shell", "chrome-linux64/headless_shell"].map(p => join(cache, d, p))) : [];
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
  await page.getByRole("heading", { name: "Good ideas deserve a place to grow." }).waitFor();
  assert.deepEqual(await page.getByRole("navigation", { name: "Primary", exact: true }).getByRole("link").allTextContents(), ["Projects", "Communities", "Your AI", "Profile"]);
  assert.equal(await page.getByRole("link", { name: /trading|payment card|packs|studio|coming soon/i }).count(), 0);
  await fit(page);
  await page.getByRole("textbox", { name: "Project name", exact: true }).fill("Zuber Pen");
  await page.getByRole("textbox", { name: "What do you want to make happen?" }).fill("My brother and I want to develop our idea with our AIs.");
  await page.reload(); await waitValue(page, "project-title", "Zuber Pen");
  await page.screenshot({ path: join(out, "projects-desktop.png"), fullPage: true });
  await page.getByRole("button", { name: "Continue with this idea" }).click();
  await page.waitForURL(/\/login\?next=%2Fworlds%2Fnew/);
  await page.getByRole("heading", { name: "Sign in to build together." }).waitFor();
  await page.getByRole("link", { name: "Back to your idea" }).click(); await waitValue(page, "project-title", "Zuber Pen");
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
    for (const [path, heading] of [["/", "Good ideas deserve a place to grow."], ["/account", "Your profile. Your AI."], ["/communities", "Build with people who share your goal."], ["/bot", "Your AI"]]) {
      await page.goto(url + path); await page.getByRole("heading", { name: heading, exact: true }).waitFor(); await fit(page);
      const navigation = page.getByRole("navigation", { name: "Primary mobile" });
      assert.ok(await navigation.isVisible());
      for (const link of await navigation.getByRole("link").all()) { const box = await link.boundingBox(); assert.ok(box && box.height >= 44 && box.width >= 44, "Mobile navigation has touch targets"); }
      if (path === "/account") await page.waitForFunction(() => [...document.querySelectorAll(".solve-profile-preview img,.solve-portrait-grid img")].every(img => img.complete && img.naturalWidth > 0));
      await page.screenshot({ path: join(out, `${path === "/" ? "projects" : path.slice(1)}-${width}.png`), fullPage: true });
    }
  }
  await page.goto(url); await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), "Skip to content");
  await page.keyboard.press("Enter"); assert.equal(await page.evaluate(() => document.activeElement?.id), "solve-main");
  for (const [path, location] of [["/card", "/"], ["/packs/trading/argus", "/"], ["/money", "/"], ["/studio", "/"], ["/world/example/studio", "/"], ["/sov-id", "/account"], ["/start", "/account"], ["/command", "/"]]) {
    const result = await fetch(url + path, { redirect: "manual" }); assert.equal(result.status, 307, path); assert.equal(new URL(result.headers.get("location"), url).pathname, location, path);
    const post = await fetch(url + path, { method: "POST", redirect: "manual" }); assert.equal(post.status, 404, `POST ${path}`);
  }
  for (const path of ["/api/market/sparkline", "/api/studio/propose", "/api/auth/meta/start", "/api/avatar/generate"]) { const result = await fetch(url + path, { method: "POST" }); assert.equal(result.status, 404, path); assert.equal(result.headers.get("cache-control"), "no-store"); }
  // Storage denial is a labelled browser failure case, not a simulated success.
  const blocked = await browser.newContext(); await blocked.addInitScript(() => { Storage.prototype.setItem = function () { throw new DOMException("Blocked for this test", "SecurityError"); }; });
  const failure = await blocked.newPage(); await failure.goto(url);
  await failure.getByRole("textbox", { name: "Project name", exact: true }).fill("Keep this idea");
  await failure.getByRole("button", { name: "Continue with this idea" }).click();
  await failure.getByRole("alert").filter({ hasText: "Copy your idea" }).waitFor(); assert.equal(new URL(failure.url()).pathname, "/");
  assert.equal(await failure.getByRole("textbox", { name: "Project name", exact: true }).inputValue(), "Keep this idea");
  await failure.goto(url + "/account"); await failure.getByRole("textbox", { name: "Your name", exact: true }).fill("Storage test");
  await failure.getByRole("button", { name: "Save on this device" }).click(); await failure.getByRole("alert").filter({ hasText: "couldn't save the profile" }).waitFor();
  assert.equal(await failure.getByRole("status").filter({ hasText: "Profile saved" }).count(), 0); await blocked.close();
  assert.deepEqual(errors, []);
  console.log("Production product browser checks passed: navigation, drafts/sign-in return, profile/persona continuity, keyboard/mobile, hidden GET/POST routes and honest storage failures. Live sign-in/provider delivery is not simulated or claimed.");
} catch (error) { console.error(serverLog); throw error; } finally { await browser?.close(); server.kill("SIGTERM"); }
