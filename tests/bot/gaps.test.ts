// What solve can't do yet: capability drafts assistants recorded, read back, grouped by need (most
// repeated first) and shown on the Command Center. The Forge's seed: repeated real needs pick what
// gets built next.
import assert from "node:assert/strict";
import { it } from "node:test";
import { kernelClient, type Kernel } from "../../lib/kernel/client";
import { localSupabase } from "../../lib/kernel/local";
import { createConnector, type Session } from "../../lib/bot/connector";
import { groupGaps, parseCapabilityProposal, type Gap } from "../../lib/bot/gaps";
import { approveConnection } from "../../lib/bot/memory";
import { saveBot } from "../../lib/bot/store";
import { overview } from "../../lib/bot/waiting";
import { draftCapabilityProposal, setBotAccess } from "../../lib/bot/worlds";
import { createCreativeWorld } from "../../lib/world/creative";
import { createKernelDb, service, user } from "../kernel/harness";

it("reads a capability draft back, and nothing else", () => {
  const { body } = draftCapabilityProposal({ goal: "Read my GitHub build results", outcome: "Show which builds passed in the World", acceptanceTest: "A finished build appears within a minute" });
  assert.deepEqual(parseCapabilityProposal(body), { goal: "Read my GitHub build results", result: "Show which builds passed in the World", check: "A finished build appears within a minute" });
  assert.equal(parseCapabilityProposal("GOAL\nJust a note"), null);
});

it("finds the same need asked in two Worlds and counts it once, twice asked", async () => {
  const db = await createKernelDb();
  const ana = kernelClient(localSupabase(db, user("auth:gaps-ana")));
  const anaId = await ana.register("Ana");
  const anaBot = (await saveBot(ana, { name: "Nova" }, "persona-gaps-ana")).avatar!.agent_id;
  const botAs = (agentId: string) => kernelClient(localSupabase(db, service), { actAs: agentId });
  const clientId = "00000000-0000-4000-8000-0000000c1a11";
  await approveConnection(ana, anaId, anaBot, { clientId, clientName: "Claude", mode: "remember" }, "gaps-connect");
  const call = async (person: Kernel, args: Record<string, unknown>) => {
    const s: Session = { clientId, person, botAs, appUrl: "https://sov.test" };
    await createConnector(s).handle({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "propose_capability", arguments: args } });
  };
  const worlds = [];
  for (const [i, title] of ["Build solve", "Shop"].entries()) {
    const w = await createCreativeWorld(ana, { worldId: `9c1d2c3b-4a59-4687-9a0b-1c2d3e4f5aa${i}`, title });
    await setBotAccess(ana, { scope: w.scope, botAgentId: anaBot, access: "add" }, `in-${i}`);
    worlds.push({ worldId: w.worldId, title: w.title, scope: w.scope });
  }
  await call(ana, { world_id: worlds[0].worldId, goal: "Read my GitHub build results", outcome: "Show builds in the World", acceptance_test: "A build shows within a minute" });
  await call(ana, { world_id: worlds[1].worldId, goal: "read my github build results!", outcome: "Know if the shop deploy passed", acceptance_test: "The deploy result shows" });
  await call(ana, { world_id: worlds[1].worldId, goal: "Send invoices", outcome: "Invoice a customer", acceptance_test: "An invoice is sent" });
  const { gaps } = await overview(ana, worlds, anaId);
  assert.equal(gaps.length, 3);
  const grouped = groupGaps(gaps);
  assert.deepEqual(grouped.map((g) => [g.times, g.worlds.sort()]), [[2, ["Build solve", "Shop"]], [1, ["Shop"]]]);
  assert.match(grouped[0].goal, /github build results/i);
});

it("shows needs on the Command Center, most repeated first, and runs nothing", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { CommandView } = await import("../../app/command/view");
  const gap = (over: Partial<Gap>): Gap => ({ goal: "Send invoices", result: "Invoice a customer", check: "", worldId: "w1", worldTitle: "Shop", pieceId: "p", at: "2026-10-05T03:00:00Z", ...over });
  const html = renderToStaticMarkup(CommandView({ data: { name: "Ana", botName: "Nova", worlds: [], journeys: [], connections: [], saves: [], gaps: [
    gap({ pieceId: "p1" }),
    gap({ pieceId: "p2", goal: "Read build results", result: "Show builds", worldTitle: "Build solve" }),
    gap({ pieceId: "p3", goal: "read build results", result: "Show deploys", worldTitle: "Shop" }),
  ] } }));
  assert.match(html, /What solve can&#x27;t do yet.*Read build results.*Needed 2 times · in Build solve, Shop.*Send invoices.*Needed once · in Shop.*Nothing here runs\./);
  const none = renderToStaticMarkup(CommandView({ data: { name: "Ana", botName: "Nova", worlds: [], journeys: [], connections: [], saves: [] } }));
  assert.doesNotMatch(none, /can&#x27;t do yet/);
});
