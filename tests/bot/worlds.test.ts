// The bot in Worlds, end to end on the embedded kernel: a person lets their bot into a World at a
// level (read, add) and takes it out; a connected assistant reads and adds only as far as that goes,
// always as the bot for its owner; starting a World makes it the person's, never the bot's; and a
// World's owner can let someone else's bot in, while a mere member cannot pass access on.
import assert from "node:assert/strict";
import { it } from "node:test";
import { kernelClient, KernelError, type Kernel } from "../../lib/kernel/client";
import { localSupabase } from "../../lib/kernel/local";
import { createConnector, type Session } from "../../lib/bot/connector";
import { approveConnection } from "../../lib/bot/memory";
import { saveBot } from "../../lib/bot/store";
import { botGrantsIn, setBotAccess, worldsForBot } from "../../lib/bot/worlds";
import { createCreativeWorld, loadCreativeWorld } from "../../lib/world/creative";
import { createKernelDb, service, user } from "../kernel/harness";

const CLAUDE = "00000000-0000-4000-8000-0000000c1a0d";
const WORLD = "6f1d2c3b-4a59-4687-9a0b-1c2d3e4f5a6b";
type Result = { content: { text: string }[]; isError?: boolean; structuredContent?: Record<string, unknown> };

async function setting() {
  const db = await createKernelDb();
  const ana = kernelClient(localSupabase(db, user("auth:worlds-ana")));
  const ben = kernelClient(localSupabase(db, user("auth:worlds-ben")));
  const anaId = await ana.register("Ana");
  const benId = await ben.register("Ben");
  const anaBot = await saveBot(ana, { name: "Nova" }, "persona-worlds-ana");
  const benBot = await saveBot(ben, { name: "Rex" }, "persona-worlds-ben");
  const botAs = (agentId: string) => kernelClient(localSupabase(db, service), { actAs: agentId });
  await approveConnection(ana, anaId, anaBot.avatar!.agent_id, { clientId: CLAUDE, clientName: "Claude", mode: "remember" }, "worlds-connect-ana");
  await approveConnection(ben, benId, benBot.avatar!.agent_id, { clientId: CLAUDE, clientName: "ChatGPT", mode: "remember" }, "worlds-connect-ben");
  let id = 0;
  const call = async (person: Kernel, name: string, args: Record<string, unknown> = {}, extra: Partial<Session> = {}) => {
    const s: Session = { clientId: CLAUDE, person, botAs, appUrl: "https://sov.test", ...extra };
    const res = (await createConnector(s).handle({ jsonrpc: "2.0", id: ++id, method: "tools/call", params: { name, arguments: args } })) as { result: Result };
    return res.result;
  };
  return { db, ana, ben, anaId, benId, anaBot: anaBot.avatar!.agent_id, benBot: benBot.avatar!.agent_id, botAs, call };
}

