"use client";

// Motion + atmosphere layer for /start. No dependencies — canvas dust,
// animejs-grade easing via CSS, aceternity/magicui-style tracing beam.
import "./fx.css";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/* Deep-space abyss behind the whole flow: cyan dust drift, slow sheen,
   faint grid, floor glow, vignette. Still when reduced motion is on. */
export function Ambient() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    type Dust = { x: number; y: number; r: number; s: number; o: number; ph: number };
    let parts: Dust[] = [];
    let w = 0;
    let h = 0;
    let raf = 0;
    let t = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const seed = () => {
      const count = Math.min(110, Math.floor((w * h) / 16000));
      parts = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.6 + Math.random() * 1.8,
        s: 0.08 + Math.random() * 0.35,
        o: 0.1 + Math.random() * 0.45,
        ph: Math.random() * Math.PI * 2,
      }));
    };

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };

    const tick = () => {
      t += 0.016;
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.y -= p.s;
        p.x += Math.sin(t * 0.6 + p.ph) * 0.15;
        if (p.y < -4) {
          p.y = h + 4;
          p.x = Math.random() * w;
        }
        const tw = 0.6 + 0.4 * Math.sin(t * 1.4 + p.ph);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(34,211,238,${(p.o * tw).toFixed(3)})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };

    const onVis = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else raf = requestAnimationFrame(tick);
    };

    resize();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVis);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <div aria-hidden className="fx-ambient">
      <div className="fx-core" />
      <div className="fx-sheen" />
      <div className="fx-grid" />
      <canvas ref={canvasRef} />
      <div className="fx-floor" />
      <div className="fx-vignette" />
    </div>
  );
}

/* Mount-in entrance with stagger support. */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const style: CSSProperties = delay ? { animationDelay: `${delay}ms` } : {};
  return (
    <div className={`fx-reveal ${className}`} style={style}>
      {children}
    </div>
  );
}

/* Keyed by step — every step change cross-slides the panel. */
export function StepPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`fx-step-in flex flex-col gap-6 ${className}`}>{children}</div>;
}

/* Tracing beam: glowing comet head, per-step ignition ticks. */
export function TraceBeam({ step, total }: { step: number; total: number }) {
  const pct = ((step + 1) / total) * 100;
  return (
    <div
      className="fx-beam"
      role="progressbar"
      aria-valuenow={step + 1}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-label="Onboarding progress"
    >
      <div className="fx-beam-fill" style={{ width: `${pct}%` }}>
        <span aria-hidden className="fx-beam-head" />
      </div>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className={`fx-tick ${i <= step ? "lit" : ""}`}
          style={{ left: `${(i / total) * 100}%` }}
        />
      ))}
    </div>
  );
}
