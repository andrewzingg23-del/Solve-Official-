// Home: a person can create, save, reopen and find something real — and nobody else can.
//
// Perspectives: a new person who has never used SOLVE; the same person returning; a second
// device belonging to nobody; and another person deliberately trying to reach the first person's
// thing. Every UI result is read back through the kernel as that person.
import { INTERNAL_IDS, MARK, OUR_WORDS, VIEWPORTS, close, persona } from "../lib.mjs";

const S = "home";

export async function home({ browser, base, evidence }) {
  const ana = await persona(browser, base, "new-person", VIEWPORTS.phone390, evidence, S);
  const other = await persona(browser, base, "another-person", VIEWPORTS.desktop, evidence, S);
  const stranger = await persona(browser, base, "second-device", VIEWPORTS.phone320, evidence, S);
  try {
    if (!ana.kernel || !other.kernel) return;
    const { page } = ana;
    const words = `${MARK} Replace the gate latch at the back fence`;
    const title = words; // one sentence, under 100 characters: the title is the whole line
    const field = page.getByRole("textbox", { name: "What do you want to do?" });

    // --- A new person types one line, and it survives a refresh before they press anything.
    await field.fill(words);
    await page.reload();
    evidence.record(S, ana.role, "an unsent line survives a refresh", (await field.inputValue()) === words,
      `field held "${await field.inputValue()}"`);

    // --- They press Begin. A guest stays on Home and the thing is listed as theirs.
    await page.getByRole("button", { name: "Begin", exact: true }).click();
    const card = page.locator("a[data-thing]", { hasText: title });
    const listed = await card.waitFor({ timeout: 20000 }).then(() => true, () => false);
    evidence.record(S, ana.role, "pressing Begin records the thing and lists it on Home", listed,
      (await page.getByRole("alert").textContent().catch(() => "")) || "card never appeared");
    await evidence.shot(page, "home-01-created-390");
    if (!listed) return;
    const href = await card.getAttribute("href");
    const worldId = decodeURIComponent(href?.match(/^\/world\/([^/]+)\/record$/)?.[1] ?? "");
    evidence.record(S, ana.role, "a guest's thing opens its record, not a sign-in wall", Boolean(worldId), `href was ${href}`);
    if (!worldId) return;
    const scope = `world:${worldId}`;

    // --- Independent read-back: the kernel, asked as Ana, holds exactly what she typed.
    const mine = await ana.kernel.rpc("read_world", { p_scope: scope }).catch(e => e);
    const entity = Array.isArray(mine) ? mine.find(e => e.kind === "world") : null;
    evidence.record(S, ana.role, "the kernel holds the thing under her scope, with her words", entity?.title === title,
      mine instanceof Error ? mine.message : `kernel title was "${entity?.title}"`);
    const events = await ana.kernel.rpc("read_events", { p_scope: scope, p_after_seq: 0, p_limit: 50, p_newest_first: false }).catch(e => e);
    // Precisely what is true: every act on her thing is hers, except the system issuing her own
    // authority over it when she claimed it. Anything else in her history would be a leak.
    const others = Array.isArray(events) ? events.filter(e => e.actor_id !== ana.actorId) : [];
    const otherActors = others.length
      ? await ana.kernel.rpc("read_actors", { p_actor_ids: [...new Set(others.map(e => e.actor_id))] }).catch(() => [])
      : [];
    const systemOnly = others.every(e => e.type === "kernel.grant.issued"
      && otherActors.find(a => a.actor_id === e.actor_id)?.kind === "service");
    evidence.record(S, ana.role, "its history is hers, plus only the system granting her own authority",
      Array.isArray(events) && events.some(e => e.actor_id === ana.actorId) && systemOnly,
      events instanceof Error ? events.message : `others: ${others.map(e => e.type).join(",")}`);

    // --- Find: the same thing is in Space, which is where things live, not only on Home.
    await page.goto(base + "/space");
    const inSpace = page.locator("main a[data-thing]", { hasText: title });
    evidence.record(S, ana.role, "it is also found in Space, where her things live",
      await inSpace.waitFor({ timeout: 15000 }).then(() => true, () => false));
    evidence.record(S, ana.role, "and opening it from Space goes to its record",
      (await inSpace.getAttribute("href").catch(() => "")) === href, `href ${await inSpace.getAttribute("href").catch(() => "")}`);
    const spaceText = await page.locator("main").first().innerText().catch(() => "");
    evidence.record(S, ana.role, "Space shows her no word or id of ours", !OUR_WORDS.test(spaceText) && !INTERNAL_IDS.test(spaceText),
      spaceText.match(OUR_WORDS)?.[0] ?? spaceText.match(INTERNAL_IDS)?.[0] ?? "");
    await evidence.shot(page, "home-02a-space-390");

    // --- Returning: a fresh load still lists it, and the record shows all six parts in order.
    await page.goto(base + "/");
    evidence.record(S, ana.role, "returning later, it is still there",
      await page.locator("a[data-thing]", { hasText: title }).waitFor({ timeout: 15000 }).then(() => true, () => false));
    await page.goto(base + href);
    const heading = await page.getByRole("heading", { level: 1 }).textContent().catch(() => "");
    evidence.record(S, ana.role, "reopening it shows the thing she made", heading?.trim() === title, `heading was "${heading}"`);
    const main = (await page.locator("main").first().textContent()) ?? "";
    const parts = ["what it is", "whose it is", "what happened", "what's proven", "what's next", "who can reach it"];
    const positions = parts.map(p => main.indexOf(p));
    evidence.record(S, ana.role, "its record shows all six parts, in order",
      positions.every(i => i >= 0) && positions.every((v, i) => i === 0 || v > positions[i - 1]), `positions ${positions.join(",")}`);
    // Read the parts from the DOM, not from concatenated text, so whitespace cannot fool a check.
    const part = name => page.locator(`section[data-part="${name}"]`);
    const holder = (await part("whose it is").locator("p").first().textContent())?.trim() ?? "";
    evidence.record(S, ana.role, "the record names her as the holder, as You", holder === "You", `holder shown as "${holder}"`);
    const lines = await part("what happened").locator("li span.s-muted").allTextContents();
    evidence.record(S, ana.role, "every act in her history has a real name, never a blank",
      lines.length > 0 && lines.every(l => /^\s*—\s*\S/.test(l)), lines.join(" | "));
    const visible = await page.locator("main").first().innerText();
    evidence.record(S, ana.role, "no internal id is shown to her anywhere on the record", !INTERNAL_IDS.test(visible),
      visible.match(INTERNAL_IDS)?.[0] ?? "");
    evidence.record(S, ana.role, "it says plainly that nothing proves it yet", main.includes("Nothing proves this yet"));
    evidence.record(S, ana.role, "none of our words are stamped on her thing", !OUR_WORDS.test(main), main.match(OUR_WORDS)?.[0] ?? "");
    await evidence.shot(page, "home-02-record-390");

    // --- Another person, holding the exact address, sees nothing — in the app and in the kernel.
    const theirs = await other.page.goto(base + href);
    const leaked = ((await other.page.content()) ?? "").includes(words);
    evidence.record(S, other.role, "cannot open someone else's thing by its address", theirs?.status() === 404 && !leaked,
      `status ${theirs?.status()}, leaked=${leaked}`);
    await evidence.shot(other.page, "home-03-other-person-1440");
    const peek = await other.kernel.rpc("read_world", { p_scope: scope }).then(r => r, e => e);
    evidence.record(S, other.role, "the kernel refuses them the thing directly, too",
      peek instanceof Error || (Array.isArray(peek) && !JSON.stringify(peek).includes(words)),
      Array.isArray(peek) ? `returned ${peek.length} rows` : "");
    const intrude = await other.kernel.rpc("record_event", { p_type: "acceptance.intrusion", p_scope: scope, p_payload: { by: MARK } })
      .then(() => "written", e => e.message);
    evidence.record(S, other.role, "cannot write into someone else's thing", intrude !== "written", "the kernel accepted the write");

    // --- A second device with no shared identity does not see it. Guest custody is this browser.
    await stranger.page.goto(base + "/");
    const seen = await stranger.page.locator("a[data-thing]", { hasText: title }).count();
    evidence.record(S, stranger.role, "a different browser does not see a guest's things", seen === 0, `${seen} matching cards`);
    const notice = await stranger.page.locator("[data-custody]").textContent().catch(() => "");
    evidence.record(S, stranger.role, "and is told truthfully where their own work lives", /another browser/.test(notice ?? ""), notice ?? "");
    await evidence.shot(stranger.page, "home-04-second-device-320");

    // --- The network drops mid-action: the person is told, and keeps their words.
    const second = `${MARK} Order more two-stroke oil`;
    await page.goto(base + "/");
    await field.fill(second);
    await ana.context.setOffline(true);
    await page.getByRole("button", { name: "Begin", exact: true }).click();
    // The product's own error element. getByRole("alert") is ambiguous: Next.js renders an
    // invisible route announcer with the same role (found on the first run, 2026-11-09).
    const alert = await page.locator("main [role=alert]").textContent({ timeout: 15000 }).catch(() => "");
    evidence.record(S, ana.role, "losing the network is reported, not hidden", /wasn't recorded|retry/i.test(alert ?? ""), alert || "no alert");
    evidence.record(S, ana.role, "and her words are still on screen", (await field.inputValue()) === second, await field.inputValue());
    await evidence.shot(page, "home-05-offline-390");
    await ana.context.setOffline(false);
    await page.getByRole("button", { name: "Begin", exact: true }).click();
    evidence.record(S, ana.role, "retrying once the network returns records it",
      await page.locator("a[data-thing]", { hasText: second }).waitFor({ timeout: 20000 }).then(() => true, () => false));

    // --- Nothing was thrown in the browser along the way.
    for (const p of [ana, other, stranger]) {
      evidence.record(S, p.role, "no uncaught errors in the page", p.errors.length === 0, p.errors.join(" | "));
    }
  } finally {
    await close(ana, other, stranger);
  }
}
