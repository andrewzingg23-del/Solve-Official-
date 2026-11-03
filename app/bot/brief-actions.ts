"use server";

import { readProvider } from "@/lib/ai/provider";
import { buildChatCompletionBody, completeChat } from "@/lib/bot/openrouter";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { buildBriefPrompt, readBrief, writeBrief, BRIEF_TTL_MS, type Brief } from "@/lib/bot/brief";
import { loadBot } from "@/lib/bot/store";
import { waitingOn } from "@/lib/bot/waiting";
import { worldsForBot } from "@/lib/bot/worlds";

export async function getBrief(): Promise<Brief | null> {
  const user = await getUser();
  if (!user) return null;
  const kernel = await getKernel();
  const bot = await loadBot(kernel);
  if (!bot.avatar) return null;
  const ownerId = bot.ownerId;

  const cached = await readBrief(kernel, ownerId);
  if (cached) return cached;

  const provider = await readProvider(kernel);
  if (!provider) return null;

  // Gather what's real: waiting items, world list. Keep it small and fast.
  const worlds = await worldsForBot(kernel, ownerId).catch(() => []);
  const worldRefs = worlds.slice(0, 10).map((w) => ({ worldId: w.worldId, title: w.title, scope: w.scope }));
  const waiting = await waitingOn(kernel, worldRefs, ownerId).catch(() => []);

  const prompt = buildBriefPrompt({
    botName: bot.persona.name,
    waiting: waiting.slice(0, 8).map((w) => ({ kind: w.kind, ask: w.ask, worldTitle: w.worldTitle })),
    newMemories: 0, // v1: waiting + worlds carry the brief; memory deltas follow.
    recentWorlds: worldRefs.map((w) => ({ title: w.title, activity: "Open for review." })),
  });

  try {
    const res = await completeChat(provider.apiKey, buildChatCompletionBody({
      model: provider.model,
      maxTokens: 512,
      history: [],
      system: "Write a concise, grounded brief from the supplied project records. Never invent activity.",
      message: prompt,
    }));
    const brief = res.reply;
    if (!brief) return null;
    await writeBrief(kernel, ownerId, brief);
    return { text: brief, at: new Date().toISOString() };
  } catch {
    return null;
  }
}

export const BRIEF_TTL = BRIEF_TTL_MS;
