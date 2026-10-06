"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export function WalletConnect() {
  const { publicKey, disconnect } = useWallet();
  if (publicKey) {
    const short = `${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}`;
    return (
      <div className="flex items-center gap-2">
        <span className="rounded-full border border-line px-3 py-1.5 font-mono text-xs text-muted">{short}</span>
        <button onClick={() => disconnect()}
          className="rounded-full border border-line px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-muted hover:text-foreground">
          Disconnect
        </button>
      </div>
    );
  }
  return <WalletMultiButton className="!rounded-full !bg-accent !text-background !text-xs !font-semibold !uppercase !tracking-[0.14em]" />;
}
