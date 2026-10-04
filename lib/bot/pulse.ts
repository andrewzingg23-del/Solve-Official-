// How the master bot is doing right now, from durable records only: what it remembers, who is
// connected, when its persona changed. No model call and nothing invented: the mood and the line it
// says are templates over real facts, and the relationship numbers are counts of kernel records.
// (Live "an assistant is reading right now" presence needs an ephemeral signal; see the plan.)
import type { Connection, Memory } from "./memory";
import type { Persona } from "./persona";
import type { PersonaVersion } from "./store";

export type Mood = "idle" | "listening" | "working" | "happy" | "sleeping";

export type Pulse = {
  mood: Mood;
  // What the bot says, in its own voice.
  line: string;
  // What happened most recently, for the caption under the bot.
  latest: { what: string; at: string } | null;
  bond: { days: number; memories: number; fromAssistants: number; assistants: number; versions: number };
};

const MIN = 60_000;

function ago(ms: number) {
  if (ms < MIN) return "just now";
  if (ms < 60 * MIN) return `${Math.round(ms / MIN)} min ago`;
  if (ms < 24 * 60 * MIN) return `${Math.round(ms / (60 * MIN))} h ago`;
  return `${Math.round(ms / (24 * 60 * MIN))} d ago`;
}

export function botPulse(input: {
  persona: Persona;
  since: string;
  memories: Memory[];
  connections: Connection[];
  history: PersonaVersion[];
  now: Date;
}): Pulse {
  const { persona, memories, connections, history } = input;
  const now = input.now.getTime();
  const events = [
    ...memories.map((m) => ({ at: Date.parse(m.at), what: m.via.client_name ? `${m.via.client_name} added a memory` : "You added a memory", byAssistant: Boolean(m.via.client_name) })),
    ...connections.map((c) => ({ at: Date.parse(c.since), what: `${c.clientName} connected`, byAssistant: true })),
    ...history.map((h) => ({ at: Date.parse(h.at), what: "You restyled me", byAssistant: false })),
  ].sort((a, b) => b.at - a.at);
  const latest = events[0];
  const quiet = latest ? now - latest.at : Infinity;

  const mood: Mood =
    latest && quiet < 2 * MIN && latest.byAssistant ? "working"
    : latest && quiet < 2 * MIN ? "happy"
    : connections.length > 0 && quiet < 30 * MIN ? "listening"
    : quiet > 3 * 24 * 60 * MIN ? "sleeping"
    : "idle";

  const fromAssistants = memories.filter((m) => m.via.client_name).length;
  const days = Math.max(1, Math.ceil((now - Date.parse(input.since)) / (24 * 60 * MIN)));
  const names = connections.map((c) => c.clientName);

  const line =
    mood === "working" && latest ? `${latest.what.replace(/^(.+) added a memory$/, "$1 just gave me something to remember")}. Got it.`
    : mood === "happy" ? persona.voice || "Noted."
    : mood === "sleeping" ? `It's been quiet. I'm still holding ${memories.length} ${memories.length === 1 ? "memory" : "memories"} for you.`
    : connections.length === 0 ? `Connect Claude, ChatGPT or Meta AI and I'll be the same me in each of them.`
    : memories.length === 0 ? `${names.join(" and ")} can speak as me now. Tell me something worth keeping.`
    : `I'm keeping ${memories.length} ${memories.length === 1 ? "memory" : "memories"} for you, and ${names.join(" and ")} ${names.length === 1 ? "speaks" : "speak"} as me.`;

  return {
    mood,
    line,
    latest: latest ? { what: latest.what, at: ago(now - latest.at) } : null,
    bond: { days, memories: memories.length, fromAssistants, assistants: connections.length, versions: history.length },
  };
}
