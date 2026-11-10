// The SOV card: a person sees their own card with their own name, shapes its look, keeps it, undoes
// it, returns to Base — and the look is a private record nobody else can read or write. Readability
// is measured in the rendered browser, not assumed from the palette maths.
import { INTERNAL_IDS, MARK, OUR_WORDS, VIEWPORTS, close, persona } from "../lib.mjs";

const S = "card";

/** WCAG contrast between an element's text colour and the card's background, as actually rendered. */
async function renderedContrast(page, textSelector) {
  return page.evaluate(sel => {
    const parse = s => (s.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number).map(v => v / 255);
    const lin = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const card = document.querySelector("main figure[data-id-card]");
    const text = document.querySelector(sel);
    if (!card || !text) return 0;
    const [a, b] = [lum(parse(getComputedStyle(card).backgroundColor)), lum(parse(getComputedStyle(text).color))];
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }, textSelector);
}

async function cardShape(page) {
  const box = await page.locator("main figure[data-id-card]").boundingBox();
  return box ? box.width / box.height : 0;
}

async function storedLook(kernel, actorId) {
  const rows = await kernel.rpc("read_world", { p_scope: `actor:${actorId}` }).catch(e => e);
  if (!Array.isArray(rows)) return { error: rows?.message ?? "unreadable" };
  const record = rows.find(r => r.attributes?.sov === "solve.look");
  return record ? { look: record.attributes.look, version: record.version } : { look: null };
}

