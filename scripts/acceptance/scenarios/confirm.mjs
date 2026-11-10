// Counterparty confirmation, end to end: one person asks, another person answers from a link, and
// both can see the outcome. The heartbeat — two people standing on one record.
//
// Perspectives: the holder; the person asked (a stranger to SOLVE, no account); and an outsider
// with a tampered or malformed link. Every outcome is read back through the kernel as each person.
import { INTERNAL_IDS, MARK, OUR_WORDS, VIEWPORTS, close, persona } from "../lib.mjs";

const S = "confirm";

async function createThing(who, base, words, evidence) {
  const page = who.page;
  await page.goto(base + "/");
  await page.getByRole("textbox", { name: "What do you want to do?" }).fill(words);
  await page.getByRole("button", { name: "Begin", exact: true }).click();
  const card = page.locator("a[data-thing]", { hasText: words });
  const ok = await card.waitFor({ timeout: 20000 }).then(() => true, () => false);
  evidence.record(S, who.role, `records "${words.slice(MARK.length + 1)}"`, ok);
  if (!ok) return null;
  const href = await card.getAttribute("href");
  const worldId = decodeURIComponent(href.match(/^\/world\/([^/]+)$/)?.[1] ?? "");
  return { href: `${href}/record`, worldId, scope: `world:${worldId}` };
}

async function ask(who, base, thing, askedOf, question, evidence, label) {
  const page = who.page;
  await page.goto(base + thing.href);
  await page.getByRole("textbox", { name: "Who are you asking?" }).fill(askedOf);
  await page.getByRole("textbox", { name: "What should they confirm?" }).fill(question);
  await page.getByRole("button", { name: "Ask someone to confirm this" }).click();
  const field = page.getByRole("textbox", { name: "Confirmation link" });
  const shown = await field.waitFor({ timeout: 20000 }).then(() => true, () => false);
  const link = shown ? await field.inputValue() : "";
  evidence.record(S, who.role, `${label}: asking produces a link to send`, /\/confirm\/[A-Za-z0-9_-]{43}$/.test(link),
    shown ? link : (await page.locator("main [role=alert]").textContent().catch(() => "")) || "no link shown");
  return link;
}

