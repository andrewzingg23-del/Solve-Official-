"use client";

import { useEffect, useRef, useState } from "react";

// Count-up between two REAL values with an easeOutExpo curve (animejs-grade
// easing, hand-rolled). from → value must both be honest numbers; when they
// match, or under reduced motion, it renders the final value instantly.
export function CountUp({
  value,
  from,
  duration = 1400,
  format = "usd",
}: {
  value: number;
  from?: number;
  duration?: number;
  // Serializable format key — never a function: server components cannot pass
  // functions to client components.
  format?: "usd" | "int";
}) {
  const fmt = (n: number) =>
    format === "int"
      ? Math.round(n).toLocaleString("en-US")
      : `$${Math.round(n).toLocaleString("en-US")}`;
  const [display, setDisplay] = useState(from ?? value);
  const raf = useRef(0);

  useEffect(() => {
    const start = from ?? value;
    if (start === value) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = requestAnimationFrame(() => setDisplay(value));
      return () => cancelAnimationFrame(id);
    }
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const e = p >= 1 ? 1 : 1 - Math.pow(2, -10 * p); // easeOutExpo
      setDisplay(start + (value - start) * e);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, from, duration]);

  return <>{fmt(display)}</>;
}
