"use client";

import { useEffect, useState } from "react";
import { Sparkline } from "./sparkline";

type State =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; price: number; changePct24h: number; closes: number[] };

// Trading pack card micro-visualization. Binds real Binance hourly closes
// from /api/market/sparkline; degrades honestly — a loading line, an
// unavailable line, never a fake curve.
export function TradingCardVisual() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/market/sparkline?symbol=BTCUSDT")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: { price?: unknown; changePct24h?: unknown; closes?: unknown }) => {
        if (cancelled) return;
        const price = Number(data.price);
        const changePct24h = Number(data.changePct24h);
        const closes = Array.isArray(data.closes) ? data.closes.map(Number).filter(Number.isFinite) : [];
        if (!Number.isFinite(price) || !Number.isFinite(changePct24h) || closes.length < 2) {
          throw new Error("Bad payload");
        }
        setState({ kind: "ready", price, changePct24h, closes });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === "loading") {
    return <p className="text-xs leading-6 text-faint">Loading live market…</p>;
  }
  if (state.kind === "error") {
    return <p className="text-xs leading-6 text-faint">Market data unavailable</p>;
  }
  const up = state.changePct24h >= 0;
  return (
    <div className="flex items-end justify-between gap-3" aria-label="Live Bitcoin price and trend">
      <div>
        <p className="text-xl font-medium tabular-nums tracking-tight">
          ${state.price.toLocaleString("en-US", { maximumFractionDigits: 0 })}
        </p>
        <p className={`text-[11px] font-medium tabular-nums ${up ? "text-positive" : "text-negative"}`}>
          {up ? "+" : ""}
          {state.changePct24h.toFixed(2)}% · 24h
        </p>
      </div>
      <Sparkline
        points={state.closes}
        width={110}
        height={34}
        label={`Bitcoin hourly closes, ${up ? "up" : "down"} over the shown period`}
      />
    </div>
  );
}
