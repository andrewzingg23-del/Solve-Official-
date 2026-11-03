// The chat pipe: plain fetch to OpenRouter's OpenAI-compatible
// chat-completions endpoint. Drew's order 2026-10-06: "switch anthropic
// with open router." The key never reaches a browser — the route owns it.
// Pure builders here so the request shape is unit-testable; the network
// call lives in completeChat.

export const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
export const OPENROUTER_REFERER = "https://solve-sovigrn.vercel.app";
export const OPENROUTER_TITLE = "Solve";

// Model IDs verified live 2026-10-06 against https://openrouter.ai/api/v1/models.
// Sonnet 5.5 is the current flagship Sonnet; Haiku 4.5 is the cheap tier.
export const OPENROUTER_DEFAULT_MODEL = "anthropic/claude-sonnet-5.5";
export const OPENROUTER_DEFAULT_MODEL_FLASH = "anthropic/claude-haiku-4.5";

export const OPENROUTER_MISSING_KEY_ERROR =
  "Chat isn't wired up yet — the OpenRouter key is missing on this deployment.";

export type OpenRouterRole = "system" | "user" | "assistant";
export type OpenRouterMessage = { role: OpenRouterRole; content: string };

export type ChatCompletionBody = {
  model: string;
  max_tokens: number;
  messages: OpenRouterMessage[];
};

/** Build the exact JSON the chat-completions endpoint expects. */
export function buildChatCompletionBody(args: {
  model: string;
  system: string;
  history: { role: "user" | "assistant"; content: string }[];
  message: string;
  maxTokens?: number;
}): ChatCompletionBody {
  return {
    model: args.model,
    max_tokens: args.maxTokens ?? 1024,
    messages: [
      { role: "system", content: args.system },
      ...args.history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user" as const, content: args.message },
    ],
  };
}

function providerErrorMessage(status: number, data: unknown): string {
  if (status === 401)
    return "The chat key was rejected — check the OpenRouter key on this deployment.";
  if (status === 429) return "The chat provider is rate-limiting right now — back in a bit.";
  const inner = (data as { error?: unknown } | null)?.error;
  const raw =
    typeof inner === "string"
      ? inner
      : inner && typeof inner === "object" && typeof (inner as { message?: unknown }).message === "string"
        ? ((inner as { message: string }).message as string)
        : "";
  const clean = raw.trim();
  if (clean) return clean.slice(0, 200);
  return `The chat provider answered ${status}. Try again.`;
}

export type ChatCompletionResult = {
  reply: string;
  inputTokens: number;
  outputTokens: number;
};

// Typed provider failure: the HTTP status is safe to classify and log.
// The message is already sanitized by providerErrorMessage; raw provider
// bodies are never attached to this error.
export class ProviderError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
  }
}

/** POST to OpenRouter and return the assistant's text plus token usage. */
export async function completeChat(
  apiKey: string,
  body: ChatCompletionBody,
): Promise<ChatCompletionResult> {
  const res = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": OPENROUTER_REFERER,
      "X-Title": OPENROUTER_TITLE,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) throw new ProviderError(res.status, providerErrorMessage(res.status, data));
  const choice = (data as { choices?: { message?: { content?: unknown } }[] } | null)?.choices?.[0]
    ?.message;
  const reply =
    choice && typeof choice.content === "string" ? choice.content.trim() : "";
  if (!reply) throw new ProviderError(res.status, "The bot had nothing to say. Try again.");
  const usage = (data as { usage?: { prompt_tokens?: unknown; completion_tokens?: unknown } } | null)
    ?.usage;
  const inputTokens =
    typeof usage?.prompt_tokens === "number" && usage.prompt_tokens > 0
      ? Math.ceil(usage.prompt_tokens)
      : 0;
  const outputTokens =
    typeof usage?.completion_tokens === "number" && usage.completion_tokens > 0
      ? Math.ceil(usage.completion_tokens)
      : 0;
  return { reply, inputTokens, outputTokens };
}
