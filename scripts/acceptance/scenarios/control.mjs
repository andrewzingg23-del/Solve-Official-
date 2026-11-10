// Control: a person sees what they can reach, in their own words, and can take everything with them
// — and the file they take contains everything of theirs and nothing of anyone else's.
import { readFile } from "node:fs/promises";
import { INTERNAL_IDS, MARK, OUR_WORDS, VIEWPORTS, beginThing, close, persona } from "../lib.mjs";

const S = "control";

async function makeThing(who, base, words) {
  return Boolean(await beginThing(who.page, base, words));
}

export async function control({ browser, base, evidence }) {
  const owner = await persona(browser, base, "control-owner", VIEWPORTS.phone390, evidence, S);
  const other = await persona(browser, base, "someone-else", VIEWPORTS.desktop, evidence, S);
  try {
    if (!owner.kernel || !other.kernel) return;
    const mine = `${MARK} Pay the crew on Friday`;
    const theirs = `${MARK} Someone else's private plan`;
    evidence.record(S, owner.role, "records a thing", await makeThing(owner, base, mine));
    evidence.record(S, other.role, "records a thing of their own", await makeThing(other, base, theirs));

    // --- What they can reach, in their words.
    const page = owner.page;
    await page.goto(base + "/control");
    const reach = await page.locator('section[aria-labelledby="reach"]').innerText().catch(() => "");
    evidence.record(S, owner.role, "Control lists their SOV ID among what they can reach", /Your SOV ID/.test(reach), reach.slice(0, 200));
    evidence.record(S, owner.role, "and the thing they made, by its own name", reach.includes(mine.slice(MARK.length + 1)) || reach.includes(mine), reach.slice(0, 300));
    evidence.record(S, owner.role, "and never someone else's thing", !reach.includes(theirs));
    evidence.record(S, owner.role, "in plain words — no capability codes, ids or words of ours",
      !/\b[a-z]+\.[a-z]+(\.[a-z]+)?\b/.test(reach.replace(MARK, "")) && !INTERNAL_IDS.test(reach) && !OUR_WORDS.test(reach), reach.slice(0, 300));
    await evidence.shot(page, "control-01-reach-390");

    // --- Take everything: the download is real, and it is theirs alone.
    const download = page.waitForEvent("download", { timeout: 30000 }).catch(() => null);
    await page.getByRole("button", { name: "Download everything" }).click();
    const file = await download;
    evidence.record(S, owner.role, "Download everything gives them a file", Boolean(file), "no download happened");
    if (file) {
      const text = await readFile(await file.path(), "utf8").catch(() => "");
      let data = null;
      try { data = JSON.parse(text); } catch {}
      evidence.record(S, owner.role, "the file is readable data, named for the day", Boolean(data) && /^solve-export-\d{4}-\d{2}-\d{2}\.json$/.test(file.suggestedFilename()), file.suggestedFilename());
      const titles = (data?.things ?? []).map(t => t.title);
      evidence.record(S, owner.role, "it contains what they made", titles.some(t => t?.includes("Pay the crew on Friday")), titles.slice(0, 5).join(" | "));
      evidence.record(S, owner.role, "and nothing of anyone else's, in any form", !text.includes("Someone else's private plan"));
      evidence.record(S, owner.role, "with their history", Array.isArray(data?.history) && data.history.length > 0, `${data?.history?.length ?? 0} acts`);
      // Independent read-back: the kernel, asked as them, agrees with the file.
      const direct = await owner.kernel.rpc("export_mine", { p_as_actor: null }).catch(() => null);
      evidence.record(S, owner.role, "the file matches what the kernel holds for them",
        Boolean(direct) && direct.things?.length === data?.things?.length, `kernel ${direct?.things?.length}, file ${data?.things?.length}`);
    }
    const said = await page.locator('section[aria-labelledby="leave"] [role=status]').textContent({ timeout: 10000 }).catch(() => "");
    evidence.record(S, owner.role, "and is told what was downloaded", /Downloaded solve-export-/.test(said ?? ""), said ?? "");
    await evidence.shot(page, "control-02-exported-390");

    for (const p of [owner, other]) evidence.record(S, p.role, "no uncaught errors in the page", p.errors.length === 0, p.errors.join(" | "));
  } finally {
    await close(owner, other);
  }
}
