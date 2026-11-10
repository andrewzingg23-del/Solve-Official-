// Probe: a populated Space on real phone viewports — viewport screenshots (never stitched full-page)
// at the top, middle and bottom, with the keyboard-equivalent focus on the composer and the sharing
// preview open, plus measurements of where the header, skip link and tab bar actually sit.
//
//   node scripts/acceptance/probes/space-viewports.mjs <label> [base]
//
// Uses one automated fixture on staging (its identity is labelled; its Space has an ordinary name).
import { mkdirSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";
import { VIEWPORTS, beginThing, chromiumPath, persona, Evidence, RUN } from "../lib.mjs";
import { phonePhoto } from "../scenarios/photos.mjs";

const label = process.argv[2] ?? "probe";
let base = process.argv[3];
let server;
if (!base) {
  base = "http://localhost:3012";
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", "3012"],
    { env: { ...process.env, VERCEL_ENV: "preview", SOLVE_DIST_DIR: ".next-acceptance" }, stdio: "ignore" });
  for (let i = 0; i < 40; i++) { try { if ((await fetch(base)).status < 500) break; } catch {} await new Promise(r => setTimeout(r, 1000)); }
}
const out = `test-results/viewports/${label}`;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: chromiumPath(), args: ["--no-sandbox"] });
const report = {};
try {
  const ev = new Evidence(`test-results/acceptance/${RUN}-viewports`);
  const owner = await persona(browser, base, "viewports", VIEWPORTS.phone390, ev, "viewports");
  if (!owner.kernel) throw new Error("no staging identity (guest sign-in limit?)");
  const worldId = await beginThing(owner.page, base, "Lisbon in June");
  const p = owner.page;
  for (const words of ["Flights on the 4th, back on the 11th", "Hotel: Alfama, 4 nights — booked", "Ideas: tram 28, Belém pastries, Sintra day trip"]) {
    await p.getByRole("textbox", { name: "Add something" }).fill(words);
    await p.getByRole("button", { name: "Add", exact: true }).click();
    await p.locator("[data-piece]", { hasText: words.slice(0, 12) }).waitFor({ timeout: 15000 });
  }
  await p.locator("#photo-file").setInputFiles({ name: "IMG.jpg", mimeType: "image/jpeg", buffer: await phonePhoto(p) });
  await p.getByRole("textbox", { name: "Caption" }).fill("The view from the hotel");
  await p.locator("[data-add-photo]").click();
  await p.locator("[data-photo]").first().waitFor({ timeout: 20000 });

  for (const [name, viewport] of [["390", { width: 390, height: 844 }], ["320", { width: 320, height: 640 }]]) {
    await p.setViewportSize(viewport);
    await p.goto(`${base}/world/${worldId}`);
    await p.getByRole("heading", { level: 1 }).waitFor();
    const height = await p.evaluate(() => document.documentElement.scrollHeight);
    const measure = async () => p.evaluate(() => {
      const box = sel => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), visible: r.bottom > 0 && r.top < innerHeight }; };
      return { scrollY: Math.round(scrollY), header: box("header[class*=top]"), skip: box('a[href="#main"]'), tabs: box('nav[aria-label="Primary mobile"]'),
        overflow: document.documentElement.scrollWidth > innerWidth + 1, active: document.activeElement?.tagName + (document.activeElement?.id ? "#" + document.activeElement.id : "") };
    });
    const shots = {};
    for (const [where, y] of [["top", 0], ["middle", Math.max(0, (height - viewport.height) / 2)], ["bottom", height]]) {
      await p.evaluate(top => window.scrollTo(0, top), y);
      await p.waitForTimeout(250);
      await p.screenshot({ path: `${out}/${name}-${where}.png` });
      shots[where] = await measure();
    }
    // The last piece must be reachable above the tab bar at the very bottom.
    const lastClear = await p.evaluate(() => {
      const items = [...document.querySelectorAll("main a, main button, main input, main textarea")].filter(el => el.offsetParent);
      const last = items.at(-1); const tabs = document.querySelector('nav[aria-label="Primary mobile"]');
      if (!last || !tabs) return null;
      return Math.round(tabs.getBoundingClientRect().top - last.getBoundingClientRect().bottom);
    });
    // Keyboard: focus the composer as a tap would, and Tab through to the next control.
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.getByRole("textbox", { name: "Add something" }).focus();
    await p.screenshot({ path: `${out}/${name}-composer-focused.png` });
    const composerFocus = await measure();
    // The sharing preview, as the owner would open it.
    const share = p.locator("[data-share]");
    if (await share.count()) {
      await share.scrollIntoViewIfNeeded();
      if (!(await share.evaluate(el => el.open ?? true))) await share.locator("summary").click();
      await p.screenshot({ path: `${out}/${name}-share-open.png` });
      await share.locator("[data-choice]").first().locator("input").check().catch(() => {});
      await share.locator("[data-preview]").scrollIntoViewIfNeeded().catch(() => {});
      await p.screenshot({ path: `${out}/${name}-share-preview.png` });
    }
    report[name] = { height, shots, lastClearOfTabs: lastClear, composerFocus };
  }
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 1));
} finally { await browser.close(); server?.kill(); }
