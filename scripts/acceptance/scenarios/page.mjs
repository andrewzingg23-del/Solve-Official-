// An intention, the ways to make it, and a public page — MySpace grown up. Three parties: the owner,
// a friend who builds with them, and a stranger with no account and no cookies who opens the public
// link. Proves the page shows only what the owner made, never creates an identity for the person
// looking, goes dark the moment the owner stops sharing, and that a handoff to another tool carries
// exactly the brief the owner reviewed.
import { createClient } from "@supabase/supabase-js";
import LZString from "lz-string";
import { INTERNAL_IDS, MARK, OUR_WORDS, STAGING, VIEWPORTS, close, persona } from "../lib.mjs";
import { loaded, phonePhoto, whyNot } from "./photos.mjs";

const S = "page";

async function addPhoto(who, caption) {
  await who.page.locator("#photo-file").setInputFiles({ name: "IMG.jpg", mimeType: "image/jpeg", buffer: await phonePhoto(who.page) });
  await who.page.getByRole("textbox", { name: "Caption" }).fill(caption);
  await who.page.locator("[data-add-photo]").click();
  return who.page.locator("[data-photo]", { hasText: caption }).waitFor({ timeout: 20000 }).then(() => true, () => false);
}
async function addText(who, words) {
  await who.page.getByRole("textbox", { name: "Add something" }).fill(words);
  await who.page.getByRole("button", { name: "Add", exact: true }).click();
  return who.page.locator("[data-piece]", { hasText: words }).waitFor({ timeout: 15000 }).then(() => true, () => false);
}

