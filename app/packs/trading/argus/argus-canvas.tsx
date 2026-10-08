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

interface VortexParticle {
  band: number;
  angle: number;
  radiusJitter: number;
  z: number;
  size: number;
  speed: number;
  seed: number;
  warm: boolean;
  bright: boolean;
}

interface Star {
  x: number;
  y: number;
  r: number;
  a: number;
  depth: number;
  seed: number;
}

interface Packet {
  cloud: number;
  t: number;
  speed: number;
  prevT: number;
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

/** Smooth deterministic pseudo-noise — organic deviation, never frame jitter. */
function snoise(t: number, seed: number): number {
  return (
    Math.sin(t * 0.9 + seed) * 0.55 +
    Math.sin(t * 1.7 + seed * 1.31) * 0.3 +
    Math.sin(t * 2.9 + seed * 2.17) * 0.15
  );
}

function bezierPoint(
  p0x: number, p0y: number, p1x: number, p1y: number, p2x: number, p2y: number, t: number,
): [number, number] {
  const u = 1 - t;
  return [
    u * u * p0x + 2 * u * t * p1x + t * t * p2x,
    u * u * p0y + 2 * u * t * p1y + t * t * p2y,
  ];
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

    // Quarter-res bloom buffer (bright pass + blur, composited additively).
    let bloomC: HTMLCanvasElement | null = null;
    let bloomX: CanvasRenderingContext2D | null = null;

    const stars: Star[] = Array.from({ length: 70 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.4 + Math.random() * 1.1,
      a: 0.08 + Math.random() * 0.22,
      depth: 0.2 + Math.random() * 0.8,
      seed: Math.random() * 10,
    }));

    const BANDS = [1.85, 2.45, 3.1, 3.85];
    const vortex: VortexParticle[] = Array.from({ length: 240 }, (_, i) => ({
      band: i % BANDS.length,
      angle: Math.random() * Math.PI * 2,
      radiusJitter: 0.86 + Math.random() * 0.28,
      z: Math.random() * 2 - 1,
      size: 0.5 + Math.random() * 1.5 + (Math.random() < 0.04 ? 2.2 : 0),
      speed: (0.12 + Math.random() * 0.22) * (Math.random() < 0.5 ? 1 : -1),
      seed: Math.random() * 10,
      warm: Math.random() < 0.06,
      bright: Math.random() < 0.05,
    }));

    const packets: Packet[] = [];
    CLOUDS.forEach((_, ci) => {
      packets.push({ cloud: ci, t: Math.random(), speed: 0.14 + Math.random() * 0.1, prevT: 0 });
      packets.push({ cloud: ci, t: Math.random(), speed: 0.1 + Math.random() * 0.08, prevT: 0 });
    });

    // Spring state for the core flash (overshoot, never dead linear decay).
    let flash = 0;
    let flashV = 0;

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

    function cloudPoint(c: Cloud, t: number): [number, number] {
      const cx = w / 2;
      const cy = h * 0.44;
      const baseR = Math.min(w, h) * 0.34;
      const rx = baseR * c.orbit;
      const ry = baseR * c.orbit * 0.52;
      const ang = c.phase + t * c.speed;
      const px = cx + Math.cos(ang) * rx;
      const py = cy + Math.sin(ang) * ry + snoise(t * 0.9, c.phase * 2.3) * 7;
      return [px, py];
    }

    function tentacleControl(cx: number, cy: number, px: number, py: number, t: number, phase: number): [number, number] {
      const mx = (cx + px) / 2;
      const my = (cy + py) / 2;
      const dx = px - cx;
      const dy = py - cy;
      const len = Math.hypot(dx, dy) || 1;
      const curve = 20 + snoise(t * 0.6, phase * 1.7) * 12;
      return [mx + (-dy / len) * curve, my + (dx / len) * curve];
    }

