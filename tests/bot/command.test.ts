// The Command Center: where a person's asks stand across their Worlds (proposed, underway, done),
// and a page that shows only what is on the record, with honest empty states.
import assert from "node:assert/strict";
import { it } from "node:test";
import { kernelClient, type Kernel } from "../../lib/kernel/client";
import { localSupabase } from "../../lib/kernel/local";
import { createConnector, type Session } from "../../lib/bot/connector";
import { approveConnection } from "../../lib/bot/memory";
import { markStepDone, takeRoute } from "../../lib/bot/routes";
import { saveBot } from "../../lib/bot/store";
import { journeys, type Journey } from "../../lib/bot/waiting";
import { setBotAccess } from "../../lib/bot/worlds";
import { createCreativeWorld } from "../../lib/world/creative";
import { createKernelDb, service, user } from "../kernel/harness";

it("knows where each ask stands: proposed, underway or done, and who may choose", async () => {
  const db = await createKernelDb();
  const ana = kernelClient(localSupabase(db, user("auth:command-ana")));
  const ben = kernelClient(localSupabase(db, user("auth:command-ben")));
  const anaId = await ana.register("Ana");
  const benId = await ben.register("Ben");
  const anaBot = (await saveBot(ana, { name: "Nova" }, "persona-command-ana")).avatar!.agent_id;
  const botAs = (agentId: string) => kernelClient(localSupabase(db, service), { actAs: agentId });
  const clientId = "00000000-0000-4000-8000-0000000c1a10";
  await approveConnection(ana, anaId, anaBot, { clientId, clientName: "Claude", mode: "remember" }, "command-connect");
  const propose = async (person: Kernel, args: Record<string, unknown>) => {
    const s: Session = { clientId, person, botAs, appUrl: "https://sov.test" };
    const res = (await createConnector(s).handle({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "propose_routes", arguments: args } })) as { result: { structuredContent: { artifact_id: string } } };
    return res.result.structuredContent.artifact_id;
  };
  const world = await createCreativeWorld(ana, { worldId: "9c1d2c3b-4a59-4687-9a0b-1c2d3e4f5a90", title: "Build solve" });
  await setBotAccess(ana, { scope: world.scope, botAgentId: anaBot, access: "add" }, "in");
  await ana.issueGrant({ grantee: benId, capability: "kernel.read", scope: world.scope });
  const one = (ask: string, steps: string[]) => propose(ana, { world_id: world.worldId, ask, routes: [{ title: `Route for ${ask}`, why: "", steps: steps.map((s) => ({ do: s })) }] });
  await one("Proposed ask", ["a"]);
  const underway = await one("Underway ask", ["first", "second"]);
  const finished = await one("Finished ask", ["only"]);
  await takeRoute(ana, { worldId: world.worldId, pieceId: underway, route: 0 });
  const done = await takeRoute(ana, { worldId: world.worldId, pieceId: finished, route: 0 });
  await markStepDone(ana, { worldId: world.worldId, taskId: done.steps[0].taskId });

  const ref = [{ worldId: world.worldId, title: world.title, scope: world.scope }];
  const byAsk = new Map((await journeys(ana, ref, anaId)).map((j) => [j.ask, j]));
  assert.deepEqual([...byAsk.keys()].sort(), ["Finished ask", "Proposed ask", "Underway ask"]);
  assert.deepEqual(
    ["Proposed ask", "Underway ask", "Finished ask"].map((a) => { const j = byAsk.get(a)!; return [j.state, j.canChoose, j.mine, j.done, j.total, j.next?.step ?? null]; }),
    [["proposed", true, false, 0, 0, null], ["underway", true, true, 0, 2, "first"], ["done", true, true, 1, 1, null]],
  );
  const bens = await journeys(ben, ref, benId);
  assert.ok(bens.every((j) => !j.canChoose && !j.mine), "a read-only member sees where things stand but chooses nothing");
});

const journey = (over: Partial<Journey>): Journey => ({
  worldId: "w1", worldTitle: "Build solve", pieceId: "p", ask: "An ask", at: "2026-10-05T03:00:00Z",
  state: "proposed", options: ["A", "B"], canChoose: true, route: null, mine: false, done: 0, total: 0, next: null, ...over,
});

it("shows only what is on the record, with honest empty states", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { CommandView } = await import("../../app/command/view");
  const empty = renderToStaticMarkup(CommandView({ data: { name: "Ana", botName: null, worlds: [], journeys: [], connections: [], saves: [] } }));
  for (const text of ["Where you are", "No Worlds yet", "Where you&#x27;re going", "Nothing asked yet", "With you", "Make your bot", "What actually happened", "Nothing saved yet", "What&#x27;s next"]) assert.ok(empty.includes(text), text);
  assert.doesNotMatch(empty, /Waiting on you/, "nothing waiting, nothing shown");
  assert.doesNotMatch(empty, /bg-accent/, "no point without a save");

  const html = renderToStaticMarkup(CommandView({ data: {
    name: "Ana",
    botName: "Nova",
    worlds: [{ worldId: "w1", title: "Build solve", updatedAt: "2026-10-05T03:00:00Z" }],
    journeys: [
      journey({ pieceId: "p1", ask: "Which bridge first?" }),
      journey({ pieceId: "p2", ask: "Ship the Command Center", state: "underway", route: "Build it on the record", mine: true, done: 1, total: 3, next: { step: "Write the tests", link: null } }),
      journey({ pieceId: "p3", ask: "Gate money", state: "done", route: "Flags", mine: true, done: 2, total: 2 }),
    ],
    connections: [{ clientId: "c1", clientName: "Claude", mode: "remember", since: "2026-10-04T12:00:00Z" }, { clientId: "c2", clientName: "Codex", mode: "read", since: "2026-10-05T01:00:00Z" }],
    saves: [{ pieceId: "p3", what: "Money gated off", proof: "", link: "https://github.com/x/actions/runs/1", basis: "self_reported", at: "2026-10-05T02:42:00Z", recordId: "r1", number: 1042, by: "a", worldId: "w1", worldTitle: "Build solve" }],
  } }));
  assert.match(html, /1 World · 1 route underway · 1 recent save on the record/);
  assert.match(html, /Waiting on you.*Choose a route.*Which bridge first\?.*Next step.*Write the tests/);
  assert.match(html, /Proposed · 2 routes · in Build solve/);
  assert.match(html, /Build it on the record · 1 of 3 done · in Build solve/);
  assert.match(html, /Flags · all 2 steps done · in Build solve/);
  assert.match(html, /Nova, your bot, with 2 assistants connected\./);
  assert.match(html, /Claude.*can add · since Oct 4.*Codex.*read only · since Oct 5/);
  assert.match(html, /Saved · No\. 1042.*Money gated off.*On your word.*in Build solve/);
  assert.equal(html.match(/bg-accent/g)?.length, 1, "the point lands only on the save");
  assert.match(html, /Start with what&#x27;s waiting on you\./);
});
