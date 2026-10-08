"use client";

import { useEffect, useRef } from "react";

const ICE = "#f2f7fb";
const WIN = "#00e5a0";
const LOSS = "#ff4d5e";

interface Cloud {
  label: string;
  value: string;
  change: string;
  up: boolean;
  orbit: number; // base radius factor
  speed: number;
  phase: number;
}

// Snapshot from the Oct 7, 2026 FOMO feed read — labeled as a snapshot, not live.
const CLOUDS: Cloud[] = [
  { label: "LONG", value: "$1.95M MC", change: "-11.36%", up: false, orbit: 1.0, speed: 0.11, phase: 0.0 },
  { label: "RHEA", value: "$79.1M MC", change: "+3.25%", up: true, orbit: 1.18, speed: -0.09, phase: 1.4 },
  { label: "PONKE", value: "$12.6M MC", change: "-6.50%", up: false, orbit: 1.0, speed: 0.13, phase: 2.6 },
  { label: "PRIORS", value: "$6.58M MC", change: "+5.13%", up: true, orbit: 1.32, speed: -0.07, phase: 3.5 },
  { label: "SI", value: "$24.0M MC", change: "-10.26%", up: false, orbit: 1.18, speed: 0.1, phase: 4.7 },
  { label: "BTC", value: "$83,316", change: "-2.59%", up: false, orbit: 0.82, speed: -0.14, phase: 0.8 },
  { label: "ETH", value: "$2,577", change: "-4.58%", up: false, orbit: 0.82, speed: 0.12, phase: 2.2 },
  { label: "SOL", value: "$116.46", change: "-3.47%", up: false, orbit: 1.32, speed: 0.08, phase: 5.4 },
  { label: "HYPE", value: "$88.44", change: "-3.82%", up: false, orbit: 1.0, speed: -0.12, phase: 5.9 },
];

interface Particle {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  a: number;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function ArgusCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const raw = canvas.getContext("2d");
    if (!raw) return;
    const ctx: CanvasRenderingContext2D = raw;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let w = 0;
    let h = 0;
    let dpr = 1;

    const particles: Particle[] = Array.from({ length: 42 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.6 + Math.random() * 1.6,
      vx: (Math.random() - 0.5) * 0.00012,
      vy: (Math.random() - 0.5) * 0.00012,
      a: 0.12 + Math.random() * 0.25,
    }));

    function resize() {
      const rect = wrap!.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const labelFont = "600 11px ui-sans-serif, system-ui, sans-serif";
    const valueFont = "500 11px ui-sans-serif, system-ui, sans-serif";

    function drawCloud(c: Cloud, t: number) {
      const cx = w / 2;
      const cy = h * 0.44;
      const baseR = Math.min(w, h) * 0.34;
      const rx = baseR * c.orbit;
      const ry = baseR * c.orbit * 0.52;
      const ang = c.phase + t * c.speed;
      const px = cx + Math.cos(ang) * rx;
      const py = cy + Math.sin(ang) * ry + Math.sin(t * 0.9 + c.phase * 2) * 7;
      const pulse = 1 + Math.sin(t * 1.7 + c.phase * 3) * 0.04;

      const changeText = c.change;
      ctx.font = labelFont;
      const lw = ctx.measureText(c.label).width;
      ctx.font = valueFont;
      const vw = ctx.measureText(`${c.value}  ${changeText}`).width;
      const bw = Math.max(lw, vw) + 24;
      const bh = 46;
      const bx = px - bw / 2;
      const by = py - bh / 2;

      // tentacle from the core
      ctx.strokeStyle = "rgba(34,211,238,0.16)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo((cx + px) / 2, (cy + py) / 2 - 18, px, py);
      ctx.stroke();

      ctx.save();
      ctx.translate(px, py);
      ctx.scale(pulse, pulse);
      ctx.translate(-px, -by - bh / 2);

      // cloud body
      roundRect(ctx, bx, by, bw, bh, 10);
      ctx.fillStyle = "rgba(8,15,26,0.82)";
      ctx.fill();
      ctx.strokeStyle = c.up ? "rgba(0,229,160,0.35)" : "rgba(34,211,238,0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.font = labelFont;
      ctx.fillStyle = ICE;
      const labelW = ctx.measureText(c.label).width;
      ctx.fillText(c.label, px - labelW / 2, by + 19);
      ctx.font = valueFont;
      const valueW = ctx.measureText(c.value).width;
      const changeW = ctx.measureText(changeText).width;
      const gap = 8;
      const lineW = valueW + gap + changeW;
      const lx = px - lineW / 2;
      ctx.fillStyle = "rgba(242,247,251,0.72)";
      ctx.fillText(c.value, lx, by + 35);
      ctx.fillStyle = c.up ? WIN : LOSS;
      ctx.fillText(changeText, lx + valueW + gap, by + 35);
      ctx.restore();
    }

    function drawCore(t: number) {
      const cx = w / 2;
      const cy = h * 0.44;
      const R = Math.min(w, h) * 0.16;
      const pulse = 1 + Math.sin(t * 2.2) * 0.05;

      // glow
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 3.2);
      glow.addColorStop(0, "rgba(34,211,238,0.28)");
      glow.addColorStop(1, "rgba(34,211,238,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 3.2, 0, Math.PI * 2);
      ctx.fill();

      // outer dashed ring — slow rotation
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.18);
      ctx.strokeStyle = "rgba(34,211,238,0.5)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([10, 7]);
      ctx.beginPath();
      ctx.arc(0, 0, R * 1.55, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // arc segments — counter-rotation
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-t * 0.3);
      ctx.strokeStyle = "rgba(34,211,238,0.75)";
      ctx.lineWidth = 3;
      ctx.setLineDash([]);
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(0, 0, R * 1.22, (i * Math.PI * 2) / 3, (i * Math.PI * 2) / 3 + 0.9);
        ctx.stroke();
      }
      ctx.restore();

      // tick ring
      ctx.save();
      ctx.translate(cx, cy);
      ctx.strokeStyle = "rgba(242,247,251,0.28)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 24; i++) {
        const a = (i * Math.PI * 2) / 24 + t * 0.05;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * R * 0.98, Math.sin(a) * R * 0.98);
        ctx.lineTo(Math.cos(a) * R * 1.08, Math.sin(a) * R * 1.08);
        ctx.stroke();
      }
      ctx.restore();

      // core orb
      const orb = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * pulse);
      orb.addColorStop(0, "rgba(160,240,255,0.95)");
      orb.addColorStop(0.45, "rgba(34,211,238,0.55)");
      orb.addColorStop(1, "rgba(34,211,238,0.08)");
      ctx.fillStyle = orb;
      ctx.beginPath();
      ctx.arc(cx, cy, R * pulse, 0, Math.PI * 2);
      ctx.fill();

      // core label
      ctx.font = "600 10px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(4,7,13,0.9)";
      ctx.fillText("ARGUS", cx, cy + 3.5);
    }

    function draw(t: number) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // drifting particles
      for (const p of particles) {
        p.x = (p.x + p.vx + 1) % 1;
        p.y = (p.y + p.vy + 1) % 1;
        ctx.fillStyle = `rgba(34,211,238,${p.a})`;
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const c of CLOUDS) drawCloud(c, t);
      drawCore(t);
    }

    if (reduced) {
      draw(0.6);
    } else {
      const start = performance.now();
      const loop = (now: number) => {
        draw((now - start) / 1000);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div ref={wrapRef} className="relative h-[480px] w-full md:h-[600px]">
      <canvas ref={canvasRef} className="absolute inset-0" aria-hidden="true" />
    </div>
  );
}
