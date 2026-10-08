import type { Metadata } from "next";
import { ArgusCanvas } from "./argus-canvas";

export const metadata: Metadata = { title: "ARGUS — trading watch · solve" };

const TOKENS = [
  { label: "LONG", value: "$1.95M MC", change: "-11.36%", up: false },
  { label: "RHEA", value: "$79.1M MC", change: "+3.25%", up: true },
  { label: "PONKE", value: "$12.6M MC", change: "-6.50%", up: false },
  { label: "PRIORS", value: "$6.58M MC", change: "+5.13%", up: true },
  { label: "SI", value: "$24.0M MC", change: "-10.26%", up: false },
];

const MARKETS = [
  { label: "BTC", value: "$83,316", change: "-2.59%", up: false },
  { label: "ETH", value: "$2,577", change: "-4.58%", up: false },
  { label: "SOL", value: "$116.46", change: "-3.47%", up: false },
  { label: "HYPE", value: "$88.44", change: "-3.82%", up: false },
];

function CloudRow({ items }: { items: typeof TOKENS }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((t) => (
        <li key={t.label} className="glass p-4">
          <p className="text-sm font-semibold text-foreground">{t.label}</p>
          <p className="mt-1 text-xs tabular-nums text-muted">{t.value}</p>
          <p className={`mt-1 text-xs font-semibold tabular-nums ${t.up ? "ok-pin inline-block" : "alert-pin inline-block"}`}>
            {t.change}
          </p>
        </li>
      ))}
    </ul>
  );
}

export default function ArgusPage() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-12 pb-24">
      <div>
        <p className="eyebrow">Pack · Trading · Intel</p>
        <h1 className="mt-3 text-3xl font-medium tracking-tight text-foreground md:text-4xl">
          <span className="serif-accent">ARGUS.</span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          The watcher that never blinks. Signal clouds orbit the machine — what the
          feeds are saying, at a glance.
        </p>
      </div>

      <section aria-label="ARGUS machine" className="glass relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-accent-dim via-transparent to-transparent"
          aria-hidden="true"
        />
        <ArgusCanvas />
        <p className="relative border-t border-line-soft px-5 py-3 text-[11px] tabular-nums text-faint">
          Snapshot · Oct 7, 2026 · FOMO feed — illustrative, not live prices, not a
          recommendation.
        </p>
      </section>

      <section aria-label="Trending tokens">
        <p className="eyebrow eyebrow-accent">Trending tokens</p>
        <div className="mt-3">
          <CloudRow items={TOKENS} />
        </div>
      </section>

      <section aria-label="Market ticker">
        <p className="eyebrow eyebrow-accent">Market ticker</p>
        <div className="mt-3">
          <CloudRow items={MARKETS} />
        </div>
      </section>

      <p className="text-xs leading-5 text-faint">
        ARGUS watches; it doesn&apos;t trade. Every signal here is an input to verify
        on-chain — see the watchlist for who to trust and the shill screen for who
        to dodge.
      </p>
    </main>
  );
}
