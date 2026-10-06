"use server";

import { getKernel } from "@/lib/kernel/server";

export const SWAP_EXECUTED = "trading.swap.executed";
export const swapScope = (ownerId: string) => `actor:${ownerId}/trading:swaps`;

export type SwapRecord = {
  from: string;
  to: string;
  inAmount: string;
  outAmount: string;
  signature: string;
  at: string;
};

export async function recordSwap(ownerId: string, swap: Omit<SwapRecord, "at">) {
  const kernel = await getKernel();
  await kernel.recordEvent({
    type: SWAP_EXECUTED,
    scope: swapScope(ownerId),
    payload: { ...swap, at: new Date().toISOString() },
  });
}

export async function readSwaps(ownerId: string, limit = 20): Promise<SwapRecord[]> {
  const kernel = await getKernel();
  const events = await kernel.readEvents(swapScope(ownerId), { newestFirst: true, limit }).catch(() => []);
  return events
    .filter((e) => e.type === SWAP_EXECUTED)
    .map((e) => e.payload as SwapRecord);
}
