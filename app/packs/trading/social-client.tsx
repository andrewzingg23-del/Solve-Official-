"use client";

import type { SwapRecord } from "@/lib/trading/social";

// Activity feed: real swaps recorded as kernel events. Honest empty state
// when there are none — never placeholder trades.
export function SwapFeedClient({ swaps }: { swaps: SwapRecord[] }) {
  const copyTrade = (s: SwapRecord) => {
    // Pre-fill the SwapBox via a custom event the SwapBox listens for.
    window.dispatchEvent(new CustomEvent("swap:copy", { detail: { from: s.from, amount: s.inAmount } }));
    document.getElementById("swap-box")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  if (swaps.length === 0) {
    return (
      <p className="text-xs leading-5 text-muted">
        No swaps yet. When you trade, your history shows up here — and you can copy any trade with one tap.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {swaps.map((s, i) => (
        <li
          key={`${s.signature}-${i}`}
          className="glass flex items-center justify-between gap-3 !rounded-xl px-4 py-3 text-xs"
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate font-mono tabular-nums text-foreground">
              {s.inAmount} {s.from} → {s.outAmount} {s.to}
            </span>
            <span className="text-faint">{new Date(s.at).toLocaleString()}</span>
          </div>
          <button
            onClick={() => copyTrade(s)}
            className="inline-flex h-11 shrink-0 items-center rounded-full border border-line px-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted transition-colors duration-300 ease-calm hover:border-accent hover:text-accent active:scale-95"
          >
            Copy
          </button>
        </li>
      ))}
    </ul>
  );
}
