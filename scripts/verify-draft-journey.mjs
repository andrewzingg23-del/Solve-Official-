// Manual preview E2E: verify the first-draft project journey through visible UI controls.
//
// NOT part of `npm test` — it drives a real browser against a DEPLOYED preview (previews run on the
// staging Supabase, which must have anonymous sign-in enabled and kernel_api exposed). Run it by hand
// after deploying a preview that contains the draft journey.
//
// Prerequisites: playwright-core (already a dependency) + a cached headless Chromium
//   (~/Library/Caches/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-mac-arm64; macOS).
// Usage:
//   PREVIEW_URL="https://<preview>.vercel.app" [SHOT_DIR="/abs/dir"] [MAX_DRAFT_ATTEMPTS=1] [VIEWPORT_WIDTH=390] node scripts/verify-draft-journey.mjs
//
// Checks (each reported separately as RESULT_JSON): guest session, create → navigates to the project,
// open project via the Documents control, create first draft → rendered preview (retries because the
// free model intermittently returns empty — see BUILD-STREAM 2026-11-02), edit + save a revision,
// reload retains the draft, three separate creates with a duplicate count, and separate-session
// isolation (a fresh browser context must get 404 on the private project).
import { chromium } from "playwright-core";
import { readdirSync } from "node:fs"; import { join } from "node:path"; import { homedir } from "node:os";
const base = join(homedir(), "Library/Caches/ms-playwright");
const dir = readdirSync(base).filter((d) => /^chromium_headless_shell-\d+$/.test(d)).sort().at(-1);
const exe = join(base, dir, "chrome-headless-shell-mac-arm64", "chrome-headless-shell");
const BASE = process.env.PREVIEW_URL, SHOT = process.env.SHOT_DIR;
if (!BASE) throw new Error("set PREVIEW_URL to a deployed preview");
const maxDraftAttempts = Number(process.env.MAX_DRAFT_ATTEMPTS || 4);
if (!Number.isInteger(maxDraftAttempts) || maxDraftAttempts < 1 || maxDraftAttempts > 4) throw new Error("MAX_DRAFT_ATTEMPTS must be 1–4");
const viewportWidth = Number(process.env.VIEWPORT_WIDTH || 1280);
if (!Number.isInteger(viewportWidth) || viewportWidth < 320 || viewportWidth > 1920) throw new Error("VIEWPORT_WIDTH must be 320–1920");
const r = { checks: {}, timings: {}, notes: [], maxDraftAttempts, viewportWidth };
const b = await chromium.launch({ executablePath: exe });

async function ownerReady(page) {
  await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 60000 });
  for (let i = 0; i < 6; i++) { await page.reload({ waitUntil: "networkidle", timeout: 60000 }); if (await page.getByText(/Conversation, documents and your AIs/i).count()) return true; await page.waitForTimeout(2500); }
  return false;
}
async function createViaUI(page, title, goal) {
  await page.fill("#project-title", title);
  await page.fill("#project-goal", goal);
  const t0 = Date.now();
  await page.getByRole("button", { name: /create project/i }).click();
  const ok = await page.waitForURL(/\/world\/[0-9a-f-]+\/room/, { timeout: 90000 }).then(() => true).catch(() => false);
  return { ok, ms: Date.now() - t0, worldId: ok ? page.url().match(/\/world\/([0-9a-f-]+)\/room/)[1] : null };
}

