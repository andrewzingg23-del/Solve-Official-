"use server";
import { readProvider } from "@/lib/ai/provider";

import { companionOf } from "@/lib/bot/store";
import {
  buildChatCompletionBody,
  completeChat,
} from "@/lib/bot/openrouter";
import {
  communityMembers,
  notesForMe,
  readCommunity,
  standingIn,
  type Community,
} from "@/lib/community/community";
import {
  ASK_QUESTION_MAX,
  buildAskRoomPrompt,
  buildRoomBriefPrompt,
  lastRoomBriefAt,
  readRoomBrief,
  toBriefNotes,
  writeRoomBrief,
  type RoomBrief,
} from "@/lib/community/room-ai";
import { getKernel } from "@/lib/kernel/server";
import type { Kernel } from "@/lib/kernel/client";

export type RoomAiError = "unavailable" | "missing" | "join" | "noconfig" | "model";

export type RoomBriefResult = { brief: RoomBrief } | { error: RoomAiError };

export type AskRoomResult =
  | { answer: string }
  | { error: RoomAiError | "empty" | "long" };

type Ctx =
  | { ok: true; kernel: Kernel; community: Community; me: string; botName: string }
  | { ok: false; error: RoomAiError };

async function ctxFor(communityId: string): Promise<Ctx> {
  let kernel: Kernel;
  try {
    kernel = await getKernel();
  } catch {
    return { ok: false, error: "unavailable" };
  }
  const community = await readCommunity(kernel, communityId).catch(() => null);
  if (!community) return { ok: false, error: "missing" };
  let standing: string;
  let me: string;
  try {
    ({ me, standing } = await standingIn(kernel, community));
  } catch {
    return { ok: false, error: "unavailable" };
  }
  if (standing === "guest") return { ok: false, error: "join" };
  const avatars = await kernel.myAvatars().catch(() => []);
  const bot = companionOf(avatars);
  return { ok: true, kernel, community, me, botName: bot?.name ?? "Your bot" };
}

async function complete(kernel: Kernel, prompt: string, maxTokens: number): Promise<string> {
  const provider = await readProvider(kernel);
  if (!provider) throw new Error("noconfig");
  const {apiKey,model} = provider;
  const { reply } = await completeChat(apiKey,
    buildChatCompletionBody({
      model,
      system: "You are a community room assistant. Be direct, specific, and honest. Never invent.",
      history: [],
      message: prompt,
      maxTokens,
    }),
  );
  return reply;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getRoomBrief(communityId: string): Promise<RoomBriefResult> {
  const ctx = await ctxFor(communityId);
  if (!ctx.ok) return { error: ctx.error };

  const cached = await readRoomBrief(ctx.kernel, communityId, ctx.me).catch(() => null);
  if (cached) return { brief: cached };
  if (!await readProvider(ctx.kernel)) return { error: "noconfig" };

  const [notes, roster] = await Promise.all([
    notesForMe(ctx.kernel, ctx.community, 30).catch(() => []),
    communityMembers(ctx.kernel, ctx.community).catch(() => null),
  ]);
  const memberNames = roster ? roster.people.map((m) => m.name) : [];
  const lastAt = await lastRoomBriefAt(ctx.kernel, communityId, ctx.me).catch(() => null);
  const sinceMs = lastAt ? Date.parse(lastAt) : Date.now() - DAY_MS;
  const fresh = notes.filter((n) => Date.parse(n.at) >= sinceMs);
  const sinceLabel = lastAt
    ? `since ${new Date(lastAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
    : "in the last day";

  const prompt = buildRoomBriefPrompt({
    botName: ctx.botName,
    communityName: ctx.community.name,
    notes: toBriefNotes(fresh.length ? fresh : notes.slice(0, 5)),
    memberNames,
    sinceLabel,
  });

  try {
    const text = await complete(ctx.kernel, prompt, 400);
    if (!text) return { error: "model" };
    await writeRoomBrief(ctx.kernel, communityId, ctx.me, text).catch(() => {});
    return { brief: { text, at: new Date().toISOString() } };
  } catch (e) {
    return { error: e instanceof Error && e.message === "noconfig" ? "noconfig" : "model" };
  }
}

export async function askRoom(communityId: string, question: string): Promise<AskRoomResult> {
  const q = question.trim();
  if (!q) return { error: "empty" };
  if (q.length > ASK_QUESTION_MAX) return { error: "long" };

  const ctx = await ctxFor(communityId);
  if (!ctx.ok) return { error: ctx.error };
  if (!await readProvider(ctx.kernel)) return { error: "noconfig" };

  const notes = await notesForMe(ctx.kernel, ctx.community, 30).catch(() => []);
  const prompt = buildAskRoomPrompt({
    communityName: ctx.community.name,
    about: ctx.community.about ?? "",
    notes: toBriefNotes(notes),
    question: q,
  });

  try {
    const answer = await complete(ctx.kernel, prompt, 600);
    if (!answer) return { error: "model" };
    return { answer };
  } catch (e) {
    return { error: e instanceof Error && e.message === "noconfig" ? "noconfig" : "model" };
  }
}
