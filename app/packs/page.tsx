import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { loginRequired } from "@/lib/auth/gate";
import { marketSnapshot, type SymbolId, type Candle } from "@/lib/packs/trading";
import { primaryAction } from "@/app/ui";
import { TradingCardVisual } from "./trading-card-visual";
import { BotPulse } from "./bot-pulse";
import { BuildVisual, CreateVisual, GatherVisual } from "./soon-visuals";

export const metadata: Metadata = { title: "What do you want to do? — solve" };

const SOON = [
  {
    id: "build",
    verb: "Build",
    title: "Build something",
    desc: "Rooms, packs, and tools that compound.",
    Visual: BuildVisual,
  },
  {
    id: "create",
    verb: "Create",
    title: "Create",
    desc: "Your avatar, your content, your worlds.",
    Visual: CreateVisual,
  },
  {
    id: "gather",
    verb: "Gather",
    title: "Gather your people",
    desc: "Communities with portable identity.",
    Visual: GatherVisual,
  },
];

function changePct24h(candles: Candle[]): number | null {
  if (candles.length < 2) return null;
  const closes = candles.map((c) => c.close);
  const latest = closes[closes.length - 1];
  const ref = closes[Math.max(0, closes.length - 25)];
  return ((latest - ref) / ref) * 100;
}

const STRIP_SYMBOLS: { id: SymbolId; label: string }[] = [
  { id: "BTCUSDT", label: "Bitcoin" },
  { id: "SOLUSDT", label: "Solana" },
];

export default async function PacksPage() {
  const user = await getUser();
  if (!user && loginRequired()) redirect("/login?next=/packs");
  // Real market data for the ambient proof strip. If the feed is down the
  // strip says so honestly — no invented numbers, ever.
  const snapshot = await marketSnapshot().catch(() => null);

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-12 pb-24">
      <div>
        <p className="eyebrow">Your ID</p>
        <h1 className="mt-3 text-4xl font-medium tracking-tight md:text-5xl">
          What do you want to <span className="serif-accent">do?</span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          Pick one to start. The rest are coming.
        </p>
      </div>

      {/* The one live pack — its own card, its own live micro-visuals. */}
      <Link
        href="/packs/trading"
        className="group glass relative block overflow-hidden p-6 transition-all duration-300 ease-calm hover:-translate-y-1 hover:shadow-[var(--shadow-lift)] md:p-8"
      >
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent-dim via-transparent to-transparent"
          aria-hidden="true"
        />
        <div className="relative grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="eyebrow eyebrow-accent">Play</p>
              <span className="flex items-center gap-1.5 rounded-full bg-accent-dim px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" aria-hidden="true" />
                Live
              </span>
            </div>
            <h2 className="mt-3 text-3xl font-medium tracking-tight">Trade markets</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted">
              Live charts, your bot reading them with you, real on-chain swaps.
            </p>
            <span className={`${primaryAction} mt-6`}>Enter the pack</span>
          </div>
          <div className="border-t border-line-soft pt-5 md:w-64 md:border-l md:border-t-0 md:pl-6 md:pt-0">
            <TradingCardVisual />
            <div className="mt-3">
              <BotPulse />
            </div>
          </div>
        </div>
      </Link>

      {/* Not ready yet: honest Soon cards, non-links, aria-disabled. */}
      <div className="grid gap-4 sm:grid-cols-3">
        {SOON.map((p) => (
          <div
            key={p.id}
            aria-disabled="true"
            className="glass relative flex flex-col gap-3 p-5 opacity-70"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="eyebrow">{p.verb}</p>
              <span className="rounded-full border border-line px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-faint">
                Soon
              </span>
            </div>
            <h2 className="text-xl font-medium tracking-tight">{p.title}</h2>
            <p className="text-sm leading-6 text-muted">{p.desc}</p>
            <div className="mt-auto pt-2">
              <p.Visual />
            </div>
          </div>
        ))}
      </div>

      {/* Ambient proof strip — real market numbers, never claims we can't back. */}
      <div className="proof-strip py-5" aria-label="Live market snapshot">
        <p className="eyebrow">Live market</p>
        {snapshot ? (
          <div className="mt-4 flex flex-wrap gap-x-10 gap-y-4">
            {STRIP_SYMBOLS.map(({ id, label }) => {
              const candles = snapshot[id] ?? [];
              if (candles.length < 2) return null;
              const price = candles[candles.length - 1].close;
              const chg = changePct24h(candles);
              const up = (chg ?? 0) >= 0;
              return (
                <div key={id}>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-faint">{label}</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight">
                    ${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </p>
                  {chg !== null && (
                    <p className={`text-xs font-medium tabular-nums ${up ? "text-positive" : "text-negative"}`}>
                      {up ? "+" : ""}
                      {chg.toFixed(2)}% · 24h
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 text-xs leading-5 text-muted">
            Market data unavailable right now — the trading pack will say the same.
          </p>
        )}
      </div>
    </main>
  );
}