try {
  // ---- Main journey (visible controls only) ----
  const ctxA = await b.newContext({ viewport: { width: viewportWidth, height: 900 } });
  const page = await ctxA.newPage();
  r.checks.guest_session = (await ownerReady(page)) ? "PASS" : "FAIL";

  const c = await createViaUI(page, "Reef Cafe", "A one-page website for a small beachside coffee shop: a warm hero, the menu, opening hours, and a 'book a table' call to action.");
  r.timings.create_ms = c.ms;
  r.checks.create_navigates = c.ok ? `PASS (navigated to room in ${c.ms}ms)` : "FAIL (did not navigate)";
  if (!c.ok) throw new Error("create did not navigate");
  const worldId = c.worldId; r.worldId = worldId;

  // Open the project via the Documents nav control (leaves /room for the world page).
  await page.locator('a[href*="documents-heading"]').first().click();
  await page.waitForFunction(() => !location.pathname.endsWith("/room") && /\/world\//.test(location.pathname), { timeout: 30000 }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});
  r.checks.open_project = (!page.url().endsWith("/room") && /\/world\//.test(page.url())) ? "PASS (on project page)" : `FAIL (url=${page.url()})`;

  // Create first draft via its button; wait for the preview to appear (no manual reload).
  const dbtn = page.getByRole("button", { name: /create first draft/i });
  r.checks.create_first_draft = "PENDING";
  if (await dbtn.count()) {
    const t0 = Date.now();
    const panel = page.locator("section:has(button:has-text('Create first draft'))").first();
    let drew = false, attempts = 0, lastErr = "";
    // The free model intermittently returns empty; the error is recoverable, so retry via the button
    // (as a user would), up to 4 attempts.
    while (!drew && attempts < maxDraftAttempts) {
      attempts++;
      await panel.getByRole("button", { name: /create first draft/i }).first().click().catch(() => {});
      for (let i = 0; i < 16; i++) {
        await page.waitForTimeout(5000);
        if (await page.locator('iframe[title^="Preview of"]').count()) { drew = true; break; }
        const al = (await panel.locator('[role="alert"], .solve-error').first().textContent().catch(() => "")) || "";
        if (al.trim()) { lastErr = al.trim(); break; }
      }
    }
    r.timings.draft_ms = Date.now() - t0;
    r.timings.draft_attempts = attempts;
    if (!drew) r.notes.push("draft last error after " + attempts + " tries: " + (lastErr || "timeout"));
    r.checks.create_first_draft = drew ? `PASS (${attempts} attempt(s), ${r.timings.draft_ms}ms — free model intermittent)` : `FAIL after ${attempts} tries (${lastErr || "timeout"})`;
    if (drew) {
      const fr = page.locator('iframe[title^="Preview of"]').first();
      await fr.scrollIntoViewIfNeeded();
      const renderedText = await fr.contentFrame().locator("body").innerText({ timeout: 15000 });
      if (renderedText.trim().length < 80) throw new Error("preview iframe has no substantive rendered content");
      r.previewTextChars = renderedText.trim().length;
      if (SHOT) { await fr.screenshot({ path: join(SHOT, "draft-preview.png") }); r.screenshot = "draft-preview.png"; }
      r.checks.preview_renders_promptly = "PASS (eager iframe in view)";
    }
  } else r.checks.create_first_draft = (await page.locator('iframe[title^="Preview of"]').count()) ? "PASS (already present)" : "FAIL (no button)";

  // Edit + save via the Edit document control.
  if (/PASS/.test(r.checks.create_first_draft)) {
    try {
      const card = page.locator("article", { has: page.locator('iframe[title^="Preview of"]') }).first();
      await card.getByText(/Edit document/i).first().click(); await page.waitForTimeout(400);
      const ed = card.locator("form:has(button:has-text('Save revision'))").first();
      const ta = ed.locator("textarea").first(); await ta.scrollIntoViewIfNeeded();
      const v = await ta.inputValue();
      const cardId = await card.getAttribute("id");
      const revised = v.includes("</body>") ? v.replace("</body>", "<!-- edited --></body>") : v + "\n<!-- edited -->";
      if (revised.length > 12000) throw new Error("fixture revision would exceed the document limit");
      await ta.fill(revised);
      const [resp] = await Promise.all([
        page.waitForResponse((x) => x.url().includes("/artifacts") && x.request().method() === "PATCH", { timeout: 40000 }).catch(() => null),
        ed.getByRole("button", { name: /save revision/i }).click(),
      ]);
      r.notes.push("patch " + (resp ? resp.status() : "none"));
      if (!resp || !resp.ok()) throw new Error("revision PATCH did not confirm success");
      await page.reload({ waitUntil: "networkidle", timeout: 60000 });
      const savedCard = page.locator(`[id="${cardId}"]`);
      const savedSource = await savedCard.locator('iframe[title^="Preview of"]').getAttribute("srcdoc");
      const versionLabel = await savedCard.locator("header p").textContent();
      r.revisionProof = { cardId, patchStatus: resp.status(), versionLabel, sourceContainsMarker: Boolean(savedSource?.includes("<!-- edited -->")) };
      r.checks.edit_save_revision = /·\s*v2\b/i.test(versionLabel || "") && r.revisionProof.sourceContainsMarker ? "PASS (same artifact v2 and edited source survive reload)" : "FAIL (saved revision/source missing)";
    } catch (e) { r.checks.edit_save_revision = "ERROR " + String(e.message).slice(0, 60); }
    // Reload retains.
    await page.reload({ waitUntil: "networkidle", timeout: 60000 });
    r.checks.reload_retains = (await page.locator('iframe[title^="Preview of"]').count()) ? "PASS" : "FAIL";
  }
  await ctxA.close();

  // ---- 3 separate create attempts → no duplicates ----
  const ctxC = await b.newContext();
  const pg = await ctxC.newPage();
  await ownerReady(pg);
  const made = [];
  for (const n of [1, 2, 3]) {
    const res = await createViaUI(pg, `Dup Test ${n}`, `Project number ${n}.`);
    made.push(res.ok ? res.worldId : null);
    await pg.waitForTimeout(1500);
    if (n < 3) await ownerReady(pg); // back to home for the next create
  }
  await pg.goto(BASE + "/worlds", { waitUntil: "networkidle", timeout: 60000 });
  const links = await pg.locator('a[href*="/world/"]').evaluateAll((els) => [...new Set(els.map((e) => (e.getAttribute("href") || "").match(/world\/([0-9a-f-]+)/)?.[1]).filter(Boolean))]);
  r.checks.three_creates_no_duplicates = `made=${made.filter(Boolean).length}/3 distinct, /worlds shows ${links.length} projects` + (links.length === 3 && made.filter(Boolean).length === 3 ? " PASS" : " CHECK");
  await ctxC.close();

  // ---- Isolation (separate session) preserved ----
  const ctxB = await b.newContext();
  const pB = await ctxB.newPage();
  const resp = await pB.goto(`${BASE}/world/${worldId}`, { waitUntil: "networkidle", timeout: 60000 });
  const denied = (resp ? resp.status() : 0) === 404 || /not found|could not be/i.test(await pB.content());
  r.checks.isolation_separate_session = denied && !(await pB.locator('iframe[title^="Preview of"]').count()) ? `PASS (status ${resp ? resp.status() : 0})` : "FAIL";
  await ctxB.close();
} catch (e) { r.fatal = String(e.message || e).slice(0, 200); } finally { await b.close(); }
console.log("RESULT_JSON=" + JSON.stringify(r));
if (r.fatal || Object.values(r.checks).some(value => /FAIL|ERROR|UNCERTAIN|CHECK|PENDING/.test(String(value)))) process.exitCode = 1;
