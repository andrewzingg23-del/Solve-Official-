"use server";

import { revalidatePath } from "next/cache";
import { saveBot } from "@/lib/bot/store";
import { KernelError } from "@/lib/kernel/client";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";

export type SaveResult = { ok: true; version: number; savedAt: string | null } | { ok: false; error: "signed-out" | "identity" | "forbidden" | "unavailable" };

// Saves the signed-in person's bot. The persona is validated again inside saveBot; the request id
// makes a double-click or a retried request write one version, not two.
export async function saveBotAction(requestId: string, persona: unknown): Promise<SaveResult> {
  if (!(await getUser())) return { ok: false, error: "signed-out" };
  try {
    const bot = await saveBot(await getKernel(), persona, requestId);
    revalidatePath("/bot");
    return { ok: true, version: bot.history.length, savedAt: bot.saved?.at ?? null };
  } catch (error) {
    if (error instanceof KernelError && error.name === "unauthenticated") return { ok: false, error: "identity" };
    if (error instanceof KernelError && error.name === "forbidden") return { ok: false, error: "forbidden" };
    return { ok: false, error: "unavailable" };
  }
}
