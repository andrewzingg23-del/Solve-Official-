import { ProviderError, ProviderReplyError, tokenCount } from "./provider-error";
// OpenAI Responses API transport for server-side use by the approved SOLVE shell.
// This is not a bridge to a person's ChatGPT account, subscription, or memories.
// The calling SOLVE route authorizes the viewer, scopes context, and charges usage.
// Never accept a user-supplied API key or model ID from the browser.
export const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
// Balance cost and reasoning for general SOLVE chat; allow a stronger model via server configuration.
export const OPENAI_DEFAULT_MODEL = "gpt-6.1-sol";
export const OPENAI_MISSING_KEY_ERROR =
  "ChatGPT isn't configured on this SOLVE deployment. An OpenAI API key is needed.";

export type OpenAIChatMessage = { role: "user" | "assistant"; content: string };

export type OpenAIResponsesBody = {
  model: string;
  instructions: string;
  input: OpenAIChatMessage[];
  max_output_tokens: number;
  store: false;
};

export type OpenAICompletion = {
  reply: string;
  inputTokens: number | null;
  outputTokens: number | null;
  model: string;
};

export function buildOpenAIResponsesBody(args: {
  model: string;
  system: string;
  history: OpenAIChatMessage[];
  message: string;
  maxOutputTokens?: number;
}): OpenAIResponsesBody {
  return {
    model: args.model,
    instructions: args.system,
    input: [...args.history.map((turn) => ({ role: turn.role, content: turn.content })),
      { role: "user", content: args.message }],
    max_output_tokens: args.maxOutputTokens ?? 2048,
    // SOLVE holds the user's consented conversation context; avoid duplicating
    // conversation storage on the model provider unless explicitly designed.
    store: false,
  };
}

/** Extracts only user-visible output text; no reasoning or tool metadata. */
export function parseOpenAIResponse(data: unknown): OpenAICompletion {
  const response = data && typeof data === "object" ? data as Record<string, unknown> : {};
  const output = Array.isArray(response.output) ? response.output : [];
  const text = output.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const value = item as { type?: unknown; content?: unknown };
    if (value.type !== "message" || !Array.isArray(value.content)) return [];
    return value.content.flatMap((part) => {
      if (!part || typeof part !== "object") return [];
      const t = part as { type?: unknown; text?: unknown };
      return t.type === "output_text" && typeof t.text === "string" ? [t.text] : [];
    });
  }).join("\n").trim();
  // output_text can also be provided as a convenience property by SDK-shaped
  // test responses. The official REST response includes output[].content[].
  const reply = text || (typeof response.output_text === "string" ? response.output_text.trim() : "");
  const usage = response.usage && typeof response.usage === "object"
    ? response.usage as { input_tokens?: unknown; output_tokens?: unknown }
    : {};
  const completion = {
    reply,
    inputTokens: tokenCount(usage.input_tokens),
    outputTokens: tokenCount(usage.output_tokens),
    model: typeof response.model === "string" ? response.model : "",
  };
  if (!reply) throw new ProviderReplyError("provider_empty", completion);
  return completion;
}

export async function completeOpenAIChat(
  apiKey: string,
  body: OpenAIResponsesBody,
): Promise<OpenAICompletion> {
  const res = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new ProviderError("OpenAI", res.status);
  let data: unknown;
  try { data = await res.json(); } catch { throw new Error("OpenAI returned an unreadable response."); }
  return parseOpenAIResponse(data);
}