export async function page({ browser, base, evidence }) {
  const owner = await persona(browser, base, "owner", VIEWPORTS.phone390, evidence, S);
  const friend = await persona(browser, base, "friend", VIEWPORTS.phone390, evidence, S);
  // The stranger: a bare browser, never sent to Home, so nothing gives it an identity first.
  const strangerContext = await browser.newContext({ viewport: VIEWPORTS.phone390, reducedMotion: "reduce" });
  const stranger = { role: "stranger", context: strangerContext, page: await strangerContext.newPage(), errors: [] };
  stranger.page.on("pageerror", e => stranger.errors.push(e.message));
  try {
    if (!owner.kernel || !friend.kernel) return;
    const title = `${MARK} Photography portfolio website`;

    // --- The owner states an intention. It lives here, with its people, whatever tool makes it.
    await owner.page.goto(base + "/");
    await owner.page.getByRole("textbox", { name: "What do you want to do?" }).fill(title);
    await owner.page.getByRole("button", { name: "Begin", exact: true }).click();
    const card = owner.page.locator("a[data-thing]", { hasText: title });
    if (!evidence.record(S, owner.role, "states an intention", await card.waitFor({ timeout: 20000 }).then(() => true, () => false))) return;
    const worldId = decodeURIComponent((await card.getAttribute("href")).match(/^\/world\/([^/]+)$/)?.[1] ?? "");
    await card.click();
    await owner.page.locator("[data-ways]").waitFor({ timeout: 15000 }).catch(() => {});

    // --- The ways to make it: here first for a portfolio, a specialist offered and labelled honestly.
    const ways = await owner.page.locator("[data-way]").evaluateAll(els => els.map(e => e.getAttribute("data-way")));
    evidence.record(S, owner.role, "is shown ways to make it, here first for a portfolio", ways[0] === "solve-page" && ways.includes("replit"), ways.join(","));
    evidence.record(S, owner.role, "the fitting path is marked, and the specialist is labelled as opening another app",
      await owner.page.locator('[data-way="solve-page"] [data-recommended]').count() === 1
      && /opens in another app/i.test(await owner.page.locator('[data-way="replit"]').innerText()));

    // --- The handoff: the owner edits the brief; the link carries exactly that and nothing else.
    await owner.page.locator('[data-prepare="replit"]').click();
    const brief = owner.page.locator("[data-brief]");
    const first = await brief.inputValue();
    evidence.record(S, owner.role, "the brief starts from the intention's own words only", first.startsWith(title), first.slice(0, 120));
    const edited = `${first}\nUse a dark theme with large photos.`;
    await brief.fill(edited);
    const href = await owner.page.locator("[data-open-tool]").getAttribute("href");
    const url = href ? new URL(href) : null;
    evidence.record(S, owner.role, "opening Replit carries exactly the brief they reviewed, in Replit's documented format",
      url?.origin === "https://replit.com" && url.searchParams.get("stack") === "Design"
      && LZString.decompressFromEncodedURIComponent(url.searchParams.get("prompt") ?? "") === edited, href?.slice(0, 120) ?? "no link");
    evidence.record(S, owner.role, "the handoff opens in a new tab, without sending SOLVE's address along",
      (await owner.page.locator("[data-open-tool]").getAttribute("rel"))?.includes("noreferrer"));
    await evidence.shot(owner.page, "page-01-ways-390");

    // --- They bring back what was made; it's shown as their word, not something SOLVE checked.
    await owner.page.locator("[data-made-link]").fill("javascript:alert(1)");
    await owner.page.getByRole("button", { name: "Add link" }).click();
    evidence.record(S, owner.role, "a link that isn't a plain https address is refused",
      await owner.page.locator("[data-ways] [role=alert]").filter({ hasText: "https://" }).waitFor({ timeout: 10000 }).then(() => true, () => false));
    await owner.page.locator("[data-made-link]").fill("https://example.com/portfolio");
    await owner.page.getByRole("button", { name: "Add link" }).click();
    const made = owner.page.locator("[data-piece]", { has: owner.page.locator("[data-made]") });
    evidence.record(S, owner.role, "what they made elsewhere is linked back, labelled as their word and not checked",
      await made.waitFor({ timeout: 15000 }).then(() => true, () => false) && /made with replit/i.test(await made.innerText()) && /not checked/i.test(await made.innerText()));

    // --- The owner adds their own work; a friend joins and adds theirs.
    const ownText = "Golden hour at the lake";
    evidence.record(S, owner.role, "adds their own words and photo", await addText(owner, ownText) && await addPhoto(owner, "Lake at dusk"));
    await owner.page.getByRole("button", { name: "Invite a friend" }).click();
    const invite = await owner.page.getByRole("textbox", { name: "Invite link" }).inputValue().catch(() => "");
    await friend.page.goto(base + new URL(invite).pathname);
    await friend.page.locator("[data-join]").click();
    await friend.page.waitForURL(new RegExp(`/world/${worldId}$`), { timeout: 20000 }).catch(() => {});
    const friendText = "Dana's note: my own vacation pics";
    evidence.record(S, friend.role, "joins and adds their own words and photo", await addText(friend, friendText) && await addPhoto(friend, "Dana at the beach"));
    evidence.record(S, friend.role, "isn't offered the owner's public page controls", (await friend.page.locator("[data-share]").count()) === 0);

    // --- Before sharing, the page doesn't exist for anyone.
    const before = await stranger.page.goto(base + `/p/${worldId}`);
    evidence.record(S, stranger.role, "before it's shared, the page doesn't exist", before?.status() === 404, `status ${before?.status()}`);

    // --- The owner shares it as a page.
    await owner.page.goto(base + `/world/${worldId}`);
    await owner.page.locator("[data-publish]").click();
    evidence.record(S, owner.role, "shares it as a page with one press",
      await owner.page.locator("[data-page-link]").waitFor({ timeout: 15000 }).then(() => true, () => false));

    // --- A stranger with no account opens it.
    const opened = await stranger.page.goto(base + `/p/${worldId}`);
    const view = await stranger.page.locator("body").innerText();
    evidence.record(S, stranger.role, "opens the page with no account", opened?.status() === 200, `status ${opened?.status()}`);
    evidence.record(S, stranger.role, "sees whose it is and what it is", view.includes(`${MARK} owner`) && view.includes(title));
    evidence.record(S, stranger.role, "sees the owner's own words and photo",
      view.includes(ownText) && await loaded(stranger.page.locator('[data-public-piece="photo"]', { hasText: "Lake at dusk" }).locator("img")),
      await whyNot(stranger.page.locator('[data-public-piece="photo"] img').first()));
    evidence.record(S, stranger.role, "never sees what the friend added — publishing someone's page doesn't publish their friends",
      !view.includes(friendText) && !view.includes("Dana at the beach"), view.slice(0, 300));
    evidence.record(S, stranger.role, "sees no word or identifier of ours", !OUR_WORDS.test(view) && !INTERNAL_IDS.test(view), view.slice(0, 300));
    evidence.record(S, stranger.role, "is invited to make their own", await stranger.page.getByRole("link", { name: "Make your own" }).isVisible());
    const cookies = (await strangerContext.cookies()).filter(c => c.name.startsWith(`sb-${STAGING.ref}`));
    evidence.record(S, stranger.role, "looking never created an identity for them", cookies.length === 0, cookies.map(c => c.name).join(","));
    await evidence.shot(stranger.page, "page-02-public-390");

    // --- Storage, with no identity at all: the owner's published photo yes, the friend's never.
    const anon = createClient(STAGING.url, STAGING.publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const pieces = await owner.kernel.rpc("read_world", { p_scope: `world:${worldId}` }).catch(() => []);
    const fileOf = caption => pieces.find(e => e.attributes?.documentType === "photo" && e.attributes?.caption === caption)?.attributes?.file?.name;
    const ownersFile = fileOf("Lake at dusk"), friendsFile = fileOf("Dana at the beach");
    const ownersRead = ownersFile ? await anon.storage.from("things").download(ownersFile) : { error: { message: "no file" } };
    evidence.record(S, stranger.role, "storage gives anyone the owner's published photo", !ownersRead.error, ownersRead.error?.message ?? "");
    const friendsRead = friendsFile ? await anon.storage.from("things").download(friendsFile) : { error: { message: "no file" } };
    evidence.record(S, stranger.role, "storage refuses the friend's photo to anyone outside", Boolean(friendsRead.error) && Boolean(friendsFile), friendsRead.error?.message ?? "downloaded it");
    const kernelPeek = await anon.schema("kernel_api").rpc("read_world", { p_scope: `world:${worldId}` });
    evidence.record(S, stranger.role, "and no other kernel function answers them", Boolean(kernelPeek.error), kernelPeek.error?.message ?? "read the thing");
    const forged = await friend.kernel.rpc("upsert_entity", {
      p_kind: "resource", p_scope: `actor:${owner.actorId}`, p_title: "Public page", p_summary: "",
      p_attributes: { sov: "solve.page", worldId, published: false }, p_latitude: null, p_longitude: null, p_altitude_m: null,
      p_location_truth: null, p_visibility: "private", p_importance: 50, p_entity_id: null, p_idempotency_key: `${MARK}-forge`,
    }).then(() => ({ code: "wrote", message: "wrote the owner's record" }), e => ({ code: e.code, message: e.message }));
    // Refused by the kernel's authority check itself (KA002), not by a malformed call.
    evidence.record(S, friend.role, "cannot take the owner's page down (or up) for them", forged.code === "KA002", `${forged.code}: ${forged.message}`);

    // --- The owner stops sharing: the page and its photos go dark at once.
    await owner.page.locator("[data-unpublish]").click();
    await owner.page.locator("[data-publish]").waitFor({ timeout: 15000 }).catch(() => {});
    const after = await stranger.page.goto(base + `/p/${worldId}`);
    evidence.record(S, stranger.role, "after the owner stops sharing, the page is gone", after?.status() === 404, `status ${after?.status()}`);
    const gone = ownersFile ? await anon.storage.from("things").download(ownersFile) : { error: { message: "no file" } };
    evidence.record(S, stranger.role, "and so is the photo", Boolean(gone.error), gone.error?.message ?? "still downloadable");

    for (const p of [owner, friend, stranger]) evidence.record(S, p.role, "no uncaught errors in the page", p.errors.length === 0, p.errors.join(" | "));
  } finally {
    await close(owner, friend, stranger);
  }
}
