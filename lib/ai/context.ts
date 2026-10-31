// The context packer (One Solve plan, Step 3 / Step 10 "AI engine").
//
// Every model call gets a fixed token budget, filled in priority order with a
// cap per layer. The layers, highest priority first:
//   1. rules and persona
//   2. passport profile (cached prefix)
//   3. project brief
//   4. top-k relevant facts
//   5. recent turns verbatim, plus a summary of older ones
//   6. the ask (the person's actual message)
//
// Two guarantees the tests pin down:
//   - A layer's text never exceeds its own cap, and the whole pack never
//     exceeds the budget.
//   - Higher layers are never dropped to make room for lower ones: when the
//     budget is tight, the lowest-priority layers get nothing.
//
// The one exception is "the ask": the person's message is mandatory, so a layer
// marked `required` is reserved before the optional layers are filled. A tight
// budget can therefore keep the ask over a higher optional layer — never the
// other way around among optional layers.
//
// Pure and deterministic: no clock, no randomness, no I/O. Token counts are an
// estimate (~4 characters per token for English); the real spend is still
// metered on the provider's reported usage in lib/bot/chat.ts.

const CHARS_PER_TOKEN = 4;
const TRUNCATION_MARK = "…";

/** Estimated tokens for a string (~4 chars/token). Deterministic, never negative. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/** Cut `text` so its estimate is at most `tokens`. Returns "" for a zero budget. */
export function truncateToTokens(text: string, tokens: number): string {
  if (tokens <= 0 || !text) return "";
  const maxChars = tokens * CHARS_PER_TOKEN;
  if (text.length <= maxChars) return text;
  // Keep room for the one-char mark so the result's estimate still fits the cap.
  return text.slice(0, maxChars - TRUNCATION_MARK.length) + TRUNCATION_MARK;
}

export type ContextLayer = {
  /** Short identifier, e.g. "rules", "profile", "ask". */
  name: string;
  /** The layer's full text before any capping. */
  text: string;
  /** The most tokens this layer may contribute. */
  cap: number;
  /** Mandatory layers (the ask) are reserved before optional layers are filled. */
  required?: boolean;
};

export type PackedLayer = { name: string; text: string; tokens: number; truncated: boolean };

export type PackedContext = {
  /** The assembled prompt text, layers in their given order, blank layers omitted. */
  text: string;
  /** Per-layer accounting, in the given order (including layers that got 0 tokens). */
  layers: PackedLayer[];
  totalTokens: number;
  budgetTokens: number;
};

/**
 * Packs the layers into `budgetTokens`. Layers keep their given order in the
 * output (so the prompt reads rules → persona → … → ask); allocation runs
 * required-first, then optional layers in the order given (highest priority
 * first). Caps and the total budget are never exceeded.
 */
export function packContext(layers: ContextLayer[], budgetTokens: number): PackedContext {
  const budget = Math.max(0, Math.floor(budgetTokens));
  const allocation = new Map<number, number>();
  let remaining = budget;

  const allocate = (index: number) => {
    const layer = layers[index];
    const want = Math.min(Math.max(0, Math.floor(layer.cap)), estimateTokens(layer.text));
    const give = Math.min(want, remaining);
    allocation.set(index, give);
    remaining -= give;
  };

  // Pass 1: reserve the required layers (the ask) in order.
  layers.forEach((layer, i) => {
    if (layer.required) allocate(i);
  });
  // Pass 2: fill optional layers in priority order with what's left.
  layers.forEach((layer, i) => {
    if (!layer.required) allocate(i);
  });

  const packed: PackedLayer[] = layers.map((layer, i) => {
    const tokens = allocation.get(i) ?? 0;
    const text = truncateToTokens(layer.text, tokens);
    return {
      name: layer.name,
      text,
      tokens: estimateTokens(text),
      truncated: text.length > 0 && estimateTokens(layer.text) > tokens,
    };
  });

  const text = packed
    .filter((p) => p.text.trim().length > 0)
    .map((p) => p.text)
    .join("\n\n");

  return {
    text,
    layers: packed,
    totalTokens: packed.reduce((sum, p) => sum + p.tokens, 0),
    budgetTokens: budget,
  };
}
