"use server";

import { randomUUID } from "node:crypto";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { BASE_LOOK, normalizeCardLook, type CardLook } from "@/lib/product/card";
import { readLook, writeLook } from "@/lib/product/look-store";

export type LookResult = { ok: true; look: CardLook; canUndo: boolean } | { ok: false; error: string };

// Every change goes through the same path: read what is there, write the next version. Save, undo
// and return-to-Base are three names for one act, so none of them can bypass the record.
async function commit(choose: (current: Awaited<ReturnType<typeof readLook>>) => CardLook | null): Promise<LookResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Your identity isn't ready yet. Reload and try again." };
  try {
    const kernel = await getKernel();
    const me = await kernel.whoami();
    const current = await readLook(kernel, me.actor_id);
    const next = choose(current);
    if (!next) return { ok: false, error: "There's nothing to undo." };
    await writeLook(kernel, me.actor_id, current, next, randomUUID());
    // No revalidation: the studio already holds the saved look, and re-rendering the page moved
    // focus to the skip link. A later visit reads the look from the kernel.
    return { ok: true, look: next, canUndo: true };
  } catch {
    return { ok: false, error: "Your card's look wasn't saved, and nothing changed. Try again." };
  }
}

export async function saveLook(value: unknown): Promise<LookResult> {
  const look = normalizeCardLook(value);
  return commit(() => look);
}

export async function undoLook(): Promise<LookResult> {
  return commit(current => current.previous);
}

export async function resetLook(): Promise<LookResult> {
  return commit(() => ({ ...BASE_LOOK }));
}
