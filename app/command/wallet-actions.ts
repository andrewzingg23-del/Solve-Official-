"use server";

// Linking a wallet the person controls: issue a signed challenge, then check the wallet's signature
// before the kernel links the address. solve never sees or holds a key.
import { revalidatePath } from "next/cache";
import { KernelError } from "@/lib/kernel/client";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { verifyWalletProof, walletChallenge, WalletProofError } from "@/lib/chain/wallet-proof";

// While money and settlement run on devnet, links are recorded for devnet. The address is the same key
// on every cluster.
const WALLET_CHAIN = "solana-devnet" as const;

const secret = () => process.env.SUPABASE_SECRET_KEY || null;

export type WalletResult = { ok: true; address: string } | { ok: false; error: string };

export async function walletChallengeAction(): Promise<{ message: string; token: string } | { error: string }> {
  if (!(await getUser())) return { error: "Sign in first." };
  const key = secret();
  if (!key) return { error: "Wallet linking isn't set up on this deployment yet." };
  try {
    const me = await (await getKernel()).whoami();
    return walletChallenge(key, me.actor_id, me.label);
  } catch {
    return { error: "Finish setting up your SOV ID first." };
  }
}

export async function linkWalletAction(input: { address: string; message: string; signature: string; token: string }): Promise<WalletResult> {
  if (!(await getUser())) return { ok: false, error: "Sign in first." };
  const key = secret();
  if (!key) return { ok: false, error: "Wallet linking isn't set up on this deployment yet." };
  try {
    const kernel = await getKernel();
    const me = await kernel.whoami();
    const address = await verifyWalletProof({ secret: key, actorId: me.actor_id, ...input });
    await kernel.linkWallet(WALLET_CHAIN, address);
    revalidatePath("/command");
    return { ok: true, address };
  } catch (error) {
    if (error instanceof WalletProofError) return { ok: false, error: `Not linked: ${error.message}.` };
    if (error instanceof KernelError && /another actor/.test(error.message)) return { ok: false, error: "Not linked: that wallet is already linked to someone else." };
    return { ok: false, error: "Not linked: something went wrong. Nothing was changed; try again." };
  }
}
