"use client";

// Verb dock: the four moves docked above the ask bar. Trade shows a LIVE
// Bitcoin sparkline (real Binance data, fetched client-side). Build, Create
// and Gather are honest "Soon" placeholders — not links, never invented
// visuals, never fake numbers.
import Link from "next/link";
import { useEffect, useState } from "react";
import { Sparkline } from "@/app/packs/sparkline";

type Quote = { closes: number[]; price: number; changePct24h: number };
type QuoteState = { status: "loading" } | { status: "ready"; quote: Quote } | { status: "failed" };

const fmtUsd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

function TradeVisual() {
  const [state, setState] = useState<QuoteState>({ status: "loading" });

  useEffect(() => {
    let live = true;
    fetch("/api/market/sparkline?symbol=BTCUSDT&limit=48")
      .then(async (res) => {
        if (!res.ok) throw new Error("Market data unavailable");
        const json = (await res.json()) as { closes?: unknown; price?: unknown; changePct24h?: unknown };
        if (!Array.isArray(json.closes) || json.closes.length < 2 || json.closes.some((c) => typeof c !== "number") || typeof json.price !== "number" || typeof json.changePct24h !== "number") {
          throw new Error("Bad shape");
        }
        return { closes: json.closes as number[], price: json.price, changePct24h: json.changePct24h };
      })
      .then((quote) => live && setState({ status: "ready", quote }))
      .catch(() => live && setState({ status: "failed" }));
    return () => {
      live = false;
    };
  }, []);

  if (state.status === "loading") {
    return (
      <span className="block h-6 w-full animate-pulse rounded bg-surface-sunken" role="status" aria-label="Loading Bitcoin price">
      </span>
    );
  }
  if (state.status === "failed") {
    return <span className="block text-[10px] leading-6 text-muted">Market data unavailable</span>;
  }
  const { quote } = state;
  return (
    <span className="flex w-full flex-col gap-0.5" aria-label={`Bitcoin ${fmtUsd.format(quote.price)}, ${fmtPct(quote.changePct24h)} over 24 hours`}>
      <Sparkline points={quote.closes} width={64} height={22} label="Bitcoin price, last 48 hours" />
      <span className="truncate text-[10px] leading-4 text-muted">
        {fmtUsd.format(quote.price)} · {fmtPct(quote.changePct24h)}
      </span>
    </span>
  );
}

const CARD = "flex min-h-[60px] min-w-0 flex-col justify-between gap-1 rounded-md border border-line bg-surface/85 px-2 py-1.5 backdrop-blur-md";
const VERB = "text-[10px] font-semibold uppercase tracking-[0.14em]";

const SOON = [
  { verb: "Build", note: "Rooms, packs, and tools that compound." },
  { verb: "Create", note: "Your avatar, your content, your worlds." },
  { verb: "Gather", note: "Communities with portable identity." },
];

export function VerbDock() {
  return (
    <nav aria-label="What do you want to do?" className="pointer-events-auto grid w-full grid-cols-4 gap-1.5">
      <Link href="/packs/trading" className={CARD} aria-label="Trade markets">
        <span className="flex items-center justify-between gap-1">
          <span className={`${VERB} text-foreground`}>Trade</span>
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent-dim px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.1em] text-accent">
            <span className="h-1 w-1 animate-pulse rounded-full bg-accent" aria-hidden="true" />
            Live
          </span>
        </span>
        <TradeVisual />
      </Link>
      {SOON.map((s) => (
        <div key={s.verb} className={`${CARD} border-line-soft bg-surface/50 opacity-60`} aria-disabled="true" title={s.note}>
          <span className={`${VERB} text-muted`}>{s.verb}</span>
          <span className="rounded-full border border-line px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] text-faint self-start">Soon</span>
        </div>
      ))}
    </nav>
  );
}
