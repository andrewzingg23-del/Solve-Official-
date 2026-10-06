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
    <section aria-labelledby="analysis-heading" className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)] md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Your bot reads the market</p>
          <h2 id="analysis-heading" className="mt-2 text-xl font-medium tracking-tight">What {botName} sees</h2>
        </div>
        <button type="button" onClick={run} disabled={busy}
          className="rounded-full bg-accent px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-background disabled:opacity-50">
          {busy ? "Reading…" : ticket ? "Refresh read" : "Ask your bot"}
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-negative">{error}</p>}
      {ticket ? (
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-line-soft bg-surface-sunken/50 p-4">
            <div className="flex items-center justify-between">
              <p className="eyebrow">Trend</p>
              <Confidence level={ticket.trend.confidence} />
            </div>
            <p className="mt-2 text-base font-medium">{ticket.trend.label}</p>
            <p className="mt-1 text-sm leading-6 text-muted">{ticket.trend.detail}</p>
          </div>
          <div className="rounded-xl border border-line-soft bg-surface-sunken/50 p-4">
            <div className="flex items-center justify-between">
              <p className="eyebrow">Momentum</p>
              <Confidence level={ticket.momentum.confidence} />
            </div>
            <p className="mt-2 text-base font-medium">{ticket.momentum.label}</p>
            <p className="mt-1 text-sm leading-6 text-muted">{ticket.momentum.detail}</p>
          </div>
          <div className="rounded-xl border border-line-soft bg-surface-sunken/50 p-4">
            <p className="eyebrow">Watch</p>
            <p className="mt-2 text-base font-medium">{ticket.watch.label}</p>
            <p className="mt-1 text-sm leading-6 text-muted">{ticket.watch.detail}</p>
          </div>
        </div>
      ) : (
        !error && <p className="text-sm leading-6 text-muted">Live prices above. Ask and {botName} will read the last 96 hours — trend, momentum, and the one thing to watch, each with a confidence read.</p>
      )}
      <p className="text-[10px] uppercase tracking-[0.14em] text-faint">Practice — observation only, not financial advice</p>
    </section>
  );
}
