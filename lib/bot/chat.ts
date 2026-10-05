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
export function pickChatModel(ids: string[]): string | null {
  if (!ids.length) return null;
  const lower = ids.map((id) => id.toLowerCase());
  const find = (want: string[]) => {
    for (const w of want) {
      const i = lower.findIndex((id) => id.includes(w));
      if (i >= 0) return ids[i];
    }
    return null;
  };
  return find(["haiku"]) ?? find(["sonnet"]) ?? find(["opus"]) ?? ids[0];
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
