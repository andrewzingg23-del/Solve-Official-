"use client";

import { useEffect, useId, useRef, useState } from "react";

// Shared SVG sparkline. Points are real values or the component renders
// nothing (honest empty state, never a fake curve). Optional `animated`
// draws the line in on mount — decoration only, the values don't change.
export function Sparkline({
  points,
  width = 120,
  height = 36,
  stroke = "var(--accent)",
  label,
  className,
  animated = false,
  glow = false,
  fill = false,
}: {
  points: number[];
  width?: number;
  height?: number;
  stroke?: string;
  label?: string;
  className?: string;
  animated?: boolean;
  glow?: boolean;
  fill?: boolean;
}) {
  const pathRef = useRef<SVGPathElement>(null);
  const gradId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [ready, setReady] = useState(!animated);

  useEffect(() => {
    if (!animated) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = requestAnimationFrame(() => setReady(true));
      return () => cancelAnimationFrame(id);
    }
    const p = pathRef.current;
    if (!p) {
      const id = requestAnimationFrame(() => setReady(true));
      return () => cancelAnimationFrame(id);
    }
    const len = p.getTotalLength();
    p.style.strokeDasharray = `${len}`;
    p.style.strokeDashoffset = `${len}`;
    p.getBoundingClientRect(); // force reflow so the transition runs
    p.style.transition = "stroke-dashoffset 1.1s cubic-bezier(0.22, 1, 0.36, 1)";
    p.style.strokeDashoffset = "0";
    const t = setTimeout(() => {
      p.style.strokeDasharray = "";
      p.style.transition = "";
      setReady(true);
    }, 1150);
    return () => clearTimeout(t);
  }, [animated]);

  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = width / (points.length - 1);
  const yOf = (p: number) =>
    Number((height - 2 - ((p - min) / span) * (height - 4)).toFixed(1));
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${yOf(p)}`)
    .join(" ");
  const area = `${d} L${width.toFixed(1)},${(height - 1).toFixed(1)} L0,${(height - 1).toFixed(1)} Z`;
  const up = points[points.length - 1] >= points[0];
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label ?? `Trend, ${up ? "up" : "down"} over the shown period`}
      className={className ?? "block"}
    >
      <defs>
        <linearGradient id={`spark-${gradId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={0.3} />
          <stop offset="100%" stopColor={stroke} stopOpacity={0} />
        </linearGradient>
      </defs>
      {fill && (
        <path
          d={area}
          fill={`url(#spark-${gradId})`}
          style={{ opacity: ready ? 1 : 0, transition: "opacity 0.9s cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      )}
      <path
        ref={pathRef}
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={glow ? { filter: "drop-shadow(0 0 6px rgb(34 211 238 / 0.55))" } : undefined}
      />
      <circle
        cx={width - 1}
        cy={yOf(points[points.length - 1])}
        r={2.5}
        fill={stroke}
        style={{
          opacity: ready ? 1 : 0,
          transition: "opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1)",
          filter: glow ? "drop-shadow(0 0 5px rgb(34 211 238 / 0.8))" : undefined,
        }}
      />
    </svg>
  );
}
