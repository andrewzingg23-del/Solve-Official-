// Social trading: swaps as kernel events, world-scoped feeds.
// Pure kernel logic — the caller supplies the kernel (server components and
// actions get it from getKernel; tests fake it). No server-only imports here
// so this module stays unit-testable.
import type { kernelClient } from "@/lib/kernel/client";

type Kernel = ReturnType<typeof kernelClient>;

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

export async function recordSwap(kernel: Kernel, ownerId: string, swap: Omit<SwapRecord, "at">) {
  await kernel.recordEvent({
    type: SWAP_EXECUTED,
    scope: swapScope(ownerId),
    payload: { ...swap, at: new Date().toISOString() },
  });
}

export async function readSwaps(kernel: Kernel, ownerId: string, limit = 20): Promise<SwapRecord[]> {
  const events = await kernel.readEvents(swapScope(ownerId), { newestFirst: true, limit }).catch(() => []);
  return events
    .filter((e) => e.type === SWAP_EXECUTED)
    .map((e) => e.payload as SwapRecord);
}

export const SHARING_ENABLED = "trading.sharing.enabled";
export const SHARING_DISABLED = "trading.sharing.disabled";
const sharingScope = (ownerId: string) => `actor:${ownerId}/trading:settings`;

/**
 * Money privacy defaults to closed: a member's swaps appear in world feeds
 * only after they explicitly enable sharing. The toggle UI comes with the
 * redesign; the backend honors it now.
 */
export async function setSharing(kernel: Kernel, ownerId: string, enabled: boolean): Promise<void> {
  await kernel.recordEvent({
    type: enabled ? SHARING_ENABLED : SHARING_DISABLED,
    scope: sharingScope(ownerId),
    payload: { at: new Date().toISOString() },
  });
}

export async function sharingEnabled(kernel: Kernel, ownerId: string): Promise<boolean> {
  const events = await kernel.readEvents(sharingScope(ownerId), { newestFirst: true, limit: 1 }).catch(() => []);
  const latest = events.find((e) => e.type === SHARING_ENABLED || e.type === SHARING_DISABLED);
  return latest?.type === SHARING_ENABLED;
}

export type WorldSwap = SwapRecord & { actorId: string };

/**
 * World-scoped swap feed: latest swaps from world members who enabled
 * sharing, newest first. Observation only — reading never copies or
 * mirrors anyone's trades.
 */
export async function readWorldSwaps(
  kernel: Kernel,
  memberActorIds: string[],
  isSharing: (kernel: Kernel, actorId: string) => Promise<boolean>,
  limit = 30,
): Promise<WorldSwap[]> {
  const perMember = await Promise.all(
    memberActorIds.map(async (actorId) => {
      if (!(await isSharing(kernel, actorId).catch(() => false))) return [];
      const swaps = await kernel
        .readEvents(swapScope(actorId), { newestFirst: true, limit: 10 })
        .catch(() => []);
      return swaps
        .filter((e) => e.type === SWAP_EXECUTED)
        .map((e) => ({ ...(e.payload as SwapRecord), actorId }));
    }),
  );
  return perMember
    .flat()
    .sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""))
    .slice(0, limit);
}
