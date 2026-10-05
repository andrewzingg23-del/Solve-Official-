// Routes: an assistant proposes up to three ways forward; only the person takes one, its steps become
// their kernel tasks, and a step marked done is done on their word. The bot can read the progress but
// cannot take a route or mark a step done.
import assert from "node:assert/strict";
import { it } from "node:test";
import { kernelClient, type Kernel } from "../../lib/kernel/client";
import { localSupabase } from "../../lib/kernel/local";
import { createConnector, type Session } from "../../lib/bot/connector";
import { approveConnection } from "../../lib/bot/memory";
import { encodeRoutes, markStepDone, parseRoutes, takenRoutes, takeRoute, STEP_CAPABILITY } from "../../lib/bot/routes";
import { saveBot } from "../../lib/bot/store";
import { setBotAccess, WorldInputError } from "../../lib/bot/worlds";
import { createCreativeWorld, loadCreativeWorld } from "../../lib/world/creative";
import { createKernelDb, service, user } from "../kernel/harness";

const ASK = "Sell my prints at the Saturday market";
const ROUTES = [
  { title: "Rent a stall through the council", why: "Cheapest, but the waiting list can be weeks.", takes: "About $40 a Saturday and a permit", unknowns: "Whether the council needs public liability insurance", done_when: "A receipt for the first pitch", steps: [{ do: "Apply for a casual trader permit", link: "https://example.gov/market-permit" }, { do: "Book a Saturday pitch" }, { do: "Bring 20 framed prints and a card reader" }] },
  { title: "Share a friend's stall", why: "Starts this week; split the fee.", steps: [{ do: "Ask Mo about half his table" }, { do: "Agree the split in writing" }] },
];

