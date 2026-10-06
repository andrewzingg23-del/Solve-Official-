"use client";

// The verb dock: four floating glass cards orbiting the living Earth.
// Trade shows a LIVE Bitcoin sparkline (real market data, fetched
// client-side). Build, Create and Gather are honest "Soon" placeholders —
// not links, never invented visuals, never fake numbers.
import Link from "next/link";
import { useEffect, useState } from "react";
import { Sparkline } from "@/app/packs/sparkline";
import { glassCard } from "@/app/ui";

type Quote = { closes: number[]; price: number; changePct24h: number };
type QuoteState = { status: "loading" } | { status: "ready"; quote: Quote } | { status: "failed" };

const fmtUsd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

function LiveBadge() {
  return (
    <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent-dim px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-accent">
      <span className="h-1 w-1 animate-pulse rounded-full bg-accent" aria-hidden="true" />
      Live
    </span>
  );
}

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
    return <span className="block h-12 w-full animate-pulse rounded-xl bg-surface-sunken" role="status" aria-label="Loading Bitcoin price" />;
  }
  if (state.status === "failed") {
    return <span className="block text-xs leading-6 text-muted">Market data unavailable</span>;
  }
  const { quote } = state;
  const up = quote.changePct24h >= 0;
  return (
    <span className="flex w-full flex-col gap-1.5" aria-label={`Bitcoin ${fmtUsd.format(quote.price)}, ${fmtPct(quote.changePct24h)} over 24 hours`}>
      <Sparkline points={quote.closes} width={200} height={40} label="Bitcoin price, last 48 hours" />
      <span className="flex items-baseline justify-between gap-2">
        <span className="stat-number text-xl text-foreground">{fmtUsd.format(quote.price)}</span>
        <span className={`text-xs font-semibold ${up ? "text-positive" : "text-negative"}`}>{fmtPct(quote.changePct24h)}</span>
      </span>
    </span>
  );
}

const CARD = `${glassCard} group flex min-h-[8.5rem] w-full flex-col justify-between gap-3 p-4`;

export function TradeCard() {
  return (
    <Link href="/packs/trading" className={CARD} aria-label="Trade markets — live Bitcoin price">
      <span className="flex items-center justify-between gap-2">
        <span className="eyebrow eyebrow-accent">Trade</span>
        <LiveBadge />
      </span>
      <TradeVisual />
      <span className="text-xs font-medium text-muted transition-colors group-hover:text-accent">
        Open the market <span aria-hidden="true">→</span>
      </span>
    </Link>
  );
}

export function SoonCard({ verb, note }: { verb: string; note: string }) {
  return (
    <div className={`${CARD} opacity-70`} aria-disabled="true" title={note}>
      <span className="flex items-center justify-between gap-2">
        <span className="eyebrow">{verb}</span>
        <span className="rounded-full border border-dashed border-line px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-faint">Soon</span>
      </span>
      {/* Honest placeholder motif: a dashed orbit, waiting for a live reading. Not data. */}
      <svg width="72" height="28" viewBox="0 0 72 28" aria-hidden="true" className="opacity-50">
        <ellipse cx="36" cy="14" rx="32" ry="10" fill="none" stroke="#f2f7fb" strokeOpacity="0.25" strokeWidth="1" strokeDasharray="4 4" />
        <ellipse cx="36" cy="14" rx="18" ry="6" fill="none" stroke="#f2f7fb" strokeOpacity="0.18" strokeWidth="1" strokeDasharray="3 4" />
      </svg>
      <span className="text-xs leading-5 text-muted">{note}</span>
    </div>
  );
}

const SOON = [
  { verb: "Build", note: "Rooms, packs, and tools that compound." },
  { verb: "Create", note: "Your avatar, your content, your worlds." },
  { verb: "Gather", note: "Communities with portable identity." },
];

export function VerbDock() {
  return (
    <nav aria-label="What do you want to do?" className="pointer-events-auto flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 md:px-0">
      <div className="w-48 shrink-0 snap-start md:w-56">
        <TradeCard />
      </div>
      {SOON.map((s) => (
        <div key={s.verb} className="w-48 shrink-0 snap-start md:w-56">
          <SoonCard verb={s.verb} note={s.note} />
        </div>
      ))}
    </nav>
  );
}
