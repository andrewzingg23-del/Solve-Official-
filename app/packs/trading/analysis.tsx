"use client";

import { useState } from "react";
import { analyzeMarket, type MarketTicket } from "./analysis-actions";

function Confidence({ level }: { level: string }) {
  const n = level === "High" ? 3 : level === "Medium" ? 2 : 1;
  return (
    <span className="flex items-center gap-1" aria-label={`Confidence: ${level}`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={`h-1 w-4 rounded-full ${i <= n ? "bg-accent" : "bg-line"}`} />
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
    <div className="rounded-2xl border border-line-soft bg-surface-sunken/50 p-4">
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
          <ReadCard
            eyebrow="Trend"
            title={ticket.trend.label}
            detail={ticket.trend.detail}
            confidence={ticket.trend.confidence}
          />
          <ReadCard
            eyebrow="Momentum"
            title={ticket.momentum.label}
            detail={ticket.momentum.detail}
            confidence={ticket.momentum.confidence}
          />
          <ReadCard eyebrow="Watch" title={ticket.watch.label} detail={ticket.watch.detail} />
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
