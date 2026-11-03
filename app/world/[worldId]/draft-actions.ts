"use server";

// Slice B — generate a first website draft for a project from its goal. Kernel-authorized, bounded by
// the existing token budget, and persisted as a normal versioned CreativeArtifact (one concept, one
// home). The generated HTML is untrusted and only ever shown in the script-free sandboxed preview.
import { revalidatePath } from "next/cache";
import { ACCOUNT_CHANGED, requireDisplayedActor } from "@/lib/product/account-guard";
import type { FormResult } from "@/app/product/recoverable-form";
import { KernelError } from "@/lib/kernel/client";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { createCreativeArtifact, loadCreativeWorld } from "@/lib/world/creative";
import { buildChatCompletionBody, ChatTimeoutError, completeChat, OPENROUTER_MISSING_KEY_ERROR } from "@/lib/bot/openrouter";
import { recordSpend, resolveChatModel, spendBlocked } from "@/lib/bot/chat";
import { buildWebsiteDraftMessages, draftErrorMessage, evaluateDraft, looksLikeHtmlDocument } from "@/lib/product/website-draft";

// The provider call is bounded below this route's function limit so a slow model fails cleanly as a
// recoverable "took too long", never a killed worker with no response.
const DRAFT_TIMEOUT_MS = 50_000;
const text = (value: FormDataEntryValue | null) => (typeof value === "string" ? value : "");

export async function generateFirstDraftAction(worldId: string, formData: FormData): Promise<FormResult> {
  if (!(await getUser())) return { ok: false, error: "Sign in again to build this draft. Your idea is still here." };
  try {
    const kernel = await getKernel();
    await requireDisplayedActor(kernel, text(formData.get("expectedActorId")));
    const me = await kernel.whoami();
    const { world, artifacts } = await loadCreativeWorld(kernel, worldId);

    // Safe retry: if a draft already exists (e.g., an earlier attempt finished late), don't generate
    // again — just open it. The stable idempotency key below also dedupes concurrent commits.
    if (artifacts.some((a) => looksLikeHtmlDocument(a.body))) {
      return { ok: true, href: `/world/${worldId}?saved=draft` };
    }

    // Read access is sufficient to reopen existing output, but never to spend generation resources.
    // Use the kernel policy decision, including lease limits/governance, rather than a UI grant flag.
    const authority = await kernel.authorize({ capability: "world.entity.write", scope: world.scope });
    if (authority.decision !== "ALLOW") return { ok: false, error: "You need permission to edit this project before building a draft." };

    const goal = text(formData.get("goal")).trim() || world.summary.trim();
    if (goal.length > 7000) return { ok: false, error: "Keep the description to 7,000 characters or less, then build again." };
    if (goal.length < 3) return { ok: false, error: "Add a sentence about what you want, then build the draft." };
    if (spendBlocked(me.actor_id)) return { ok: false, error: "You've used this hour's build budget. Try again shortly." };

    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) return { ok: false, error: OPENROUTER_MISSING_KEY_ERROR };
    const model = resolveChatModel("smart");
    const messages = buildWebsiteDraftMessages({ title: world.title, goal });
    const t0 = Date.now();
    let result;
    try {
      result = await completeChat(
        apiKey,
        buildChatCompletionBody({ model, system: messages[0].content, history: [], message: messages[1].content, maxTokens: 8000 }),
        { timeoutMs: DRAFT_TIMEOUT_MS, allowEmpty: true },
      );
    } catch (error) {
      const timedOut = error instanceof ChatTimeoutError;
      console.warn(`[first-draft] model=${model} outcome=${timedOut ? "timeout" : "provider_error"} ms=${Date.now() - t0}`);
      return { ok: false, error: draftErrorMessage(timedOut ? "timeout" : "provider") };
    }
    recordSpend(me.actor_id, result.inputTokens + result.outputTokens);

    const outcome = evaluateDraft(result.reply, result.finishReason);
    // Diagnostic (no secrets, no content): completion status, sizes, timing, decision.
    console.log(`[first-draft] model=${model} finish=${result.finishReason} replyLen=${result.reply.length} reasoningChars=${result.reasoningChars} outputTokens=${result.outputTokens} ms=${Date.now() - t0} outcome=${outcome.ok ? "ok:" + outcome.html.length : outcome.reason}`);
    if (!outcome.ok) return { ok: false, error: draftErrorMessage(outcome.reason) };

    try {
      await createCreativeArtifact(kernel, {
        scope: world.scope,
        worldEntityId: world.entityId,
        // Stable per project: a late-finishing or duplicate attempt dedupes to one first draft.
        requestId: `first-draft:${worldId}`,
        title: `${world.title} — first draft`.slice(0, 160),
        body: outcome.html,
        position: { x: 50, y: 30 },
        via: { clientId: null, clientName: "SOLVE" },
        documentType: "website",
      });
    } catch (error) {
      // Only a save conflict can be reconciled here. A conflict alone is not evidence of success.
      if (!(error instanceof KernelError) || error.name !== "conflict") throw error;
      const saved = await loadCreativeWorld(kernel, worldId);
      if (!saved.artifacts.some((artifact) => looksLikeHtmlDocument(artifact.body))) throw error;
    }
  } catch (error) {
    if (error instanceof Error && error.message === ACCOUNT_CHANGED) return { ok: false, error: ACCOUNT_CHANGED };
    if (error instanceof KernelError && error.name === "forbidden") return { ok: false, error: "Your access to this project has changed." };
    if (error instanceof KernelError && error.name === "not_found") return { ok: false, error: "This project could not be found." };
    return { ok: false, error: error instanceof Error && error.message ? error.message : "We couldn't finish this step. Your idea is saved; retry in a moment." };
  }
  revalidatePath(`/world/${worldId}`);
  return { ok: true, href: `/world/${worldId}?saved=draft` };
}
