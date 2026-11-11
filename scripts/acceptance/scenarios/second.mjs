// A second person, independently: the same shell, a different AI app, an unrelated real task, and
// the same connection lifecycle — with no access to anyone else's Spaces, in either direction.
import { MARK, VIEWPORTS, beginThing, close, kernelFor, persona } from "../lib.mjs";
import { connectApp, said, tool } from "../connect.mjs";

const S = "second";

export async function second({ browser, base, evidence }) {
  const first = await persona(browser, base, "first-person", VIEWPORTS.phone390, evidence, S);
  const other = await persona(browser, base, "second-person", VIEWPORTS.phone320, evidence, S);
  try {
    if (!first.kernel || !other.kernel) return;

    // --- The first person has a private Space and their own app in it.
    const diary = await beginThing(first.page, base, "Family budget");
    const firstApp = await connectApp(first, base, `${MARK} Claude`);
    evidence.record(S, first.role, "connects their AI", Boolean(firstApp.token), firstApp.failed ?? "");

    // --- The second person finds how to connect from the shell's own AI button.
    const p = other.page;
    await p.goto(base + "/");
    await p.getByRole("link", { name: "AI", exact: true }).click();
    await p.waitForURL(/\/apps/, { timeout: 15000 }).catch(() => {});
    const address = await p.locator("[data-mcp-address]").innerText().catch(() => "");
    evidence.record(S, other.role, "the shell's AI button leads to how to connect their own AI, with the address", /\/mcp$/.test(address), address);

    // --- A different app, the same lifecycle, an unrelated task.
    const bakery = await beginThing(p, base, "Corner bakery");
    evidence.record(S, other.role, "creates their own Space", Boolean(bakery));
    const otherApp = await connectApp(other, base, `${MARK} Another AI`);
    evidence.record(S, other.role, "connects a different AI app through the same process, with one approval", Boolean(otherApp.token), otherApp.failed ?? otherApp.heading);
    if (!otherApp.token) return;
    const before = await tool(base, otherApp.token, "list_worlds");
    evidence.record(S, "second app", "starts with nothing", (before.body?.result?.structuredContent?.worlds ?? []).length === 0, said(before).slice(0, 120));

    await p.goto(`${base}/world/${bakery}`);
    await p.locator("[data-apps-here] summary").click();
    await p.locator(`[data-app-access="${otherApp.clientId}"] [data-app-choice="add"]`).check();
    await p.waitForFunction(id => document.querySelector(`[data-app-access="${id}"] [data-app-choice="add"]`)?.checked && !document.querySelector(`[data-app-access="${id}"]`)?.disabled, otherApp.clientId, { timeout: 15000 }).catch(() => {});
    const order = "Weekly order: 40kg flour, 12 dozen eggs, 8kg butter — to confirm with the supplier";
    const added = await tool(base, otherApp.token, "add_to_world", { world_id: bakery, title: "Weekly order", body: order });
    evidence.record(S, "second app", "does the task in the person's Space", !added.body?.result?.isError, said(added).slice(0, 160));
    await p.goto(`${base}/world/${bakery}`);
    const piece = p.locator("[data-piece]", { hasText: "Weekly order" });
    evidence.record(S, other.role, "sees the result in their Space, credited to their AI",
      await piece.waitFor({ timeout: 15000 }).then(() => true, () => false) && /Another AI/.test(await piece.locator("[data-author]").innerText().catch(() => "")));
    // --- The same AI uses a real tool through Solve: it brings in a live web page, recorded as a task.
    const brought = await tool(base, otherApp.token, "bring_in_link", { world_id: bakery, url: "https://example.com/" });
    evidence.record(S, "second app", "runs a real capability through Solve: brings in a live page", !brought.body?.result?.isError, said(brought).slice(0, 160));
    const again = await tool(base, otherApp.token, "bring_in_link", { world_id: bakery, url: "https://example.com/" });
    evidence.record(S, "second app", "a retry resumes the same run instead of repeating it", again.body?.result?.structuredContent?.resumed === true && again.body?.result?.structuredContent?.artifact_id === brought.body?.result?.structuredContent?.artifact_id);
    const tasks = await other.kernel.rpc("read_tasks", { p_scope: `world:${bakery}` }).catch(() => []);
    const done = tasks.find(t => t.task_id === brought.body?.result?.structuredContent?.task_id);
    evidence.record(S, other.role, "the run is a completed task in their Space, with its result", done?.status === "completed" && done?.result?.entity_id === brought.body?.result?.structuredContent?.artifact_id, done?.status ?? "no task");
    await p.goto(`${base}/world/${bakery}`);
    const page = p.locator("[data-captured]", { hasText: "Example Domain" });
    evidence.record(S, other.role, "sees the page in their Space with its real title, marked as brought in by Solve",
      await page.waitFor({ timeout: 15000 }).then(() => true, () => false) && /brought in by Solve/.test(await p.locator("[data-piece]", { has: page }).innerText().catch(() => "")));

    await p.goto(base + "/apps");
    const health = await p.locator(`[data-app="${otherApp.clientId}"] [data-app-health]`).innerText().catch(() => "");
    evidence.record(S, other.role, "Apps shows the connection's real state: connected, reaching one Space", /can reach 1 Space/.test(health), health);

    // --- Isolation, both ways, through the connector and the tokens themselves.
    const crossA = await tool(base, otherApp.token, "read_world", { world_id: diary });
    evidence.record(S, "second app", "can't read the first person's Space", Boolean(crossA.body?.result?.isError), said(crossA).slice(0, 120));
    const crossB = await tool(base, firstApp.token, "read_world", { world_id: bakery });
    evidence.record(S, "first app", "can't read the second person's Space", Boolean(crossB.body?.result?.isError), said(crossB).slice(0, 120));
    const direct = await kernelFor(otherApp.token).rpc("read_world", { p_scope: `world:${diary}` }).then(r => r, e => e);
    evidence.record(S, "second app", "nor with its own token straight to the kernel", direct instanceof Error || (Array.isArray(direct) && direct.length === 0), direct instanceof Error ? direct.message : `${direct.length}`);

    // --- Disconnecting one person's app leaves the other untouched; the work stays.
    await first.page.goto(base + "/apps");
    await first.page.locator(`[data-app="${firstApp.clientId}"] [data-disconnect]`).click();
    await first.page.locator(`[data-app="${firstApp.clientId}"]`).waitFor({ state: "detached", timeout: 15000 }).catch(() => {});
    evidence.record(S, "first app", "is refused once its person disconnects it", (await tool(base, firstApp.token, "whoami")).status === 401);
    evidence.record(S, "second app", "is unaffected by someone else disconnecting", !(await tool(base, otherApp.token, "list_worlds")).body?.result?.isError);
    await p.goto(base + "/apps");
    await p.locator(`[data-app="${otherApp.clientId}"] [data-disconnect]`).click();
    await p.locator(`[data-app="${otherApp.clientId}"]`).waitFor({ state: "detached", timeout: 15000 }).catch(() => {});
    evidence.record(S, "second app", "is refused at once after its person disconnects it", (await tool(base, otherApp.token, "whoami")).status === 401);
    evidence.record(S, "second app", "and can't refresh its way back", !(await otherApp.refresh()).body.access_token);
    await p.goto(`${base}/world/${bakery}`);
    evidence.record(S, other.role, "the work it did is still theirs", await p.locator("[data-piece]", { hasText: "Weekly order" }).isVisible());

    for (const x of [first, other]) evidence.record(S, x.role, "no uncaught errors in the page", x.errors.length === 0, x.errors.join(" | "));
  } finally {
    await close(first, other);
  }
}
