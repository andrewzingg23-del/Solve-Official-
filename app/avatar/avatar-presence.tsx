"use client";

import { useEffect, useRef } from "react";

// The living frame around the bot's face: a breathing cyan halo, two orbiting
// tracing beams, a slow dashed orbit ring, and drifting motes — drawn on a
// single rAF-driven canvas so the companion feels awake, not static.
export function AvatarPresence({ src, alt }: { src: string; alt: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const maybeCtx = canvas.getContext("2d");
    if (!maybeCtx) return;
    const ctx: CanvasRenderingContext2D = maybeCtx;

    const SIZE = 300;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.scale(dpr, dpr);

    const cx = SIZE / 2;
    const cy = SIZE / 2;
    const R = 116; // orbit radius around the 176px face

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Ambient motes drifting upward.
    const motes = Array.from({ length: 26 }, () => ({
      x: Math.random() * SIZE,
      y: Math.random() * SIZE,
      r: 0.6 + Math.random() * 1.6,
      speed: 0.12 + Math.random() * 0.3,
      drift: Math.random() * Math.PI * 2,
      a: 0.08 + Math.random() * 0.22,
    }));

    const CYAN = "34, 211, 238";

    function drawComet(angle: number, headAlpha: number) {
      const TRAIL = 26;
      for (let k = TRAIL; k >= 0; k--) {
        const a = angle - k * 0.022;
        const t = 1 - k / TRAIL;
        const x = cx + Math.cos(a) * R;
        const y = cy + Math.sin(a) * R;
        ctx.beginPath();
        ctx.arc(x, y, 0.6 + t * 2.4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${CYAN}, ${(t * headAlpha).toFixed(3)})`;
        ctx.fill();
      }
      // bright head
      const hx = cx + Math.cos(angle) * R;
      const hy = cy + Math.sin(angle) * R;
      ctx.beginPath();
      ctx.arc(hx, hy, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(242, 247, 251, ${headAlpha.toFixed(3)})`;
      ctx.fill();
    }

    function drawFrame(time: number) {
      ctx.clearRect(0, 0, SIZE, SIZE);

      // 1 — breathing halo
      const breath = 0.5 + 0.5 * Math.sin(time * 0.0009);
      const halo = ctx.createRadialGradient(cx, cy, 60, cx, cy, 150);
      halo.addColorStop(0, `rgba(${CYAN}, 0)`);
      halo.addColorStop(0.62, `rgba(${CYAN}, ${(0.05 + breath * 0.05).toFixed(3)})`);
      halo.addColorStop(1, `rgba(${CYAN}, 0)`);
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, SIZE, SIZE);

      // 2 — heartbeat ring: expands and fades on a 4s cycle
      const cycle = (time % 4000) / 4000;
      const hr = R + 6 + cycle * 46;
      ctx.beginPath();
      ctx.arc(cx, cy, hr, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${CYAN}, ${((1 - cycle) * 0.28).toFixed(3)})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // 3 — slow dashed orbit
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-time * 0.00005);
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.setLineDash([2, 12]);
      ctx.strokeStyle = `rgba(242, 247, 251, 0.14)`;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      // 4 — orbiting tracing comets
      drawComet(time * 0.00042, 0.85);
      drawComet(time * 0.00042 + Math.PI, 0.5);

      // 5 — motes
      for (const m of motes) {
        m.y -= m.speed;
        m.x += Math.sin(time * 0.001 + m.drift) * 0.15;
        if (m.y < -4) {
          m.y = SIZE + 4;
          m.x = Math.random() * SIZE;
        }
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(242, 247, 251, ${m.a.toFixed(3)})`;
        ctx.fill();
      }
    }

    if (reduced) {
      drawFrame(1200);
      return;
    }

    let raf = 0;
    const loop = (time: number) => {
      drawFrame(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="relative flex h-[300px] w-[300px] items-center justify-center">
      <style>{`
        @keyframes avatar-breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.018); }
        }
        .avatar-breathe { animation: avatar-breathe 6s ease-in-out infinite; }
        @keyframes presence-ping {
          0% { transform: scale(1); opacity: 0.9; }
          80%, 100% { transform: scale(2.4); opacity: 0; }
        }
        .presence-ping { animation: presence-ping 2.2s cubic-bezier(0.22, 1, 0.36, 1) infinite; }
        @media (prefers-reduced-motion: reduce) {
          .avatar-breathe, .presence-ping { animation: none; }
        }
      `}</style>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
      <div className="avatar-breathe relative">
        <img
          src={src}
          alt={alt}
          className="h-44 w-44 rounded-full object-cover shadow-[0_0_64px_rgb(34_211_238/0.35)] ring-1 ring-white/15"
        />
        {/* online indicator */}
        <span className="absolute bottom-2 right-2 flex h-5 w-5">
          <span className="presence-ping absolute inline-flex h-full w-full rounded-full bg-accent" />
          <span className="relative inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent ring-4 ring-[#04070d]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#04070d]" />
          </span>
        </span>
      </div>
    </div>
  );
}
