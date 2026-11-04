import { getUser } from "@/lib/supabase/server";
import { getKernel } from "@/lib/kernel/server";
import { completeRoomAgent, listRoomAgents } from "@/lib/world/agent-models";
import { rateLimited, recordSpend, spendBlocked } from "@/lib/bot/chat";
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
  // A model picker is not a tool grant. The World kernel still authenticates
  // and authorizes the caller before sharing any World context with a model.
  const complete: RoomCompletion | undefined = listRoomAgents().some(a => a.configured)
    ? async (shared, question, agentId) => {
      if (rateLimited(user.id) || spendBlocked(user.id)) throw new Error("Room AI budget exhausted");
      const result = await completeRoomAgent(agentId || "solve", shared, question);
      recordSpend(user.id, result.inputTokens + result.outputTokens);
      return { text: result.reply, model: result.model };
    }
    : undefined;
  return handleRoomConversation(await getKernel(), (await context.params).worldId, request, complete);
}
