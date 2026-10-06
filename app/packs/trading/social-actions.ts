"use server";

import { getKernel } from "@/lib/kernel/server";
import { recordSwap, setSharing, readWorldSwaps, sharingEnabled, type WorldSwap } from "@/lib/trading/social";
import { readWorldMembers } from "@/lib/world/collaboration";

export async function logSwap(swap: { from: string; to: string; inAmount: string; outAmount: string; signature: string }) {
  const kernel = await getKernel();
  const me = await kernel.whoami().catch(() => null);
  if (!me) return;
  await recordSwap(kernel, me.actor_id, swap).catch(() => {});
}

/** Opt in/out of sharing your swaps with your worlds. For the future toggle UI. */
export async function setSwapSharing(enabled: boolean) {
  const kernel = await getKernel();
  const me = await kernel.whoami().catch(() => null);
  if (!me) return;
  await setSharing(kernel, me.actor_id, enabled).catch(() => {});
}

/** Latest swaps from world members who enabled sharing. Observation only. */
export async function worldSwapFeed(worldScope: string, limit = 30): Promise<WorldSwap[]> {
  const kernel = await getKernel();
  const { ownerActorId, members } = await readWorldMembers(kernel, worldScope).catch(() => ({
    ownerActorId: "",
    members: [],
  }));
  const ids = [ownerActorId, ...members.map((m) => m.actorId)].filter(Boolean);
  return readWorldSwaps(kernel, ids, (k, actorId) => sharingEnabled(k, actorId), limit).catch(() => []);
}
