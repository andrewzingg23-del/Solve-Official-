import { getKernel } from "@/lib/kernel/server";
import { readSwaps, type SwapRecord } from "@/lib/trading/social";
import { SwapFeedClient } from "./social-client";

export async function SwapFeed({ ownerId }: { ownerId: string }) {
  const kernel = await getKernel();
  const swaps = await readSwaps(kernel, ownerId).catch(() => [] as SwapRecord[]);
  return <SwapFeedClient swaps={swaps} />;
}