it("checks routes: up to three, each with steps, links only on the web", () => {
  const body = encodeRoutes({ ask: ASK, routes: ROUTES });
  assert.deepEqual(parseRoutes(body)?.routes.map((r) => r.steps.length), [3, 2]);
  assert.deepEqual(parseRoutes(body)?.routes[0], { title: ROUTES[0].title, why: ROUTES[0].why, takes: "About $40 a Saturday and a permit", unknowns: "Whether the council needs public liability insurance", doneWhen: "A receipt for the first pitch", steps: ROUTES[0].steps }, "the route-card notes survive the round trip");
  assert.equal("takes" in parseRoutes(body)!.routes[1], false, "notes left out stay out");
  assert.throws(() => encodeRoutes({ ask: ASK, routes: [...ROUTES, ...ROUTES] }), /at most 3 routes/);
  assert.throws(() => encodeRoutes({ ask: ASK, routes: [] }), /at least one route/);
  assert.throws(() => encodeRoutes({ ask: "", routes: ROUTES }), /what the person asked/);
  assert.throws(() => encodeRoutes({ ask: ASK, routes: [{ title: "x", why: "", steps: [] }] }), /at least one step/);
  assert.throws(() => encodeRoutes({ ask: ASK, routes: [{ title: "x", why: "", steps: [{ do: "Click", link: "javascript:alert(1)" }] }] }), /https:\/\/ or http:\/\//);
  assert.throws(() => encodeRoutes({ ask: ASK, routes: [1, 2, 3].map(() => ({ title: "x", why: "y".repeat(400), steps: Array.from({ length: 8 }, () => ({ do: "z".repeat(300), link: `https://example.com/${"a".repeat(1900)}` })) })) }), /too long for one piece/);
  assert.equal(parseRoutes("Just a note"), null);
  assert.equal(parseRoutes('SOV_ROUTES_V1\n{"ask":"x","routes":[{"title":"t","why":"","steps":[{"do":"go","link":"javascript:alert(1)"}]}]}'), null, "a hand-edited piece is checked again");
});

it("lets the bot propose routes, and only the person take one and mark its steps done", async () => {
  const db = await createKernelDb();
  const ana = kernelClient(localSupabase(db, user("auth:routes-ana")));
  const ben = kernelClient(localSupabase(db, user("auth:routes-ben")));
  const anaId = await ana.register("Ana");
  const benId = await ben.register("Ben");
  const anaBot = (await saveBot(ana, { name: "Nova" }, "persona-routes-ana")).avatar!.agent_id;
  const botAs = (agentId: string) => kernelClient(localSupabase(db, service), { actAs: agentId });
  const clientId = "00000000-0000-4000-8000-0000000c1a0e";
  await approveConnection(ana, anaId, anaBot, { clientId, clientName: "Claude", mode: "remember" }, "routes-connect");
  const call = async (person: Kernel, name: string, args: Record<string, unknown>) => {
    const s: Session = { clientId, person, botAs, appUrl: "https://sov.test" };
    return ((await createConnector(s).handle({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } })) as { result: { content: { text: string }[]; isError?: boolean; structuredContent?: Record<string, unknown> } }).result;
  };
  const worldId = "9c1d2c3b-4a59-4687-9a0b-1c2d3e4f5a7b";
  const world = await createCreativeWorld(ana, { worldId, title: "Market" });
  await ana.issueGrant({ grantee: benId, capability: "kernel.read", scope: world.scope });

  const shut = await call(ana, "propose_routes", { world_id: worldId, ask: ASK, routes: ROUTES });
  assert.equal(shut.isError, true, "a bot that was not let in proposes nothing");
  await setBotAccess(ana, { scope: world.scope, botAgentId: anaBot, access: "add" }, "in");

  const bad = await call(ana, "propose_routes", { world_id: worldId, ask: ASK, routes: [{ title: "x", why: "", steps: [] }] });
  assert.match(bad.content[0].text, /^Nothing was written: route 1 needs at least one step/);
  const proposed = await call(ana, "propose_routes", { world_id: worldId, ask: ASK, routes: ROUTES });
  assert.match(proposed.content[0].text, /^Proposed 2 routes for "Sell my prints at the Saturday market": Rent a stall through the council; Share a friend's stall\. Nothing has started/);
  const pieceId = (proposed.structuredContent as { artifact_id: string }).artifact_id;
  const again = await call(ana, "propose_routes", { world_id: worldId, ask: ASK, routes: ROUTES });
  assert.equal((again.structuredContent as { artifact_id: string }).artifact_id, pieceId, "a retried call is one piece");

  const before = await call(ana, "read_world", { world_id: worldId });
  assert.match(before.content[0].text, /2 proposed routes for: Sell my prints at the Saturday market \(1\. Rent a stall through the council; 2\. Share a friend's stall\); none taken yet/);

  const bot = botAs(anaBot);
  await assert.rejects(takeRoute(bot, { worldId, pieceId, route: 0 }), (e: Error) => e.name === "forbidden", "the bot cannot take a route");
  await assert.rejects(takeRoute(ben, { worldId, pieceId, route: 0 }), (e: Error) => e.name === "forbidden", "a member who can only read cannot take one");
  await assert.rejects(takeRoute(ana, { worldId, pieceId, route: 5 }), WorldInputError);

  const taken = await takeRoute(ana, { worldId, pieceId, route: 0 });
  assert.deepEqual([taken.route, taken.takenBy, taken.steps.map((s) => s.status)], [0, anaId, ["ready", "ready", "ready"]]);
  assert.deepEqual(taken.steps.map((s) => s.link), ["https://example.gov/market-permit", null, null]);
  const retaken = await takeRoute(ana, { worldId, pieceId, route: 0 });
  assert.deepEqual(retaken.steps.map((s) => s.taskId), taken.steps.map((s) => s.taskId), "taking it again changes nothing");
  await assert.rejects(takeRoute(ana, { worldId, pieceId, route: 1 }), /another route is already taken/);
  const tasks = await ana.readTasks(world.scope);
  assert.equal(tasks.length, 3);
  assert.ok(tasks.every((t) => t.created_by === anaId && t.required_capability === STEP_CAPABILITY && t.cause_ref === `entity:${pieceId}`));

  const revise = await call(ana, "propose_routes", { world_id: worldId, ask: ASK, routes: ROUTES.slice(1), artifact_id: pieceId });
  assert.match(revise.content[0].text, /a route is already taken for this/, "the bot cannot rewrite a route the person took");

  const first = taken.steps[0].taskId;
  await assert.rejects(bot.transitionTask({ taskId: first, status: "claimed" }), (e: Error) => e.name === "forbidden", "the bot cannot claim the person's step");
  await assert.rejects(markStepDone(ben, { worldId, taskId: first }), (e: Error) => e.name === "forbidden");
  const done = await markStepDone(ana, { worldId, taskId: first });
  assert.equal(done.status, "completed");
  assert.ok(done.doneAt);
  assert.equal((await markStepDone(ana, { worldId, taskId: first })).status, "completed", "marking it twice is one done");

  const after = await call(ana, "read_world", { world_id: worldId });
  assert.match(after.content[0].text, /route taken for: Sell my prints at the Saturday market: Rent a stall through the council, 1 of 3 steps done on the person's word; next: Book a Saturday pitch/);
  const piece = (after.structuredContent as { pieces: { artifact_id: string; route_taken?: { steps: { status: string; done_on: string | null }[] } }[] }).pieces.find((p) => p.artifact_id === pieceId)!;
  assert.deepEqual(piece.route_taken?.steps.map((s) => [s.status, s.done_on]), [["completed", "the person's word"], ["ready", null], ["ready", null]]);

  const history = await ana.readEvents(world.scope, { newestFirst: true, limit: 5 });
  assert.equal(history[0].type, "kernel.task.completed");
  assert.equal(history[0].actor_id, anaId, "the record says who called it done");
  assert.equal((await takenRoutes(ben, world.scope)).get(pieceId)?.steps[0].status, "completed", "a member who can read sees the same progress");
  assert.ok((await loadCreativeWorld(ana, worldId)).artifacts.some((a) => a.entityId === pieceId));
});

it("draws proposed routes with a choice, and a taken route with whose word each done step rests on", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { RouteCard } = await import("../../app/route-card");
  const routes = parseRoutes(encodeRoutes({ ask: ASK, routes: ROUTES }))!;
  const act = async () => {};
  const proposed = renderToStaticMarkup(RouteCard({ pieceId: "p", routes, take: act, markDone: act }));
  assert.match(proposed, /Proposed · 2 routes/);
  assert.equal(proposed.match(/Take this route/g)?.length, 2);
  assert.match(proposed, /Nothing starts until you take a route\./);
  assert.match(proposed, /example\.gov/);
  assert.doesNotMatch(proposed, /bg-accent/, "a proposal never carries the point");
  assert.match(proposed, /Not yet known.*Whether the council needs public liability insurance/);
  assert.match(proposed, /Done when.*A receipt for the first pitch/);

  const taken = {
    pieceId: "p", route: 0, takenBy: "a", takenAt: "2026-10-05T12:00:00Z",
    steps: [
      { taskId: "t1", step: 0, do: "Apply for a casual trader permit", link: "https://example.gov/market-permit", status: "completed" as const, doneAt: "2026-10-05T13:00:00Z", since: "2026-10-05T13:00:00Z" },
      { taskId: "t2", step: 1, do: "Book a Saturday pitch", link: null, status: "ready" as const, doneAt: null, since: "2026-10-05T12:00:00Z" },
      { taskId: "t3", step: 2, do: "Bring 20 framed prints and a card reader", link: null, status: "ready" as const, doneAt: null, since: "2026-10-05T12:00:00Z" },
    ],
  };
  const mine = renderToStaticMarkup(RouteCard({ pieceId: "p", routes, taken, take: act, markDone: act }));
  assert.match(mine, /Route taken · 1 of 3 done/);
  assert.match(mine, /Done · On your word · Oct 5/);
  assert.equal(mine.match(/Mark done/g)?.length, 1, "only the next step can be marked done");
  assert.equal(mine.match(/bg-accent/g)?.length, 1, "the point lands only on the done step");
  const theirs = renderToStaticMarkup(RouteCard({ pieceId: "p", routes, taken, who: "Ana" }));
  assert.match(theirs, /Done · On Ana&#x27;s word/);
  assert.doesNotMatch(theirs, /Mark done/, "without the action the card is read only");
});
