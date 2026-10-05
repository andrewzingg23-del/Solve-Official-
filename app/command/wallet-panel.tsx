"use client";

// Your wallet on the Command Center. Linking asks your own wallet (Phantom, Solflare or Backpack in
// this browser) to sign a short message. That proves control, moves nothing and costs nothing, and
// solve never sees a key.
import { useState, useTransition } from "react";
import { getBase58Decoder } from "@solana/kit";
import { linkWalletAction, walletChallengeAction } from "./wallet-actions";

type Provider = { connect(): Promise<{ publicKey: { toString(): string } }>; signMessage(message: Uint8Array, display?: string): Promise<{ signature: Uint8Array } | Uint8Array> };

function injectedWallet(): Provider | null {
  const w = window as unknown as { phantom?: { solana?: Provider }; solflare?: Provider; backpack?: { solana?: Provider }; solana?: Provider };
  return w.phantom?.solana ?? w.solflare ?? w.backpack?.solana ?? w.solana ?? null;
}

export const short = (address: string) => `${address.slice(0, 4)}…${address.slice(-4)}`;

export function WalletPanel({ wallets }: { wallets: string[] }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const link = () =>
    start(async () => {
      setMessage(null);
      const wallet = injectedWallet();
      if (!wallet) return setMessage("No Solana wallet found in this browser. Install Phantom, Solflare or Backpack, then try again.");
      const challenge = await walletChallengeAction();
      if ("error" in challenge) return setMessage(challenge.error);
      try {
        const { publicKey } = await wallet.connect();
        const signed = await wallet.signMessage(new TextEncoder().encode(challenge.message), "utf8");
        const bytes = signed instanceof Uint8Array ? signed : signed.signature;
        const result = await linkWalletAction({ address: publicKey.toString(), message: challenge.message, signature: getBase58Decoder().decode(bytes), token: challenge.token });
        setMessage(result.ok ? `Linked ${short(result.address)}.` : result.error);
      } catch {
        setMessage("The wallet didn't sign, so nothing was linked.");
      }
    });
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-3">
      {wallets.length ? (
        <p className="text-sm leading-6 tabular-nums">
          Your wallet: {wallets.map(short).join(", ")} <span className="text-muted">· yours alone; solve never holds keys</span>
        </p>
      ) : (
        <p className="text-sm leading-6 text-muted">No wallet linked. Link a Solana wallet you control: you sign a message, nothing moves, and solve never holds keys.</p>
      )}
      <button type="button" onClick={link} disabled={pending} className="inline-flex h-8 items-center justify-center self-start rounded-md border border-line px-3 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors duration-300 ease-calm hover:border-accent hover:text-accent disabled:opacity-50">
        {pending ? "Waiting for your wallet…" : wallets.length ? "Link another wallet" : "Link a wallet"}
      </button>
      {message ? <p role="status" className="text-xs text-muted">{message}</p> : null}
    </div>
  );
}
