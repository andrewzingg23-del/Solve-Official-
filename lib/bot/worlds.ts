// Where the master bot may work. A person lets their bot into a World; from then on, whichever
// assistant they connected can read that World and add to it as the bot. Access is nothing but
// kernel grants on the World's scope, issued by someone who holds them (the World's owner) to the
// bot's agent, for 30 days at a time:
//   read  kernel.read
//   add   kernel.read + world.entity.write
// A person can also start a new World from their assistant. The World is theirs: it is created
// with their own sign-in, because an agent can never claim a scope, and their bot is let in to add.
// The World itself (its entities, canvas and history) is Codex's lib/world/creative.ts; this file
// only decides who the bot is and what it was let into.
import type { Kernel } from "@/lib/kernel/client";
import { createCreativeArtifact, createCreativeWorld, listCreativeWorlds, loadCreativeWorld, updateCreativeArtifact, type CreativeWorld } from "@/lib/world/creative";
import { cleanText } from "./memory";

export type WorldAccess = "none" | "read" | "add";
export const ACCESS_CAPABILITIES: Record<Exclude<WorldAccess, "none">, readonly string[]> = {
  read: ["kernel.read"],
  add: ["kernel.read", "world.entity.write"],
};
export const ACCESS_DAYS = 30;
export const WORLD_LIMITS = { title: 160, body: 7000, perPerson: 50 } as const;

export type BotGrant = { id: string; capability: string; scope: string; expiresAt: string | null };
export type WorldWithAccess = CreativeWorld & { access: WorldAccess; url: string };

export const worldScope = (worldId: string) => `world:${worldId}`;
export const worldUrl = (appUrl: string, worldId: string) => `${appUrl}/world/${worldId}`;

export function accessFrom(grants: Pick<BotGrant, "capability">[]): WorldAccess {
  const caps = new Set(grants.map((g) => g.capability));
  if (!caps.has("kernel.read")) return "none";
  return caps.has("world.entity.write") ? "add" : "read";
}

// The bot's active grants in one World, read from the World's own history (issued, minus revoked,
// minus expired), so the owner can see them without acting as the bot.
export async function botGrantsIn(kernel: Kernel, scope: string, botAgentId: string, now = new Date()): Promise<BotGrant[]> {
  const issued = new Map<string, BotGrant>();
  const revoked = new Set<string>();
  let afterSeq = 0;
  for (let page = 0; page < 20; page++) {
    const events = await kernel.readEvents(scope, { afterSeq, limit: 500 });
    for (const e of events) {
      const p = e.payload as Record<string, unknown>;
      if (e.type === "kernel.grant.issued" && p.grantee_id === botAgentId && p.scope === scope) {
        issued.set(String(p.grant_id), { id: String(p.grant_id), capability: String(p.capability), scope, expiresAt: typeof p.expires_at === "string" ? p.expires_at : null });
      }
      if (e.type === "kernel.grant.revoked") revoked.add(String(p.grant_id));
    }
    if (events.length < 500) break;
    afterSeq = events.at(-1)!.seq;
  }
  return [...issued.values()].filter((g) => !revoked.has(g.id) && (!g.expiresAt || Date.parse(g.expiresAt) > now.getTime()));
}

// Lets the bot into a World at the given level, or takes it out ("none"). Only grants the person
// holds can be passed on, so in practice only a World's owner can let bots in; the kernel refuses
// anyone else. Returns the access the bot now has.
export async function setBotAccess(
  person: Kernel,
  input: { scope: string; botAgentId: string; access: WorldAccess },
  requestId: string,
  now = new Date(),
): Promise<WorldAccess> {
  const current = await botGrantsIn(person, input.scope, input.botAgentId, now);
  const wanted = new Set(input.access === "none" ? [] : ACCESS_CAPABILITIES[input.access]);
  for (const g of current.filter((g) => !wanted.has(g.capability))) {
    await person.revokeGrant(g.id, "taken out of this World by its owner", `bot-world-out:${requestId}:${g.id}`.slice(0, 200));
  }
  const held = new Set(current.map((g) => g.capability));
  const expiresAt = new Date(now.getTime() + ACCESS_DAYS * 86_400_000);
  for (const capability of [...wanted].filter((c) => !held.has(c))) {
    await person.issueGrant({ grantee: input.botAgentId, capability, scope: input.scope, expiresAt, idempotencyKey: `bot-world-in:${requestId}:${capability}`.slice(0, 200) });
  }
  return input.access;
}

