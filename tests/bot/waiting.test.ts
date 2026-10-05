// Waiting on you: routes the person can still choose, and the next step of each route they took,
// across their Worlds. A member who can only read is never asked to choose, and a route whose
// steps are all done stops waiting.
import assert from "node:assert/strict";
import { it } from "node:test";
import { kernelClient, type Kernel } from "../../lib/kernel/client";
import { localSupabase } from "../../lib/kernel/local";
import { createConnector, type Session } from "../../lib/bot/connector";
import { approveConnection } from "../../lib/bot/memory";
import { markStepDone, takeRoute } from "../../lib/bot/routes";
import { saveBot } from "../../lib/bot/store";
import { waitingOn } from "../../lib/bot/waiting";
import { setBotAccess } from "../../lib/bot/worlds";
import { createCreativeWorld } from "../../lib/world/creative";
import { createKernelDb, service, user } from "../kernel/harness";

it("lists routes to choose and next steps, only for the person who can act on them", async () => {
  const db = await createKernelDb();
  const ana = kernelClient(localSupabase(db, user("auth:waiting-ana")));
  const ben = kernelClient(localSupabase(db, user("auth:waiting-ben")));
  const anaId = await ana.register("Ana");
  const benId = await ben.register("Ben");
  const anaBot = (await saveBot(ana, { name: "Nova" }, "persona-waiting-ana")).avatar!.agent_id;
  const botAs = (agentId: string) => kernelClient(localSupabase(db, service), { actAs: agentId });
  const clientId = "00000000-0000-4000-8000-0000000c1a0f";
  await approveConnection(ana, anaId, anaBot, { clientId, clientName: "Claude", mode: "remember" }, "waiting-connect");
  const propose = async (person: Kernel, args: Record<string, unknown>) => {
    const s: Session = { clientId, person, botAs, appUrl: "https://sov.test" };
    const res = (await createConnector(s).handle({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "propose_routes", arguments: args } })) as { result: { structuredContent: { artifact_id: string } } };
    return res.result.structuredContent.artifact_id;
  };

  const build = await createCreativeWorld(ana, { worldId: "9c1d2c3b-4a59-4687-9a0b-1c2d3e4f5a80", title: "Build solve" });
  const market = await createCreativeWorld(ana, { worldId: "9c1d2c3b-4a59-4687-9a0b-1c2d3e4f5a81", title: "Market" });
  for (const w of [build, market]) await setBotAccess(ana, { scope: w.scope, botAgentId: anaBot, access: "add" }, `in-${w.worldId}`);
  await ana.issueGrant({ grantee: benId, capability: "kernel.read", scope: build.scope });

  const decision = await propose(ana, {
    world_id: build.worldId,
    ask: "Which outside service connects first?",
    routes: [
      { title: "Whop", why: "The directive names it", steps: [{ do: "Record the choice" }] },
      { title: "Discord", why: "The spec names it", steps: [{ do: "Record the choice" }] },
    ],
  });
  const stall = await propose(ana, {
    world_id: market.worldId,
    ask: "Sell prints at the Saturday market",
    routes: [{ title: "Rent a stall", why: "Cheapest", steps: [{ do: "Apply for a permit", link: "https://example.gov/permit" }, { do: "Book a pitch" }] }],
  });
  await takeRoute(ana, { worldId: market.worldId, pieceId: stall, route: 0 });

  const worlds = [build, market].map((w) => ({ worldId: w.worldId, title: w.title, scope: w.scope }));
  const waiting = await waitingOn(ana, worlds, anaId);
  assert.deepEqual(waiting.map((w) => [w.kind, w.ask]), [["choose", "Which outside service connects first?"], ["next", "Sell prints at the Saturday market"]]);
  const choose = waiting[0];
  assert.ok(choose.kind === "choose" && choose.pieceId === decision);
  assert.deepEqual(choose.kind === "choose" && choose.options, ["Whop", "Discord"]);
  const next = waiting[1];
  assert.deepEqual(next.kind === "next" && [next.step, next.link, next.done, next.total, next.route, next.worldTitle], ["Apply for a permit", "https://example.gov/permit", 0, 2, "Rent a stall", "Market"]);

  assert.deepEqual(await waitingOn(ben, worlds.slice(0, 1), benId), [], "a member who can only read is not asked to choose");

  const taken = await takeRoute(ana, { worldId: market.worldId, pieceId: stall, route: 0 });
  for (const s of taken.steps) await markStepDone(ana, { worldId: market.worldId, taskId: s.taskId });
  assert.deepEqual((await waitingOn(ana, worlds, anaId)).map((w) => w.kind), ["choose"], "a finished route stops waiting");
  await takeRoute(ana, { worldId: build.worldId, pieceId: decision, route: 1 });
  const after = await waitingOn(ana, worlds, anaId);
  assert.deepEqual(after.map((w) => [w.kind, w.kind === "next" ? w.route : ""]), [["next", "Discord"]], "a decision taken becomes its next step");
});

it("shows nothing when nothing waits, and links each item to its World", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { WaitingOnYou } = await import("../../app/bot/waiting");
  assert.equal(WaitingOnYou({ items: [] }), null);
  const html = renderToStaticMarkup(WaitingOnYou({ items: [
    { kind: "choose", worldId: "w1", worldTitle: "Build solve", pieceId: "p1", ask: "Which outside service connects first?", at: "2026-10-05T03:00:00Z", options: ["Whop", "Discord"] },
    { kind: "next", worldId: "w2", worldTitle: "Market", pieceId: "p2", ask: "Sell prints", at: "2026-10-05T02:00:00Z", route: "Rent a stall", step: "Apply for a permit", link: "https://www.example.gov/permit", done: 0, total: 2 },
  ] })!);
  assert.match(html, /Waiting on you/);
  assert.match(html, /Choose a route.*href="\/world\/w1".*Which outside service connects first\?.*2 options: Whop · Discord · in Build solve/);
  assert.match(html, /Next step.*href="\/world\/w2".*Apply for a permit.*Rent a stall · 0 of 2 done · in Market.*example\.gov/);
});
