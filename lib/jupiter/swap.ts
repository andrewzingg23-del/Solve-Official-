// Jupiter Ultra swap execution. The user signs with their own wallet;
// we never custody funds. Real money on mainnet.

import { VersionedTransaction } from "@solana/web3.js";
import { MINTS } from "./quotes";

const ULTRA_API = "https://api.jup.ag/ultra/v1";

export type SwapOrder = {
  requestId: string;
  transaction: string; // base64 unsigned tx
  outAmount: string;
  inAmount: string;
  priceImpactPct?: string;
};

export async function getSwapOrder(
  inputMint: string,
  outputMint: string,
  amount: string,
  taker: string, // user's wallet address
  slippageBps = 50,
): Promise<SwapOrder> {
  const url = `${ULTRA_API}/order?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&taker=${taker}&slippageBps=${slippageBps}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Jupiter order failed: ${res.status}`);
  const data = await res.json();
  if (data.error || !data.transaction) throw new Error(data.errorMessage || "No transaction in order");
  return data;
}

export function deserializeTx(base64Tx: string): VersionedTransaction {
  const bytes = Uint8Array.from(atob(base64Tx), (c) => c.charCodeAt(0));
  return VersionedTransaction.deserialize(bytes);
}

export async function executeSwap(signedTxBase64: string, requestId: string) {
  const res = await fetch(`${ULTRA_API}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signedTransaction: signedTxBase64, requestId }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Execute failed: ${res.status} ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<{ signature: string; status: string }>;
}

export { MINTS };
