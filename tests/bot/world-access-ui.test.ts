import assert from "node:assert/strict";
import { it } from "node:test";
import { kernelClient, KernelError } from "../../lib/kernel/client";
import { localSupabase } from "../../lib/kernel/local";
import { saveBot } from "../../lib/bot/store";
import { createCreativeWorld } from "../../lib/world/creative";
import { setWorldBotAccess, listWorldBotAccess } from "../../lib/world/bot-access";
import { formatWorldActorAttribution } from "../../lib/world/attribution";
import type { ActorProfile } from "../../lib/kernel/client";
import { createKernelDb, user } from "../kernel/harness";

const WORLD_ID = "00000000-0000-4000-8000-000000000421";

async function setup() {
  const db = await createKernelDb();
  const owner = kernelClient(localSupabase(db, user("auth:world-access-owner")));
  const brother = kernelClient(localSupabase(db, user("auth:world-access-brother")));
  const ownerId = await owner.register("Owner");
  const brotherId = await brother.register("Ben");
  const bot = await saveBot(brother, { name: "Rex" }, "world-access-bot-persona");
  const world = await createCreativeWorld(owner, { worldId: WORLD_ID, title: "Mom's 60th" });
  return { owner, brother, ownerId, brotherId, botId: bot.avatar!.agent_id, world };
}

it("lets a World owner invite another person's named bot and remove its access", async () => {
  const { owner, brother, brotherId, botId, world } = await setup();

  await assert.rejects(
    setWorldBotAccess(owner, { worldId: WORLD_ID, botAgentId: brotherId, access: "read", requestId: "human-is-not-a-bot" }),
    (error: unknown) => error instanceof KernelError && error.name === "invalid",
  );

  const invited = await setWorldBotAccess(owner, {
    worldId: WORLD_ID, botAgentId: botId, access: "add", requestId: "world-bot-invite-1",
  });
  assert.deepEqual(
    [invited.botName, invited.ownerName, invited.access],
    ["Rex", "Ben", "add"],
  );
  assert.deepEqual(
    (await listWorldBotAccess(owner, WORLD_ID)).map((bot) => [bot.botAgentId, bot.botName, bot.ownerName, bot.access]),
    [[botId, "Rex", "Ben", "add"]],
  );

  await owner.issueGrant({ grantee: brotherId, capability: "kernel.read", scope: world.scope });
  await owner.issueGrant({ grantee: brotherId, capability: "world.entity.write", scope: world.scope });
  await assert.rejects(
    setWorldBotAccess(brother, { worldId: WORLD_ID, botAgentId: botId, access: "add", requestId: "member-cannot-delegate" }),
    (error: unknown) => error instanceof KernelError && error.name === "forbidden",
  );

  await setWorldBotAccess(owner, {
    worldId: WORLD_ID, botAgentId: botId, access: "none", requestId: "world-bot-remove-1",
  });
  assert.deepEqual(await listWorldBotAccess(owner, WORLD_ID), []);
});

it("labels a bot's World history entry with the bot name and its owner", () => {
  const botId = "00000000-0000-4000-8000-000000000431";
  const ownerId = "00000000-0000-4000-8000-000000000432";
  const bot: ActorProfile = {
    actor_id: botId,
    kind: "agent",
    label: "Rex",
    owner_id: ownerId,
    accountable_party: ownerId,
    role: "ai_companion",
  };
  const labels = new Map([[botId, "Rex"], [ownerId, "Ben"]]);
  assert.equal(
    formatWorldActorAttribution(botId, new Map([[botId, bot]]), labels),
    "Rex · bot for Ben",
  );
});
