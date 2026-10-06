"use client";

import { useMemo, useState } from "react";
import type { Candle, SymbolId } from "@/lib/packs/trading";
import { symbolLabel } from "@/lib/packs/trading";

const W = 720;
const H = 280;
const PAD = 10;

function geometry(candles: Candle[]) {
  const min = Math.min(...candles.map((c) => c.low));
  const max = Math.max(...candles.map((c) => c.high));
  const span = max - min || 1;
  const x = (i: number) => PAD + (i / Math.max(candles.length - 1, 1)) * (W - PAD * 2);
  const y = (v: number) => PAD + (1 - (v - min) / span) * (H - PAD * 2);
  const line = candles
    .map((c, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(c.close).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${x(candles.length - 1).toFixed(1)},${(H - PAD).toFixed(1)} L${x(0).toFixed(1)},${(H - PAD).toFixed(1)} Z`;
  return { line, area, min, max, x, y };
}

// Cinematic area chart: cyan instrument line (the single accent), emerald/red
// reserved for the win/loss read. Hover/tap inspection is enhancement only —
// price, change, and range are always visible, nothing depends on it.
export function PriceChart({ symbol, candles }: { symbol: SymbolId; candles: Candle[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const g = useMemo(() => geometry(candles), [candles]);
  if (candles.length === 0) return <p className="text-xs text-muted">No market data right now.</p>;

  const last = candles[candles.length - 1];
  const pct = ((last.close - candles[0].open) / candles[0].open) * 100;
  const up = pct >= 0;
  const hovered = hover !== null ? candles[hover] : null;
  const gradId = `area-${symbol}`;
  const hx = hover !== null ? g.x(hover) : 0;

  const pick = (clientX: number, el: SVGSVGElement) => {
    const rect = el.getBoundingClientRect();
    const i = Math.round(((clientX - rect.left) / rect.width) * (candles.length - 1));
    setHover(Math.max(0, Math.min(candles.length - 1, i)));
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <p className="eyebrow">{symbolLabel(symbol)}</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
            ${last.close.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </p>
        </div>
        <p
          className={`rounded-full px-3 py-1 text-sm font-semibold tabular-nums ${up ? "ok-pin" : "alert-pin"}`}
        >
          {up ? "+" : ""}
          {pct.toFixed(2)}% · {candles.length}h
        </p>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-pan-y"
        role="img"
        aria-label={`${symbolLabel(symbol)} price chart, ${up ? "up" : "down"} ${Math.abs(pct).toFixed(2)} percent over the shown period`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => pick(e.clientX, e.currentTarget)}
        onTouchStart={(e) => {
          if (e.touches.length > 0) pick(e.touches[0].clientX, e.currentTarget);
        }}
        onTouchEnd={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={g.area} fill={`url(#${gradId})`} />
        <path
          d={g.line}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {hover !== null && hovered && (
          <g>
            <line
              x1={hx}
              y1={PAD}
              x2={hx}
              y2={H - PAD}
              stroke="var(--foreground)"
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.6}
            />
            <circle cx={hx} cy={g.y(hovered.close)} r={4} fill="var(--accent)" stroke="var(--background)" strokeWidth={2} />
            <text
              x={W - PAD}
              y={PAD + 12}
              textAnchor="end"
              fontSize={12}
              fill="var(--foreground)"
              fontFamily="monospace"
            >
              ${hovered.close.toLocaleString("en-US", { maximumFractionDigits: 2 })}
            </text>
          </g>
        )}
      </svg>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-faint tabular-nums">
        <span>${g.min.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
        <span>hourly</span>
        <span>${g.max.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
      </div>
    </div>
  );
}
