// Pure, untrusted input boundary for the optional SOLVE AI console.
// Paths label a screen; they NEVER confer permission to any underlying resource.

export type EngineReport = { id: "anthropic" | "openai"; model: string; chosenBy?: string };
export type ConsoleMessage = {
  role: "user" | "assistant"; content: string;
  engine?: EngineReport;
  usage?: { inputTokens: number | null; outputTokens: number | null; cacheTokens?: number };
  cost?: { estimatedUsd: number | null; status: "estimated" | "unknown" };
  metering?: "recorded" | "failed" | "unknown";
};

export function replyLabel(engine?: EngineReport): string {
  return engine ? `${engine.id === "anthropic" ? "Anthropic" : "OpenAI"} · ${engine.model}` : "AI";
}

// Preserve recent conversation within the same limits enforced by the server.
export function historyForTurn(turns: ConsoleMessage[]): ConsoleMessage[] {
  let remaining = CONSOLE_LIMITS.totalHistoryChars;
  const history: ConsoleMessage[] = [];
  for (const turn of turns.slice(-CONSOLE_LIMITS.history).reverse()) {
    const content = turn.content.slice(0, Math.min(CONSOLE_LIMITS.historyMessage, remaining)).trim();
    if (!content) break;
    history.unshift({ role: turn.role, content });
    remaining -= content.length;
  }
  return history;
}
export type ConsoleTurn = {
  message: string;
  history: ConsoleMessage[];
  path: string;
};

export const CONSOLE_LIMITS = {
  message: 1800,
  history: 8,
  historyMessage: 1400,
  totalHistoryChars: 7500,
} as const;

const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const worldPath = new RegExp(`^/world/(${uuid})(?:/.*)?$`, "i");

export type Screen = { path: string; label: string; worldId: string | null };

export function screenFromPath(value: unknown): Screen | null {
  if (typeof value !== "string" || value.length > 240 || !value.startsWith("/") ||
    !/^\/[a-zA-Z0-9/_-]*$/.test(value) || value.includes("//")) return null;
  const path = value;
  const world = worldPath.exec(path);
  if (path.startsWith("/world/") && !world) return null;
  if (world) return { path, label: "a Space", worldId: world[1].toLowerCase() };
  if (path === "/" || path.startsWith("/space")) return { path, label: "your Space", worldId: null };
  if (path.startsWith("/people")) return { path, label: "People", worldId: null };
  if (path.startsWith("/apps")) return { path, label: "Apps", worldId: null };
  if (path.startsWith("/control") || path.startsWith("/account")) return { path, label: "Control", worldId: null };
  if (path.startsWith("/search")) return { path, label: "Search", worldId: null };
  return { path, label: "a SOLVE screen", worldId: null };
}

export function validateConsoleTurn(raw: unknown): ConsoleTurn | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const body = raw as Record<string, unknown>;
  const message = body.message;
  if (typeof message !== "string" || !message.trim() || message.length > CONSOLE_LIMITS.message) return null;
  const screen = screenFromPath(body.path);
  if (!screen) return null;
  const rawHistory = body.history === undefined ? [] : body.history;
  if (!Array.isArray(rawHistory) || rawHistory.length > CONSOLE_LIMITS.history) return null;
  const history: ConsoleMessage[] = [];
  let count = 0;
  for (const turn of rawHistory) {
    if (!turn || typeof turn !== "object" || Array.isArray(turn)) return null;
    const obj = turn as Record<string, unknown>;
    if (obj.role !== "user" && obj.role !== "assistant") return null;
    if (typeof obj.content !== "string" || !obj.content.trim() ||
        obj.content.length > CONSOLE_LIMITS.historyMessage) return null;
    count += obj.content.length;
    if (count > CONSOLE_LIMITS.totalHistoryChars) return null;
    history.push({ role: obj.role, content: obj.content.trim() });
  }
  return { message: message.trim(), history, path: screen.path };
}

/** Fail closed: preview authorization never comes from user input or forwarded headers. */
export function previewAllowed(
  userId: string,
  // An index signature so `process.env` is accepted directly: a type of only-optional
  // properties trips TypeScript's weak-type check against ProcessEnv. Keys read:
  // SOLVE_AI_INTERNAL_PREVIEW, SOLVE_AI_PREVIEW_USER_IDS.
  env: Record<string, string | undefined>,
): boolean {
  if (env.VERCEL_ENV !== "preview" || env.SOLVE_AI_INTERNAL_PREVIEW !== "1" || !userId) return false;
  return (env.SOLVE_AI_PREVIEW_USER_IDS || "").split(",").map(s => s.trim())
    .filter(Boolean).includes(userId);
}
