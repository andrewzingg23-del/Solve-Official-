// Present: the same saved Lisbon trip composed as a travel Space — cover, highlights, journal, its own
// colour — without copying or changing a single record (DECISIONS.md 2026-11-10, the quality contract).
import { VIEWPORTS, beginThing, close, persona } from "../lib.mjs";
import { phonePhoto } from "./photos.mjs";

const S = "present";

const presentationOf = async (kernel, worldId) => {
  const rows = await kernel.rpc("read_world", { p_scope: `world:${worldId}` }).catch(() => []);
  return Array.isArray(rows) ? rows.find(r => r.attributes?.sov === "solve.presentation") ?? null : null;
};
const versionsOf = async (kernel, worldId) => {
  const rows = await kernel.rpc("read_world", { p_scope: `world:${worldId}` }).catch(() => []);
  return Object.fromEntries((Array.isArray(rows) ? rows : []).filter(r => r.kind === "document").map(r => [r.entity_id, r.version]));
};

/**
 * Everything a presentation must never touch, read from the kernel: each note and photo (id, version,
 * words, author), who is a member and with what authority, and the Space's history — minus the
 * presentation record's own versions, which are the one thing that is supposed to change.
 */
async function truthOf(owner, family, worldId) {
  const scope = `world:${worldId}`;
  const rows = await owner.kernel.rpc("read_world", { p_scope: scope }).catch(() => []);
  const pres = rows.find?.(r => r.attributes?.sov === "solve.presentation")?.entity_id ?? null;
  const events = await owner.kernel.rpc("read_events", { p_scope: scope, p_after_seq: 0, p_limit: 1000, p_newest_first: false }).catch(() => []);
  const authorOf = Object.fromEntries(events.filter(e => e.type === "kernel.entity.created").map(e => [e.payload?.entity_id, e.actor_id]));
  const grants = await family.kernel.rpc("my_grants").catch(() => []);
  return {
    pres,
    resources: rows.filter(r => r.kind === "document").map(r => [r.entity_id, r.version, r.attributes?.content ?? r.attributes?.caption ?? "", authorOf[r.entity_id]]).sort().join("|"),
    authority: grants.filter(g => g.scope === scope).map(g => `${g.capability}:${g.grantee_id ?? ""}`).sort().join(","),
    history: (pid) => events.filter(e => e.payload?.entity_id !== pid).map(e => `${e.type}:${e.actor_id}:${e.payload?.entity_id ?? ""}`).join("|"),
  };
}
/** The same Space? Compared ignoring only the presentation record. */
function same(a, b) {
  const pid = b.pres ?? a.pres;
  return a.resources === b.resources && a.authority === b.authority && a.history(pid) === b.history(pid);
}

async function invite(owner, friend, base) {
  await owner.page.getByRole("button", { name: "Invite a friend" }).click();
  const link = await owner.page.getByRole("textbox", { name: "Invite link" }).inputValue().catch(() => "");
  if (!link) return false;
  await friend.page.goto(base + new URL(link).pathname);
  await friend.page.locator("[data-join]").click();
  return friend.page.waitForURL(/\/world\/[0-9a-f-]{36}$/, { timeout: 20000 }).then(() => true, () => false);
}

