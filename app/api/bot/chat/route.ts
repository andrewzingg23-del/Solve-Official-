// The room's talking bot, server side. Signed-in people only (it costs money);
// the key never reaches a browser. Conversational only — it never acts.
import Anthropic from "@anthropic-ai/sdk";
import { getUser } from "@/lib/supabase/server";
import {
  buildChatSystemPrompt,
  pickChatModel,
  validateChatBody,
} from "@/lib/bot/chat";

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

// The account's chat model, resolved once per deployment from the model list.
let cachedModel: string | null | undefined;
async function chatModel(apiKey: string): Promise<string | null> {
  const envModel = process.env.CHAT_MODEL?.trim();
  if (envModel) return envModel;
  if (cachedModel !== undefined) return cachedModel;
  try {
    const res = await fetch("https://api.anthropic.com/v1/models", {
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      cachedModel = null;
      return null;
    }
    const data = (await res.json()) as { data?: { id?: string }[] };
    const ids = (data.data ?? [])
      .map((m) => (typeof m.id === "string" ? m.id : ""))
      .filter(Boolean);
    cachedModel = pickChatModel(ids);
    return cachedModel;
  } catch {
    cachedModel = null;
    return null;
  }
}

export async function POST(request: Request) {
  if (!(await getUser().catch(() => null)))
    return json({ error: "Sign in to talk to your bot." }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Send a valid JSON request." }, 400);
  }
  const chat = validateChatBody(body);
  if (!chat) return json({ error: "Send a message, your bot's name, and up to 20 history items." }, 422);

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return json({ error: "The chat model is not configured on this deployment." }, 503);

  const model = await chatModel(apiKey);
  if (!model) return json({ error: "No chat model is available right now." }, 503);

  const client = new Anthropic({ apiKey });
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      system: buildChatSystemPrompt(chat.botName),
      messages: [
        ...chat.history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user" as const, content: chat.message },
      ],
    });
    const text = response.content.find((b) => b.type === "text");
    const reply = text?.type === "text" ? text.text.trim() : "";
    if (!reply) return json({ error: "The bot had nothing to say. Try again." }, 502);
    return json({ reply });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message.slice(0, 200) : "The chat call failed." },
      502,
    );
  }
}
