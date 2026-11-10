// Build something and invite your friends — the founder's answer to "what's the first thing someone
// does in SOLVE just because it's fun". Three independent people: the one who starts it, a friend
// with no account who joins from a link, and a third person who tries to reuse the friend's link.
import { createHash, randomUUID } from "node:crypto";
import { INTERNAL_IDS, MARK, OUR_WORDS, VIEWPORTS, close, persona } from "../lib.mjs";
import { GPS, loaded, phonePhoto, whyNot } from "./photos.mjs";

const S = "together";

export async function together({ browser, base, evidence }) {
  const host = await persona(browser, base, "starter", VIEWPORTS.phone390, evidence, S);
  const friend = await persona(browser, base, "friend", VIEWPORTS.phone390, evidence, S);
  const third = await persona(browser, base, "third-person", VIEWPORTS.phone320, evidence, S);
  try {
    if (!host.kernel || !friend.kernel || !third.kernel) return;
    const title = `${MARK} Summer road trip`;

    // --- The starter makes something and opens it.
    await host.page.goto(base + "/");
    await host.page.getByRole("textbox", { name: "What do you want to do?" }).fill(title);
    await host.page.getByRole("button", { name: "Begin", exact: true }).click();
    const card = host.page.locator("a[data-thing]", { hasText: title });
    if (!evidence.record(S, host.role, "starts something", await card.waitFor({ timeout: 20000 }).then(() => true, () => false))) return;
    const href = await card.getAttribute("href");
    const worldId = decodeURIComponent(href.match(/^\/world\/([^/]+)$/)?.[1] ?? "");
    await card.click();
    await host.page.getByRole("heading", { level: 1, name: title }).waitFor({ timeout: 15000 });
    evidence.record(S, host.role, "opening it shows the thing, ready to build",
      await host.page.getByRole("heading", { name: "Nothing added yet" }).waitFor({ timeout: 15000 }).then(() => true, () => false));

    // --- They add the first piece.
    await host.page.getByRole("textbox", { name: "Add something" }).fill("Rent a van for four");
    await host.page.getByRole("button", { name: "Add", exact: true }).click();
    const first = host.page.locator("[data-piece]", { hasText: "Rent a van for four" });
    evidence.record(S, host.role, "adds the first piece, credited to them",
      await first.waitFor({ timeout: 15000 }).then(() => true, () => false) && (await first.locator("[data-author]").textContent()) === "You");

    // --- They invite a friend. Where the browser has no share sheet, the link is shown to copy.
    await host.page.getByRole("button", { name: "Invite a friend" }).click();
    const field = host.page.getByRole("textbox", { name: "Invite link" });
    const shown = await field.waitFor({ timeout: 15000 }).then(() => true, () => false);
    const link = shown ? await field.inputValue() : "";
    evidence.record(S, host.role, "gets a link to send a friend", /\/world-invite\/[0-9a-f]{64}$/.test(link), link || "no link");
    await evidence.shot(host.page, "together-01-started-390");
    if (!link) return;
    const path = new URL(link).pathname;

    // --- A messaging app's link preview fetches the page first. That must not use up the invite.
    const previewFetch = await fetch(base + path).then(r => r.status).catch(() => 0);
    evidence.record(S, "link-preview", "fetching the invite to build a preview doesn't use it up", previewFetch === 200, `status ${previewFetch}`);

    // --- The friend opens it: no account, and they see who invited them and to what.
    await friend.page.goto(base + path);
    const invite = await friend.page.locator("main").first().innerText();
    evidence.record(S, friend.role, "sees who invited them, by name", invite.includes(`${MARK} starter invited you to build`), invite.slice(0, 160));
    evidence.record(S, friend.role, "and to what", invite.includes(title));
    evidence.record(S, friend.role, "and nothing else of the starter's, and no word or id of ours",
      !invite.includes("Rent a van") && !OUR_WORDS.test(invite) && !INTERNAL_IDS.test(invite), invite.slice(0, 200));
    evidence.record(S, friend.role, "is told plainly there's no sign-up", /No sign-up/.test(invite));
    await evidence.shot(friend.page, "together-02-invited-390");

    // --- They join with one press, and land inside the thing.
    await friend.page.locator("[data-join]").click();
    const landed = await friend.page.waitForURL(new RegExp(`/world/${worldId}$`), { timeout: 20000 }).then(() => true, () => false);
    evidence.record(S, friend.role, "one press joins them and takes them inside", landed, friend.page.url());
    const inside = await friend.page.locator("main").first().innerText();
    evidence.record(S, friend.role, "sees it's being built together, and with whom", /building together/i.test(inside) && inside.includes(`${MARK} starter`), inside.slice(0, 200));
    evidence.record(S, friend.role, "sees what's already been added, and by whom",
      inside.includes("Rent a van for four") && (await friend.page.locator("[data-piece]", { hasText: "Rent a van" }).locator("[data-author]").textContent())?.includes("starter"));

    // --- The friend adds their own piece.
    await friend.page.getByRole("textbox", { name: "Add something" }).fill("I'll bring snacks and the speaker");
    await friend.page.getByRole("button", { name: "Add", exact: true }).click();
    const theirs = friend.page.locator("[data-piece]", { hasText: "bring snacks" });
    evidence.record(S, friend.role, "adds their piece, credited to them",
      await theirs.waitFor({ timeout: 15000 }).then(() => true, () => false) && (await theirs.locator("[data-author]").textContent()) === "You");
    evidence.record(S, friend.role, "isn't offered invites, which belong to the one who started it",
      (await friend.page.getByRole("button", { name: "Invite a friend" }).count()) === 0);
    await evidence.shot(friend.page, "together-03-friend-added-390");

    // --- The friend adds a photo straight from their phone — hidden location and all.
    const original = await phonePhoto(friend.page);
    await friend.page.locator("#photo-file").setInputFiles({ name: "IMG_0412.jpg", mimeType: "image/jpeg", buffer: original });
    await friend.page.getByRole("textbox", { name: "Caption" }).fill("The van!");
    await evidence.shot(friend.page, "together-03b-photo-chosen-390");
    await friend.page.locator("[data-add-photo]").click();
    const shot = friend.page.locator("[data-photo]", { hasText: "The van!" });
    const photoShown = await shot.waitFor({ timeout: 20000 }).then(() => true, () => false);
    evidence.record(S, friend.role, "adds a photo with a caption, and sees it", photoShown && await loaded(shot.locator("img")),
      photoShown ? await whyNot(shot.locator("img")) : await friend.page.locator("main [role=alert]").allTextContents().then(t => t.join(" | ")));
    evidence.record(S, friend.role, "the photo is credited to them", photoShown && (await shot.locator("[data-author]").textContent()) === "You");

    // Kernel and storage read-back: the photo the friend's piece points at is the photo stored, and it carries no location.
    const world = await friend.kernel.rpc("read_world", { p_scope: `world:${worldId}` }).catch(() => []);
    const piece = Array.isArray(world) ? world.find(e => e.attributes?.documentType === "photo" && e.attributes?.caption === "The van!") : null;
    const file = piece?.attributes?.file;
    evidence.record(S, friend.role, "the kernel records the photo as a piece of this thing", Boolean(file?.name?.startsWith(`${worldId}/`)), JSON.stringify(file ?? null));
    const stored = file ? await friend.kernel.storage.from("things").download(file.name) : { error: "no file" };
    const bytes = stored.data ? Buffer.from(await stored.data.arrayBuffer()) : Buffer.alloc(0);
    evidence.record(S, friend.role, "what's stored is exactly what was recorded (SHA-256 matches)",
      bytes.length > 0 && createHash("sha256").update(bytes).digest("hex") === file?.sha256, stored.error?.message ?? "");
    evidence.record(S, friend.role, "the stored photo carries no hidden location — the GPS the phone wrote is gone",
      bytes.length > 0 && !bytes.includes(Buffer.from(GPS)) && !bytes.includes(Buffer.from("Exif\0\0", "binary")) && original.includes(Buffer.from(GPS)));

    // --- The starter sees the friend's piece, credited to the friend, and the friend among the people.
    await host.page.reload();
    const hostView = await host.page.locator("main").first().innerText();
    const friendPiece = host.page.locator("[data-piece]", { hasText: "bring snacks" });
    evidence.record(S, host.role, "sees what their friend added, credited to the friend",
      await friendPiece.isVisible() && (await friendPiece.locator("[data-author]").textContent())?.includes("friend"), hostView.slice(0, 240));
    const hostPhoto = host.page.locator("[data-photo]", { hasText: "The van!" });
    evidence.record(S, host.role, "sees their friend's photo, credited to the friend",
      await loaded(hostPhoto.locator("img")) && (await hostPhoto.locator("[data-author]").textContent().catch(() => ""))?.includes("friend"),
      await whyNot(hostPhoto.locator("img")));
    evidence.record(S, host.role, "sees their friend among the people building it", (await host.page.locator("[data-people]").textContent())?.includes("friend"));
    await evidence.shot(host.page, "together-04-host-sees-friend-390");

    // --- The friend finds it among their own things.
    await friend.page.goto(base + "/");
    evidence.record(S, friend.role, "finds it on their own Home",
      await friend.page.locator("a[data-thing]", { hasText: title }).waitFor({ timeout: 15000 }).then(() => true, () => false));

    // --- Kernel read-back: the friend's piece is authored by the friend, and the friend can read it.
    const events = await host.kernel.rpc("read_events", { p_scope: `world:${worldId}`, p_after_seq: 0, p_limit: 200, p_newest_first: false }).catch(() => []);
    const docs = Array.isArray(events) ? events.filter(e => e.type === "kernel.entity.created" && e.actor_id === friend.actorId) : [];
    evidence.record(S, friend.role, "the kernel records the friend's piece as theirs", docs.length >= 1, `${docs.length} created by friend`);
    const forge = await friend.kernel.rpc("create_world_invitation", {
      p_world_id: worldId, p_token_hash: "b".repeat(64), p_role: "editor", p_request_id: `${MARK}-forge`,
    }).then(() => "made", e => e.message);
    evidence.record(S, friend.role, "the kernel refuses an invite made by anyone but the starter", forge !== "made", "the friend minted an invite");

    // --- The same link is for one person. A third person who gets hold of it is turned away.
    await third.page.goto(base + path);
    const reused = await third.page.locator("main").first().innerText();
    evidence.record(S, third.role, "a used link turns away anyone else, saying why", /already been used/.test(reused) && !reused.includes("Rent a van"), reused.slice(0, 160));
    const peek = await third.page.goto(base + `/world/${worldId}`);
    evidence.record(S, third.role, "and they cannot open the thing by its address", peek?.status() === 404);
    await evidence.shot(third.page, "together-05-reused-320");

    // --- And the photo is out of their reach by every route storage offers.
    if (file?.name) {
      const read = await third.kernel.storage.from("things").download(file.name);
      evidence.record(S, third.role, "cannot download the photo with their own session", Boolean(read.error) && !read.data, read.error?.message ?? "downloaded it");
      const link = await third.kernel.storage.from("things").createSignedUrl(file.name, 60);
      evidence.record(S, third.role, "cannot get a link to it", Boolean(link.error) && !link.data?.signedUrl, link.error?.message ?? "got a link");
      const listing = await third.kernel.storage.from("things").list(worldId);
      evidence.record(S, third.role, "cannot list the thing's files", (listing.data ?? []).length === 0, `${(listing.data ?? []).length} listed`);
      const planted = await third.kernel.storage.from("things").upload(`${worldId}/${randomUUID()}.jpg`, original, { contentType: "image/jpeg" });
      evidence.record(S, third.role, "cannot put a file into the thing", Boolean(planted.error), planted.error?.message ?? "uploaded it");
      const swap = await friend.kernel.storage.from("things").upload(file.name, original, { contentType: "image/jpeg", upsert: true });
      const again = await friend.kernel.storage.from("things").download(file.name);
      const same = again.data ? createHash("sha256").update(Buffer.from(await again.data.arrayBuffer())).digest("hex") === file.sha256 : false;
      evidence.record(S, friend.role, "even someone who can add can't swap a recorded photo for another", Boolean(swap.error) && same, swap.error?.message ?? "overwrote it");
    }

    // --- Returning to the link: the friend is told they're in; the starter that it's their own.
    await friend.page.goto(base + path);
    evidence.record(S, friend.role, "returning to the link, they're told they're already in",
      /you're in/i.test(await friend.page.locator("main").first().innerText()));
    await host.page.goto(base + path);
    evidence.record(S, host.role, "opening their own link says it's theirs to send",
      /your own invite link/.test(await host.page.locator("main").first().innerText()));

    for (const p of [host, friend, third]) evidence.record(S, p.role, "no uncaught errors in the page", p.errors.length === 0, p.errors.join(" | "));
  } finally {
    await close(host, friend, third);
  }
}
