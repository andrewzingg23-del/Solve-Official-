"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export function WalletConnect() {
  const { publicKey, disconnect } = useWallet();
  if (publicKey) {
    const short = `${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}`;
    return (
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-2 rounded-full border border-[rgb(34_211_238/0.35)] bg-accent-dim px-3 py-1.5 font-mono text-xs text-foreground">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" aria-hidden="true" />
          {short}
        </span>
        <button onClick={() => disconnect()}
          className="rounded-full border border-line px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-muted transition-colors duration-300 ease-calm hover:border-accent hover:text-foreground">
          Disconnect
        </button>
      </div>
    );
  }
  return <WalletMultiButton className="!rounded-full !bg-accent !text-background !text-xs !font-semibold !uppercase !tracking-[0.14em] hover:!brightness-110 hover:!shadow-[0_0_28px_rgb(34_211_238/0.4)]" />;
}
