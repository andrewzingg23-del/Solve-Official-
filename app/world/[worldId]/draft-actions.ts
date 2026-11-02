"use server";

// Slice B — generate a first website draft for a project from its goal. Owner-authorized, bounded by
// the existing token budget, and persisted as a normal versioned CreativeArtifact (one concept, one
// home). The generated HTML is untrusted and only ever shown in the script-free sandboxed preview.
import { revalidatePath } from "next/cache";
import { ACCOUNT_CHANGED, requireDisplayedActor } from "@/lib/product/account-guard";
import type { FormResult } from "@/app/product/recoverable-form";
import { KernelError } from "@/lib/kernel/client";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { createCreativeArtifact, loadCreativeWorld } from "@/lib/world/creative";
import { buildChatCompletionBody, completeChat, OPENROUTER_MISSING_KEY_ERROR } from "@/lib/bot/openrouter";
import { recordSpend, resolveChatModel, spendBlocked } from "@/lib/bot/chat";
import {
  buildWebsiteDraftMessages,
  extractHtmlDocument,
  isSubstantiveDraft,
  stripActiveContent,
} from "@/lib/product/website-draft";

const text = (value: FormDataEntryValue | null) => (typeof value === "string" ? value : "");

export async function generateFirstDraftAction(worldId: string, formData: FormData): Promise<FormResult> {
  if (!(await getUser())) return { ok: false, error: "Sign in again to build this draft. Your idea is still here." };
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return { ok: false, error: OPENROUTER_MISSING_KEY_ERROR };

  try {
    const kernel = await getKernel();
    await requireDisplayedActor(kernel, text(formData.get("expectedActorId")));
    const me = await kernel.whoami();
    const { world } = await loadCreativeWorld(kernel, worldId);
    const goal = text(formData.get("goal")).trim() || world.summary.trim();
    if (goal.length < 3) return { ok: false, error: "Add a sentence about what you want, then build the draft." };

    if (spendBlocked(me.actor_id)) return { ok: false, error: "You've used this hour's build budget. Try again shortly." };

    const messages = buildWebsiteDraftMessages({ title: world.title, goal });
    const result = await completeChat(
      apiKey,
      buildChatCompletionBody({ model: resolveChatModel("smart"), system: messages[0].content, history: [], message: messages[1].content, maxTokens: 8000 }),
    );
    recordSpend(me.actor_id, result.inputTokens + result.outputTokens);

    const html = stripActiveContent(extractHtmlDocument(result.reply) ?? "");
    if (!isSubstantiveDraft(html)) {
      return { ok: false, error: "The draft didn't come through cleanly. Try again, or add a little more detail to your idea." };
    }

    await createCreativeArtifact(kernel, {
      scope: world.scope,
      worldEntityId: world.entityId,
      requestId: text(formData.get("requestId")),
      title: `${world.title} — first draft`,
      body: html,
      position: { x: 50, y: 30 },
      via: { clientId: null, clientName: "SOLVE" },
    });
  } catch (error) {
    if (error instanceof Error && error.message === ACCOUNT_CHANGED) return { ok: false, error: ACCOUNT_CHANGED };
    if (error instanceof KernelError && error.name === "forbidden") return { ok: false, error: "Your access to this project has changed." };
    if (error instanceof KernelError && error.name === "not_found") return { ok: false, error: "This project could not be found." };
    return { ok: false, error: error instanceof Error && error.message ? error.message : "We couldn't finish this step. Your idea is saved; retry in a moment." };
  }
  revalidatePath(`/world/${worldId}`);
  return { ok: true, href: `/world/${worldId}?saved=draft` };
}
