// Where the master bot may work. A person lets their bot into a World; from then on, whichever
// assistant they connected can read that World and add to it as the bot. Access is nothing but
// kernel grants on the World's scope, issued by someone who holds them (the World's owner) to the
// bot's agent, for 30 days at a time:
//   read  kernel.read
//   add   kernel.read + world.entity.write + kernel.evidence.attach (proof, lib/bot/proof.ts)
// A connected app can't create a World: its token can change nothing (20261110080000), and an agent
// can never claim a scope. The person starts one in Solve and lets their AI in from it.
// The World itself (its entities, canvas and history) is Codex's lib/world/creative.ts; this file
// only decides who the bot is and what it was let into.
import type { Kernel } from "@/lib/kernel/client";

export type WorldAccess = "none" | "read" | "add";
export const ACCESS_CAPABILITIES: Record<Exclude<WorldAccess, "none">, readonly string[]> = {
  read: ["kernel.read"],
  add: ["kernel.read", "world.entity.write", "kernel.evidence.attach", "task.create"],
};
export const ACCESS_DAYS = 30;

export type BotGrant = { id: string; capability: string; scope: string; expiresAt: string | null };

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
