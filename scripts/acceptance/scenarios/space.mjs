// The first consumer milestone (docs/direction/2026-11-10-consolidated-direction.md): an ordinary
// person makes a beautiful SOV Card and personal Space, shares it, and another person can use the
// result at once without installing SOLVE. Two parties: the owner, and a stranger with no account
// and no cookies who opens the one link.
import { createClient } from "@supabase/supabase-js";
import { INTERNAL_IDS, MARK, OUR_WORDS, STAGING, VIEWPORTS, close, persona } from "../lib.mjs";
import { loaded, phonePhoto } from "./photos.mjs";

const S = "space";

export async function space({ browser, base, evidence }) {
  const owner = await persona(browser, base, "owner", VIEWPORTS.phone390, evidence, S);
  const ctx = await browser.newContext({ viewport: VIEWPORTS.phone390, reducedMotion: "reduce" });
  const stranger = { role: "stranger", context: ctx, page: await ctx.newPage(), errors: [] };
  stranger.page.on("pageerror", e => stranger.errors.push(e.message));
  try {
    if (!owner.kernel) return;
    const p = owner.page;

    // --- The owner makes their card their own.
    await p.goto(base + "/account");
    await p.getByRole("group", { name: "Expression" }).getByRole("button", { name: "Expressive" }).click();
    await p.getByRole("button", { name: "Colour #7a2f5c" }).click();
    await p.getByRole("button", { name: "Save look" }).click();
    await p.waitForTimeout(1500);

    // --- Before anything is shared, their Space doesn't exist for anyone.
    const shareBox = p.locator("[data-space-share]");
    evidence.record(S, owner.role, "ID offers their Space, with a preview, unshared",
      await shareBox.locator("[data-space-preview]").waitFor({ timeout: 15000 }).then(() => true, () => false)
      && (await shareBox.locator("[data-share-space]").count()) === 1);
    const spacePath = `/s/${owner.actorId}`;
    const before = await stranger.page.goto(base + spacePath);
    evidence.record(S, stranger.role, "before it's shared, the Space doesn't exist", before?.status() === 404, `status ${before?.status()}`);

    // --- They make something with a photo and share it as a page (the existing, tested flow).
    const title = `${MARK} Wedding photography`;
    await p.goto(base + "/");
    await p.getByRole("textbox", { name: "What do you want to do?" }).fill(title);
    await p.getByRole("button", { name: "Begin", exact: true }).click();
    const card = p.locator("a[data-thing]", { hasText: title });
    await card.waitFor({ timeout: 20000 });
    const worldId = decodeURIComponent((await card.getAttribute("href")).match(/^\/world\/([^/]+)$/)?.[1] ?? "");
    await card.click();
    await p.locator("#photo-file").setInputFiles({ name: "IMG.jpg", mimeType: "image/jpeg", buffer: await phonePhoto(p) });
    await p.getByRole("textbox", { name: "Caption" }).fill("First dance");
    await p.locator("[data-add-photo]").click();
    await p.locator("[data-photo]", { hasText: "First dance" }).waitFor({ timeout: 20000 });
    await p.locator("[data-share] [data-choice]", { hasText: "First dance" }).locator("input").check();
    await p.locator("[data-publish]").click();
    evidence.record(S, owner.role, "shares a thing as a page", await p.locator("[data-page-link]").waitFor({ timeout: 15000 }).then(() => true, () => false));
    // A second thing, never shared, must never appear.
    await p.goto(base + "/");
    await p.getByRole("textbox", { name: "What do you want to do?" }).fill(`${MARK} Private diary`);
    await p.getByRole("button", { name: "Begin", exact: true }).click();
    await p.locator("a[data-thing]", { hasText: "Private diary" }).waitFor({ timeout: 20000 });

    // --- Back on ID: the preview shows exactly the shared page; they share their Space.
    await p.goto(base + "/account");
    const preview = await shareBox.locator("[data-space-preview]").innerText();
    evidence.record(S, owner.role, "the preview lists the shared page and not the private one",
      preview.includes("Wedding photography") && !preview.includes("Private diary"), preview.slice(0, 200));
    await shareBox.locator("[data-share-space]").click();
    const link = shareBox.locator("[data-space-link]");
    evidence.record(S, owner.role, "shares their Space with one press and gets its link",
      await link.waitFor({ timeout: 15000 }).then(() => true, () => false) && (await link.getAttribute("href")) === spacePath);
    const focus = await p.evaluate(() => ({ pointer: document.documentElement.hasAttribute("data-pointer"), active: document.activeElement?.textContent?.slice(0, 30) ?? "", tag: document.activeElement?.tagName }));
    evidence.record(S, owner.role, "after sharing, nothing pops over the page", focus.active !== "Skip to content", JSON.stringify(focus));
    await evidence.shot(p, "space-01-id-shared-390");
    await p.screenshot({ path: `${evidence.dir}/space-01b-id-shared-viewport-390.png` }).catch(() => {});

    // --- A stranger with nothing installed opens the one link.
    const opened = await stranger.page.goto(base + spacePath);
    const view = await stranger.page.locator("body").innerText();
    evidence.record(S, stranger.role, "opens the Space with no account", opened?.status() === 200, `status ${opened?.status()}`);
    evidence.record(S, stranger.role, "it fits a phone without sideways scrolling",
      await stranger.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    evidence.record(S, stranger.role, "sees the owner's card, full size, with their name",
      (await stranger.page.locator("[data-space-card] figure[data-card]").count()) === 1 && view.includes(`${MARK} owner`));
    // SOLVE's Base accent is #f2f3f5; the owner chose an expressive colour, so the page must carry theirs.
    const accent = await stranger.page.locator("div[data-tone]").first().evaluate(el => getComputedStyle(el).getPropertyValue("--accent").trim());
    evidence.record(S, stranger.role, "the whole page wears the owner's own colours, not SOLVE's default", Boolean(accent) && accent.toLowerCase() !== "#f2f3f5", accent);
    const tile = stranger.page.locator(`[data-space-page="${worldId}"]`);
    evidence.record(S, stranger.role, "sees what the owner shared, with its photo as the cover",
      await tile.isVisible() && await loaded(tile.locator("img")));
    evidence.record(S, stranger.role, "and nothing the owner didn't share, nor any word or id of ours",
      !view.includes("Private diary") && !OUR_WORDS.test(view) && !INTERNAL_IDS.test(view), view.slice(0, 240));
    await evidence.shot(stranger.page, "space-02-stranger-390");

    // --- They use it: tap through to the shared page, and from the page back to the Space.
    await tile.click();
    await stranger.page.waitForURL(new RegExp(`/p/${worldId}$`), { timeout: 15000 }).catch(() => {});
    evidence.record(S, stranger.role, "taps through to the shared page and sees its photo",
      await loaded(stranger.page.locator('[data-public-piece="photo"] img').first()));
    await stranger.page.locator("[data-owner-space]").click();
    evidence.record(S, stranger.role, "and from the page back to the owner's Space",
      await stranger.page.waitForURL(new RegExp(`${spacePath}$`), { timeout: 15000 }).then(() => true, () => false));
    const cookies = (await ctx.cookies()).filter(c => c.name.startsWith(`sb-${STAGING.ref}`));
    evidence.record(S, stranger.role, "and none of it gave them an identity", cookies.length === 0, cookies.map(c => c.name).join(","));

    // --- Wide screen too.
    await stranger.page.setViewportSize(VIEWPORTS.desktop);
    await stranger.page.reload();
    const fits = await stranger.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
    evidence.record(S, stranger.role, "it fits a wide screen without sideways scrolling", fits);
    await evidence.shot(stranger.page, "space-03-stranger-1440");

    // --- No one else can share it for them.
    const anon = createClient(STAGING.url, STAGING.publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const peek = await anon.schema("kernel_api").rpc("read_world", { p_scope: `actor:${owner.actorId}` });
    evidence.record(S, stranger.role, "the kernel answers them nothing beyond what was shared", Boolean(peek.error), peek.error?.message ?? "read it");

    // --- The owner stops sharing; the Space goes offline, and they're told the truth about copies.
    await p.goto(base + "/account");
    await shareBox.locator("[data-stop-space]").click();
    await shareBox.locator("[data-share-space]").waitFor({ timeout: 15000 }).catch(() => {});
    const told = await shareBox.locator("[data-space-note]").innerText().catch(() => "");
    evidence.record(S, owner.role, "stopping says plainly what can't be recalled", /up to 10 minutes/.test(told) && /can't be taken back/.test(told), told);
    const after = await stranger.page.goto(base + spacePath);
    evidence.record(S, stranger.role, "after the owner stops, the Space is gone", after?.status() === 404, `status ${after?.status()}`);

    for (const who of [owner, stranger]) evidence.record(S, who.role, "no uncaught errors in the page", who.errors.length === 0, who.errors.join(" | "));
  } finally {
    await close(owner, stranger);
  }
}
