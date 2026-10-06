// "While you were away": the avatar doing work you didn't ask for. It scans
// what's waiting on the owner, what's new in their memories and Worlds, and
// writes a short brief in its own voice. The brief is cached as a kernel event
// (bot.brief.written) for an hour, so opening /bot feels like the avatar was
// already working — because it was. Nothing is invented: every claim in the
// brief traces to a real record, and the brief itself is on the record.
import type { Kernel, KernelEvent } from "@/lib/kernel/client";
import { memoryScope } from "./memory";

export const BRIEF_WRITTEN = "bot.brief.written";
export const BRIEF_TTL_MS = 60 * 60 * 1000;

export type BriefInput = {
  botName: string;
  waiting: Array<{ kind: string; ask: string; worldTitle: string }>;
  newMemories: number;
  recentWorlds: Array<{ title: string; activity: string }>;
};

export type Brief = { text: string; at: string };

const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};

export async function readBrief(kernel: Kernel, ownerId: string, now = Date.now()): Promise<Brief | null> {
  const events = await kernel.readEvents(memoryScope(ownerId), { limit: 50, newestFirst: true });
  const written = events.find((e: KernelEvent) => e.type === BRIEF_WRITTEN);
  if (!written) return null;
  const at = Date.parse(written.occurred_at);
  if (Number.isNaN(at) || now - at > BRIEF_TTL_MS) return null;
  const text = String(record(written.payload).text ?? "").trim();
  return text ? { text, at: written.occurred_at } : null;
}

export async function writeBrief(kernel: Kernel, ownerId: string, text: string): Promise<void> {
  await kernel.recordEvent({
    type: BRIEF_WRITTEN,
    scope: memoryScope(ownerId),
    payload: { text: text.slice(0, 2000) },
  });
}

// The prompt the avatar briefs from. Grounded: the model gets real records,
// and is told to say nothing when there's nothing worth saying.
export function buildBriefPrompt(input: BriefInput): string {
  const lines: string[] = [
    `You are ${input.botName}, writing a short "while you were away" brief for the person you serve.`,
    "Be direct and specific. Name what's waiting, what's new, and what you'd do next.",
    "If nothing needs their attention, say so in one line and stop.",
    "Never invent activity, people, or numbers. Only use what follows.",
    "",
    "Waiting on them:",
  ];
  if (input.waiting.length === 0) {
    lines.push("- Nothing waiting.");
  } else {
    for (const w of input.waiting.slice(0, 8)) lines.push(`- [${w.kind}] ${w.ask} (in ${w.worldTitle})`);
  }
  lines.push("", `New memories since last brief: ${input.newMemories}`, "", "Recent World activity:");
  if (input.recentWorlds.length === 0) {
    lines.push("- None.");
  } else {
    for (const w of input.recentWorlds.slice(0, 5)) lines.push(`- ${w.title}: ${w.activity}`);
  }
  return lines.join("\n");
}
