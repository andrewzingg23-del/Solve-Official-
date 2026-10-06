"use client";

import { useState } from "react";
import { analyzeMarket } from "./analysis-actions";

export function BotAnalysis({ botName }: { botName: string }) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setError(null);
    const res = await analyzeMarket();
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Couldn't analyze the market.");
      return;
    }
    setText(res.text ?? null);
  }

  return (
    <section aria-labelledby="analysis-heading" className="flex flex-col gap-3 rounded-md border border-line bg-surface/60 p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Your bot reads the market</p>
          <h2 id="analysis-heading" className="mt-1 text-lg font-medium">What {botName} sees</h2>
        </div>
        <button type="button" onClick={run} disabled={busy}
          className="rounded bg-accent px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-background disabled:opacity-50">
          {busy ? "Reading…" : text ? "Refresh read" : "Ask your bot"}
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-negative">{error}</p>}
      {text ? (
        <p className="whitespace-pre-line text-sm leading-6">{text}</p>
      ) : (
        !error && <p className="text-xs leading-5 text-muted">Live prices above. Ask and {botName} will read the last 96 hours and tell you the trend, the momentum, and the one thing to watch.</p>
      )}
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted">Practice — observation only, not financial advice</p>
    </section>
  );
}
