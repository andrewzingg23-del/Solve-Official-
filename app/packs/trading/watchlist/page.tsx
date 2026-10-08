import type { Metadata } from "next";
import { WatchlistClient } from "./watchlist-client";

export const metadata: Metadata = { title: "Watchlist — trading pack · solve" };

export default function WatchlistPage() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-12 pb-24">
      <div>
        <p className="eyebrow">Pack · Trading · Intel</p>
        <h1 className="mt-3 text-3xl font-medium tracking-tight text-foreground md:text-4xl">
          The <span className="serif-accent">watchlist.</span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Researched memecoin accounts, ranked by evidence — October 2026. Attention
          signals to verify on-chain, never calls to copy. Nothing here is a trade
          recommendation.
        </p>
      </div>

      <div
        role="note"
        className="glass border-[rgb(34_211_238/0.25)] bg-[rgb(34_211_238/0.05)] p-5"
      >
        <p className="text-sm leading-6 text-foreground/90">
          The strongest finding across every source: treat all KOLs as attention
          signals to verify on-chain. By the time a call reaches your feed, the
          caller and their inner circle are already positioned.
        </p>
      </div>

      <WatchlistClient />

      <p className="mt-4 text-xs leading-5 text-faint">
        Research compiled October 8, 2026 from indexed web sources. Follower counts
        are dated snapshots. Track records move daily — verify before you trust.
      </p>
    </main>
  );
}