    function drawTentacles(t: number, pts: [number, number][]) {
      const cx = w / 2;
      const cy = h * 0.44;
      CLOUDS.forEach((c, i) => {
        const [px, py] = pts[i];
        const [qx, qy] = tentacleControl(cx, cy, px, py, t, c.phase);
        // faint structural curve
        ctx.strokeStyle = "rgba(34,211,238,0.13)";
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.quadraticCurveTo(qx, qy, px, py);
        ctx.stroke();
        // animated flow dashes riding the same curve
        ctx.strokeStyle = "rgba(34,211,238,0.4)";
        ctx.setLineDash([5, 11]);
        ctx.lineDashOffset = -t * 34;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.quadraticCurveTo(qx, qy, px, py);
        ctx.stroke();
        ctx.setLineDash([]);
      });
    }

    function drawPackets(t: number, dt: number, pts: [number, number][]) {
      const cx = w / 2;
      const cy = h * 0.44;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      packets.forEach((p) => {
        const c = CLOUDS[p.cloud];
        const [px, py] = pts[p.cloud];
        const [qx, qy] = tentacleControl(cx, cy, px, py, t, c.phase);
        p.prevT = p.t;
        p.t = (p.t + p.speed * dt) % 1;
        if (p.t < p.prevT) flashV += 5; // arrival impulse → spring overshoot
        const [bx, by] = bezierPoint(cx, cy, qx, qy, px, py, p.t);
        const fade = Math.sin(p.t * Math.PI);
        ctx.fillStyle = `rgba(150,235,255,${0.25 + fade * 0.65})`;
        ctx.beginPath();
        ctx.arc(bx, by, 1.6 + fade * 1.4, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }

    function drawVortex(t: number, dt: number) {
      const cx = w / 2;
      const cy = h * 0.44;
      const R = Math.min(w, h) * 0.16;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const p of vortex) {
        p.angle += p.speed * dt * (1.3 - p.band * 0.18);
        const bandR = R * BANDS[p.band] * p.radiusJitter;
        const wob = snoise(t * 0.8, p.seed) * R * 0.16;
        const z = Math.sin(p.angle * 2 + p.seed) * 0.55;
        const scale = 1 / (1 + z * 0.5);
        const px = cx + Math.cos(p.angle) * (bandR + wob);
        const py = cy + Math.sin(p.angle) * (bandR + wob) * 0.52;
        const alpha = Math.max(0.04, Math.min(0.75, 0.3 * scale + (p.bright ? 0.35 : 0)));
        ctx.fillStyle = p.warm
          ? `rgba(255,217,160,${alpha})`
          : `rgba(120,225,250,${alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, Math.max(0.4, p.size * scale), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    function drawStarfield(t: number, dt: number) {
      for (const s of stars) {
        s.x = (s.x + 0.000008 * s.depth * dt * 60 + 1) % 1;
        const tw = 0.6 + 0.4 * Math.sin(t * 1.2 + s.seed * 3);
        ctx.fillStyle = `rgba(180,220,240,${s.a * tw * s.depth})`;
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function drawCore(t: number, dt: number) {
      const cx = w / 2;
      const cy = h * 0.44;
      const R = Math.min(w, h) * 0.16;

      // spring the flash toward rest (overshoot = alive)
      const stiffness = 90;
      const damping = 11;
      const acc = -stiffness * flash - damping * flashV;
      flashV += acc * dt;
      flash += flashV * dt;
      const glowBoost = 1 + Math.max(0, flash) * 0.45;
      const breathe = 1 + Math.sin(t * 2.2) * 0.045;

      // deep halo
      const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 3.4);
      halo.addColorStop(0, `rgba(34,211,238,${0.24 * glowBoost})`);
      halo.addColorStop(1, "rgba(34,211,238,0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 3.4, 0, Math.PI * 2);
      ctx.fill();

      // structural orbit rings (faint ellipses the clouds ride)
      ctx.strokeStyle = "rgba(34,211,238,0.1)";
      ctx.lineWidth = 1;
      for (const f of [0.82, 1.0, 1.18, 1.32]) {
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.min(w, h) * 0.34 * f, Math.min(w, h) * 0.34 * f * 0.52, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // outer dashed ring — slow rotation
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.16);
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
      ctx.rotate(-t * 0.28);
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
      ctx.strokeStyle = "rgba(242,247,251,0.3)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 24; i++) {
        const a = (i * Math.PI * 2) / 24 + t * 0.05;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * R * 0.98, Math.sin(a) * R * 0.98);
        ctx.lineTo(Math.cos(a) * R * 1.08, Math.sin(a) * R * 1.08);
        ctx.stroke();
      }
      ctx.restore();

      // core orb — brightest point in the scene
      const orbR = R * breathe * (1 + Math.max(0, flash) * 0.18);
      const orb = ctx.createRadialGradient(cx, cy, 0, cx, cy, orbR);
      orb.addColorStop(0, "rgba(190,245,255,0.98)");
      orb.addColorStop(0.4, `rgba(34,211,238,${0.6 * glowBoost})`);
      orb.addColorStop(1, "rgba(34,211,238,0.06)");
      ctx.fillStyle = orb;
      ctx.beginPath();
      ctx.arc(cx, cy, orbR, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = "600 10px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(4,7,13,0.9)";
      ctx.fillText("ARGUS", cx, cy + 3.5);
    }

    function drawCloud(c: Cloud, px: number, py: number, t: number) {
      const pulse = 1 + snoise(t * 1.4, c.phase * 3.1) * 0.03;
      const changeText = c.change;
      ctx.font = labelFont;
      const lw = ctx.measureText(c.label).width;
      ctx.font = valueFont;
      const vw = ctx.measureText(`${c.value}  ${changeText}`).width;
      const bw = Math.max(lw, vw) + 24;
      const bh = 46;
      const bx = px - bw / 2;
      const by = py - bh / 2;

      ctx.save();
      ctx.translate(px, py);
      ctx.scale(pulse, pulse);
      ctx.translate(-px, -by - bh / 2);

      roundRect(ctx, bx, by, bw, bh, 10);
      ctx.fillStyle = "rgba(8,15,26,0.85)";
      ctx.fill();
      ctx.strokeStyle = c.up ? "rgba(0,229,160,0.4)" : "rgba(34,211,238,0.35)";
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
      ctx.fillStyle = "rgba(242,247,251,0.75)";
      ctx.fillText(c.value, lx, by + 35);
      ctx.fillStyle = c.up ? WIN : LOSS;
      ctx.fillText(changeText, lx + valueW + gap, by + 35);
      ctx.restore();
    }

    function applyBloom() {
      const bw = Math.max(1, canvas!.width >> 2);
      const bh = Math.max(1, canvas!.height >> 2);
      if (!bloomC) {
        bloomC = document.createElement("canvas");
        bloomX = bloomC.getContext("2d");
      }
      if (!bloomX) return;
      if (bloomC.width !== bw || bloomC.height !== bh) {
        bloomC.width = bw;
        bloomC.height = bh;
      }
      // bright pass + blur in one go, at quarter resolution
      bloomX.globalCompositeOperation = "copy";
      bloomX.filter = "brightness(0.75) contrast(2.6) blur(3px)";
      bloomX.drawImage(canvas!, 0, 0, bw, bh);
      bloomX.filter = "none";
      // additive composite back over the frame
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.42;
      ctx.drawImage(bloomC, 0, 0, canvas!.width, canvas!.height);
      ctx.restore();
    }

    function draw(t: number, dt: number) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // abyssal backdrop
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#04070d");
      bg.addColorStop(1, "#0a1220");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // near-imperceptible slow camera drift
      ctx.save();
      ctx.translate(Math.sin(t * 0.05) * 6, Math.cos(t * 0.04) * 6);

      drawStarfield(t, dt);
      drawVortex(t, dt);

      const pts = CLOUDS.map((c) => cloudPoint(c, t));
      drawTentacles(t, pts);
      drawPackets(t, dt, pts);
      drawCore(t, dt);
      for (let i = 0; i < CLOUDS.length; i++) drawCloud(CLOUDS[i], pts[i][0], pts[i][1], t);

      ctx.restore();

      // vignette — ambient occlusion, not a drop shadow
      const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.42)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);

      applyBloom();
    }

    if (reduced) {
      draw(0.6, 0.016);
    } else {
      let last = performance.now();
      const start = last;
      const loop = (now: number) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        draw((now - start) / 1000, dt);
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
