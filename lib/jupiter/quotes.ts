// Server-side Jupiter client (read-only quotes, no key needed).
// Ultra API: https://api.jup.ag/ultra/v1

const ULTRA_API = "https://api.jup.ag/ultra/v1";

export const MINTS = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
} as const;

// Dummy taker for quote-only requests (no wallet needed for a price).
const QUOTE_TAKER = "11111111111111111111111111111111";

export type JupiterOrder = {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct?: string;
};

export async function getOrder(
  inputMint: string,
  outputMint: string,
  amount: string, // in smallest units (lamports / micro-USDC)
): Promise<JupiterOrder> {
  const url = `${ULTRA_API}/order?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&taker=${QUOTE_TAKER}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Jupiter order failed: ${res.status}`);
  return res.json();
}

/** Human-friendly: how much USDC for 1 SOL, and how much SOL for 100 USDC. */
export async function getSolUsdcQuotes() {
  const [solToUsdc, usdcToSol] = await Promise.all([
    getOrder(MINTS.SOL, MINTS.USDC, "1000000000").catch(() => null), // 1 SOL
    getOrder(MINTS.USDC, MINTS.SOL, "100000000").catch(() => null), // 100 USDC
  ]);
  return {
    solToUsdc: solToUsdc ? Number(solToUsdc.outAmount) / 1e6 : null,
    usdcToSol: usdcToSol ? Number(usdcToSol.outAmount) / 1e9 : null,
  };
}
