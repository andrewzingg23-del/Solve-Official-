"use server";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { KernelError } from "@/lib/kernel/client";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { ACCOUNT_CHANGED, requireDisplayedActor } from "@/lib/product/account-guard";
import { experimentalFeaturesEnabled } from "@/lib/product/routes";
import type { FormResult } from "@/app/product/recoverable-form";
import { setBotAccess } from "@/lib/bot/worlds";
import { companionOf } from "@/lib/bot/store";
import { answerAsk, askToJoin, CommunityInputError, letAiSendNotes, readCommunity, requireOwner, sendNote, updateCommunity } from "@/lib/community/community";
import { answerDesign, DeskInputError } from "@/lib/solar/desk";
const text = (value: FormDataEntryValue | null) => typeof value === "string" ? value : "";

async function act(communityId: string, done: string, formData: FormData, work: (kernel: Awaited<ReturnType<typeof getKernel>>, community: NonNullable<Awaited<ReturnType<typeof readCommunity>>>) => Promise<unknown>): Promise<FormResult | void> {
  const path = `/community/${communityId}`;
  if (!(await getUser())) return { ok: false, error: "Sign in again before saving. Your text is still here." };
  try {
    const kernel = await getKernel();
    await requireDisplayedActor(kernel, formData.get("expectedActorId"));
    const community = await readCommunity(kernel, communityId);
    if (!community) return { ok: false, error: "This community is unavailable. Your text is still here." };
    await work(kernel, community);
  } catch (error) {
    return { ok: false, error: error instanceof Error && error.message === ACCOUNT_CHANGED ? ACCOUNT_CHANGED : error instanceof CommunityInputError || error instanceof DeskInputError ? "Check what you entered. Your text is still here." : error instanceof KernelError && error.name === "forbidden" ? "Your access changed. Your text is still here; contact the owner." : "The change couldn't be saved. Keep this page open and retry." };
  }
  revalidatePath("/communities");
  revalidatePath(path); return { ok: true, href: `${path}?done=${done}` };
}
export async function askToJoinAction(communityId: string, formData: FormData) {
  return act(communityId, "asked", formData, (kernel, community) => askToJoin(kernel, community, { note: text(formData.get("note")), bringBot: formData.get("bringBot") === "on", requestId: text(formData.get("requestId")) }));
}
export async function answerAskAction(communityId: string, formData: FormData) {
  const answer = text(formData.get("answer")) === "in" ? "in" : "declined";
  return act(communityId, answer === "in" ? "let-in" : "declined", formData, (kernel, community) => answerAsk(kernel, community, { askId: text(formData.get("askId")), answer }));
}
export async function sendNoteAction(communityId: string, formData: FormData) {
  return act(communityId, "noted", formData, (kernel, community) => sendNote(kernel, community, { to: text(formData.get("to")), text: text(formData.get("text")), requestId: text(formData.get("requestId")), inReplyTo: text(formData.get("inReplyTo")) || undefined }));
}
export async function updatePacksAction(communityId: string, formData: FormData) {
  if (!experimentalFeaturesEnabled()) notFound();
  return act(communityId, "packs", formData, (kernel, community) => updateCommunity(kernel, community, { packs: formData.getAll("packs") }));
}
export async function answerDesignAction(communityId: string, formData: FormData) {
  if (!experimentalFeaturesEnabled()) notFound();
  return act(communityId, "designed", formData, (kernel, community) => answerDesign(kernel, community, { askId: text(formData.get("askId")), proposalUrl: text(formData.get("proposalUrl")), systemKw: text(formData.get("systemKw")), panels: text(formData.get("panels")), annualKwh: text(formData.get("annualKwh")), price: text(formData.get("price")), note: text(formData.get("note")) }, text(formData.get("requestId"))));
}
export async function aiNotesAction(communityId: string, formData: FormData) {
  const on = text(formData.get("on")) === "on";
  return act(communityId, on ? "ai-notes-on" : "ai-notes-off", formData, (kernel, community) => letAiSendNotes(kernel, community, { on, requestId: text(formData.get("requestId")) }));
}
export async function letMyAiInAction(communityId: string, formData: FormData) {
  return act(communityId, "ai-in", formData, async (kernel, community) => {
    await requireOwner(kernel, community);
    const bot = companionOf(await kernel.myAvatars());
    if (!bot) throw new CommunityInputError("set up your bot first");
    await setBotAccess(kernel, { scope: community.scope, botAgentId: bot.agent_id, access: "add" }, `owner-ai-${community.communityId}`);
  });
}

export async function directoryVisibilityAction(communityId: string, formData: FormData) {
  return act(communityId, "directory", formData, (kernel, community) => updateCommunity(kernel, community, { directoryListed: formData.get("listed") === "true" }));
}
