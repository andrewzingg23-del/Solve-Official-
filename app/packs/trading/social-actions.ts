"use server";

import { getKernel } from "@/lib/kernel/server";
import { recordSwap } from "@/lib/trading/social";

export async function logSwap(swap: { from: string; to: string; inAmount: string; outAmount: string; signature: string }) {
  const kernel = await getKernel();
  const me = await kernel.whoami().catch(() => null);
  if (!me) return;
  await recordSwap(me.actor_id, swap).catch(() => {});
}
