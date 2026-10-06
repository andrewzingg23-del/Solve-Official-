// Turn intent: chatter vs. "a way".
// The canon's universal interaction: "They ask for a way." Wayfinder loop:
// Ask → Find a route → Enter a Room → Act → Create consequence → Expand.
// When the person asks for a way (not small talk), the Talk route records
// it as a kernel event — speech in, kernel gates and records. The world
// updating live in front of them renders off that event (redesign slice);
// the record is this slice.

export type TurnIntent = { kind: "chat" } | { kind: "way"; goal: string };

export const WAY_REQUESTED = "talk.way.requested";
export const talkScope = (actorId: string) => `actor:${actorId}/talk`;

const WAY_OPENERS =
  /^(how (do|can|should) i|help me|i want to|i need to|can you|show me how|find me|get me|make me|build me|set up|remind me to|what('s| is) the way to)\b/i;

/**
 * Classify a Talk turn. "way" = the person asks for a way to do something
 * real; everything else is conversation. Heuristic and explicit about it —
 * a small model classifier can replace this later without changing callers.
 */
export function classifyTurn(message: string): TurnIntent {
  const text = message.trim();
  if (!text) return { kind: "chat" };
  if (WAY_OPENERS.test(text)) {
    const goal = text.replace(/\s+/g, " ").slice(0, 500);
    return { kind: "way", goal };
  }
  return { kind: "chat" };
}
