// Act: revise a piece, through the capability contract (lib/product/capabilities.ts) — one mechanism
// proven in two different lives (docs/architecture/2026-11-10-reusable-foundation.md §9).
//
//   A family trip: the owner and a family member both change the plan. Persistence across reloads,
//   a dropped connection and a retry, two people saving at once, and an outsider refused.
//   A creator's portfolio: changing a published piece changes the public page — one truth, two
//   presentations — and a friend's change to the owner's piece takes it off the public page.
//
// Every claim is read back from the kernel as the person, never trusted from the screen.
import { MARK, VIEWPORTS, beginThing, close, openShare, persona } from "../lib.mjs";

const S = "act";

async function addText(who, words) {
  await who.page.getByRole("textbox", { name: "Add something" }).fill(words);
  await who.page.getByRole("button", { name: "Add", exact: true }).click();
  return who.page.locator("[data-piece]", { hasText: words }).waitFor({ timeout: 15000 }).then(() => true, () => false);
}

async function invite(owner, friend, base) {
  await owner.page.getByRole("button", { name: "Invite a friend" }).click();
  const link = await owner.page.getByRole("textbox", { name: "Invite link" }).inputValue().catch(() => "");
  if (!link) return false;
  await friend.page.goto(base + new URL(link).pathname);
  await friend.page.locator("[data-join]").click();
  return friend.page.waitForURL(/\/world\/[0-9a-f-]{36}$/, { timeout: 20000 }).then(() => true, () => false);
}

/** The piece whose latest text matches, as the kernel holds it for this person. */
async function pieceIn(kernel, worldId, text) {
  const rows = await kernel.rpc("read_world", { p_scope: `world:${worldId}` }).catch(() => []);
  return Array.isArray(rows) ? rows.find(r => r.kind === "document" && r.attributes?.content === text) ?? null : null;
}

/** Open, type, save — and wait until the save has really finished: the editor closes, or says why not.
 *  (A text match alone would also match the open editor, which already holds the new words.) */
async function edit(who, from, to) {
  const piece = who.page.locator("[data-piece]", { hasText: from });
  await piece.locator("[data-revise-open]").click();
  await piece.locator("[data-revise-text]").fill(to);
  await piece.locator("[data-revise-save]").click();
  await settled(who.page);
  return piece;
}
async function settled(page) {
  await Promise.race([
    page.locator("[data-revise]").waitFor({ state: "detached", timeout: 20000 }),
    page.locator("[data-revise-error]").waitFor({ timeout: 20000 }),
  ]).catch(() => {});
}
/** A piece showing these words as saved text — not inside an open editor. */
const savedPiece = (page, words) => page.locator("[data-piece]:not(:has([data-revise]))", { hasText: words });

const fits = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

