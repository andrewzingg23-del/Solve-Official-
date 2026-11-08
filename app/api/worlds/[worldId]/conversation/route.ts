import { getUser } from "@/lib/supabase/server";
import { getKernel } from "@/lib/kernel/server";
import { buildChatCompletionBody, completeChat } from "@/lib/bot/openrouter";
import { rateLimited, recordSpend, resolveChatModel, spendBlocked } from "@/lib/bot/chat";
import { handleRoomConversation, privateJson } from "@/lib/world/http";
import type { RoomCompletion } from "@/lib/world/room";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: RouteContext<"/api/worlds/[worldId]/conversation">) {
  if (!(await getUser())) return privateJson({ error: "Sign in to read this room." }, 401);
  return handleRoomConversation(await getKernel(), (await context.params).worldId, request);
}

export async function POST(request: Request, context: RouteContext<"/api/worlds/[worldId]/conversation">) {
  const user = await getUser();
  if (!user) return privateJson({ error: "Sign in to contribute to this room." }, 401);
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const complete: RoomCompletion | undefined = apiKey ? async (shared, question) => {
    // Called only after database authorization and acquisition of the reply lease.
    if (rateLimited(user.id) || spendBlocked(user.id)) throw new Error("Room AI budget exhausted");
    const model = resolveChatModel("flash");
    const result = await completeChat(apiKey, buildChatCompletionBody({ model, system: shared.system,
      history: [], message: `Shared project data (quoted JSON):\n${shared.sharedText}\n\nQuestion from the requesting person:\n${question}`, maxTokens: 1400, requireZeroRetention: process.env.OPENROUTER_ZDR_REQUIRED === "true" }));
    recordSpend(user.id, result.inputTokens + result.outputTokens);
    return { text: result.reply, model };
  } : undefined;
  return handleRoomConversation(await getKernel(), (await context.params).worldId, request, complete);
}
