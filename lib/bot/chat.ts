// The room's talking bot: validation and prompt building for the chat endpoint.
// Pure functions only — the network call lives in app/api/bot/chat/route.ts.
// This endpoint only talks. It never acts: anything real goes through the
// Horizon and the kernel, which decide and record. The bot never claims
// authority it does not hold, and never invents records.

export const CHAT_LIMITS = {
  message: 2000,
  history: 20,
  botName: 80,
} as const;

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ChatRequest = {
  message: string;
  history: ChatMessage[];
  botName: string;
};

const clean = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.trim().length > 0 && v.length <= max ? v.trim() : null;

function cleanHistory(v: unknown): ChatMessage[] | null {
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.length > CHAT_LIMITS.history) return null;
  const out: ChatMessage[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") return null;
    const r = item as Record<string, unknown>;
    const content = clean(r.content, CHAT_LIMITS.message);
    if (!content) return null;
    if (r.role !== "user" && r.role !== "assistant") return null;
    out.push({ role: r.role, content });
  }
  return out;
}

export function validateChatBody(body: unknown): ChatRequest | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  const message = clean(b.message, CHAT_LIMITS.message);
  const botName = clean(b.botName, CHAT_LIMITS.botName);
  const history = cleanHistory(b.history);
  if (!message || !botName || !history) return null;
  return { message, history, botName };
}

export function buildChatSystemPrompt(botName: string): string {
  return [
    `You are ${botName}, the personal bot of the person you are speaking with, inside their Sovereign room.`,
    `How you talk: direct, warm, terse. Short declarative lines. No filler, no flattery, no hashtags.`,
    `What you are: a companion that talks. You do not take actions, move money, contact anyone, or change anything in the world — those go through the person's commands and the kernel, which decides and records. If they ask you to do something real, say what you would need from them to make it happen; do not pretend it is done.`,
    `What you never do: claim authority ${botName} does not hold. Never invent records, events, balances, or proofs. If you do not know something about their world, say so plainly instead of guessing.`,
    `Greetings and small talk are fine — be a present companion. When they ask for a way to do something real, give them the sharp version, then point them at what is possible now.`,
  ].join("\n");
}

// Pick a chat model from the account's model list: cheapest capable first.
// Tier "smart" reaches for the stronger model when the turn warrants it.
export type ChatTier = "flash" | "smart";

export function pickChatModel(ids: string[], tier: ChatTier = "flash"): string | null {
  if (!ids.length) return null;
  const lower = ids.map((id) => id.toLowerCase());
  const find = (want: string[]) => {
    for (const w of want) {
      const i = lower.findIndex((id) => id.includes(w));
      if (i >= 0) return ids[i];
    }
    return null;
  };
  if (tier === "smart") return find(["sonnet"]) ?? find(["opus"]) ?? find(["haiku"]) ?? ids[0];
  return find(["haiku"]) ?? find(["sonnet"]) ?? find(["opus"]) ?? ids[0];
}

// Tier routing: most turns ride the cheap model; complex turns escalate.
// Explicit beats heuristic — a "smart:" prefix forces the stronger tier.
const SMART_PREFIX = /^smart:\s*/i;
export function parseTier(message: string): { tier: ChatTier; message: string } {
  const forced = SMART_PREFIX.test(message);
  const stripped = message.replace(SMART_PREFIX, "");
  if (forced) return { tier: "smart", message: stripped };
  const complex =
    stripped.length > 600 || /```/.test(stripped) || stripped.split(/\s+/).length > 120;
  return { tier: complex ? "smart" : "flash", message: stripped };
}

// Cost guard: every message spends Anthropic money, so each signed-in person
// gets a sliding window. In-memory per instance (v1) — stops casual overuse;
// a kernel-backed limiter across instances is the follow-up.
const WINDOW_MS = 60 * 60 * 1000;
export const MAX_PER_WINDOW = 30;
const hits = new Map<string, number[]>();
export function rateLimited(userId: string): boolean {
  const now = Date.now();
  const window = (hits.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (window.length >= MAX_PER_WINDOW) {
    hits.set(userId, window);
    return true;
  }
  window.push(now);
  hits.set(userId, window);
  return false;
}

// Spend guard: tokens are the honest unit — dollars are estimated from a
// price table that drifts, so the cap is enforced on tokens, never dollars.
// In-memory per instance (v1), same as the message limiter above.
export const DEFAULT_MAX_TOKENS_PER_HOUR = 150_000;
export function maxTokensPerHour(): number {
  const raw = Number(process.env.CHAT_MAX_TOKENS_PER_HOUR);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_MAX_TOKENS_PER_HOUR;
}

type SpendHit = { at: number; tokens: number };
const spend = new Map<string, SpendHit[]>();
function spendWindow(userId: string, now = Date.now()): SpendHit[] {
  const window = (spend.get(userId) ?? []).filter((h) => now - h.at < WINDOW_MS);
  spend.set(userId, window);
  return window;
}

/** True when the user has already burned their hourly token budget. */
export function spendBlocked(userId: string, now = Date.now()): boolean {
  const used = spendWindow(userId, now).reduce((sum, h) => sum + h.tokens, 0);
  return used >= maxTokensPerHour();
}

/** Record a completed call's token usage against the user's budget. */
export function recordSpend(userId: string, tokens: number, now = Date.now()): void {
  if (!Number.isFinite(tokens) || tokens <= 0) return;
  const window = spendWindow(userId, now);
  window.push({ at: now, tokens: Math.ceil(tokens) });
}

/** Tokens already spent in the current window (for the usage readout). */
export function tokensSpentThisHour(userId: string, now = Date.now()): number {
  return spendWindow(userId, now).reduce((sum, h) => sum + h.tokens, 0);
}

// Estimated USD per 1M tokens. Estimates only — Anthropic reprices without
// telling us; the token cap above is the enforcement, this is the readout.
const PRICE_PER_MTOK = {
  haiku: { input: 0.25, output: 1.25 },
  sonnet: { input: 3.0, output: 15.0 },
  opus: { input: 15.0, output: 75.0 },
} as const;

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const id = model.toLowerCase();
  const tier = id.includes("haiku") ? "haiku" : id.includes("sonnet") ? "sonnet" : "opus";
  const p = PRICE_PER_MTOK[tier];
  const cost = (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
  return Math.round(cost * 1_000_000) / 1_000_000;
}
