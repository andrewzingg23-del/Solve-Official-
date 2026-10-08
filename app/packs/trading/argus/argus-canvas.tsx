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

interface Bokeh {
  x: number;
  y: number;
  r: number;
  speed: number;
  seed: number;
  a: number;
}

interface Comet {
  cloud: number;
  t: number;
  speed: number;
}

/** animejs-grade easings */
function easeOutExpo(x: number): number {
  return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
}
function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const u = x - 1;
  return 1 + c3 * u * u * u + c1 * u * u;
}
function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
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

    // Adaptive density: smaller screens get fewer particles.
    let vortexN = 240;

    // Quarter-res bloom buffer.
    let bloomC: HTMLCanvasElement | null = null;
    let bloomX: CanvasRenderingContext2D | null = null;

    // Shader-style plasma flow field at 1/8 res (shadertoy fbm feel, cheap).
    const PLASMA_DIV = 8;
    let plasmaC: HTMLCanvasElement | null = null;
    let plasmaX: CanvasRenderingContext2D | null = null;
    let plasmaImg: ImageData | null = null;

    const stars: Star[] = Array.from({ length: 70 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.4 + Math.random() * 1.1,
      a: 0.08 + Math.random() * 0.22,
      depth: 0.2 + Math.random() * 0.8,
      seed: Math.random() * 10,
    }));

    const BANDS = [1.85, 2.45, 3.1, 3.85];
    const vortex: VortexParticle[] = [];
    function seedVortex() {
      vortex.length = 0;
      for (let i = 0; i < vortexN; i++) {
        vortex.push({
          band: i % BANDS.length,
          angle: Math.random() * Math.PI * 2,
          radiusJitter: 0.86 + Math.random() * 0.28,
          size: 0.5 + Math.random() * 1.5 + (Math.random() < 0.04 ? 2.2 : 0),
          speed: (0.12 + Math.random() * 0.22) * (Math.random() < 0.5 ? 1 : -1),
          seed: Math.random() * 10,
          warm: Math.random() < 0.06,
          bright: Math.random() < 0.05,
        });
      }
    }

    const bokeh: Bokeh[] = Array.from({ length: 14 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 18 + Math.random() * 42,
      speed: 0.004 + Math.random() * 0.01,
      seed: Math.random() * 10,
      a: 0.03 + Math.random() * 0.06,
    }));

    const packets: Packet[] = [];
    CLOUDS.forEach((_, ci) => {
      packets.push({ cloud: ci, t: Math.random(), speed: 0.14 + Math.random() * 0.1, prevT: 0 });
      packets.push({ cloud: ci, t: Math.random(), speed: 0.1 + Math.random() * 0.08, prevT: 0 });
    });

    const comets: Comet[] = CLOUDS.map((_, ci) => ({
      cloud: ci,
      t: Math.random(),
      speed: 0.32 + Math.random() * 0.22,
    }));

    // Spring state for the core flash (overshoot, never dead linear decay).
    let flash = 0;
    let flashV = 0;
    // Per-cloud arrival pop springs.
    const pops = new Array<number>(CLOUDS.length).fill(0);
    const popsV = new Array<number>(CLOUDS.length).fill(0);

    function resize() {
      const rect = wrap!.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      vortexN = Math.min(w, h) < 420 ? 140 : 240;
      seedVortex();
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const labelFont = "600 11px ui-sans-serif, system-ui, sans-serif";
    const valueFont = "500 11px ui-sans-serif, system-ui, sans-serif";

    /** Intro choreography: clouds fly in from the core, staggered, expo easing. */
    function introProgress(t: number, i: number): { p: number; s: number } {
      const delay = 0.25 + i * 0.09;
      const dur = 1.1;
      const p = easeOutExpo(clamp01((t - delay) / dur));
      const s = easeOutBack(clamp01((t - delay) / (dur * 0.9)));
      return { p, s };
    }

    function cloudPoint(c: Cloud, t: number, introP: number): [number, number] {
      const cx = w / 2;
      const cy = h * 0.44;
      const baseR = Math.min(w, h) * 0.34;
      const rx = baseR * c.orbit;
      const ry = baseR * c.orbit * 0.52;
      const ang = c.phase + t * c.speed;
      const tx = cx + Math.cos(ang) * rx;
      const ty = cy + Math.sin(ang) * ry + snoise(t * 0.9, c.phase * 2.3) * 7;
      // fly in from the core
      return [cx + (tx - cx) * introP, cy + (ty - cy) * introP];
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

    /** Shader-style plasma: fbm-ish sine interference at 1/8 res, additive energy field. */
    function drawPlasma(t: number) {
      const pw = Math.max(2, Math.ceil(w / PLASMA_DIV));
      const ph = Math.max(2, Math.ceil(h / PLASMA_DIV));
      if (!plasmaC) {
        plasmaC = document.createElement("canvas");
        plasmaX = plasmaC.getContext("2d");
      }
      if (!plasmaX) return;
      if (plasmaC.width !== pw || plasmaC.height !== ph) {
        plasmaC.width = pw;
        plasmaC.height = ph;
        plasmaImg = plasmaX.createImageData(pw, ph);
      }
      if (!plasmaImg) return;
      const data = plasmaImg.data;
      const tt = t * 0.35;
      let k = 0;
      for (let y = 0; y < ph; y++) {
        const ny = y / ph;
        for (let x = 0; x < pw; x++, k += 4) {
          const nx = x / pw;
          // layered interference — veins of energy drifting upward
          let v =
            Math.sin(nx * 9 + tt * 1.3 + Math.sin(ny * 7 - tt) * 1.6) * 0.5 +
            Math.sin(ny * 11 - tt * 1.7 + Math.sin(nx * 5 + tt * 0.8) * 1.2) * 0.35 +
            Math.sin((nx + ny) * 6 + tt * 0.6) * 0.15;
          v = Math.pow(Math.max(0, v * 0.5 + 0.5), 2.2); // sharpen into veins
          // radial falloff from the core so the field breathes around the machine
          const dx = nx - 0.5;
          const dy = ny - 0.44;
          const fall = Math.max(0, 1 - Math.hypot(dx, dy) * 1.5);
          const e = v * (0.25 + fall * 0.75);
          data[k] = 10 + e * 34; // deep blue
          data[k + 1] = 40 + e * 150; // cyan channel
          data[k + 2] = 60 + e * 190;
          data[k + 3] = 255;
        }
      }
      plasmaX.putImageData(plasmaImg, 0, 0);
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = 0.5;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(plasmaC, 0, 0, w, h);
      ctx.restore();
    }

    /** Aceternity-style tracing beams: wide soft pass, mid pass, bright narrow core. */
    function drawTentacles(t: number, pts: [number, number][]) {
      const cx = w / 2;
      const cy = h * 0.44;
      CLOUDS.forEach((c, i) => {
        const [px, py] = pts[i];
        const [qx, qy] = tentacleControl(cx, cy, px, py, t, c.phase);
        const trace = (lw: number, style: string, dash: number[], offset: number) => {
          ctx.strokeStyle = style;
          ctx.lineWidth = lw;
          ctx.setLineDash(dash);
          ctx.lineDashOffset = offset;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.quadraticCurveTo(qx, qy, px, py);
          ctx.stroke();
        };
        // structural ghost
        trace(1, "rgba(34,211,238,0.10)", [], 0);
        // wide soft energy pass
        trace(6, "rgba(34,211,238,0.07)", [], 0);
        // animated flow dashes
        trace(2.5, "rgba(34,211,238,0.28)", [4, 12], -t * 46);
        // bright tracing core
        trace(1.1, "rgba(190,245,255,0.55)", [14, 26], -t * 60);
        ctx.setLineDash([]);
      });
    }

    /** Comet pulses riding the tentacles — bright head, fading trail. */
    function drawComets(t: number, dt: number, pts: [number, number][]) {
      const cx = w / 2;
      const cy = h * 0.44;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      comets.forEach((cm) => {
        const c = CLOUDS[cm.cloud];
        const [px, py] = pts[cm.cloud];
        const [qx, qy] = tentacleControl(cx, cy, px, py, t, c.phase);
        cm.t = (cm.t + cm.speed * dt) % 1;
        if (cm.t < 0.02 && Math.random() < 0.5) flashV += 2.5; // soft arrival kick
        // trail: sample the bezier behind the head
        for (let s = 0; s < 7; s++) {
          const bt = cm.t - s * 0.018;
          if (bt < 0) break;
          const [bx, by] = bezierPoint(cx, cy, qx, qy, px, py, bt);
          const fade = 1 - s / 7;
          ctx.fillStyle = `rgba(160,240,255,${0.5 * fade * fade})`;
          ctx.beginPath();
          ctx.arc(bx, by, 2.6 * fade + 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
        const [hx, hy] = bezierPoint(cx, cy, qx, qy, px, py, cm.t);
        ctx.fillStyle = "rgba(230,252,255,0.95)";
        ctx.beginPath();
        ctx.arc(hx, hy, 2.4, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }

    /** Small data-packet streaks along the tentacles. */
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
        if (p.t < p.prevT) {
          flashV += 5; // arrival impulse → spring overshoot
          popsV[p.cloud] += 3.2; // cloud pop
        }
        const [bx, by] = bezierPoint(cx, cy, qx, qy, px, py, p.t);
        const [tx2, ty2] = bezierPoint(cx, cy, qx, qy, px, py, Math.max(0, p.t - 0.035));
        const fade = Math.sin(p.t * Math.PI);
        ctx.strokeStyle = `rgba(150,235,255,${0.2 + fade * 0.6})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(tx2, ty2);
        ctx.lineTo(bx, by);
        ctx.stroke();
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
        const alpha = Math.max(0.04, Math.min(0.8, 0.32 * scale + (p.bright ? 0.38 : 0)));
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

    /** Foreground bokeh — depth in front of the clouds. */
    function drawBokeh(t: number, dt: number) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const b of bokeh) {
        b.x = (b.x + b.speed * dt + 1) % 1;
        const bx = b.x * w + snoise(t * 0.4, b.seed) * 20;
        const by = b.y * h + snoise(t * 0.3, b.seed * 1.7) * 24;
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, b.r);
        g.addColorStop(0, `rgba(120,220,245,${b.a})`);
        g.addColorStop(1, "rgba(120,220,245,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(bx, by, b.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    /** hoverstat.es experimental layer: perspective grid floor + scanline sweep + ghost type. */
    function drawExperimental(t: number) {
      const cx = w / 2;
      // ghost typography — landing.love bar
      ctx.save();
      ctx.font = `900 ${Math.min(w, 560) * 0.22}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.strokeStyle = "rgba(34,211,238,0.07)";
      ctx.lineWidth = 1;
      ctx.strokeText("ARGUS", cx, h * 0.44);
      ctx.restore();

      // perspective grid floor
      const horizon = h * 0.86;
      ctx.save();
      ctx.strokeStyle = "rgba(34,211,238,0.06)";
      ctx.lineWidth = 1;
      for (let i = -8; i <= 8; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + i * 14, horizon);
        ctx.lineTo(cx + i * w * 0.09, h);
        ctx.stroke();
      }
      for (let i = 0; i < 4; i++) {
        const yy = horizon + ((h - horizon) * i) / 3;
        ctx.beginPath();
        ctx.moveTo(0, yy);
        ctx.lineTo(w, yy);
        ctx.stroke();
      }
      // slow scanline sweep
      const sy = (t * 28) % (h * 1.2) - h * 0.1;
      const sg = ctx.createLinearGradient(0, sy - 26, 0, sy + 26);
      sg.addColorStop(0, "rgba(34,211,238,0)");
      sg.addColorStop(0.5, "rgba(34,211,238,0.05)");
      sg.addColorStop(1, "rgba(34,211,238,0)");
      ctx.fillStyle = sg;
      ctx.fillRect(0, sy - 26, w, 52);
      ctx.restore();
    }

    /** Volumetric core: stacked glow layers, chromatic fringe, rotating energy blades. */
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

      // volumetric halo — stacked layers, additive feel
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const layers: Array<[number, number]> = [
        [3.6, 0.05], [2.8, 0.08], [2.1, 0.13], [1.5, 0.2], [1.05, 0.3],
      ];
      for (const [mult, a] of layers) {
        const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * mult);
        halo.addColorStop(0, `rgba(34,211,238,${a * glowBoost})`);
        halo.addColorStop(1, "rgba(34,211,238,0)");
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(cx, cy, R * mult, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // structural orbit rings (faint ellipses the clouds ride)
      ctx.strokeStyle = "rgba(34,211,238,0.1)";
      ctx.lineWidth = 1;
      for (const f of [0.82, 1.0, 1.18, 1.32]) {
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.min(w, h) * 0.34 * f, Math.min(w, h) * 0.34 * f * 0.52, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // rotating energy blades — conic wedges, additive
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.translate(cx, cy);
      for (let i = 0; i < 5; i++) {
        ctx.save();
        ctx.rotate(t * 0.9 + (i * Math.PI * 2) / 5);
        const blade = ctx.createLinearGradient(0, 0, R * 2.3, 0);
        blade.addColorStop(0, `rgba(34,211,238,${0.22 * glowBoost})`);
        blade.addColorStop(1, "rgba(34,211,238,0)");
        ctx.fillStyle = blade;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, R * 2.3, -0.16, 0.16);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();

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

      // chromatic fringe ring — cyan + faint warm edge split
      ctx.save();
      ctx.translate(cx, cy);
      ctx.strokeStyle = "rgba(34,211,238,0.55)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0.8, 0, R * 0.86, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,140,200,0.16)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(-0.8, 0.6, R * 0.86, 0, Math.PI * 2);
      ctx.stroke();
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

      // core orb — white-hot center
      const orbR = R * breathe * (1 + Math.max(0, flash) * 0.18);
      const orb = ctx.createRadialGradient(cx, cy, 0, cx, cy, orbR);
      orb.addColorStop(0, "rgba(220,252,255,0.99)");
      orb.addColorStop(0.35, `rgba(34,211,238,${0.75 * glowBoost})`);
      orb.addColorStop(1, "rgba(34,211,238,0.05)");
      ctx.fillStyle = orb;
      ctx.beginPath();
      ctx.arc(cx, cy, orbR, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = "600 10px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(4,7,13,0.9)";
      ctx.fillText("ARGUS", cx, cy + 3.5);
    }

    /** Cloud chip with depth-of-field dimming and arrival pop spring. */
    function drawCloud(c: Cloud, i: number, px: number, py: number, t: number, scaleIntro: number) {
      // arrival pop spring
      const stiffness = 140;
      const damping = 12;
      const acc = -stiffness * pops[i] - damping * popsV[i];
      popsV[i] += acc * 0.016;
      pops[i] += popsV[i] * 0.016;
      const pop = 1 + Math.max(-0.25, Math.min(0.25, pops[i])) * 0.12;

      const pulse = 1 + snoise(t * 1.4, c.phase * 3.1) * 0.03;
      const scale = Math.max(0.001, scaleIntro) * pulse * pop;
      // depth of field: outer orbits sit slightly dimmer
      const depthDim = c.orbit > 1.1 ? 0.82 : 1;

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
      ctx.globalAlpha = depthDim * Math.min(1, scaleIntro * 1.5);
      ctx.translate(px, py);
      ctx.scale(scale, scale);
      ctx.translate(-px, -by - bh / 2);

      // chip glow shadow
      ctx.shadowColor = c.up ? "rgba(0,229,160,0.35)" : "rgba(34,211,238,0.3)";
      ctx.shadowBlur = 14;
      roundRect(ctx, bx, by, bw, bh, 10);
      ctx.fillStyle = "rgba(8,15,26,0.88)";
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = c.up ? "rgba(0,229,160,0.45)" : "rgba(34,211,238,0.4)";
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
      ctx.fillStyle = "rgba(242,247,251,0.78)";
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
      bloomX.globalCompositeOperation = "copy";
      bloomX.filter = "brightness(0.75) contrast(2.6) blur(3px)";
      bloomX.drawImage(canvas!, 0, 0, bw, bh);
      bloomX.filter = "none";
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

      // shader-style plasma energy field
      drawPlasma(t);

      // near-imperceptible slow camera drift
      ctx.save();
      ctx.translate(Math.sin(t * 0.05) * 6, Math.cos(t * 0.04) * 6);

      drawExperimental(t);
      drawStarfield(t, dt);
      drawVortex(t, dt);

      const intros = CLOUDS.map((_, i) => introProgress(t, i));
      const pts = CLOUDS.map((c, i) => cloudPoint(c, t, intros[i].p));
      drawTentacles(t, pts);
      drawComets(t, dt, pts);
      drawPackets(t, dt, pts);
      drawCore(t, dt);
      for (let i = 0; i < CLOUDS.length; i++) {
        drawCloud(CLOUDS[i], i, pts[i][0], pts[i][1], t, intros[i].s);
      }
      drawBokeh(t, dt);

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
      draw(8, 0.016); // intro complete, static frame
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
