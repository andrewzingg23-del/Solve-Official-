// Pure, untrusted input boundary for the optional SOLVE AI console.
// Paths label a screen; they NEVER confer permission to any underlying resource.

export type ConsoleMessage = { role: "user" | "assistant"; content: string };
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
export function previewAllowed(userId: string, env: {
  SOLVE_AI_INTERNAL_PREVIEW?: string;
  SOLVE_AI_PREVIEW_USER_IDS?: string;
}): boolean {
  if (env.SOLVE_AI_INTERNAL_PREVIEW !== "1" || !userId) return false;
  return (env.SOLVE_AI_PREVIEW_USER_IDS || "").split(",").map(s => s.trim())
    .filter(Boolean).includes(userId);
}
