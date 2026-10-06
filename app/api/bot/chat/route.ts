// The room's talking bot, server side. Signed-in people only (it costs money);
// the key never reaches a browser. Conversational only — it never acts.
import Anthropic from "@anthropic-ai/sdk";
import { getUser } from "@/lib/supabase/server";
import { loginRequired } from "@/lib/auth/gate";
import { getBotSoul } from "@/lib/bot/soul";
import { getKernel } from "@/lib/kernel/server";
import { classifyTurn, WAY_REQUESTED, talkScope } from "@/lib/bot/intent";
import { planVenture, type RoutePlan } from "@/lib/world/wayfinder";
import {
  buildChatSystemPrompt,
  estimateCostUsd,
  parseTier,
  pickChatModel,
  rateLimited,
  recordSpend,
  spendBlocked,
  tokensSpentThisHour,
  validateChatBody,
  type ChatTier,
} from "@/lib/bot/chat";

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

// The account's chat models, resolved once per deployment from the model list.
let cachedIds: string[] | null | undefined;
async function modelIds(apiKey: string): Promise<string[] | null> {
  const envModel = process.env.CHAT_MODEL?.trim();
  if (envModel) return [envModel];
  if (cachedIds !== undefined) return cachedIds;
  try {
    const res = await fetch("https://api.anthropic.com/v1/models", {
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      cachedIds = null;
      return null;
    }
    const data = (await res.json()) as { data?: { id?: string }[] };
    const ids = (data.data ?? [])
      .map((m) => (typeof m.id === "string" ? m.id : ""))
      .filter(Boolean);
    cachedIds = ids.length ? ids : null;
    return cachedIds;
  } catch {
    cachedIds = null;
    return null;
  }
}

export async function POST(request: Request) {
  const user = await getUser().catch(() => null);
  // Gate off: guests may talk, limited by IP so the key isn't an open wallet.
  if (!user && loginRequired())
    return json({ error: "Sign in to talk to your bot." }, 401);
  const limiterKey = user?.id ?? `guest:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"}`;
  if (rateLimited(limiterKey))
    return json({ error: "Slow down — 30 messages an hour keeps the lights on." }, 429);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Send a valid JSON request." }, 400);
  }
  // Tier routing happens before validation so a "smart:" prefix never
  // reaches the model or counts against the message length limit.
  const rawMessage =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>).message
      : undefined;
  const { tier, message: tieredMessage }: { tier: ChatTier; message: string } =
    typeof rawMessage === "string" ? parseTier(rawMessage) : { tier: "flash" as ChatTier, message: "" };
  const chat = validateChatBody({ ...(body as object), message: tieredMessage });
  if (!chat) return json({ error: "Send a message, your bot's name, and up to 20 history items." }, 422);

  if (spendBlocked(limiterKey))
    return json({ error: "Hourly token budget spent — back in a bit." }, 429);

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return json({ error: "The chat model is not configured on this deployment." }, 503);

  const ids = await modelIds(apiKey);
  const model = ids ? pickChatModel(ids, tier) : null;
  if (!model) return json({ error: "No chat model is available right now." }, 503);

  const client = new Anthropic({ apiKey });
  // The Inside loop, first half: when the person asks for a way (not small
  // talk), their ask goes on the kernel record before the bot answers.
  // Speech in → kernel gates and records. The world's live update renders
  // off this event (redesign slice); the record is this slice.
  let wayEventId: string | null = null;
  let wayPlan: RoutePlan | null = null;
  const intent = classifyTurn(chat.message);
  if (intent.kind === "way") {
    // A way-plan is derived from the planner, not invented prose: every
    // number it carries is an estimate, labelled as one.
    try {
      const leastCapital =
        /least|minim|low|little|cheap|lean|without much|capital/.test(intent.goal.toLowerCase());
      wayPlan = planVenture(intent.goal, leastCapital);
    } catch {
      wayPlan = null;
    }
    try {
      const kernel = await getKernel();
      const me = await kernel.whoami().catch(() => null);
      if (me) {
        wayEventId = await kernel
          .recordEvent({
            type: WAY_REQUESTED,
            scope: talkScope(me.actor_id),
            payload: { goal: intent.goal, at: new Date().toISOString() },
          })
          .catch(() => null);
      }
    } catch {
      // Recording must never break the conversation.
    }
  }
  try {
    // The user's soul.md shapes the voice — read fresh each turn.
    const soul = user ? getBotSoul({ user_metadata: (user as { user_metadata?: Record<string, unknown> }).user_metadata }) : "";
    const system = soul
      ? `${buildChatSystemPrompt(chat.botName)}\nThe person's soul.md for you (their words, honor them):\n${soul}`
      : buildChatSystemPrompt(chat.botName);
    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      system,
      messages: [
        ...chat.history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user" as const, content: chat.message },
      ],
    });
    const text = response.content.find((b) => b.type === "text");
    const reply = text?.type === "text" ? text.text.trim() : "";
    if (!reply) return json({ error: "The bot had nothing to say. Try again." }, 502);
    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;
    recordSpend(limiterKey, inputTokens + outputTokens);
    return json({
      reply,
      wayEventId,
      wayPlan,
      usage: {
        model,
        tier,
        inputTokens,
        outputTokens,
        estimatedCostUsd: estimateCostUsd(model, inputTokens, outputTokens),
        tokensSpentThisHour: tokensSpentThisHour(limiterKey),
      },
    });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message.slice(0, 200) : "The chat call failed." },
      502,
    );
  }
}