export async function confirm({ browser, base, evidence }) {
  const owner = await persona(browser, base, "holder", VIEWPORTS.phone390, evidence, S);
  const asked = await persona(browser, base, "person-asked", VIEWPORTS.phone390, evidence, S);
  const outsider = await persona(browser, base, "outsider", VIEWPORTS.phone320, evidence, S);
  try {
    if (!owner.kernel || !asked.kernel || !outsider.kernel) return;

    // A second, private thing of the holder's that must never appear to anyone holding a link.
    const secret = `${MARK} Private note nobody was asked about`;
    await createThing(owner, base, secret, evidence);

    const words = `${MARK} Replaced the gate latch`;
    const thing = await createThing(owner, base, words, evidence);
    if (!thing) return;
    const question = "That it was done as agreed";
    const link = await ask(owner, base, thing, "The person asked", question, evidence, "first request");
    if (!link) return;
    const path = new URL(link).pathname;

    // --- Before anyone answers: the holder sees a request waiting, not a confirmation.
    await owner.page.goto(base + thing.href);
    const waiting = await owner.page.locator('ul[aria-label="Asked to confirm"]').textContent().catch(() => "");
    evidence.record(S, owner.role, "sees the request as waiting, never as confirmed", /Waiting for an answer/.test(waiting ?? "") && !/Confirmed by/.test(waiting ?? ""), waiting ?? "");
    await evidence.shot(owner.page, "confirm-01-asked-holder-390");

    // --- The holder cannot confirm their own record, even holding the link.
    await owner.page.goto(base + path);
    await owner.page.getByRole("button", { name: "Confirm", exact: true }).click();
    const refused = await owner.page.locator("main [role=alert]").textContent({ timeout: 15000 }).catch(() => "");
    evidence.record(S, owner.role, "cannot confirm their own record", /can't confirm your own record/i.test(refused ?? ""), refused || "no refusal shown");

    // --- The person asked: a stranger to SOLVE opens the link.
    await asked.page.goto(base + path);
    const heading = await asked.page.getByRole("heading", { level: 1 }).textContent().catch(() => "");
    evidence.record(S, asked.role, "is told who asked them, by name", /asked you to confirm something/.test(heading ?? "") && (heading ?? "").includes(MARK), heading ?? "");
    const body = await asked.page.locator("main").first().innerText();
    evidence.record(S, asked.role, "sees the one thing they were asked about", body.includes(words));
    evidence.record(S, asked.role, "sees the question in the asker's words", body.includes(question));
    evidence.record(S, asked.role, "sees nothing else of the holder's", !body.includes(secret), "the private thing leaked");
    evidence.record(S, asked.role, "sees no word or id of ours", !OUR_WORDS.test(body) && !INTERNAL_IDS.test(body),
      body.match(OUR_WORDS)?.[0] ?? body.match(INTERNAL_IDS)?.[0] ?? "");
    await evidence.shot(asked.page, "confirm-02-asked-sees-390");

    await asked.page.locator("textarea[name=note]").fill("Saw it done this morning.");
    await asked.page.getByRole("button", { name: "Confirm", exact: true }).click();
    const done = await asked.page.locator("[data-answer-done]").textContent({ timeout: 15000 }).catch(() => "");
    evidence.record(S, asked.role, "their answer is recorded and they are told so", /Your answer is recorded: confirmed/.test(done ?? ""), done || "");
    await evidence.shot(asked.page, "confirm-03-answered-390");

    // --- Refresh: the answer persists, and cannot be changed.
    await asked.page.reload();
    const after = await asked.page.locator("main").first().innerText();
    evidence.record(S, asked.role, "after a refresh they are told they answered it, with no way to change it",
      /You answered: confirmed/.test(after) && (await asked.page.getByRole("button", { name: "Dispute" }).count()) === 0, after.slice(0, 200));
    const change = await asked.kernel.rpc("answer_confirmation", {
      p_token_hash: (await import("node:crypto")).createHash("sha256").update(path.split("/").pop()).digest("hex"),
      p_decision: "disputed", p_note: "", p_request_id: `${MARK}-change`,
    }).then(() => "changed", e => e.message);
    evidence.record(S, asked.role, "the kernel refuses a changed answer, too", change !== "changed", "the answer was overwritten");

    // --- Kernel read-back, as each person.
    const events = await owner.kernel.rpc("read_events", { p_scope: thing.scope, p_after_seq: 0, p_limit: 100, p_newest_first: false }).catch(e => e);
    const answered = Array.isArray(events) ? events.find(e => e.type === "kernel.confirmation.answered") : null;
    const attached = Array.isArray(events) ? events.find(e => e.type === "kernel.evidence.attached") : null;
    evidence.record(S, owner.role, "the kernel records the answer as authored by the person asked",
      answered?.actor_id === asked.actorId, events instanceof Error ? events.message : `answered by ${answered?.actor_id}`);
    evidence.record(S, owner.role, "and attaches it as evidence authored by them, not by the holder",
      attached?.actor_id === asked.actorId, `attached by ${attached?.actor_id}`);
    const peek = await asked.kernel.rpc("read_world", { p_scope: thing.scope }).then(r => r, e => e);
    evidence.record(S, asked.role, "answering gave them no access to the holder's thing",
      peek instanceof Error || (Array.isArray(peek) && peek.length === 0), Array.isArray(peek) ? `${peek.length} rows` : "");

    // --- The holder sees the outcome, with who answered.
    await owner.page.goto(base + thing.href);
    const proven = await owner.page.locator("main").first().innerText();
    evidence.record(S, owner.role, "sees it is now confirmed by someone other than its owner", /Confirmed by someone other than its owner/.test(proven), proven.slice(0, 300));
    evidence.record(S, owner.role, "sees who confirmed it", /Confirmed by \[automated/.test(proven), "");
    evidence.record(S, owner.role, "is no longer offered the ask, since it is proven",
      (await owner.page.getByRole("button", { name: "Ask someone to confirm this" }).count()) === 0);
    evidence.record(S, owner.role, "sees no word or id of ours on the outcome", !OUR_WORDS.test(proven) && !INTERNAL_IDS.test(proven),
      proven.match(OUR_WORDS)?.[0] ?? proven.match(INTERNAL_IDS)?.[0] ?? "");
    await evidence.shot(owner.page, "confirm-04-holder-sees-confirmed-390");

    // --- An outsider with a tampered link, and a malformed one, learns nothing.
    const token = path.split("/").pop();
    const tampered = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
    for (const [label, target] of [["a tampered link", `/confirm/${tampered}`], ["a malformed link", "/confirm/not-a-token"]]) {
      await outsider.page.goto(base + target);
      const text = await outsider.page.locator("main").first().innerText();
      evidence.record(S, outsider.role, `${label} reveals nothing and looks like any unavailable link`,
        /This link isn't available/.test(text) && !text.includes(words) && !text.includes(MARK), text.slice(0, 120));
    }
    await evidence.shot(outsider.page, "confirm-05-outsider-320");

    // --- The other outcome: a dispute is recorded beside the claim and shown as plainly.
    const words2 = `${MARK} Hauled away the debris`;
    const thing2 = await createThing(owner, base, words2, evidence);
    if (thing2) {
      const link2 = await ask(owner, base, thing2, "The person asked", "That everything was removed", evidence, "second request");
      if (link2) {
        await asked.page.goto(base + new URL(link2).pathname);
        await asked.page.locator("textarea[name=note]").fill("Some was left by the fence.");
        await asked.page.getByRole("button", { name: "Dispute", exact: true }).click();
        const disputed = await asked.page.locator("[data-answer-done]").textContent({ timeout: 15000 }).catch(() => "");
        evidence.record(S, asked.role, "can dispute instead, and is told it was recorded", /Your answer is recorded: disputed/.test(disputed ?? ""), disputed ?? "");
        await owner.page.goto(base + thing2.href);
        const shown = await owner.page.locator("main").first().innerText();
        evidence.record(S, owner.role, "sees the dispute as plainly as a confirmation", /Disputed by the person asked/.test(shown) && /Disputed by \[automated/.test(shown), shown.slice(0, 300));
        await evidence.shot(owner.page, "confirm-06-holder-sees-dispute-390");
      }
    }

    for (const p of [owner, asked, outsider]) {
      evidence.record(S, p.role, "no uncaught errors in the page", p.errors.length === 0, p.errors.join(" | "));
    }
  } finally {
    await close(owner, asked, outsider);
  }
}
