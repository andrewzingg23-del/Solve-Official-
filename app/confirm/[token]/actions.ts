"use server";

import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { hashConfirmationToken, isPlausibleToken, requestIdFor } from "@/lib/product/confirmation-token";
import { confirmationError } from "@/lib/product/confirmation-errors";

export type AnswerResult = { ok: true; decision: "confirmed" | "disputed" } | { ok: false; error: string } | null;

// The other side's answer. Recorded as evidence authored by them; it grants them nothing else.
export async function answerConfirmationAction(_previous: AnswerResult, form: FormData): Promise<AnswerResult> {
  const token = String(form.get("token") ?? "");
  const decision = String(form.get("decision") ?? "");
  const note = String(form.get("note") ?? "").trim();
  if (!isPlausibleToken(token)) return { ok: false, error: confirmationError("link is unavailable", "") };
  if (decision !== "confirmed" && decision !== "disputed") return { ok: false, error: "Choose whether to confirm or dispute it." };
  if (note.length > 2000) return { ok: false, error: "That note is too long to record." };

  const user = await getUser();
  if (!user) return { ok: false, error: "Your identity isn't ready yet. Reload and try again." };

  const hash = hashConfirmationToken(token);
  try {
    await (await getKernel()).answerConfirmation({ tokenHash: hash, decision, note, requestId: requestIdFor(hash, decision) });
  } catch (error) {
    return { ok: false, error: confirmationError(error, "Your answer wasn't recorded. Nothing changed; try again.") };
  }
  // No revalidation here: re-rendering the page as answered would unmount the message telling this
  // person their answer was recorded, and read as though someone else had answered first. A later
  // visit reads the answered state from the kernel, including that it was theirs.
  return { ok: true, decision };
}
