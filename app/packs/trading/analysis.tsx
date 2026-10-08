"use client";

import { useEffect, useState } from "react";
import { analyzeMarket, type MarketTicket } from "./analysis-actions";
import { Reveal } from "../reveal";

function Confidence({ level }: { level: string }) {
  const n = level === "High" ? 3 : level === "Medium" ? 2 : 1;
  const [on, setOn] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <span className="flex items-center gap-1" aria-label={`Confidence: ${level}`}>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={`h-1 w-4 rounded-full transition-all duration-700 ease-calm ${
            i <= n ? "bg-accent shadow-[0_0_10px_rgb(34_211_238/0.7)]" : "bg-line"
          }`}
          style={{
            transitionDelay: `${i * 110}ms`,
            transform: on || i > n ? "scaleX(1)" : "scaleX(0.2)",
            transformOrigin: "left center",
            opacity: on || i > n ? 1 : 0.25,
          }}
        />
      ))}
      <span className="ml-1 text-[10px] uppercase tracking-[0.12em] text-faint">{level}</span>
    </span>
  );
}

function ReadCard({
  eyebrow,
  title,
  detail,
  confidence,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  confidence?: string;
}) {
  return (
    <div className="fx-trace h-full rounded-2xl border border-line-soft bg-surface-sunken/50 p-4 transition-shadow duration-300 ease-calm hover:shadow-[0_0_32px_rgb(34_211_238/0.12)]">
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow">{eyebrow}</p>
        {confidence && <Confidence level={confidence} />}
      </div>
      <p className="mt-2 text-base font-medium">{title}</p>
      <p className="mt-1 text-sm leading-6 text-muted">{detail}</p>
    </div>
  );
}

// The bot's market read: Trend / Momentum / Watch — the lime-ref card row,
// bound to the real analysis backend. Honest states only: idle, working,
// error, or the ticket itself.
export function BotAnalysis({ botName }: { botName: string }) {
  const [ticket, setTicket] = useState<MarketTicket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setError(null);
    const res = await analyzeMarket();
    setBusy(false);
    if (!res.ok || !res.ticket) {
      setError(res.error ?? "Couldn't analyze the market.");
      return;
    }
    setTicket(res.ticket);
  }

  return (
    <section
      aria-labelledby="analysis-heading"
      id="analysis"
      className="glass flex scroll-mt-24 flex-col gap-4 p-5 md:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow eyebrow-accent">Your bot reads the market</p>
          <h2 id="analysis-heading" className="mt-2 text-xl font-medium tracking-tight">
            What {botName} sees
          </h2>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="inline-flex h-11 items-center justify-center rounded-full bg-accent px-6 text-[11px] font-bold uppercase tracking-[0.16em] text-accent-ink transition-all duration-300 ease-calm hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? "Reading…" : ticket ? "Refresh read" : "Ask your bot"}
        </button>
      </div>
      {error && (
        <p role="alert" className="alert-pin rounded-xl px-4 py-3 text-sm">
          {error}
        </p>
      )}
      {ticket ? (
        <div className="grid gap-3 md:grid-cols-3">
          <Reveal delay={0}>
            <ReadCard
              eyebrow="Trend"
              title={ticket.trend.label}
              detail={ticket.trend.detail}
              confidence={ticket.trend.confidence}
            />
          </Reveal>
          <Reveal delay={90}>
            <ReadCard
              eyebrow="Momentum"
              title={ticket.momentum.label}
              detail={ticket.momentum.detail}
              confidence={ticket.momentum.confidence}
            />
          </Reveal>
          <Reveal delay={180}>
            <ReadCard eyebrow="Watch" title={ticket.watch.label} detail={ticket.watch.detail} />
          </Reveal>
        </div>
      ) : (
        !error && (
          <p className="text-sm leading-6 text-muted">
            Live prices above. Ask and {botName} will read the last 96 hours — trend,
            momentum, and the one thing to watch, each with a confidence read.
          </p>
        )
      )}
      <p className="text-[10px] uppercase tracking-[0.14em] text-faint">
        Practice — observation only, not financial advice
      </p>
    </section>
  );
}
