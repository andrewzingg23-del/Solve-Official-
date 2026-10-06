"use client";

import type { SwapRecord } from "@/lib/trading/social";

export function SwapFeedClient({ swaps }: { swaps: SwapRecord[] }) {
  const copyTrade = (s: SwapRecord) => {
    // Pre-fill the SwapBox via a custom event the SwapBox listens for.
    window.dispatchEvent(new CustomEvent("swap:copy", { detail: { from: s.from, amount: s.inAmount } }));
    document.getElementById("swap-box")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  if (swaps.length === 0) {
    return (
      <p className="text-xs text-muted">
        No swaps yet. When you trade, your history shows up here — and you can copy any trade with one tap.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {swaps.map((s, i) => (
        <li key={`${s.signature}-${i}`} className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2 text-xs">
          <div className="flex flex-col">
            <span className="font-mono tabular-nums">{s.inAmount} {s.from} → {s.outAmount} {s.to}</span>
            <span className="text-muted">{new Date(s.at).toLocaleString()}</span>
          </div>
          <button onClick={() => copyTrade(s)}
            className="shrink-0 rounded-full border border-accent px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">
            Copy
          </button>
        </li>
      ))}
    </ul>
  );
}
