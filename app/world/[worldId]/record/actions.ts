"use server";

import { revalidatePath } from "next/cache";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { newConfirmationToken, requestIdFor } from "@/lib/product/confirmation-token";
import { confirmationError } from "@/lib/product/confirmation-errors";

export type AskResult = { ok: true; path: string } | { ok: false; error: string } | null;

// Ask a named person to confirm one thing. Nothing is sent by SOLVE: the owner shares the link
// themselves, so the only claim made here is that the request was recorded.
export async function askForConfirmation(_previous: AskResult, form: FormData): Promise<AskResult> {
  const worldId = String(form.get("worldId") ?? "");
  const entityId = String(form.get("entityId") ?? "");
  const askedOf = String(form.get("askedOf") ?? "").trim();
  const question = String(form.get("question") ?? "").trim();
  if (!askedOf) return { ok: false, error: "Say who you're asking, so you'll recognise their answer." };
  if (askedOf.length > 200) return { ok: false, error: "That name is too long to record." };
  if (question.length > 500) return { ok: false, error: "That question is too long to record." };
  if (!entityId) return { ok: false, error: "This thing couldn't be identified. Reload and try again." };

  const user = await getUser();
  if (!user) return { ok: false, error: "Your identity isn't ready yet. Reload and try again." };

  // The token is minted here and shown once. Only its hash reaches the kernel, and the request id
  // is derived from it, so a retry of this exact submission can never mint a second request.
  const { token, hash } = newConfirmationToken();
  try {
    await (await getKernel()).requestConfirmation({ entityId, tokenHash: hash, askedOf, question, requestId: requestIdFor(hash) });
  } catch (error) {
    return { ok: false, error: confirmationError(error, "The request wasn't recorded, and nothing was sent. Try again.") };
  }
  revalidatePath(`/world/${encodeURIComponent(worldId)}/record`);
  return { ok: true, path: `/confirm/${token}` };
}
