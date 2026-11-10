"use server";

import { randomUUID } from "node:crypto";
import { getKernel } from "@/lib/kernel/server";
import { setSpaceShared } from "@/lib/product/page";
import { getUser } from "@/lib/supabase/server";

export type ShareResult = { ok: true; path: string } | { ok: false; error: string };

// Share this person's Space — their card and the things they've shared as pages — at one link, or
// stop. The record lives in their own scope, so only they can do either.
export async function shareSpace(shared: boolean): Promise<ShareResult> {
  if (!(await getUser())) return { ok: false, error: "Your identity isn't ready yet. Reload and try again." };
  try {
    const kernel = await getKernel();
    const me = await kernel.whoami();
    await setSpaceShared(kernel, me.actor_id, Boolean(shared), randomUUID());
    return { ok: true, path: `/s/${me.actor_id}` };
  } catch {
    return { ok: false, error: shared ? "It couldn't be shared. Try again." : "It couldn't be taken down. Try again — nothing else changed." };
  }
}