export async function present({ browser, base, evidence }) {
  const owner = await persona(browser, base, "traveller", VIEWPORTS.phone390, evidence, S);
  const outsider = await persona(browser, base, "outsider", VIEWPORTS.phone390, evidence, S);
  const family = await persona(browser, base, "family", VIEWPORTS.phone320, evidence, S);
  try {
    if (!owner.kernel || !outsider.kernel || !family.kernel) return;
    const p = owner.page;
    const worldId = await beginThing(p, base, "Lisbon in June");
    for (const words of ["Flights on the 4th, back on the 11th", "Hotel: Alfama, 4 nights — booked", "Ideas: tram 28, Belém pastries, Sintra day trip"]) {
      await p.getByRole("textbox", { name: "Add something" }).fill(words);
      await p.getByRole("button", { name: "Add", exact: true }).click();
      await p.locator("[data-piece]", { hasText: words.slice(0, 14) }).waitFor({ timeout: 15000 });
    }
    await p.locator("#photo-file").setInputFiles({ name: "IMG.jpg", mimeType: "image/jpeg", buffer: await phonePhoto(p) });
    await p.getByRole("textbox", { name: "Caption" }).fill("The view from the hotel");
    await p.locator("[data-add-photo]").click();
    await p.locator("[data-photo]").first().waitFor({ timeout: 20000 });
    await p.goto(`${base}/world/${worldId}`);
    evidence.record(S, family.role, "joins the trip, so relationships and authority are part of what must not change", await invite(owner, family, base));
    await p.goto(`${base}/world/${worldId}`);
    const truth0 = await truthOf(owner, family, worldId);
    const before = await versionsOf(owner.kernel, worldId);
    evidence.record(S, owner.role, "has a real trip: three notes and a photo", Object.keys(before).length >= 4, JSON.stringify(Object.values(before)));
    await p.screenshot({ path: `${evidence.dir}/present-01-base-390.png` });

    // --- Edit Space: Story, the hotel photo as cover, the flights as a highlight, a sea-green colour.
    const edit = p.locator("[data-edit-space]");
    // Editing is contextual: it opens in place from the Space's own header.
    await p.locator("[data-edit-open]").first().click();
    evidence.record(S, owner.role, "Edit Space opens in place from the Space's header",
      await p.waitForFunction(() => document.querySelector("[data-edit-space]")?.open === true, null, { timeout: 10000 }).then(() => true, () => false));
    await edit.locator('[data-composition="story"]').check();
    const coverId = await edit.locator("[data-cover] option").nth(1).getAttribute("value");
    await edit.locator("[data-cover]").selectOption(coverId);
    const flightsId = (await edit.locator("[data-feature]").evaluateAll(els => els.map(e => [e.getAttribute("data-feature"), e.closest("label").innerText])))
      .find(([, t]) => t.startsWith("Flights"))?.[0];
    await edit.locator(`[data-feature="${flightsId}"]`).check();
    // The Space's own colour, taken from its own cover photo — or an honest message if it can't be read.
    await edit.locator("[data-tint-from-cover]").click();
    await p.waitForTimeout(1500);
    const fromCover = await edit.locator("[data-any-tint]").getAttribute("aria-pressed");
    const why = await edit.locator("[role=alert]").textContent().catch(() => "");
    evidence.record(S, owner.role, "the Space can take its colour from its own cover photo (or says plainly it can't)",
      fromCover === "true" || /can't be read/.test(why ?? ""), fromCover === "true" ? "colour taken from the photo" : why ?? "");

    // --- Preview: the trip as a travel Space, and nothing saved.
    await edit.locator("[data-preview-space]").click();
    await p.locator("[data-previewing]").waitFor({ timeout: 15000 });
    evidence.record(S, owner.role, "the preview leads with the cover photo and the title over it", await p.locator("[data-hero] img").isVisible());
    evidence.record(S, owner.role, "and puts the flights first as a highlight", (await p.locator("[data-highlight]").first().innerText()).startsWith("Flights"));
    evidence.record(S, owner.role, "previewing saves nothing", (await presentationOf(owner.kernel, worldId)) === null);
    evidence.record(S, owner.role, "previewing changes no content, relationship, permission, authorship or history", same(truth0, await truthOf(owner, family, worldId)));
    for (const [name, vp] of [["390", { width: 390, height: 844 }], ["320", { width: 320, height: 640 }]]) {
      await p.setViewportSize(vp);
      await p.evaluate(() => scrollTo(0, 0));
      await p.screenshot({ path: `${evidence.dir}/present-02-preview-${name}-top.png` });
      await p.evaluate(() => scrollTo(0, document.documentElement.scrollHeight / 3));
      await p.screenshot({ path: `${evidence.dir}/present-02-preview-${name}-middle.png` });
      evidence.record(S, owner.role, `the travel Space fits a ${name}px phone`, await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    }
    await p.setViewportSize(VIEWPORTS.phone390);

    // --- Save: one presentation version; not one note or photo changed.
    await p.locator("[data-save-space]").click();
    await p.waitForURL(u => !u.search.includes("preview"), { timeout: 15000 }).catch(() => {});
    await p.locator("[data-hero]").waitFor({ timeout: 15000 }).catch(() => {});
    const saved = await presentationOf(owner.kernel, worldId);
    evidence.record(S, owner.role, "saving writes the composition as its own record, version 1",
      saved?.version === 1 && saved.attributes.presentation.composition === "story" && saved.attributes.presentation.cover === coverId, JSON.stringify(saved?.attributes?.presentation));
    const after = await versionsOf(owner.kernel, worldId);
    evidence.record(S, owner.role, "no note or photo was copied or changed — same records, same versions",
      JSON.stringify(after) === JSON.stringify(before), `${JSON.stringify(before)} → ${JSON.stringify(after)}`);
    evidence.record(S, owner.role, "saving changes no content, relationship, permission, authorship or history", same(truth0, await truthOf(owner, family, worldId)));
    await family.page.goto(`${base}/world/${worldId}`);
    evidence.record(S, family.role, "the family member sees the same travel Space — one presentation, shared",
      await family.page.locator("[data-hero]").isVisible() && (await family.page.locator("[data-highlight]").first().innerText()).startsWith("Flights"));
    await p.reload();
    evidence.record(S, owner.role, "after a reload it is still the travel Space", await p.locator("[data-hero] img").isVisible() && !(await p.locator("[data-previewing]").count()));
    await p.screenshot({ path: `${evidence.dir}/present-03-saved-390.png` });

    // --- Nobody else can compose it.
    const peek = await outsider.page.goto(`${base}/world/${worldId}?preview=1&composition=base`);
    evidence.record(S, outsider.role, "can't open it, preview or not", peek?.status() === 404, `status ${peek?.status()}`);
    const forged = await outsider.kernel.rpc("upsert_entity", { p_kind: "resource", p_scope: `world:${worldId}`, p_title: "x", p_summary: "",
      p_attributes: { sov: "solve.presentation", worldId, presentation: { composition: "base" } }, p_latitude: null, p_longitude: null, p_altitude_m: null,
      p_location_truth: null, p_visibility: "members", p_importance: 50, p_entity_id: saved?.entity_id ?? null, p_idempotency_key: `forge-${worldId}` }).then(() => "written", e => e.message);
    evidence.record(S, outsider.role, "the kernel refuses a forged change to how it looks", forged !== "written", forged);

    // --- Undo, then Return to Base: each a version; the content is untouched throughout.
    const panel = p.locator("[data-edit-space]");
    if (!(await panel.evaluate(el => el.open))) await panel.locator("summary").click();
    await panel.locator("[data-base-space]").click();
    await p.locator("[data-hero]").waitFor({ state: "detached", timeout: 15000 }).catch(() => {});
    const based = await presentationOf(owner.kernel, worldId);
    evidence.record(S, owner.role, "Return to Base restores Solve's own layout, as a new version",
      based?.version === 2 && based.attributes.presentation.composition === "base" && !(await p.locator("[data-hero]").count()));
    if (!(await p.locator("[data-edit-space]").evaluate(el => el.open))) await p.locator("[data-edit-space] summary").click();
    await p.locator("[data-undo-space]").click();
    await p.locator("[data-hero]").waitFor({ timeout: 15000 }).catch(() => {});
    const undone = await presentationOf(owner.kernel, worldId);
    evidence.record(S, owner.role, "Undo brings the travel Space back, as a new version",
      undone?.version === 3 && undone.attributes.presentation.composition === "story" && await p.locator("[data-hero]").isVisible());
    evidence.record(S, owner.role, "and still not one note or photo changed", JSON.stringify(await versionsOf(owner.kernel, worldId)) === JSON.stringify(before));
    evidence.record(S, owner.role, "through Base and Undo, content, relationships, permissions, authorship and history are unchanged", same(truth0, await truthOf(owner, family, worldId)));

    // --- What's shown is functional: the family member edits the highlighted note right where it is.
    const highlight = family.page.locator("[data-highlight]").first();
    await family.page.goto(`${base}/world/${worldId}`);
    await highlight.locator("[data-revise-open]").click();
    await highlight.locator("[data-revise-text]").fill("Flights on the 4th, back on the 12th");
    await highlight.locator("[data-revise-save]").click();
    await family.page.locator("[data-revise]").waitFor({ state: "detached", timeout: 20000 }).catch(() => {});
    evidence.record(S, family.role, "can edit a highlighted note in place, and it stays highlighted",
      (await family.page.locator("[data-highlight]").first().innerText()).includes("back on the 12th"));
    const kept = await presentationOf(owner.kernel, worldId);
    evidence.record(S, owner.role, "editing content doesn't touch the presentation record", kept?.version === 3);
    await family.page.screenshot({ path: `${evidence.dir}/present-04-family-320.png` });

    for (const x of [owner, outsider, family]) evidence.record(S, x.role, "no uncaught errors in the page", x.errors.length === 0, x.errors.join(" | "));
  } finally {
    await close(owner, outsider, family);
  }
}
