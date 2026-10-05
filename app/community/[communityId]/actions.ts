"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { KernelError } from "@/lib/kernel/client";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { answerAsk, askToJoin, CommunityInputError, readCommunity, sendNote, updateCommunity } from "@/lib/community/community";
import { answerDesign, DeskInputError } from "@/lib/solar/desk";

const text = (value: FormDataEntryValue | null) => (typeof value === "string" ? value : "");

// Every action here: signed in, the community real, the work done, then back to the page with what
// happened. Redirects stay outside the try, because they throw.
async function act(communityId: string, done: string, work: (kernel: Awaited<ReturnType<typeof getKernel>>, community: NonNullable<Awaited<ReturnType<typeof readCommunity>>>) => Promise<unknown>) {
  const path = `/community/${communityId}`;
  if (!(await getUser())) redirect(`/login?next=${encodeURIComponent(path)}`);
  let error: string | null = null;
  try {
    const kernel = await getKernel();
    const community = await readCommunity(kernel, communityId);
    if (!community) error = "missing";
    else await work(kernel, community);
  } catch (caught) {
    error = caught instanceof CommunityInputError || caught instanceof DeskInputError ? "input"
      : caught instanceof KernelError && caught.name === "forbidden" ? "forbidden"
      : caught instanceof KernelError && caught.name === "not_found" ? "missing"
      : "save";
  }
  revalidatePath(path);
  redirect(`${path}?${error ? `error=${error}` : `done=${done}`}`);
}

export async function askToJoinAction(communityId: string, formData: FormData) {
  await act(communityId, "asked", (kernel, community) =>
    askToJoin(kernel, community, { note: text(formData.get("note")), bringBot: formData.get("bringBot") === "on", requestId: text(formData.get("requestId")) }));
}

export async function answerAskAction(communityId: string, formData: FormData) {
  const answer = text(formData.get("answer")) === "in" ? "in" : "declined";
  await act(communityId, answer === "in" ? "let-in" : "declined", (kernel, community) =>
    answerAsk(kernel, community, { askId: text(formData.get("askId")), answer }));
}

export async function sendNoteAction(communityId: string, formData: FormData) {
  await act(communityId, "noted", (kernel, community) =>
    sendNote(kernel, community, {
      to: text(formData.get("to")),
      text: text(formData.get("text")),
      requestId: text(formData.get("requestId")),
      inReplyTo: text(formData.get("inReplyTo")) || undefined,
    }));
}

export async function updatePacksAction(communityId: string, formData: FormData) {
  await act(communityId, "packs", (kernel, community) => updateCommunity(kernel, community, { packs: formData.getAll("packs") }));
}

export async function answerDesignAction(communityId: string, formData: FormData) {
  await act(communityId, "designed", (kernel, community) =>
    answerDesign(kernel, community, {
      askId: text(formData.get("askId")),
      proposalUrl: text(formData.get("proposalUrl")),
      systemKw: text(formData.get("systemKw")),
      panels: text(formData.get("panels")),
      annualKwh: text(formData.get("annualKwh")),
      price: text(formData.get("price")),
      note: text(formData.get("note")),
    }, text(formData.get("requestId"))));
}