export async function card({ browser, base, evidence }) {
  const owner = await persona(browser, base, "card-owner", VIEWPORTS.phone390, evidence, S);
  const other = await persona(browser, base, "another-person", VIEWPORTS.desktop, evidence, S);
  try {
    if (!owner.kernel || !other.kernel) return;
    const page = owner.page;

    // --- A person opens ID and sees their own card, carrying the name they chose.
    await page.goto(base + "/account");
    const figure = page.locator("main figure[data-id-card]");
    const shown = await figure.waitFor({ timeout: 20000 }).then(() => true, () => false);
    evidence.record(S, owner.role, "sees their SOV card on ID", shown);
    if (!shown) return;
    const name = (await page.locator("main figure[data-id-card] [data-card-name]").textContent())?.trim() ?? "";
    evidence.record(S, owner.role, "the card carries the name they chose, from their identity record", name.startsWith(MARK), `card says "${name}"`);
    const ratio = await cardShape(page);
    evidence.record(S, owner.role, "it is the shape of a real card (ID-1, 85.60 × 53.98 mm)", Math.abs(ratio - 85.6 / 53.98) < 0.012, `ratio ${ratio.toFixed(4)}`);
    const nameContrast = await renderedContrast(page, "main figure[data-id-card] [data-card-name]");
    const lineContrast = await renderedContrast(page, "main figure[data-id-card] [data-card-status]");
    evidence.record(S, owner.role, "its name is readable as rendered (≥ 4.5:1)", nameContrast >= 4.5, `${nameContrast.toFixed(2)}:1`);
    evidence.record(S, owner.role, "its small print is readable as rendered (≥ 4.5:1)", lineContrast >= 4.5, `${lineContrast.toFixed(2)}:1`);
    const idText = await page.locator("main").first().innerText();
    evidence.record(S, owner.role, "ID shows them no internal id or word of ours", !INTERNAL_IDS.test(idText) && !OUR_WORDS.test(idText),
      idText.match(INTERNAL_IDS)?.[0] ?? idText.match(OUR_WORDS)?.[0] ?? "");
    // Everything on the face except the person's own name, which is theirs to write.
    const faceText = (await figure.innerText()).replace(name, "").toLowerCase();
    evidence.record(S, owner.role, "the face claims nothing untrue — no number, expiry, payment mark or verification",
      !/verified|visa|mastercard|\bexp(iry|ires)?\b|valid thru|\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/.test(faceText), faceText);
    await evidence.shot(page, "card-01-base-390");
    const baseColour = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());

    // --- They shape it: expressive, their colour, a metal finish. The preview is the real card.
    await page.getByRole("group", { name: "Expression" }).getByRole("button", { name: "Expressive" }).click();
    await page.getByRole("button", { name: "Colour #7a2f5c" }).click();
    evidence.record(S, owner.role, "the preview says it is not saved yet", await page.getByText("Not saved yet.").isVisible());
    const previewContrast = await renderedContrast(page, "main figure[data-id-card] [data-card-name]");
    evidence.record(S, owner.role, "their colour keeps the name readable as rendered", previewContrast >= 4.5, `${previewContrast.toFixed(2)}:1`);
    await page.getByRole("button", { name: "Save look" }).click();
    const saved = await page.getByText("Saved. Your SOLVE now wears it.").waitFor({ timeout: 15000 }).then(() => true, () => false);
    evidence.record(S, owner.role, "saving tells them it is saved", saved);
    const skipShown = await page.locator('a[href="#main"]').evaluate(el => {
      const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight;
    }).catch(() => false);
    evidence.record(S, owner.role, "nothing flashes over their card after saving", !skipShown, "the skip link appeared on screen");
    await evidence.shot(page, "card-02-expressive-390");

    // --- Independent read-back: the kernel holds exactly that look, as a record in their scope.
    const afterSave = await storedLook(owner.kernel, owner.actorId);
    const want = { expression: "expressive", seed: "#7a2f5c", tone: "light", finish: "glass" };
    const same = (a, b) => Boolean(a && b) && Object.keys(b).every(k => a[k] === b[k]) && Object.keys(a).length === Object.keys(b).length;
    evidence.record(S, owner.role, "the kernel holds exactly the look they saved", same(afterSave.look, want), JSON.stringify(afterSave));

    // --- One record, card to Control: the whole environment now wears the card's colour.
    await page.reload();
    await figure.waitFor({ timeout: 15000 });
    const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());
    await other.page.goto(base + "/account");
    const baseAccent = await other.page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());
    evidence.record(S, owner.role, "their whole SOLVE takes its colour from their card", Boolean(accent) && accent !== baseAccent,
      `their accent ${accent}, an untouched person's ${baseAccent}`);

    // --- It persists: a fresh load shows their card as they left it.
    await page.reload();
    await figure.waitFor({ timeout: 15000 });
    const reloadedColour = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());
    evidence.record(S, owner.role, "returning later, their card looks as they left it",
      reloadedColour !== baseColour && await page.getByRole("group", { name: "Expression" }).getByRole("button", { name: "Expressive" }).getAttribute("aria-pressed") === "true",
      `accent ${reloadedColour}`);

    // --- Undo is real: it restores the previous look as a new, attributable version.
    await page.getByRole("button", { name: "Undo" }).click();
    await page.getByText("Your previous look is back.").waitFor({ timeout: 15000 }).catch(() => {});
    const afterUndo = await storedLook(owner.kernel, owner.actorId);
    evidence.record(S, owner.role, "undo restores the look they had before, in the kernel",
      afterUndo.look?.expression === "base" && (afterUndo.version ?? 0) > (afterSave.version ?? 0), JSON.stringify(afterUndo));

    // --- And Base is always one tap away.
    await page.getByRole("group", { name: "Expression" }).getByRole("button", { name: "Personal" }).click();
    await page.getByRole("button", { name: "Save look" }).click();
    await page.getByText("Saved. Your SOLVE now wears it.").waitFor({ timeout: 15000 }).catch(() => {});
    await page.getByRole("button", { name: "Return to Base" }).click();
    await page.getByText("Back to SOLVE Base.").waitFor({ timeout: 15000 }).catch(() => {});
    const afterReset = await storedLook(owner.kernel, owner.actorId);
    evidence.record(S, owner.role, "Return to Base restores SOLVE's base look", afterReset.look?.expression === "base", JSON.stringify(afterReset));

    // --- Their history records every change, as theirs.
    const events = await owner.kernel.rpc("read_events", { p_scope: `actor:${owner.actorId}`, p_after_seq: 0, p_limit: 100, p_newest_first: false }).catch(() => []);
    const lookActs = Array.isArray(events) ? events.filter(e => /entity\.(created|revised|updated)/.test(e.type)) : [];
    evidence.record(S, owner.role, "every change to the look is an act in their own history",
      lookActs.length >= 4 && lookActs.every(e => e.actor_id === owner.actorId), `${lookActs.length} acts`);

    // --- Their account history says what happened in plain words, never as our event types.
    await page.goto(base + "/account");
    const history = await page.locator('section[aria-label="About your account"]').innerText().catch(() => "");
    evidence.record(S, owner.role, "their account history uses plain words, not our event types",
      history.length > 0 && !/\bkernel\b|\bentity\b|[a-z]+\.[a-z]+\.[a-z]+/i.test(history.replace(MARK, "")), history.slice(0, 200));

    // --- Nobody else can read it or write it.
    const peek = await storedLook(other.kernel, owner.actorId);
    evidence.record(S, other.role, "cannot read someone else's card look", Boolean(peek.error) || peek.look === null, JSON.stringify(peek));
    const forge = await other.kernel.rpc("upsert_entity", {
      p_kind: "resource", p_scope: `actor:${owner.actorId}`, p_title: "Card look",
      p_summary: "", p_attributes: { sov: "solve.look", look: { expression: "expressive", seed: "#ff0000", tone: "dark", finish: "glass" } },
      p_latitude: null, p_longitude: null, p_altitude_m: null, p_location_truth: null, p_visibility: "private",
      p_importance: 50, p_entity_id: null, p_idempotency_key: `${MARK}-forge`,
    }).then(() => "written", e => e.message);
    evidence.record(S, other.role, "cannot write a look onto someone else's card", forge !== "written", "the kernel accepted the forged write");

    // --- The same card on the smallest phone and on a desktop.
    for (const [label, viewport] of [["320px", VIEWPORTS.phone320], ["1440px", VIEWPORTS.desktop]]) {
      await page.setViewportSize(viewport);
      await page.goto(base + "/account");
      await figure.waitFor({ timeout: 15000 });
      const r = await cardShape(page);
      const fits = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
      evidence.record(S, owner.role, `at ${label} it is still a true card and nothing overflows`, Math.abs(r - 85.6 / 53.98) < 0.012 && fits, `ratio ${r.toFixed(4)}, fits=${fits}`);
      await evidence.shot(page, `card-03-${label}`);
    }

    for (const p of [owner, other]) evidence.record(S, p.role, "no uncaught errors in the page", p.errors.length === 0, p.errors.join(" | "));
  } finally {
    await close(owner, other);
  }
}
