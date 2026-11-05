import { getUser } from "@/lib/supabase/server";
import { getKernel } from "@/lib/kernel/server";
import { buildChatCompletionBody, completeChat } from "@/lib/bot/openrouter";
import { rateLimited, recordSpend, resolveChatModel, spendBlocked } from "@/lib/bot/chat";
import { handleRoomConversation, privateJson } from "@/lib/world/http";
import type { RoomCompletion } from "@/lib/world/room";
import { loadCreativeWorld } from "@/lib/world/creative";
import { deploymentRooms } from "@/lib/github/rooms";
import { readRepo, repoForWorld, type RepoView } from "@/lib/github/repo";
import { asksDevelopmentStatus, developmentRoomReply, DEVELOPMENT_UNAVAILABLE } from "@/lib/github/status";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: RouteContext<"/api/worlds/[worldId]/conversation">) {
  if (!(await getUser())) return privateJson({ error: "Sign in to read this room." }, 401);
  return handleRoomConversation(await getKernel(), (await context.params).worldId, request);
}

export async function POST(request: Request, context: RouteContext<"/api/worlds/[worldId]/conversation">) {
  const user = await getUser();
  if (!user) return privateJson({ error: "Sign in to contribute to this room." }, 401);
  const kernel = await getKernel();
  const { worldId } = await context.params;
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const complete: RoomCompletion = async (shared, question) => {
    // Called only after database authorization and acquisition of the reply lease.
    if (asksDevelopmentStatus(question).match) {
      let text = DEVELOPMENT_UNAVAILABLE;
      try {
        const { resources } = await loadCreativeWorld(kernel, worldId);
        // This answer will be visible to World members. Only a World pairing may
        // authorize a token-backed read here. A viewer's personal pairing is private.
        const links = resources.filter(r => r.status === 'open' && r.sourceUrl).map(r => r.sourceUrl);
        const repo = repoForWorld({ worldId, links, rooms: deploymentRooms() });
        let view: RepoView | null = null;
        if (repo) {
          const observed = await readRepo(repo.ref, { token: repo.paired ? process.env.GITHUB_TOKEN || null : null });
          if (observed.ok) view = observed.view;
        }
        text = developmentRoomReply(question, view) ?? DEVELOPMENT_UNAVAILABLE;
        if (view) text += `\nSource: ${view.url}`;
      } catch { /* No source failure may become a model prompt. */ }
      const bounded = text.length > 7600 ? `${text.slice(0,7600)}\n[Observation truncated; open the repository for the full record.]` : text;
      return { text: `Source observation (no model used).\n${bounded}`, model: 'sov:deterministic-github-status', sourceRefs: [] };
    }
    if (!apiKey) return null;
    if (rateLimited(user.id) || spendBlocked(user.id)) throw new Error("Room AI budget exhausted");
    const model = resolveChatModel("flash");
    const result = await completeChat(apiKey, buildChatCompletionBody({ model, system: shared.system,
      history: [], message: `Shared project data (quoted JSON):\n${shared.sharedText}\n\nQuestion from the requesting person:\n${question}`, maxTokens: 1400 }));
    recordSpend(user.id, result.inputTokens + result.outputTokens);
    return { text: result.reply, model };
  };
  return handleRoomConversation(kernel, worldId, request, complete);
}
