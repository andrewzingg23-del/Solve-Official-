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
  inputTokens: number;
  outputTokens: number;
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
  if (!reply) throw new Error("The OpenAI provider returned no message. Try again.");
  const usage = response.usage && typeof response.usage === "object"
    ? response.usage as { input_tokens?: unknown; output_tokens?: unknown }
    : {};
  return {
    reply,
    inputTokens: typeof usage.input_tokens === "number" && usage.input_tokens >= 0
      ? Math.ceil(usage.input_tokens) : 0,
    outputTokens: typeof usage.output_tokens === "number" && usage.output_tokens >= 0
      ? Math.ceil(usage.output_tokens) : 0,
  };
}

function errorFor(status: number): string {
  if (status === 401 || status === 403) return "OpenAI credentials or model permissions were rejected.";
  if (status === 429) return "OpenAI's rate limit or usage quota was reached.";
  return `OpenAI could not complete the request (HTTP ${status}).`;
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
  if (!res.ok) throw new Error(errorFor(res.status));
  let data: unknown;
  try { data = await res.json(); } catch { throw new Error("OpenAI returned an unreadable response."); }
  return parseOpenAIResponse(data);
}
