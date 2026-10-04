// The master bot in the kernel. The bot is the person's AI-companion avatar (an agent they own);
// its persona is a versioned record the person keeps in their own scope. Nothing here needs a
// migration: persona saves are `bot.persona.set` events in `actor:<owner>/bot:persona`, which the
// person's own authority covers and the bot's default read grant can see.
import type { Avatar, Kernel } from "@/lib/kernel/client";
import { DEFAULT_PERSONA, validatePersona, type Persona } from "./persona";

export const PERSONA_SET = "bot.persona.set";
export const personaScope = (ownerId: string) => `actor:${ownerId}/bot:persona`;

export type PersonaVersion = { seq: number; at: string; name: string };

export type Bot = {
  ownerId: string;
  ownerLabel: string;
  // The kernel avatar, once the bot has been saved at least once.
  avatar: Avatar | null;
  persona: Persona;
  saved: PersonaVersion | null;
  history: PersonaVersion[];
};

// The person's master bot: their AI companion (one per person, by the kernel's rule).
export const companionOf = (avatars: Avatar[]) => avatars.find((a) => a.avatar_type === "ai_companion") ?? null;

// Reads the bot as its owner sees it, or as the bot itself (an agent session reading its owner).
export async function readPersona(kernel: Kernel, ownerId: string, fallbackName?: string) {
  const events = await kernel.readEvents(personaScope(ownerId), { newestFirst: true, limit: 100 });
  const saves = events.filter((e) => e.type === PERSONA_SET);
  const history = saves.map((e) => ({
    seq: e.seq,
    at: e.occurred_at,
    name: validatePersona((e.payload as { persona?: unknown }).persona).name,
  }));
  const latest = saves[0];
  const base = fallbackName ? { ...DEFAULT_PERSONA, name: fallbackName } : DEFAULT_PERSONA;
  return {
    persona: latest ? validatePersona((latest.payload as { persona?: unknown }).persona, base) : base,
    saved: history[0] ?? null,
    history,
  };
}

export async function loadBot(kernel: Kernel): Promise<Bot> {
  const me = await kernel.whoami();
  const avatar = companionOf(await kernel.myAvatars());
  const { persona, saved, history } = await readPersona(kernel, me.actor_id, avatar?.name);
  return { ownerId: me.actor_id, ownerLabel: me.label, avatar, persona, saved, history };
}

// Saves a persona as the signed-in person. The first save creates the companion avatar (and so the
// bot's agent, which starts able only to observe its owner's own scope). `requestId` makes a retry
// of the same save return the same record instead of writing a second version.
export async function saveBot(kernel: Kernel, input: unknown, requestId: string): Promise<Bot> {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(requestId)) throw new Error("a save needs a request id");
  const me = await kernel.whoami();
  const existing = companionOf(await kernel.myAvatars());
  const current = await readPersona(kernel, me.actor_id, existing?.name);
  const persona = validatePersona(input, current.persona);
  let avatar = existing;
  if (!avatar) {
    await kernel.createAvatar({
      type: "ai_companion",
      name: persona.name,
      relationship: persona.relationship,
      seed: { body: persona.body, palette: persona.palette },
      representation: persona.body === "pixel" ? "pixel" : "stylized_3d",
    });
    avatar = companionOf(await kernel.myAvatars());
  }
  await kernel.recordEvent({
    type: PERSONA_SET,
    scope: personaScope(me.actor_id),
    payload: { persona, avatar_id: avatar?.avatar_id ?? null },
    idempotencyKey: `bot-persona:${requestId}`,
  });
  return loadBot(kernel);
}