it("lets the bot into a World only as far as its owner allows, and out again", async () => {
  const { ana, anaId, anaBot, botAs, call } = await setting();
  const world = await createCreativeWorld(ana, { worldId: WORLD, title: "Kitchen remodel" });

  const listed = (await call(ana, "list_worlds")).structuredContent as { worlds: { world_id: string; bot_access: string }[] };
  assert.deepEqual(listed.worlds.map((w) => [w.world_id, w.bot_access]), [[WORLD, "none"]]);
  assert.equal((await call(ana, "read_world", { world_id: WORLD })).isError, true, "not let in: nothing to read");

  await setBotAccess(ana, { scope: world.scope, botAgentId: anaBot, access: "read" }, "in-1");
  const read = await call(ana, "read_world", { world_id: WORLD });
  assert.match(read.content[0].text, /World: Kitchen remodel/);
  assert.ok(read.content[0].text.length <= 12_000, "World context stays within its character budget");
  const refused = await call(ana, "add_to_world", { world_id: WORLD, title: "Budget", body: "Cabinets first." });
  assert.equal(refused.isError, true, "read access cannot add");
  assert.match(refused.content[0].text, /may not add to that World/);

  await setBotAccess(ana, { scope: world.scope, botAgentId: anaBot, access: "add" }, "in-2");
  const added = await call(ana, "add_to_world", { world_id: WORLD, title: "Budget", body: "Cabinets first, then counters. <script>x</script>" });
  assert.equal(added.isError, undefined, added.content[0].text);
  const again = await call(ana, "add_to_world", { world_id: WORLD, title: "Budget", body: "Cabinets first, then counters. <script>x</script>" });
  const pieceId = (added.structuredContent as { artifact_id: string }).artifact_id;
  assert.equal((again.structuredContent as { artifact_id: string }).artifact_id, pieceId, "a retried call is one change");
  const longBody = "Counters first after all. " + "x".repeat(3_000);
  await call(ana, "add_to_world", { world_id: WORLD, title: "Budget", body: longBody, artifact_id: pieceId });

  const { artifacts } = await loadCreativeWorld(ana, WORLD);
  assert.deepEqual(artifacts.map((a) => [a.title, a.body, a.version]), [["Budget", longBody, 2]], "the owner sees the bot's revision");
  assert.equal(artifacts[0].via, "Claude", "a piece the bot writes names the assistant it came through");
  const history = await ana.readEvents(world.scope);
  const byBot = history.filter((e) => e.type.startsWith("kernel.entity") && e.actor_id === anaBot);
  assert.deepEqual(byBot.map((e) => [e.type, e.on_behalf_of]), [["kernel.entity.created", anaId], ["kernel.entity.updated", anaId]], "document changes are the bot's, for Ana; retries added nothing");
  const { viaOf } = await import("../../lib/world/creative");
  assert.deepEqual(byBot.map((e) => viaOf((e.payload as { request?: { attributes?: Record<string, unknown> } }).request?.attributes)), ["Claude", "Claude"], "each revision's event records the assistant");
  const finalRead = await call(ana, "read_world", { world_id: WORLD });
  assert.match(finalRead.content[0].text, /<pieces note=[^>]+>\n- \[.+\] Budget: Counters first after all\./);
  assert.ok(finalRead.content[0].text.length <= 12_000, "the context stays within its budget");
  const finalContent = finalRead.structuredContent as { pieces: { artifact_id: string; body_truncated: boolean }[] };
  assert.equal(finalContent.pieces[0].body_truncated, true);

  const mine = await worldsForBot(ana, anaBot, "https://sov.test");
  assert.deepEqual(mine.map((w) => [w.title, w.access, w.url]), [["Kitchen remodel", "add", `https://sov.test/world/${WORLD}`]]);
  await setBotAccess(ana, { scope: world.scope, botAgentId: anaBot, access: "none" }, "out-1");
  assert.deepEqual(await botGrantsIn(ana, world.scope, anaBot), []);
  assert.deepEqual((await botAs(anaBot).myGrants()).filter((g) => g.scope === world.scope), [], "taken out means no grants left");
  assert.equal((await call(ana, "read_world", { world_id: WORLD })).isError, true);
});

it("lets a World's owner bring in someone else's bot, and stops a member passing access on", async () => {
  const { ana, ben, benId, benBot, call } = await setting();
  const world = await createCreativeWorld(ana, { worldId: WORLD, title: "Garage band EP" });

  // Ana makes Ben a member who can add; Ben still cannot pass that on to his bot.
  await ana.issueGrant({ grantee: benId, capability: "kernel.read", scope: world.scope });
  await ana.issueGrant({ grantee: benId, capability: "world.entity.write", scope: world.scope });
  await assert.rejects(setBotAccess(ben, { scope: world.scope, botAgentId: benBot, access: "add" }, "ben-tries"), (e: unknown) => e instanceof KernelError && e.name === "forbidden");
  assert.equal((await call(ben, "add_to_world", { world_id: WORLD, title: "Lyrics", body: "Verse one." })).isError, true);

  // Ana, the owner, lets Ben's bot in; Ben's assistant now sees and adds to Ana's World as Rex.
  await setBotAccess(ana, { scope: world.scope, botAgentId: benBot, access: "add" }, "ana-lets-rex-in");
  const listed = (await call(ben, "list_worlds")).structuredContent as { worlds: { world_id: string; bot_access: string }[] };
  assert.deepEqual(listed.worlds.find((w) => w.world_id === WORLD)?.bot_access, "add");
  const added = await call(ben, "add_to_world", { world_id: WORLD, title: "Lyrics", body: "Verse one." });
  assert.equal(added.isError, undefined, added.content[0].text);
  const last = (await ana.readEvents(world.scope, { newestFirst: true, limit: 1 }))[0];
  assert.deepEqual([last.actor_id, last.on_behalf_of], [benBot, benId], "Ana's history shows Ben's bot, acting for Ben");

  // A read-only connection never writes to a World.
  await approveConnection(ben, benId, benBot, { clientId: CLAUDE, clientName: "ChatGPT", mode: "read" }, "ben-read-only");
  assert.match((await call(ben, "add_to_world", { world_id: WORLD, title: "More", body: "x" })).content[0].text, /read only/);
});

