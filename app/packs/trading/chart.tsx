"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Candle, SymbolId } from "@/lib/packs/trading";
import { symbolLabel } from "@/lib/packs/trading";
import "../fx.css"; // pack motion layer (keyframes used below)

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
  const lineRef = useRef<SVGPathElement>(null);
  const g = useMemo(() => geometry(candles), [candles]);
  if (candles.length === 0) return <p className="text-xs text-muted">No market data right now.</p>;

  const last = candles[candles.length - 1];
  const pct = ((last.close - candles[0].open) / candles[0].open) * 100;
  const up = pct >= 0;
  const hovered = hover !== null ? candles[hover] : null;
  const gradId = `area-${symbol}`;
  const hx = hover !== null ? g.x(hover) : 0;
  const hoverPrice = hovered ? `$${hovered.close.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "";
  const tagW = hoverPrice.length * 7.2 + 18;

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
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Procedural depth: faint horizontal grid, dissolving at the edges. */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={PAD}
            y1={PAD + f * (H - PAD * 2)}
            x2={W - PAD}
            y2={PAD + f * (H - PAD * 2)}
            stroke="var(--foreground)"
            strokeOpacity={0.05}
            strokeWidth={1}
          />
        ))}
        <path
          d={g.area}
          fill={`url(#${gradId})`}
          className="chart-area"
          style={{ opacity: 0, transition: "opacity 1.2s cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
        <path
          ref={lineRef}
          d={g.line}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: "drop-shadow(0 0 6px rgb(34 211 238 / 0.55))" }}
        />
        {hover !== null && hovered && (
          <g style={{ opacity: 0, animation: "chart-hover-in 0.25s cubic-bezier(0.22, 1, 0.36, 1) forwards" }}>
            <line
              x1={hx}
              y1={PAD}
              x2={hx}
              y2={H - PAD}
              stroke="var(--accent)"
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.7}
            />
            <rect
              x={Math.min(W - PAD - tagW, Math.max(PAD, hx - tagW / 2))}
              y={PAD}
              width={tagW}
              height={22}
              rx={11}
              fill="var(--surface-raise)"
              stroke="var(--accent)"
              strokeOpacity={0.5}
            />
            <text
              x={Math.min(W - PAD - tagW / 2, Math.max(PAD + tagW / 2, hx))}
              y={PAD + 15}
              textAnchor="middle"
              fontSize={12}
              fill="var(--foreground)"
              fontFamily="monospace"
            >
              {hoverPrice}
            </text>
            <circle cx={hx} cy={g.y(hovered.close)} r={4.5} fill="var(--accent)" stroke="var(--background)" strokeWidth={2} />
            <circle cx={hx} cy={g.y(hovered.close)} r={4.5} fill="none" stroke="var(--accent)" strokeOpacity={0.6}>
              <animate attributeName="r" values="4.5;11" dur="1.4s" repeatCount="indefinite" />
              <animate attributeName="stroke-opacity" values="0.6;0" dur="1.4s" repeatCount="indefinite" />
            </circle>
          </g>
        )}
      </svg>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-faint tabular-nums">
        <span>${g.min.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
        <span>hourly</span>
        <span>${g.max.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
      </div>
      <ChartDrawIn lineRef={lineRef} />
    </div>
  );
}

// Draws the instrument line in on mount (animejs-grade easeOutExpo,
// hand-rolled). Decoration only — the values are already on screen.
function ChartDrawIn({ lineRef }: { lineRef: React.RefObject<SVGPathElement | null> }) {
  useEffect(() => {
    const p = lineRef.current;
    if (!p) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const len = p.getTotalLength();
    p.style.strokeDasharray = `${len}`;
    p.style.strokeDashoffset = `${len}`;
    p.getBoundingClientRect();
    p.style.transition = "stroke-dashoffset 1.3s cubic-bezier(0.16, 1, 0.3, 1)";
    p.style.strokeDashoffset = "0";
    const area = p.parentElement?.querySelector(".chart-area") as SVGPathElement | null;
    if (area) {
      const t = setTimeout(() => {
        area.style.opacity = "1";
      }, 350);
      const done = setTimeout(() => {
        p.style.strokeDasharray = "";
        p.style.transition = "";
      }, 1400);
      return () => {
        clearTimeout(t);
        clearTimeout(done);
      };
    }
    const done = setTimeout(() => {
      p.style.strokeDasharray = "";
      p.style.transition = "";
    }, 1400);
    return () => clearTimeout(done);
  }, [lineRef]);
  return null;
}