export async function act({ browser, base, evidence }) {
  const owner = await persona(browser, base, "parent", VIEWPORTS.phone390, evidence, S);
  const family = await persona(browser, base, "sibling", VIEWPORTS.phone320, evidence, S);
  const outsider = await persona(browser, base, "outsider", VIEWPORTS.phone390, evidence, S);
  const creator = await persona(browser, base, "creator", VIEWPORTS.desktop, evidence, S);
  const friend = await persona(browser, base, "friend", VIEWPORTS.phone390, evidence, S);
  const stranger = { context: await browser.newContext({ viewport: VIEWPORTS.phone390 }) };
  stranger.page = await stranger.context.newPage();
  try {
    if (!owner.kernel || !family.kernel || !outsider.kernel || !creator.kernel || !friend.kernel) return;

    // ================= A family trip =================
    const trip = await beginThing(owner.page, base, "Lisbon in June");
    evidence.record(S, owner.role, "starts a Space for the trip", Boolean(trip));
    const plan = "Flights on the 3rd, back on the 10th";
    evidence.record(S, owner.role, "adds the plan", await addText(owner, plan));
    const original = await pieceIn(owner.kernel, trip, plan);
    evidence.record(S, owner.role, "the kernel holds it as version 1", original?.version === 1, JSON.stringify(original?.version));

    // --- The dates change. The owner edits the plan in place.
    const moved = "Flights on the 4th, back on the 11th";
    await edit(owner, plan, moved);
    const shown = await savedPiece(owner.page, moved).waitFor({ timeout: 15000 }).then(() => true, () => false);
    evidence.record(S, owner.role, "edits the plan in place and sees the change", shown);
    const skipShown = await owner.page.locator('a[href="#main"]').evaluate(el => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }).catch(() => false);
    evidence.record(S, owner.role, "nothing pops over the page after saving", !skipShown, "the skip link appeared on screen");
    const v2 = await pieceIn(owner.kernel, trip, moved);
    evidence.record(S, owner.role, "the kernel holds the same piece at version 2, not a copy",
      v2?.entity_id === original?.entity_id && v2?.version === 2, `${v2?.entity_id === original?.entity_id ? "same piece" : "different piece"} v${v2?.version}`);
    await owner.page.reload();
    evidence.record(S, owner.role, "after a reload it is still the new plan, and the old text is gone from the Space",
      await savedPiece(owner.page, moved).isVisible() && !(await owner.page.locator("main").innerText()).includes(plan));
    const history = await owner.kernel.rpc("read_events", { p_scope: `world:${trip}`, p_after_seq: 0, p_limit: 200, p_newest_first: false }).catch(() => []);
    evidence.record(S, owner.role, "the change is an act in the Space's history, by them",
      Array.isArray(history) && history.some(e => e.type === "kernel.entity.updated" && e.payload?.entity_id === original?.entity_id && e.actor_id === owner.actorId));
    await evidence.shot(owner.page, "act-01-edited-390");

    // --- The connection drops mid-save: they're told, the words stay, and a retry makes one change.
    const third = "Flights on the 4th, back on the 12th";
    const piece = owner.page.locator("[data-piece]", { hasText: moved });
    await piece.locator("[data-revise-open]").click();
    await piece.locator("[data-revise-text]").fill(third);
    await owner.context.setOffline(true);
    await piece.locator("[data-revise-save]").click();
    await settled(owner.page);
    const dropped = await piece.locator("[data-revise-error]").textContent({ timeout: 15000 }).catch(() => "");
    evidence.record(S, owner.role, "a dropped connection is reported, and the words stay", /wasn't saved/i.test(dropped ?? "") && (await piece.locator("[data-revise-text]").inputValue()) === third, dropped ?? "");
    await owner.context.setOffline(false);
    await piece.locator("[data-revise-save]").click();
    // The earlier error is still on screen, so wait for the save itself: the editor closes.
    await owner.page.locator("[data-revise]").waitFor({ state: "detached", timeout: 20000 }).catch(() => {});
    const v3 = await pieceIn(owner.kernel, trip, third);
    evidence.record(S, owner.role, "saving again once connected makes exactly one new version", v3?.version === 3, `v${v3?.version}`);

    // --- The kernel's retry guarantee the screen relies on: the same request twice is one change.
    const key = `${MARK}-retry-${Date.now()}`;
    const args = { p_entity_id: original.entity_id, p_scope: `world:${trip}`, p_expected_version: 3, p_title: "Flights", p_summary: "",
      p_attributes: { documentType: "text", worldId: trip, content: "Flights on the 5th", canvas: { x: 0, y: 0 } }, p_idempotency_key: key };
    const once = await owner.kernel.rpc("update_document_version", args).then(() => "ok", e => e.message);
    const twice = await owner.kernel.rpc("update_document_version", args).then(() => "ok", e => e.message);
    const after = await pieceIn(owner.kernel, trip, "Flights on the 5th");
    evidence.record(S, owner.role, "a request sent twice is one change, not two", once === "ok" && twice === "ok" && after?.version === 4, `${once} / ${twice} → v${after?.version}`);

    // --- A family member joins and edits too; the Space says who changed it.
    await owner.page.goto(`${base}/world/${trip}`);
    evidence.record(S, family.role, "joins the trip from an invitation", await invite(owner, family, base));
    await family.page.goto(`${base}/world/${trip}`);
    const theirs = "Flights on the 5th — I'll book the hotel";
    await edit(family, "Flights on the 5th", theirs);
    evidence.record(S, family.role, "can edit the plan on a 320px phone",
      await savedPiece(family.page, theirs).waitFor({ timeout: 15000 }).then(() => true, () => false) && await fits(family.page));
    await owner.page.reload();
    const credit = await owner.page.locator("[data-piece]", { hasText: theirs }).locator("[data-editor]").textContent().catch(() => "");
    evidence.record(S, owner.role, "sees the change, credited to the person who made it", (credit ?? "").includes("sibling"), credit ?? "");

    // --- Two people save at once: nobody's words are lost silently.
    const ownerPiece = owner.page.locator("[data-piece]", { hasText: theirs });
    await ownerPiece.locator("[data-revise-open]").click();
    await edit(family, theirs, "Hotel booked: Alfama, 4 nights");
    await ownerPiece.locator("[data-revise-text]").fill("Flights on the 5th, hotel still to find");
    await ownerPiece.locator("[data-revise-save]").click();
    await settled(owner.page);
    const clash = await owner.page.locator("[data-revise-error]").textContent({ timeout: 15000 }).catch(() => "");
    evidence.record(S, owner.role, "saving over someone's newer change is refused and explained, not overwritten",
      /changed this while you were editing/i.test(clash ?? "") && (await owner.page.locator("[data-revise-latest]").innerText().catch(() => "")).includes("Hotel booked"), clash ?? "");
    const kept = await pieceIn(owner.kernel, trip, "Hotel booked: Alfama, 4 nights");
    evidence.record(S, owner.role, "the kernel still holds the family member's version", Boolean(kept), `v${kept?.version}`);
    await owner.page.locator("[data-revise-save]").click();
    // The conflict message is still showing, so wait for the save itself: the editor closes.
    await owner.page.locator("[data-revise]").waitFor({ state: "detached", timeout: 20000 }).catch(() => {});
    const resolved = await pieceIn(owner.kernel, trip, "Flights on the 5th, hotel still to find");
    evidence.record(S, owner.role, "saving again, knowingly, replaces it as a new version", resolved?.version === (kept?.version ?? 0) + 1, `v${resolved?.version}`);
    await evidence.shot(owner.page, "act-02-conflict-390");

    // --- Outsiders: no controls, and the kernel refuses a forged revision.
    const peek = await outsider.page.goto(`${base}/world/${trip}`);
    evidence.record(S, outsider.role, "can't open the Space", peek?.status() === 404, `status ${peek?.status()}`);
    const forged = await outsider.kernel.rpc("update_document_version", { ...args, p_expected_version: resolved?.version ?? 6, p_idempotency_key: `${MARK}-forge`,
      p_attributes: { ...args.p_attributes, content: "Trip cancelled" } }).then(() => "written", e => e.message);
    evidence.record(S, outsider.role, "a forged revision is refused by the kernel", forged !== "written", forged);
    evidence.record(S, owner.role, "and the plan is unchanged", Boolean(await pieceIn(owner.kernel, trip, "Flights on the 5th, hotel still to find")));

    // ================= A creator's portfolio =================
    const folio = await beginThing(creator.page, base, "Street photography");
    evidence.record(S, creator.role, "starts a portfolio Space", Boolean(folio));
    const caption = "Shot on a rainy Tuesday in Porto";
    await addText(creator, caption);
    await openShare(creator.page);
    const share = creator.page.locator("[data-share]");
    await share.locator("[data-choice]", { hasText: caption }).locator("input").check();
    await creator.page.locator("[data-publish]").click();
    await creator.page.locator("[data-page-link]").waitFor({ timeout: 15000 }).catch(() => {});
    await stranger.page.goto(`${base}/p/${folio}`);
    evidence.record(S, "stranger", "sees the published text", (await stranger.page.locator("body").innerText()).includes(caption));

    const better = "Shot on a rainy Tuesday in Porto, 35mm";
    await edit(creator, caption, better);
    await stranger.page.goto(`${base}/p/${folio}`);
    const publicView = await stranger.page.locator("body").innerText();
    evidence.record(S, "stranger", "after the creator edits it, the public page shows the new text — one record, two presentations",
      publicView.includes(better) && !publicView.includes(`${caption}\n`), publicView.slice(0, 200));

    await creator.page.goto(`${base}/world/${folio}`);
    evidence.record(S, friend.role, "joins the portfolio as a collaborator", await invite(creator, friend, base));
    await friend.page.goto(`${base}/world/${folio}`);
    await edit(friend, better, "Shot in Porto (friend's edit)");
    await stranger.page.goto(`${base}/p/${folio}`);
    const afterFriend = await stranger.page.locator("body").innerText();
    evidence.record(S, "stranger", "a friend's change to the creator's piece takes it off the public page instead of publishing it",
      !afterFriend.includes("friend's edit") && !afterFriend.includes(better), afterFriend.slice(0, 200));
    await creator.page.goto(`${base}/world/${folio}`);
    await edit(creator, "Shot in Porto (friend's edit)", better);
    await stranger.page.goto(`${base}/p/${folio}`);
    evidence.record(S, "stranger", "once the creator makes it theirs again, it is public again",
      (await stranger.page.locator("body").innerText()).includes(better));
    await evidence.shot(creator.page, "act-03-portfolio-1440");

    for (const p of [owner, family, outsider, creator, friend]) {
      evidence.record(S, p.role, "no uncaught errors in the page", p.errors.length === 0, p.errors.join(" | "));
    }
  } finally {
    await close(owner, family, outsider, creator, friend, stranger);
  }
}
