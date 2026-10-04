import { KernelError, type Kernel, type KernelEvent } from "@/lib/kernel/client";
import { setBotAccess, type WorldAccess } from "@/lib/bot/worlds";
import { loadCreativeWorld } from "@/lib/world/creative";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BOT_CAPABILITIES = ["kernel.read", "world.entity.write"] as const;

export type WorldBotAccess = {
  botAgentId: string;
  botName: string;
  ownerActorId: string;
  ownerName: string;
  access: WorldAccess;
  expiresAt: string | null;
};

function worldId(value: string) {
  if (!UUID.test(value)) throw new KernelError("invalid", "World id must be a UUID", "");
  return value.toLowerCase();
}

function actorId(value: string) {
  if (!UUID.test(value)) throw new KernelError("invalid", "Bot SOV ID must be a UUID", "");
  return value.toLowerCase();
}

async function requireWorldOwner(kernel: Kernel, id: string) {
  const scope = `world:${id}`;
  const [actor, grants, events] = await Promise.all([
    kernel.whoami(),
    kernel.myGrants(),
    kernel.readEvents(scope, { limit: 1 }),
  ]);
  const ownsScope = grants.some((grant) => grant.scope === scope && grant.capability === "*");
  const claim = events.find((event) => event.type === "kernel.scope.claimed");
  if (!ownsScope || claim?.actor_id !== actor.actor_id) {
    throw new KernelError("forbidden", "Only the World owner can manage bot access", "");
  }
  const loaded = await loadCreativeWorld(kernel, id);
  return { actorId: actor.actor_id, scope, world: loaded.world };
}

type ActiveGrant = { botAgentId: string; grantId: string; capability: string; expiresAt: string | null };

async function activeGrants(kernel: Kernel, scope: string, ownerActorId: string, now: Date): Promise<ActiveGrant[]> {
  const issued = new Map<string, ActiveGrant>();
  let afterSeq = 0;
  for (let page = 0; page < 20; page++) {
    const events: KernelEvent[] = await kernel.readEvents(scope, { afterSeq, limit: 500 });
    for (const event of events) {
      const payload = event.payload;
      if (
        event.type === "kernel.grant.issued" &&
        event.actor_id === ownerActorId &&
        payload.scope === scope &&
        typeof payload.grant_id === "string" &&
        typeof payload.grantee_id === "string" &&
        typeof payload.capability === "string" &&
        BOT_CAPABILITIES.includes(payload.capability as (typeof BOT_CAPABILITIES)[number])
      ) {
        issued.set(payload.grant_id, {
          botAgentId: payload.grantee_id,
          grantId: payload.grant_id,
          capability: payload.capability,
          expiresAt: typeof payload.expires_at === "string" ? payload.expires_at : null,
        });
      }
      if (event.type === "kernel.grant.revoked" && typeof payload.grant_id === "string") {
        issued.delete(payload.grant_id);
      }
    }
    if (events.length < 500) break;
    const lastSeq = events[events.length - 1].seq;
    if (lastSeq <= afterSeq) throw new KernelError("unavailable", "World history could not be read in order", "");
    afterSeq = lastSeq;
  }
  return [...issued.values()].filter((grant) =>
    !grant.expiresAt || (Number.isFinite(Date.parse(grant.expiresAt)) && Date.parse(grant.expiresAt) > now.getTime())
  );
}

export async function listWorldBotAccess(kernel: Kernel, rawWorldId: string, now = new Date()): Promise<WorldBotAccess[]> {
  const id = worldId(rawWorldId);
  const { actorId: ownerActorId, scope } = await requireWorldOwner(kernel, id);
  const grants = await activeGrants(kernel, scope, ownerActorId, now);
  const botIds = [...new Set(grants.map((grant) => grant.botAgentId))].slice(0, 500);
  if (!botIds.length) return [];

  const profiles = await kernel.readActors(botIds);
  const actors = new Map<string, (typeof profiles)[number]>();
  for (const profile of profiles) {
    if (profile.kind === "agent" && profile.accountable_party) actors.set(profile.actor_id, profile);
  }
  const ownerIds = [...new Set([...actors.values()].map((profile) => profile.accountable_party).filter((id): id is string => Boolean(id)))];
  const ownerProfiles = ownerIds.length ? await kernel.readActors(ownerIds) : [];
  const owners = new Map<string, string>();
  for (const profile of ownerProfiles) owners.set(profile.actor_id, profile.label);
  const byBot = new Map<string, ActiveGrant[]>();
  for (const grant of grants) {
    if (!actors.has(grant.botAgentId)) continue;
    const rows = byBot.get(grant.botAgentId) ?? [];
    rows.push(grant);
    byBot.set(grant.botAgentId, rows);
  }

  return [...actors.values()].flatMap((profile) => {
    const active = byBot.get(profile.actor_id) ?? [];
    const capabilities = new Set(active.map((grant) => grant.capability));
    if (!active.length) return [];
    const access: WorldAccess = capabilities.has("kernel.read")
      ? capabilities.has("world.entity.write") ? "add" : "read"
      : "none";
    const expiries = active.map((grant) => grant.expiresAt).filter((value): value is string => Boolean(value));
    return [{
      botAgentId: profile.actor_id,
      botName: profile.label || profile.actor_id.slice(0, 8),
      ownerActorId: profile.accountable_party!,
      ownerName: owners.get(profile.accountable_party!) || profile.accountable_party!.slice(0, 8),
      access,
      expiresAt: expiries.sort((a, b) => Date.parse(a) - Date.parse(b))[0] ?? null,
    }];
  }).sort((a, b) => a.botName.localeCompare(b.botName) || a.botAgentId.localeCompare(b.botAgentId));
}

export async function setWorldBotAccess(kernel: Kernel, input: {
  worldId: string;
  botAgentId: string;
  access: WorldAccess;
  requestId: string;
}): Promise<WorldBotAccess> {
  const id = worldId(input.worldId);
  const botId = actorId(input.botAgentId);
  const requestId = input.requestId.trim();
  if (input.access !== "none" && input.access !== "read" && input.access !== "add") {
    throw new KernelError("invalid", "Choose Out, Read or Add", "");
  }
  if (!requestId || requestId.length > 80) throw new KernelError("invalid", "A request id is required", "");

  const { scope } = await requireWorldOwner(kernel, id);
  const [profile] = await kernel.readActors([botId]);
  if (!profile || profile.kind !== "agent" || !profile.accountable_party) {
    throw new KernelError("invalid", "That SOV ID does not identify a registered bot", "");
  }

  await setBotAccess(kernel, { scope, botAgentId: botId, access: input.access }, requestId);
  if (input.access === "none") {
    return {
      botAgentId: botId,
      botName: profile.label || botId.slice(0, 8),
      ownerActorId: profile.accountable_party,
      ownerName: (await kernel.readActors([profile.accountable_party]))[0]?.label || profile.accountable_party.slice(0, 8),
      access: "none",
      expiresAt: null,
    };
  }
  const saved = (await listWorldBotAccess(kernel, id)).find((bot) => bot.botAgentId === botId);
  if (!saved) throw new KernelError("unavailable", "The bot access grant could not be read back", "");
  return saved;
}
