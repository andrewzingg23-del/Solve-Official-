// "What I already know about you": the avatar reads what the person and their other AIs told it
// and says back what matters, each line tied to the memories it came from (lib/bot/knowing.ts).
// Signed-in only, on the same message and token limits as Talk, and nothing is cached, so a
// forgotten memory can't live on in a summary.
import { getUser } from "@/lib/supabase/server";
import { getKernel } from "@/lib/kernel/server";
import { readAllMemories } from "@/lib/bot/memory";
import { buildKnowingPrompt, knowingMemories, KNOWING_LIMITS, parseKnowing } from "@/lib/bot/knowing";
import { OPENROUTER_MISSING_KEY_ERROR, buildChatCompletionBody, completeChat } from "@/lib/bot/openrouter";
import { estimateCostUsd, modelLabel, rateLimited, recordSpend, resolveChatModel, spendBlocked } from "@/lib/bot/chat";

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  const user = await getUser().catch(() => null);
  if (!user) return json({ error: "Sign in so your avatar can read what it knows about you." }, 401);
  if (rateLimited(user.id)) return json({ error: "Slow down — 30 asks an hour keeps the lights on." }, 429);
  if (spendBlocked(user.id)) return json({ error: "Hourly token budget spent — back in a bit." }, 429);
  let botName = "Your avatar";
  try {
    const body = (await request.json()) as { botName?: unknown };
    if (typeof body.botName === "string" && body.botName.trim()) botName = body.botName.trim().slice(0, 80);
  } catch {
    // A missing body is fine; the name is cosmetic.
  }
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return json({ error: OPENROUTER_MISSING_KEY_ERROR }, 503);

  let memories;
  try {
    const kernel = await getKernel();
    const me = await kernel.whoami();
    ({ memories } = await readAllMemories(kernel, me.actor_id, { maxEvents: 2000 }));
  } catch {
    return json({ error: "Your avatar's memory couldn't be read just now. Nothing was changed." }, 502);
  }
  if (memories.length < KNOWING_LIMITS.minMemories) return json({ facts: [], needMore: true, total: memories.length });

  const { system, user: prompt, ids } = buildKnowingPrompt(botName, knowingMemories(memories));
  const model = resolveChatModel("smart");
  try {
    const completion = await completeChat(apiKey, buildChatCompletionBody({ model, system, history: [], message: prompt, maxTokens: 900 }));
    recordSpend(user.id, completion.inputTokens + completion.outputTokens);
    return json({
      facts: parseKnowing(completion.reply, ids),
      read: ids.size,
      total: memories.length,
      usage: {
        model,
        modelLabel: modelLabel(model),
        inputTokens: completion.inputTokens,
        outputTokens: completion.outputTokens,
        estimatedCostUsd: estimateCostUsd(model, completion.inputTokens, completion.outputTokens),
      },
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message.slice(0, 200) : "Your avatar couldn't think just now." }, 502);
  }
}