// The person's Worlds, each with what their bot may do there. For the person's own view (/bot).
export async function worldsForBot(person: Kernel, botAgentId: string, appUrl = ""): Promise<WorldWithAccess[]> {
  const worlds = await listCreativeWorlds(person);
  return Promise.all(
    worlds.map(async (w) => ({ ...w, access: accessFrom(await botGrantsIn(person, w.scope, botAgentId).catch(() => [])), url: worldUrl(appUrl, w.worldId) })),
  );
}

// What a connected assistant sees: the Worlds the person can see and the Worlds the bot was let
// into (someone else's included), with the bot's access from its own grants.
export async function worldsForAssistant(person: Kernel, bot: Kernel, appUrl: string): Promise<WorldWithAccess[]> {
  const [mine, botGrants, botWorlds] = await Promise.all([listCreativeWorlds(person), bot.myGrants(), listCreativeWorlds(bot)]);
  const byId = new Map<string, CreativeWorld>();
  for (const w of [...mine, ...botWorlds]) byId.set(w.worldId, w);
  return [...byId.values()]
    .map((w) => ({ ...w, access: accessFrom(botGrants.filter((g) => g.scope === w.scope)), url: worldUrl(appUrl, w.worldId) }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

// Starts a private World for a goal, as the person, and lets their bot in to add. A retried call
// (same title within the hour) returns the World it already made.
export async function startWorld(
  person: Kernel,
  botAgentId: string,
  input: { title: unknown },
  { now = new Date(), newId = () => crypto.randomUUID() }: { now?: Date; newId?: () => string } = {},
): Promise<{ world: CreativeWorld; existing: boolean }> {
  const title = cleanText(input.title, WORLD_LIMITS.title);
  if (!title) throw new WorldInputError("a World needs a title");
  const worlds = await listCreativeWorlds(person);
  const same = worlds.find((w) => w.title.toLowerCase() === title.toLowerCase() && now.getTime() - Date.parse(w.updatedAt) < 3_600_000);
  if (same) return { world: same, existing: true };
  if (worlds.length >= WORLD_LIMITS.perPerson) throw new WorldInputError(`this person already has ${WORLD_LIMITS.perPerson} Worlds`);
  const world = await createCreativeWorld(person, { worldId: newId(), title });
  await setBotAccess(person, { scope: world.scope, botAgentId, access: "add" }, `start:${world.worldId}`, now);
  return { world, existing: false };
}

// Reads a World as the bot: only what the bot was let into, private entities withheld by the kernel.
export async function readWorldAsBot(bot: Kernel, worldId: string) {
  return loadCreativeWorld(bot, worldId);
}

// A spot on the canvas from the request itself, so a retried call writes exactly the same piece.
function spotFor(requestId: string) {
  let h = 2166136261;
  for (let i = 0; i < requestId.length; i++) h = Math.imul(h ^ requestId.charCodeAt(i), 16777619) >>> 0;
  return { x: 8 + (h % 84), y: 10 + ((h >>> 8) % 80) };
}

// Adds a text piece to a World as the bot, or revises one. The request id makes a retried call one
// change, not two.
export async function addToWorld(
  bot: Kernel,
  input: { worldId: string; title: unknown; body: unknown; artifactId?: string | null },
  requestId: string,
): Promise<{ entityId: string; revised: boolean }> {
  const title = cleanText(input.title, WORLD_LIMITS.title);
  const body = typeof input.body === "string" ? cleanText(input.body, WORLD_LIMITS.body) : "";
  if (!title) throw new WorldInputError("a piece needs a title");
  const { world, artifacts } = await loadCreativeWorld(bot, input.worldId);
  if (input.artifactId) {
    const existing = artifacts.find((a) => a.entityId === input.artifactId);
    if (!existing) throw new WorldInputError("no such piece in this World");
    const entityId = await updateCreativeArtifact(bot, { scope: world.scope, entityId: existing.entityId, requestId, title, body, position: existing.position });
    return { entityId, revised: true };
  }
  const entityId = await createCreativeArtifact(bot, { scope: world.scope, worldEntityId: world.entityId, requestId, title, body, position: spotFor(requestId) });
  return { entityId, revised: false };
}

export class WorldInputError extends Error {}
