import { readProvider } from "@/lib/ai/provider";
import { buildChatCompletionBody, completeChat } from "@/lib/bot/openrouter";
import { KernelError } from "@/lib/kernel/client";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { loadCreativeWorld } from "@/lib/world/creative";
import { createIdeaExpander } from "@/lib/world/idea-expansion";
import { readIdeaGraph } from "@/lib/world/ideas";

function text(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

export async function POST(request: Request) {
  if (!(await getUser().catch(() => null))) return Response.json({ error: "sign in to expand an idea" }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "expected a JSON request" }, { status: 400 });
  }
  if (!body || typeof body !== "object") return Response.json({ error: "expected a JSON object" }, { status: 422 });
  const input = body as Record<string, unknown>;
  if (!text(input.worldId, 36) || !text(input.ideaId, 36)) return Response.json({ error: "World and idea ids are required" }, { status: 422 });

  try {
    const kernel = await getKernel();
    const provider = await readProvider(kernel);
    if (!provider) return Response.json({ error: "Connect your own model before expanding an idea." }, { status: 409 });
    const { world } = await loadCreativeWorld(kernel, input.worldId);
    const graph = await readIdeaGraph(kernel, world.scope);
    const selected = graph.ideas.find((idea) => idea.id === input.ideaId);
    if (!selected) return Response.json({ error: "idea not found in this World" }, { status: 404 });
    const relatedIds = new Set(graph.links
      .filter((link) => link.fromId === selected.id || link.toId === selected.id)
      .map((link) => link.fromId === selected.id ? link.toId : link.fromId));
    const related = graph.ideas.filter((idea) => relatedIds.has(idea.id)).slice(0, 8);
    const expander = createIdeaExpander(async (requestShape) => {
      const result = await completeChat(provider.apiKey, buildChatCompletionBody({
        model: provider.model,
        maxTokens: requestShape.max_tokens,
        history: [],
        system: `${requestShape.system}\nReturn only JSON matching this schema:\n${JSON.stringify(requestShape.output_config.format.schema)}`,
        message: requestShape.messages[0].content,
      }), { allowEmpty: true, timeoutMs: 50_000 });
      return {
        stop_reason: result.finishReason === "length" ? "max_tokens" : result.finishReason,
        content: result.reply ? [{ type: "text", text: result.reply }] : [],
      };
    }, provider.model);
    const draft = await expander.expand(selected, related);
    if (!draft) return Response.json({ error: "the model did not return a usable proposal" }, { status: 502 });
    return Response.json({ model: provider.model, draft });
  } catch (error) {
    if (error instanceof KernelError) {
      if (error.name === "unauthenticated") return Response.json({ error: "Sign in to expand an idea." }, { status: 401 });
      if (error.name === "forbidden") return Response.json({ error: "You do not have access to this World." }, { status: 403 });
      if (error.name === "not_found") return Response.json({ error: "World or idea not found." }, { status: 404 });
      if (error.name === "invalid") return Response.json({ error: "The idea context is invalid." }, { status: 422 });
    }
    return Response.json({ error: "The expansion request failed. Please try again." }, { status: 502 });
  }
}
