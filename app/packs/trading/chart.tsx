"use client";

import { useMemo, useState } from "react";
import type { Candle, SymbolId } from "@/lib/packs/trading";
import { symbolLabel } from "@/lib/packs/trading";

const W = 720;
const H = 300;
const PAD = 8;

function pathFor(candles: Candle[]): { d: string; min: number; max: number } {
  const min = Math.min(...candles.map((c) => c.low));
  const max = Math.max(...candles.map((c) => c.high));
  const span = max - min || 1;
  const x = (i: number) => PAD + (i / Math.max(candles.length - 1, 1)) * (W - PAD * 2);
  const y = (v: number) => PAD + (1 - (v - min) / span) * (H - PAD * 2);
  let d = "";
  candles.forEach((c, i) => {
    d += `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(c.close).toFixed(1)}`;
  });
  return { d, min, max };
}

export function PriceChart({ symbol, candles }: { symbol: SymbolId; candles: Candle[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const { d, min, max } = useMemo(() => pathFor(candles), [candles]);
  if (candles.length === 0) return <p className="text-xs text-muted">No market data right now.</p>;
  const last = candles[candles.length - 1];
  const up = last.close >= candles[0].open;
  const hovered = hover !== null ? candles[hover] : null;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <div>
          <p className="text-sm font-medium">{symbolLabel(symbol)}</p>
          <p className="font-mono text-2xl tabular-nums">
            ${last.close.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </p>
        </div>
        <p className={`font-mono text-sm tabular-nums ${up ? "text-positive" : "text-negative"}`}>
          {up ? "▲" : "▼"} {Math.abs(((last.close - candles[0].open) / candles[0].open) * 100).toFixed(2)}%
        </p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${symbolLabel(symbol)} price chart`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const i = Math.round(((e.clientX - rect.left) / rect.width) * (candles.length - 1));
          setHover(Math.max(0, Math.min(candles.length - 1, i)));
        }}>
        <path d={d} fill="none" stroke={up ? "#00e5a0" : "#ff4d5e"} strokeWidth={1.5} />
        {hover !== null && hovered && (
          <g>
            <line x1={PAD + (hover / Math.max(candles.length - 1, 1)) * (W - PAD * 2)} y1={PAD}
              x2={PAD + (hover / Math.max(candles.length - 1, 1)) * (W - PAD * 2)} y2={H - PAD}
              stroke="#22d3ee" strokeWidth={1} strokeDasharray="3 3" />
            <text x={W - PAD} y={PAD + 12} textAnchor="end" fontSize={11} fill="#f2f7fb" fontFamily="monospace">
              ${hovered.close.toLocaleString("en-US", { maximumFractionDigits: 2 })}
            </text>
          </g>
        )}
      </svg>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-muted tabular-nums">
        <span>${min.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
        <span>{candles.length}h · hourly</span>
        <span>${max.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
      </div>
    </div>
  );
}
