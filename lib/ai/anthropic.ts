// Anthropic Messages API transport for server-side use by the approved SOLVE shell.
//
// The sibling of lib/ai/openai.ts (PR #97), and deliberately the same shape: a pure body
// builder, one network call, a normalized reply. Two engines, one console — the point of a
// master bot is that the engine is a setting, not a dependency.
//
// This is not a bridge to a person's Claude account, subscription or memories. The calling
// SOLVE route authorizes the viewer, scopes the context and charges the usage. The key is
// passed in, never read from the environment here, so the same adapter serves a deployment
// key or a person's own key without knowing which pays.
//
// Plain fetch, not @anthropic-ai/sdk: neither provider SDK is a dependency of this repo,
// lib/ai/openai.ts calls its API the same way, and adding a dependency to the trunk is a
// bigger change than the adapter itself. If an SDK is adopted, both adapters move together.
//
// Current API shape (checked 2026-11-11), because each of these is otherwise a 400:
//   * `max_tokens` is required.
//   * Thinking is always on for the current models: send no `thinking` field at all.
//     `{type:"disabled"}` and `budget_tokens` are both rejected. Depth is `output_config.effort`.
//   * `temperature`/`top_p`/`top_k` are never sent; newer API versions reject them outright.
//   * No assistant prefill — rejected on every current model.
//   * A safety decline arrives as HTTP 200 with `stop_reason: "refusal"` and no usable text,
//     so `stop_reason` is checked before the content is read.

export const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
export const ANTHROPIC_VERSION = "2023-06-01";

/** The current models. Prices are USD per million tokens. */
export const ANTHROPIC_MODELS = {
  "claude-opus-5-5": { input: 4.0, output: 20.0 },
  "claude-sonnet-5-5": { input: 2.0, output: 10.0 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
} as const;

export type AnthropicModel = keyof typeof ANTHROPIC_MODELS;

/** The default stays the most capable model; a cheaper tier is a deliberate configuration. */
export const ANTHROPIC_DEFAULT_MODEL: AnthropicModel = "claude-opus-5-5";

export const ANTHROPIC_MISSING_KEY_ERROR =
  "Claude isn't configured on this SOLVE deployment. An Anthropic API key is needed.";

export type AnthropicChatMessage = { role: "user" | "assistant"; content: string };

/** Thinking depth. Omitted means the model's own default. */
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export type AnthropicMessagesBody = {
  model: string;
  max_tokens: number;
  system: string;
  messages: AnthropicChatMessage[];
  output_config?: { effort: Effort };
};

export type AnthropicCompletion = {
  reply: string;
  inputTokens: number;
  outputTokens: number;
  /** Tokens served from the prompt cache, when the response reports any. */
  cachedTokens: number;
  model: string;
};

/** Thrown when the model declined the request: HTTP 200, no usable text. */
export class AnthropicRefusal extends Error {
  constructor(readonly category: string | null) {
    super("Claude declined this request.");
    this.name = "AnthropicRefusal";
  }
}

export function buildAnthropicMessagesBody(args: {
  model: string;
  system: string;
  history: AnthropicChatMessage[];
  message: string;
  maxTokens?: number;
  effort?: Effort;
}): AnthropicMessagesBody {
  return {
    model: args.model,
    // Bounded by default: a console reply that runs to 100k tokens is a bug, not an answer.
    max_tokens: args.maxTokens ?? 2048,
    system: args.system,
    messages: [
      ...args.history.map((turn) => ({ role: turn.role, content: turn.content })),
      { role: "user", content: args.message },
    ],
    ...(args.effort ? { output_config: { effort: args.effort } } : {}),
  };
}

type RawBlock = { type?: unknown; text?: unknown };
type RawResponse = {
  content?: unknown;
  model?: unknown;
  stop_reason?: unknown;
  stop_details?: { category?: unknown } | null;
  usage?: { input_tokens?: unknown; output_tokens?: unknown; cache_read_input_tokens?: unknown };
};

const count = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;

/** Pulls the answer out of a response. Text blocks only — a thinking block is not the answer. */
export function readAnthropicReply(raw: unknown): AnthropicCompletion {
  const body = (raw ?? {}) as RawResponse;
  if (body.stop_reason === "refusal") {
    const category = body.stop_details?.category;
    throw new AnthropicRefusal(typeof category === "string" ? category : null);
  }
  const blocks = Array.isArray(body.content) ? (body.content as RawBlock[]) : [];
  const reply = blocks
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("")
    .trim();
  return {
    reply,
    inputTokens: count(body.usage?.input_tokens),
    outputTokens: count(body.usage?.output_tokens),
    cachedTokens: count(body.usage?.cache_read_input_tokens),
    model: typeof body.model === "string" ? body.model : "",
  };
}

/** Estimated USD for a call. An estimate: providers reprice, so tokens stay the honest unit. */
export function estimateAnthropicCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const price = ANTHROPIC_MODELS[model as AnthropicModel];
  if (!price) return 0;
  const cost = (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

/**
 * One call. The key is an argument, never an environment read, so the caller decides whose
 * key pays. A non-2xx becomes an Error carrying the provider's own message, truncated.
 */
export async function completeAnthropicChat(
  apiKey: string,
  body: AnthropicMessagesBody,
  { timeoutMs = 60_000, fetchImpl = fetch }: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<AnthropicCompletion> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  try {
    const res = await fetchImpl(ANTHROPIC_MESSAGES_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
      signal: abort.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      let detail = text.slice(0, 200);
      try {
        const parsed = JSON.parse(text) as { error?: { message?: unknown } };
        if (typeof parsed.error?.message === "string") detail = parsed.error.message.slice(0, 200);
      } catch {
        // Keep the raw body: a provider error is not always JSON.
      }
      throw new Error(`Claude returned ${res.status}: ${detail}`);
    }
    return readAnthropicReply(JSON.parse(text));
  } finally {
    clearTimeout(timer);
  }
}
