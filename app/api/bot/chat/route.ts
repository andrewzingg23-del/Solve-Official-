// The room's talking bot, server side. Signed-in people only (it costs money);
// the key never reaches a browser. Conversational only — it never acts.
// Chat pipe: plain fetch to OpenRouter (Drew's order 2026-10-06:
// "switch anthropic with open router"). Response contract is full JSON —
// the Talk panel reads data.reply via res.json(); keep it that way.
import { getUser } from "@/lib/supabase/server";
import { isInstagramStyleRequest, instagramHandleInRequest } from "@/lib/product/instagram-style";
import { loginRequired } from "@/lib/auth/gate";
import { getBotSoul } from "@/lib/bot/soul";
import { agentSpaceBrief } from "@/lib/product/personal-space";
import { getKernel } from "@/lib/kernel/server";
import { passportContext } from "@/lib/passport/context";
import { classifyTurn, WAY_REQUESTED, talkScope } from "@/lib/bot/intent";
import { planVenture, type RoutePlan } from "@/lib/world/wayfinder";
import { asksDevelopmentStatus, developmentRoomReply } from "@/lib/github/status";
import { deployedView } from "@/lib/github/deployed";
import { readRepo, repoForViewer, roomRepos, type RepoView } from "@/lib/github/repo";
import {
  OPENROUTER_MISSING_KEY_ERROR,
  buildChatCompletionBody,
  completeChat,
} from "@/lib/bot/openrouter";
import {
  buildChatSystemPrompt,
  estimateCostUsd,
  packSystemPrompt,
  parseTier,
  rateLimited,
  recordSpend,
  resolveChatModel,
  spendBlocked,
  tokensSpentThisHour,
  validateChatBody,
  type ChatTier,
} from "@/lib/bot/chat";

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

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

  // Capability routing is deterministic and does not spend tokens on a fictional action.
  // A real provider search happens only in the authorized personalization workflow.
  if (isInstagramStyleRequest(chat.message)) {
    const requestedHandle = instagramHandleInRequest(chat.message);
    const href = "/personalize/instagram" + (requestedHandle ? "?profile=" + encodeURIComponent(requestedHandle) : "");
    return json({
      reply: "I can search public Instagram evidence and help you preview a personal SOLVE look. Open the Instagram personalization workflow to choose the profile and review what is actually found. Private posts need authorized access.",
      source: "instagram-personalization",
      action: { kind: "navigate", href, label: "Personalize from Instagram" }
    });
  }

  // Development Room: a dev-status question ("what is Claude working on?") is answered
  // deterministically from connected GitHub/CI evidence — never the LLM, never fabricated,
  // and works even without a chat provider key. Falls through to normal chat on anything else.
  if (asksDevelopmentStatus(chat.message).match) {
    try {
      const paired = repoForViewer(user?.email ?? null, roomRepos(process.env.GITHUB_ROOMS));
      let view: RepoView | null = null;
      if (paired) {
        const r = await readRepo(paired, { token: process.env.GITHUB_TOKEN || null });
        if (r.ok) view = r.view;
      }
      if (!view) {
        const [owner, repo] = (process.env.SOLVE_DEPLOYED_REPO ?? "").split("/");
        if (owner && repo) view = deployedView({ owner, repo, trunk: process.env.SOLVE_DEPLOYED_REF ?? null });
      }
      const devReply = developmentRoomReply(chat.message, view);
      if (devReply) return json({ reply: devReply, source: "development-room" });
    } catch {
      // Never let the Development Room path break normal chat.
    }
  }

  if (spendBlocked(limiterKey))
    return json({ error: "Hourly token budget spent — back in a bit." }, 429);

  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return json({ error: OPENROUTER_MISSING_KEY_ERROR }, 503);

  const model = resolveChatModel(tier);

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
    // Their SOV Passport, when they connected it: who they are and what they're working on.
    let passport = "";
    if (user) {
      try {
        const kernel = await getKernel();
        const me = await kernel.whoami();
        passport = await passportContext(kernel, me.actor_id, chat.message);
      } catch {
        // The passport is context; the conversation goes on without it.
      }
    }
    // Pack the system prompt into a fixed token budget so a rich soul.md or a
    // big passport can never blow the context or run up the cost. The bot's
    // rules are always kept; soul, then passport fill what's left (lib/ai/context.ts).
    const personalBrief = user ? agentSpaceBrief(user.user_metadata?.sov_personal_space) : "";
    const system = packSystemPrompt({ rules: buildChatSystemPrompt(chat.botName), soul, projectBrief: personalBrief, passport }).text;
    const completion = await completeChat(
      apiKey,
      buildChatCompletionBody({ model, system, history: chat.history, message: chat.message }),
    );
    recordSpend(limiterKey, completion.inputTokens + completion.outputTokens);
    return json({
      reply: completion.reply,
      wayEventId,
      wayPlan,
      usage: {
        model,
        tier,
        inputTokens: completion.inputTokens,
        outputTokens: completion.outputTokens,
        estimatedCostUsd: estimateCostUsd(model, completion.inputTokens, completion.outputTokens),
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
