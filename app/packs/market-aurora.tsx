"use client";

import { useEffect, useRef } from "react";

// Decorative market aurora: a cyan flow-field of motes drifting like a price
// stream, plus two slow orbital glows. Pure atmosphere — no data, no numbers,
// aria-hidden. Pauses off-screen; renders one calm static frame under
// prefers-reduced-motion.
export function MarketAurora({
  className = "",
  density = 1,
  speed = 1,
}: {
  className?: string;
  density?: number;
  speed?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let w = 0;
    let h = 0;
    let raf = 0;
    let running = true;

    interface Mote {
      x: number;
      y: number;
      r: number;
      v: number;
      a: number;
      ph: number;
      wob: number;
      ice: boolean;
    }
    let motes: Mote[] = [];

    const seed = () => {
      const count = Math.max(30, Math.min(220, Math.round(((w * h) / 9000) * density)));
      motes = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.6 + Math.random() * 1.7,
        v: (0.12 + Math.random() * 0.5) * speed,
        a: 0.1 + Math.random() * 0.32,
        ph: Math.random() * Math.PI * 2,
        wob: 0.4 + Math.random() * 1.1,
        ice: Math.random() < 0.16,
      }));
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };

    const glow = (x: number, y: number, r: number, alpha: number) => {
      const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(34, 211, 238, ${alpha})`);
      gr.addColorStop(1, "rgba(34, 211, 238, 0)");
      ctx.fillStyle = gr;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      // Two slow orbital glows — abyssal cyan, never purple.
      glow(
        w * (0.72 + 0.1 * Math.sin(t * 0.00012)),
        h * (0.28 + 0.12 * Math.cos(t * 0.00009)),
        Math.max(w, h) * 0.42,
        0.1
      );
      glow(
        w * (0.2 + 0.08 * Math.cos(t * 0.0001)),
        h * (0.75 + 0.1 * Math.sin(t * 0.00013)),
        Math.max(w, h) * 0.36,
        0.07
      );

      ctx.globalCompositeOperation = "lighter";
      for (const m of motes) {
        m.x += m.v;
        m.y += Math.sin(t * 0.001 * m.wob + m.ph) * 0.22;
        if (m.x > w + 8) {
          m.x = -8;
          m.y = Math.random() * h;
        }
        const tw = 0.72 + 0.28 * Math.sin(t * 0.002 + m.ph);
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fillStyle = m.ice
          ? `rgba(242, 247, 251, ${(m.a * 0.7 * tw).toFixed(3)})`
          : `rgba(34, 211, 238, ${(m.a * tw).toFixed(3)})`;
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    };

    const frame = (t: number) => {
      if (!running) return;
      draw(t);
      raf = requestAnimationFrame(frame);
    };

    resize();
    window.addEventListener("resize", resize);

    if (reduced) {
      draw(1200); // one calm static frame
      return () => window.removeEventListener("resize", resize);
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !raf) {
          raf = requestAnimationFrame(frame);
        } else if (!entry.isIntersecting && raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      },
      { threshold: 0 }
    );
    io.observe(canvas);
    raf = requestAnimationFrame(frame);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [density, speed]);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
