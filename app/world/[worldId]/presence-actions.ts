"use server";

import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { heartbeat, readPresence, type PresentActor } from "@/lib/world/presence";
export type { PresentActor } from "@/lib/world/presence";

function scopeOf(worldId: string): string {
  return `world:${worldId}`;
}

export async function presenceHeartbeat(worldId: string): Promise<{ ok: boolean }> {
  if (!(await getUser())) return { ok: false };
  try {
    await heartbeat(await getKernel(), scopeOf(worldId));
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function presenceList(worldId: string): Promise<PresentActor[]> {
  if (!(await getUser())) return [];
  try {
    return await readPresence(await getKernel(), scopeOf(worldId));
  } catch {
    return [];
  }
}
