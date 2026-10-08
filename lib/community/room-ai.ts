// Room AI: the two foundations of AI in community.
// 1. Room briefs — the bot reads the room's activity since your last visit and
//    briefs you: who said what matters, open questions, threads that need you.
//    Cached per reader as a kernel event for 30 minutes, on the record.
// 2. Ask the room — answers drawn only from the room's own discussion, every
//    claim attributed to the member who said it. Honest "not discussed" fallback.
// Nothing is invented: the model only ever sees real notes, and says nothing
// when there's nothing worth saying.
import type { Kernel, KernelEvent } from "@/lib/kernel/client";
import { sideScope, type Note } from "./community";

export const ROOM_BRIEF_WRITTEN = "community.room-brief.written";
export const ROOM_BRIEF_TTL_MS = 30 * 60 * 1000;

export type RoomBrief = { text: string; at: string };

const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};

export async function readRoomBrief(
  kernel: Kernel,
  communityId: string,
  readerId: string,
  now = Date.now(),
): Promise<RoomBrief | null> {
  const events = await kernel.readEvents(sideScope(readerId, communityId), {
    limit: 20,
    newestFirst: true,
  });
  const written = events.find((e: KernelEvent) => e.type === ROOM_BRIEF_WRITTEN);
  if (!written) return null;
  const at = Date.parse(written.occurred_at);
  if (Number.isNaN(at) || now - at > ROOM_BRIEF_TTL_MS) return null;
  const text = String(record(written.payload).text ?? "").trim();
  return text ? { text, at: written.occurred_at } : null;
}

// The last brief time even when expired — so the next brief can say what
// happened "since" it. Null when the reader has never had one.
export async function lastRoomBriefAt(
  kernel: Kernel,
  communityId: string,
  readerId: string,
): Promise<string | null> {
  const events = await kernel.readEvents(sideScope(readerId, communityId), {
    limit: 20,
    newestFirst: true,
  });
  const written = events.find((e: KernelEvent) => e.type === ROOM_BRIEF_WRITTEN);
  if (!written) return null;
  const at = Date.parse(written.occurred_at);
  return Number.isNaN(at) ? null : written.occurred_at;
}

export async function writeRoomBrief(
  kernel: Kernel,
  communityId: string,
  readerId: string,
  text: string,
): Promise<void> {
  await kernel.recordEvent({
    type: ROOM_BRIEF_WRITTEN,
    scope: sideScope(readerId, communityId),
    payload: { text: text.slice(0, 2000), reader: readerId },
  });
}

export type BriefNote = {
  from: string;
  text: string;
  at: string;
  via: string | null;
  inReplyTo: string | null;
};

export function toBriefNotes(notes: Note[]): BriefNote[] {
  return notes.map((n) => ({
    from: n.from,
    text: n.text.slice(0, 300),
    at: n.at,
    via: n.via,
    inReplyTo: n.inReplyTo,
  }));
}

export type RoomBriefInput = {
  botName: string;
  communityName: string;
  notes: BriefNote[];
  memberNames: string[];
  sinceLabel: string;
};

// Grounded prompt: the model gets real room activity and is told to stay quiet
// when there's nothing worth the reader's attention.
export function buildRoomBriefPrompt(input: RoomBriefInput): string {
  const lines: string[] = [
    `You are ${input.botName}, briefing the person you serve on their community "${input.communityName}".`,
    `They asked what happened ${input.sinceLabel}. Be direct and specific.`,
    "Cover: what was said that matters, open questions anyone asked, and threads that need this person. Name people.",
    "If the room was quiet, say so in one line and stop.",
    "Never invent activity, people, or numbers. Only use what follows.",
    "",
    `Members in the room: ${input.memberNames.length ? input.memberNames.slice(0, 20).join(", ") : "none listed"}`,
    "",
    "Recent notes (newest first):",
  ];
  if (input.notes.length === 0) {
    lines.push("- None.");
  } else {
    for (const n of input.notes.slice(0, 15)) {
      const via = n.via ? ` (sent by ${n.via} for them)` : "";
      const date = n.at.slice(0, 10);
      lines.push(`- ${n.from}${via} [${date}]: ${n.text}`);
    }
  }
  return lines.join("\n");
}

export type AskRoomInput = {
  communityName: string;
  about: string;
  notes: BriefNote[];
  question: string;
};

// Every claim attributed to the member who said it. The room's memory, queryable.
export function buildAskRoomPrompt(input: AskRoomInput): string {
  const lines: string[] = [
    `You answer questions using only the discussion below from the community "${input.communityName}".`,
    "Attribute every claim to the member who said it, by name.",
    "If the room hasn't discussed it, say so plainly in one line and stop. Never invent.",
    "",
    `About this community: ${input.about.slice(0, 400) || "(no description)"}`,
    "",
    "Room discussion (newest first):",
  ];
  if (input.notes.length === 0) {
    lines.push("- No discussion yet.");
  } else {
    for (const n of input.notes.slice(0, 30)) {
      const date = n.at.slice(0, 10);
      lines.push(`- ${n.from} [${date}]: ${n.text}`);
    }
  }
  lines.push("", `Question: ${input.question.trim().slice(0, 500)}`);
  return lines.join("\n");
}

export const ASK_QUESTION_MAX = 500;
