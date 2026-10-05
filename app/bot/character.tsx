"use client";

// The master bot, drawn and animated from its persona. Every part is procedural (no image assets),
// so any combination of body, finish, face, gear, aura, palette and motion is a valid character.
// States animate what is really happening; callers choose the state from real activity only.
// Motion stops for people who ask for reduced motion.
import { useId } from "react";
import type { Persona } from "@/lib/bot/persona";

// The Build Book's avatar states (listening, reasoning, waiting for approval, working, needs input,
// completed, unavailable), plus idle, happy and resting.
export type BotState = "idle" | "listening" | "thinking" | "working" | "happy" | "sleeping" | "waiting" | "needs_input" | "completed" | "unavailable";

export const STATE_LABELS: Record<BotState, string> = {
  idle: "Idle",
  listening: "Listening",
  thinking: "Reasoning",
  waiting: "Waiting for approval",
  working: "Working",
  needs_input: "Needs input",
  completed: "Completed",
  happy: "Happy",
  sleeping: "Resting",
  unavailable: "Unavailable",
};

function shade(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount));
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(mix);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

// Where the face sits on each body, and how large it is drawn.
const FACE: Record<Persona["body"], { cx: number; cy: number; s: number; screen: boolean }> = {
  bot: { cx: 100, cy: 82, s: 1, screen: true },
  humanoid: { cx: 100, cy: 84, s: 0.95, screen: false },
  creature: { cx: 100, cy: 96, s: 1.05, screen: false },
  orb: { cx: 100, cy: 98, s: 1.15, screen: false },
  pixel: { cx: 100, cy: 90, s: 1, screen: false },
};
// The top of the head, where antennas, halos, ears and crests attach.
const CROWN: Record<Persona["body"], number> = { bot: 40, humanoid: 44, creature: 52, orb: 44, pixel: 36 };

function Eyes({ p, state, light }: { p: Persona; state: BotState; light: string }) {
  const { cx, cy, s, screen } = FACE[p.body];
  const closed = state === "sleeping" || state === "unavailable";
  const ink = screen ? light : "#04070d";
  const white = screen ? "transparent" : "#f2f7fb";
  const dx = 18 * s;
  if (closed || p.eyes === "sleepy") {
    return (
      <g className={closed ? undefined : "sovbot-blink"} stroke={screen ? light : "#04070d"} strokeWidth={3.2 * s} strokeLinecap="round" fill="none">
        <path d={`M${cx - dx - 7 * s} ${cy} q${7 * s} ${closed ? 5 * s : 3 * s} ${14 * s} 0`} />
        <path d={`M${cx + dx - 7 * s} ${cy} q${7 * s} ${closed ? 5 * s : 3 * s} ${14 * s} 0`} />
      </g>
    );
  }
  if (p.eyes === "visor") {
    return (
      <g>
        <rect x={cx - 34 * s} y={cy - 8 * s} width={68 * s} height={16 * s} rx={8 * s} fill={screen ? shade(p.palette.secondary, -0.3) : "#04070d"} />
        <rect className="sovbot-scan" x={cx - 30 * s} y={cy - 4 * s} width={22 * s} height={8 * s} rx={4 * s} fill={light} />
      </g>
    );
  }
  if (p.eyes === "spark") {
    const star = (x: number) =>
      `M${x} ${cy - 9 * s} L${x + 2.6 * s} ${cy - 2.6 * s} L${x + 9 * s} ${cy} L${x + 2.6 * s} ${cy + 2.6 * s} L${x} ${cy + 9 * s} L${x - 2.6 * s} ${cy + 2.6 * s} L${x - 9 * s} ${cy} L${x - 2.6 * s} ${cy - 2.6 * s} Z`;
    return (
      <g className="sovbot-blink" fill={screen ? light : p.palette.glow} stroke={screen ? "none" : "#04070d"} strokeWidth={1.2}>
        <path d={star(cx - dx)} />
        <path d={star(cx + dx)} />
      </g>
    );
  }
  if (p.eyes === "pixel") {
    const sq = 10 * s;
    return (
      <g className="sovbot-blink" fill={ink} shapeRendering="crispEdges">
        <rect x={cx - dx - sq / 2} y={cy - sq / 2} width={sq} height={sq} />
        <rect x={cx + dx - sq / 2} y={cy - sq / 2} width={sq} height={sq} />
      </g>
    );
  }
  // round
  const look = state === "listening" ? 2.5 * s : state === "thinking" ? -2 * s : 0;
  const up = state === "thinking" || state === "needs_input" ? 2.5 * s : 0;
  return (
    <g className="sovbot-blink">
      {[cx - dx, cx + dx].map((x) => (
        <g key={x}>
          <circle cx={x} cy={cy} r={8.5 * s} fill={white} />
          <circle cx={x + look} cy={cy - up} r={screen ? 7 * s : 4.4 * s} fill={ink} />
          {!screen && <circle cx={x + look + 1.6 * s} cy={cy - 1.8 * s} r={1.4 * s} fill="#f2f7fb" />}
        </g>
      ))}
    </g>
  );
}

function Mouth({ p, state, light }: { p: Persona; state: BotState; light: string }) {
  const { cx, cy, s, screen } = FACE[p.body];
  const y = cy + 20 * s;
  const ink = screen ? light : "#04070d";
  if (p.mouth === "none" || state === "sleeping" || state === "unavailable") return null;
  if (state === "completed") return <path d={`M${cx - 10 * s} ${y - 2 * s} q${10 * s} ${10 * s} ${20 * s} 0`} stroke={ink} strokeWidth={3 * s} strokeLinecap="round" fill="none" />;
  if (p.mouth === "open" || state === "happy") {
    return <ellipse className={state === "working" || state === "listening" ? undefined : "sovbot-talk"} cx={cx} cy={y + 1} rx={7 * s} ry={5 * s} fill={ink} />;
  }
  if (p.mouth === "line") return <path d={`M${cx - 8 * s} ${y} h${16 * s}`} stroke={ink} strokeWidth={3 * s} strokeLinecap="round" />;
  return <path d={`M${cx - 10 * s} ${y - 2 * s} q${10 * s} ${10 * s} ${20 * s} 0`} stroke={ink} strokeWidth={3 * s} strokeLinecap="round" fill="none" />;
}

function Brows({ p, state, light }: { p: Persona; state: BotState; light: string }) {
  if (p.brows === "none") return null;
  const { cx, cy, s, screen } = FACE[p.body];
  const ink = screen ? light : "#04070d";
  const dx = 18 * s;
  const lift = (p.brows === "raised" ? 5 : 0) * s + (state === "needs_input" || state === "thinking" ? 2 * s : 0);
  const y = cy - 15 * s - lift;
  const d = (x: number, side: -1 | 1) =>
    p.brows === "sharp"
      ? `M${x - 8 * s} ${y - side * 2.5 * s} L${x + 8 * s} ${y + side * 2.5 * s}`
      : `M${x - 8 * s} ${y + 1.5 * s} q${8 * s} ${(p.brows === "raised" ? -7 : -4) * s} ${16 * s} 0`;
  return (
    <g stroke={ink} strokeWidth={2.6 * s} strokeLinecap="round" fill="none">
      <path d={d(cx - dx, 1)} />
      <path d={d(cx + dx, -1)} />
    </g>
  );
}

// Where body markings sit, below the face.
const CHEST: Record<Persona["body"], number> = { bot: 148, humanoid: 166, creature: 140, orb: 128, pixel: 0 };

function Marks({ p, glow }: { p: Persona; glow: string }) {
  const { cx, cy, s, screen } = FACE[p.body];
  const dx = 22 * s;
  switch (p.marks) {
    case "blush":
      return (
        <g fill={screen ? glow : "#ff7a8a"} opacity={screen ? 0.4 : 0.45}>
          <ellipse cx={cx - dx - 4 * s} cy={cy + 11 * s} rx={6 * s} ry={3.2 * s} />
          <ellipse cx={cx + dx + 4 * s} cy={cy + 11 * s} rx={6 * s} ry={3.2 * s} />
        </g>
      );
    case "stripes":
      return (
        <g stroke={glow} strokeWidth={2.2 * s} strokeLinecap="round" opacity={0.85}>
          {[-1, 1].map((side) => (
            <g key={side}>
              <path d={`M${cx + side * (dx + 2 * s)} ${cy + 5 * s} l${side * 8 * s} ${3 * s}`} />
              <path d={`M${cx + side * (dx + 2 * s)} ${cy + 10 * s} l${side * 8 * s} ${3 * s}`} />
            </g>
          ))}
        </g>
      );
    case "circuit": {
      const y = CHEST[p.body];
      return (
        <g className="sovbot-trace" stroke={glow} strokeWidth={1.6} fill="none" strokeLinecap="round" opacity={0.8}>
          <path d={`M82 ${y} h10 l6 6 h10`} />
          <path d={`M118 ${y - 4} h-8 l-4 4`} />
          <circle cx={80} cy={y} r={2} fill={glow} stroke="none" />
          <circle cx={110} cy={y + 6} r={2} fill={glow} stroke="none" />
          <circle cx={120} cy={y - 4} r={2} fill={glow} stroke="none" />
        </g>
      );
    }
    default:
      return null;
  }
}

function Top({ p, glow, filter }: { p: Persona; glow: string; filter: string }) {
  const y = CROWN[p.body];
  const c = p.palette.primary;
  switch (p.top) {
    case "antenna":
      return (
        <g className="sovbot-wiggle" style={{ transformOrigin: `100px ${y}px` }}>
          <path d={`M100 ${y} V${y - 22}`} stroke={shade(c, -0.25)} strokeWidth={4} strokeLinecap="round" />
          <circle cx={100} cy={y - 26} r={6} fill={glow} filter={filter} />
        </g>
      );
    case "halo":
      return <ellipse className="sovbot-float" cx={100} cy={y - 16} rx={30} ry={7} fill="none" stroke={glow} strokeWidth={4} filter={filter} />;
    case "ears":
      return (
        <g fill={c} stroke={shade(c, -0.3)} strokeWidth={2}>
          <path className="sovbot-ear-l" d={`M66 ${y + 14} L60 ${y - 18} L86 ${y + 4} Z`} style={{ transformOrigin: `72px ${y + 8}px` }} />
          <path className="sovbot-ear-r" d={`M134 ${y + 14} L140 ${y - 18} L114 ${y + 4} Z`} style={{ transformOrigin: `128px ${y + 8}px` }} />
        </g>
      );
    case "crest":
      return <path d={`M84 ${y + 6} C88 ${y - 26} 112 ${y - 30} 118 ${y + 2} C110 ${y - 10} 96 ${y - 8} 84 ${y + 6} Z`} fill={glow} opacity={0.9} />;
    default:
      return null;
  }
}

function Accessory({ p, glow }: { p: Persona; glow: string }) {
  const neck = p.body === "orb" ? 150 : p.body === "creature" ? 140 : 124;
  switch (p.accessory) {
    case "scarf":
      return (
        <g fill={glow}>
          <rect x={68} y={neck - 6} width={64} height={12} rx={6} />
          <path className="sovbot-flutter" d={`M118 ${neck + 2} l14 26 l-12 2 z`} style={{ transformOrigin: `120px ${neck}px` }} />
        </g>
      );
    case "headset":
      return (
        <g fill="none" stroke={shade(p.palette.secondary, 0.25)} strokeWidth={5} strokeLinecap="round">
          <path d={`M58 ${FACE[p.body].cy} C58 ${CROWN[p.body] - 14} 142 ${CROWN[p.body] - 14} 142 ${FACE[p.body].cy}`} />
          <circle cx={58} cy={FACE[p.body].cy + 4} r={8} fill={glow} stroke="none" />
          <path d={`M60 ${FACE[p.body].cy + 10} q8 22 30 22`} strokeWidth={3} />
        </g>
      );
    case "badge":
      return p.body === "orb" ? null : (
        <g>
          <circle cx={116} cy={neck + 24} r={9} fill={glow} />
          <path d={`M116 ${neck + 18} l2 4 l4.5 .5 l-3.3 3 l1 4.5 l-4.2 -2.4 l-4.2 2.4 l1 -4.5 l-3.3 -3 l4.5 -.5 z`} fill="#04070d" />
        </g>
      );
    default:
      return null;
  }
}

function Cape({ p, glow }: { p: Persona; glow: string }) {
  if (p.accessory !== "cape" || p.body === "orb") return null;
  const top = p.body === "creature" ? 112 : 118;
  const h = p.body === "creature" ? 66 : 80;
  return <path className="sovbot-sway" d={`M72 ${top} C60 ${top + h / 2} 58 ${top + h * 0.82} 54 ${top + h} L146 ${top + h} C142 ${top + h * 0.82} 140 ${top + h / 2} 128 ${top} Z`} fill={shade(glow, -0.35)} style={{ transformOrigin: `100px ${top}px` }} />;
}

// How the body is painted for each finish: its fill, edge and limb color.
type Paint = { fill: string; stroke: string; strokeWidth: number; limb: string };

// The body's shapes. `silhouette` draws only the outer shapes, for a finish's overlay (sheen,
// scanlines), so overlays never spill outside the character.
function Body({ p, paint, silhouette = false }: { p: Persona; paint: Paint; silhouette?: boolean }) {
  const c = p.palette.primary;
  const dark = shade(c, -0.35);
  const line = silhouette ? { stroke: "none" } : { stroke: paint.stroke, strokeWidth: paint.strokeWidth };
  switch (p.body) {
    case "bot":
      return (
        <g>
          <rect x={70} y={122} width={60} height={52} rx={18} fill={paint.fill} {...line} />
          <rect className="sovbot-arm-l" x={52} y={130} width={16} height={34} rx={8} fill={silhouette ? paint.fill : paint.limb} {...line} style={{ transformOrigin: "60px 132px" }} />
          <rect className="sovbot-arm-r" x={132} y={130} width={16} height={34} rx={8} fill={silhouette ? paint.fill : paint.limb} {...line} style={{ transformOrigin: "140px 132px" }} />
          <rect x={48} y={40} width={104} height={84} rx={28} fill={paint.fill} {...line} />
          {!silhouette && <rect x={60} y={54} width={80} height={58} rx={18} fill={shade(p.palette.secondary, -0.2)} />}
        </g>
      );
    case "humanoid":
      return (
        <g>
          <path d="M54 192 C56 150 76 134 100 134 C124 134 144 150 146 192 Z" fill={silhouette ? paint.fill : p.palette.secondary} {...(silhouette ? line : { stroke: shade(p.palette.secondary, 0.2), strokeWidth: 2 })} />
          {!silhouette && <path d="M88 124 h24 v14 h-24 Z" fill={dark} />}
          <circle cx={100} cy={84} r={40} fill={paint.fill} {...line} />
        </g>
      );
    case "creature":
      return (
        <g>
          {!silhouette && <path className="sovbot-tail" d="M140 160 C168 160 172 130 160 120" stroke={paint.limb} strokeWidth={9} strokeLinecap="round" fill="none" style={{ transformOrigin: "140px 160px" }} />}
          <path d="M100 52 C142 52 156 96 156 132 C156 168 132 182 100 182 C68 182 44 168 44 132 C44 96 58 52 100 52 Z" fill={paint.fill} {...line} />
          {!silhouette && (
            <>
              <ellipse cx={100} cy={146} rx={34} ry={26} fill={shade(c, 0.45)} opacity={0.55} />
              <ellipse cx={78} cy={184} rx={12} ry={6} fill={dark} />
              <ellipse cx={122} cy={184} rx={12} ry={6} fill={dark} />
            </>
          )}
        </g>
      );
    case "orb":
      return <circle cx={100} cy={100} r={58} fill={paint.fill} {...line} />;
    case "pixel":
      return null;
  }
}

// The finish's paint and its overlay, both from the persona's colors.
function finish(p: Persona, ids: Record<"body" | "sheen" | "scan" | "chrome", string>) {
  const c = p.palette.primary;
  const dark = shade(c, -0.35);
  switch (p.material) {
    case "glass":
      return { paint: { fill: `url(#${ids.body})`, stroke: shade(c, 0.55), strokeWidth: 1.6, limb: `url(#${ids.body})` }, overlay: `url(#${ids.sheen})`, overlayClass: "" };
    case "hologram":
      return { paint: { fill: `url(#${ids.body})`, stroke: p.palette.glow, strokeWidth: 1.4, limb: `url(#${ids.body})` }, overlay: `url(#${ids.scan})`, overlayClass: "sovbot-holo" };
    case "chrome":
      return { paint: { fill: `url(#${ids.chrome})`, stroke: shade(c, -0.55), strokeWidth: 1.6, limb: `url(#${ids.chrome})` }, overlay: `url(#${ids.sheen})`, overlayClass: "" };
    default:
      return { paint: { fill: `url(#${ids.body})`, stroke: dark, strokeWidth: 2, limb: c }, overlay: null, overlayClass: "" };
  }
}

function FinishDefs({ p, ids }: { p: Persona; ids: Record<"body" | "sheen" | "scan" | "chrome", string> }) {
  const c = p.palette.primary;
  const g = p.palette.glow;
  if (p.material === "hologram") {
    return (
      <>
        <linearGradient id={ids.body} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={shade(g, 0.3)} stopOpacity={0.55} />
          <stop offset="55%" stopColor={c} stopOpacity={0.35} />
          <stop offset="100%" stopColor={g} stopOpacity={0.18} />
        </linearGradient>
        <pattern id={ids.scan} width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="1.2" fill={shade(g, 0.4)} opacity={0.55} />
        </pattern>
      </>
    );
  }
  return (
    <>
      <radialGradient id={ids.body} cx="35%" cy="30%" r="80%">
        <stop offset="0%" stopColor={shade(c, p.material === "matte" ? 0.18 : 0.4)} stopOpacity={p.material === "glass" ? 0.75 : 1} />
        <stop offset="60%" stopColor={c} stopOpacity={p.material === "glass" ? 0.55 : 1} />
        <stop offset="100%" stopColor={shade(c, -0.4)} stopOpacity={p.material === "glass" ? 0.7 : 1} />
      </radialGradient>
      <linearGradient id={ids.chrome} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={shade(c, 0.75)} />
        <stop offset="35%" stopColor={shade(c, 0.15)} />
        <stop offset="52%" stopColor={shade(c, -0.5)} />
        <stop offset="70%" stopColor={shade(c, 0.35)} />
        <stop offset="100%" stopColor={shade(c, -0.25)} />
      </linearGradient>
      <linearGradient id={ids.sheen} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#ffffff" stopOpacity={p.material === "chrome" ? 0.5 : 0.38} />
        <stop offset="38%" stopColor="#ffffff" stopOpacity={0} />
        <stop offset="62%" stopColor="#ffffff" stopOpacity={0} />
        <stop offset="78%" stopColor="#ffffff" stopOpacity={p.material === "chrome" ? 0.22 : 0.1} />
        <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
      </linearGradient>
    </>
  );
}

// A 16×16 sprite in the persona's colors, for the pixel body.
function PixelSprite({ p, state }: { p: Persona; state: BotState }) {
  const rows = [
    "......XXXX......",
    ".....XXXXXX.....",
    "...XXXXXXXXXX...",
    "..XXXXXXXXXXXX..",
    "..XXSSSSSSSSXX..",
    "..XXSSSSSSSSXX..",
    "..XXSSSSSSSSXX..",
    "..XXSSSSSSSSXX..",
    "..XXSSSSSSSSXX..",
    "...XXXXXXXXXX...",
    "......XXXX......",
    "....XXXXXXXX....",
    "...XXXXXXXXXX...",
    "...XX.XXXX.XX...",
    "......XXXX......",
    ".....XX..XX.....",
  ];
  const fill: Record<string, string> = { X: p.palette.primary, S: shade(p.palette.secondary, -0.2) };
  const px = 8;
  const ox = 100 - 8 * px;
  const oy = 36;
  const eyeY = oy + 6 * px;
  const glow = shade(p.palette.primary, 0.5);
  return (
    <g shapeRendering="crispEdges">
      {rows.flatMap((row, y) =>
        [...row].map((ch, x) => (ch === "." ? null : <rect key={`${x}-${y}`} x={ox + x * px} y={oy + y * px} width={px} height={px} fill={fill[ch]} />)),
      )}
      {state === "sleeping" ? (
        <g fill={glow}>
          <rect x={ox + 5 * px} y={eyeY + px / 2} width={2 * px} height={px / 2} />
          <rect x={ox + 9 * px} y={eyeY + px / 2} width={2 * px} height={px / 2} />
        </g>
      ) : (
        <g className="sovbot-blink" fill={glow}>
          <rect x={ox + 5 * px} y={eyeY} width={2 * px} height={px} />
          <rect x={ox + 9 * px} y={eyeY} width={2 * px} height={px} />
        </g>
      )}
      {p.mouth !== "none" && state !== "sleeping" && <rect className={state === "happy" ? "sovbot-talk" : undefined} x={ox + 7 * px} y={eyeY + 2 * px} width={2 * px} height={px / 2} fill={glow} />}
    </g>
  );
}

function Aura({ p, glow }: { p: Persona; glow: string }) {
  switch (p.aura) {
    case "orbit":
      return (
        <g className="sovbot-spin" style={{ transformOrigin: "100px 110px" }}>
          <ellipse cx={100} cy={110} rx={86} ry={86} fill="none" stroke={glow} strokeOpacity={0.18} strokeWidth={1.5} strokeDasharray="2 7" />
          <circle cx={186} cy={110} r={4} fill={glow} />
          <circle cx={14} cy={110} r={2.5} fill={glow} opacity={0.7} />
        </g>
      );
    case "pulse":
      return (
        <g fill="none" stroke={glow} strokeWidth={2}>
          <circle className="sovbot-pulse" cx={100} cy={110} r={60} style={{ transformOrigin: "100px 110px" }} />
          <circle className="sovbot-pulse sovbot-pulse-2" cx={100} cy={110} r={60} style={{ transformOrigin: "100px 110px" }} />
        </g>
      );
    case "sparkle":
      return (
        <g fill={glow}>
          {[
            [30, 50, 0],
            [170, 64, 0.6],
            [24, 150, 1.1],
            [176, 160, 1.7],
            [100, 18, 2.2],
          ].map(([x, y, d]) => (
            <path key={`${x}-${y}`} className="sovbot-twinkle" style={{ animationDelay: `${d}s`, transformOrigin: `${x}px ${y}px` }} d={`M${x} ${y - 6} L${x + 1.6} ${y - 1.6} L${x + 6} ${y} L${x + 1.6} ${y + 1.6} L${x} ${y + 6} L${x - 1.6} ${y + 1.6} L${x - 6} ${y} L${x - 1.6} ${y - 1.6} Z`} />
          ))}
        </g>
      );
    default:
      return null;
  }
}

// What the bot is doing right now, drawn around it.
function StateMarks({ state, glow }: { state: BotState; glow: string }) {
  if (state === "thinking")
    return (
      <g fill={glow}>
        {[0, 1, 2].map((i) => (
          <circle key={i} className="sovbot-dot" cx={140 + i * 14} cy={30 - i * 6} r={4 + i} style={{ animationDelay: `${i * 0.25}s` }} />
        ))}
      </g>
    );
  if (state === "working")
    return (
      <g className="sovbot-spin-fast" style={{ transformOrigin: "164px 150px" }} fill="none" stroke={glow} strokeWidth={3}>
        <circle cx={164} cy={150} r={9} />
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <path key={a} d="M164 137 v-5" transform={`rotate(${a} 164 150)`} strokeLinecap="round" />
        ))}
      </g>
    );
  if (state === "listening")
    return (
      <g fill="none" stroke={glow} strokeWidth={2.5} strokeLinecap="round">
        <path className="sovbot-wave" d="M28 92 q-8 12 0 24" />
        <path className="sovbot-wave sovbot-wave-2" d="M18 86 q-12 18 0 36" />
      </g>
    );
  if (state === "waiting")
    return (
      <g className="sovbot-await" style={{ transformOrigin: "164px 34px" }}>
        <circle cx={164} cy={34} r={15} fill="#04070d" stroke={glow} strokeWidth={2} />
        <path d="M157 25 h14 l-5 9 l5 9 h-14 l5 -9 z" fill="none" stroke={glow} strokeWidth={2} strokeLinejoin="round" />
      </g>
    );
  if (state === "needs_input")
    return (
      <g className="sovbot-float">
        <path d="M150 18 h30 a8 8 0 0 1 8 8 v16 a8 8 0 0 1 -8 8 h-18 l-8 8 v-8 h-4 a8 8 0 0 1 -8 -8 v-16 a8 8 0 0 1 8 -8 z" fill="#04070d" stroke={glow} strokeWidth={2} />
        <text x={165} y={41} textAnchor="middle" fill={glow} fontSize={18} fontWeight={700} fontFamily="var(--font-archivo), sans-serif">?</text>
      </g>
    );
  if (state === "completed")
    return (
      <g className="sovbot-done" style={{ transformOrigin: "164px 36px" }}>
        <circle cx={164} cy={36} r={15} fill={glow} />
        <path d="M157 36 l5 5 l9 -10" fill="none" stroke="#04070d" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      </g>
    );
  if (state === "unavailable")
    return (
      <g stroke={glow} strokeWidth={2} fill="none" opacity={0.7}>
        <circle cx={164} cy={36} r={12} />
        <path d="M156 44 l16 -16" strokeLinecap="round" />
      </g>
    );
  if (state === "sleeping")
    return (
      <g fill={glow} fontFamily="var(--font-geist-mono), monospace" fontWeight={700}>
        <text className="sovbot-z" x={146} y={44} fontSize={16}>z</text>
        <text className="sovbot-z sovbot-z-2" x={160} y={28} fontSize={12}>z</text>
      </g>
    );
  return null;
}

const STYLE = `
.sovbot-body{animation:sovbot-bob calc(3.2s*var(--k,1)) ease-in-out infinite;transform-origin:100px 200px}
.sovbot-shadow{animation:sovbot-shadow calc(3.2s*var(--k,1)) ease-in-out infinite;transform-origin:100px 206px}
.sovbot-blink{animation:sovbot-blink calc(5s*var(--k,1)) infinite;transform-box:fill-box;transform-origin:center}
.sovbot-scan{animation:sovbot-scan calc(2.6s*var(--k,1)) ease-in-out infinite}
.sovbot-talk{animation:sovbot-talk calc(.45s*var(--k,1)) ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.sovbot-wiggle{animation:sovbot-wiggle calc(2.8s*var(--k,1)) ease-in-out infinite}
.sovbot--listening .sovbot-wiggle{animation-duration:.9s}
.sovbot-float{animation:sovbot-float calc(3s*var(--k,1)) ease-in-out infinite}
.sovbot-ear-l{animation:sovbot-ear calc(4s*var(--k,1)) ease-in-out infinite}
.sovbot-ear-r{animation:sovbot-ear calc(4s*var(--k,1)) ease-in-out infinite reverse}
.sovbot-flutter{animation:sovbot-wiggle calc(1.6s*var(--k,1)) ease-in-out infinite}
.sovbot-sway{animation:sovbot-sway calc(3.6s*var(--k,1)) ease-in-out infinite}
.sovbot-tail{animation:sovbot-wiggle calc(1.8s*var(--k,1)) ease-in-out infinite}
.sovbot--working .sovbot-arm-r{animation:sovbot-wave-arm calc(.6s*var(--k,1)) ease-in-out infinite}
.sovbot--happy .sovbot-arm-l,.sovbot--happy .sovbot-arm-r{animation:sovbot-wave-arm calc(.5s*var(--k,1)) ease-in-out infinite}
.sovbot-spin{animation:sovbot-spin calc(18s*var(--k,1)) linear infinite}
.sovbot-spin-fast{animation:sovbot-spin calc(2.4s*var(--k,1)) linear infinite}
.sovbot-pulse{animation:sovbot-pulse calc(2.8s*var(--k,1)) ease-out infinite}
.sovbot-pulse-2{animation-delay:1.4s}
.sovbot-twinkle{animation:sovbot-twinkle calc(2.6s*var(--k,1)) ease-in-out infinite}
.sovbot-dot{animation:sovbot-dot calc(1.2s*var(--k,1)) ease-in-out infinite}
.sovbot-wave{animation:sovbot-fade calc(1.4s*var(--k,1)) ease-in-out infinite}
.sovbot-wave-2{animation-delay:.35s}
.sovbot-z{animation:sovbot-z calc(2.4s*var(--k,1)) ease-in-out infinite}
.sovbot-z-2{animation-delay:1.2s}
.sovbot--working .sovbot-glow{animation:sovbot-fade calc(1s*var(--k,1)) ease-in-out infinite}
.sovbot-idle-float .sovbot-body{animation:sovbot-floaty calc(5s*var(--k,1)) ease-in-out infinite}
.sovbot-idle-drift .sovbot-body{animation:sovbot-drift calc(6s*var(--k,1)) ease-in-out infinite}
.sovbot-idle-still .sovbot-body{animation:none}
.sovbot--happy .sovbot-body{animation:sovbot-hop calc(.7s*var(--k,1)) ease-in-out infinite}
.sovbot--sleeping .sovbot-body,.sovbot--waiting .sovbot-body{animation:sovbot-bob calc(6s*var(--k,1)) ease-in-out infinite}
.sovbot--listening .sovbot-body{animation:sovbot-lean calc(2.4s*var(--k,1)) ease-in-out infinite}
.sovbot--unavailable .sovbot-body{animation:none}
.sovbot--unavailable .sovbot-figure{filter:grayscale(1) brightness(.55)}
.sovbot--completed .sovbot-arm-l,.sovbot--completed .sovbot-arm-r{animation:sovbot-wave-arm calc(.9s*var(--k,1)) ease-in-out 2}
.sovbot-holo{animation:sovbot-holo calc(2.2s*var(--k,1)) steps(6) infinite}
.sovbot-trace{animation:sovbot-fade calc(2.6s*var(--k,1)) ease-in-out infinite}
.sovbot-await{animation:sovbot-await calc(1.6s*var(--k,1)) ease-in-out infinite}
.sovbot-done{animation:sovbot-done calc(1.8s*var(--k,1)) ease-in-out infinite}
@keyframes sovbot-floaty{0%,100%{transform:translateY(0) rotate(-1deg)}50%{transform:translateY(-10px) rotate(1deg)}}
@keyframes sovbot-drift{0%,100%{transform:translate(-5px,0)}50%{transform:translate(5px,-4px)}}
@keyframes sovbot-holo{0%,100%{opacity:.85}50%{opacity:.55}}
@keyframes sovbot-await{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
@keyframes sovbot-done{0%,100%{transform:scale(.94)}50%{transform:scale(1.06)}}
@keyframes sovbot-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes sovbot-hop{0%,100%{transform:translateY(0)}40%{transform:translateY(-16px)}}
@keyframes sovbot-lean{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(1deg)}}
@keyframes sovbot-shadow{0%,100%{transform:scaleX(1);opacity:.5}50%{transform:scaleX(.86);opacity:.32}}
@keyframes sovbot-blink{0%,94%,100%{transform:scaleY(1)}96%{transform:scaleY(.08)}}
@keyframes sovbot-scan{0%,100%{transform:translateX(0)}50%{transform:translateX(38px)}}
@keyframes sovbot-talk{0%,100%{transform:scaleY(.55)}50%{transform:scaleY(1.1)}}
@keyframes sovbot-wiggle{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg)}}
@keyframes sovbot-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes sovbot-ear{0%,90%,100%{transform:rotate(0)}95%{transform:rotate(-12deg)}}
@keyframes sovbot-sway{0%,100%{transform:skewX(-3deg)}50%{transform:skewX(3deg)}}
@keyframes sovbot-wave-arm{0%,100%{transform:rotate(0)}50%{transform:rotate(-28deg)}}
@keyframes sovbot-spin{to{transform:rotate(360deg)}}
@keyframes sovbot-pulse{0%{transform:scale(.85);opacity:.55}100%{transform:scale(1.5);opacity:0}}
@keyframes sovbot-twinkle{0%,100%{transform:scale(.4);opacity:.3}50%{transform:scale(1.15);opacity:1}}
@keyframes sovbot-dot{0%,100%{transform:translateY(0);opacity:.4}50%{transform:translateY(-5px);opacity:1}}
@keyframes sovbot-fade{0%,100%{opacity:.25}50%{opacity:1}}
@keyframes sovbot-z{0%{transform:translate(0,4px);opacity:0}50%{opacity:1}100%{transform:translate(6px,-8px);opacity:0}}
@media (prefers-reduced-motion: reduce){.sovbot *{animation:none!important}}
`;

export function BotCharacter({ persona, state = "idle", size = 220, className = "" }: { persona: Persona; state?: BotState; size?: number; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ids = { body: `sovbot-body-${uid}`, glow: `sovbot-glow-${uid}`, sheen: `sovbot-sheen-${uid}`, scan: `sovbot-scan-${uid}`, chrome: `sovbot-chrome-${uid}` };
  const glow = persona.palette.glow;
  const light = shade(persona.palette.primary, 0.55);
  const filter = `url(#${ids.glow})`;
  const { paint, overlay, overlayClass } = finish(persona, ids);
  // Energy 0 slows every motion to 1.6x its base time; 100 speeds it to 0.6x.
  const k = (1.6 - persona.motion.energy / 100).toFixed(2);
  return (
    <svg
      viewBox="0 0 200 220"
      width={size}
      height={(size * 220) / 200}
      role="img"
      aria-label={`${persona.name}, ${STATE_LABELS[state].toLowerCase()}`}
      className={`sovbot sovbot--${state} sovbot-idle-${persona.motion.idle} ${className}`}
      style={{ ["--k" as string]: k }}
    >
      <style>{STYLE}</style>
      <defs>
        <FinishDefs p={persona} ids={ids} />
        <filter id={ids.glow} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g className="sovbot-figure">
        {state !== "unavailable" && <Aura p={persona} glow={glow} />}
        <ellipse className="sovbot-shadow" cx={100} cy={206} rx={46} ry={7} fill="#000" opacity={0.5} />
        <g className="sovbot-body">
          <Cape p={persona} glow={glow} />
          {persona.body === "pixel" ? (
            <PixelSprite p={persona} state={state} />
          ) : (
            <>
              <Body p={persona} paint={paint} />
              {overlay && (
                <g className={overlayClass} style={{ pointerEvents: "none" }}>
                  <Body p={persona} paint={{ ...paint, fill: overlay }} silhouette />
                </g>
              )}
              <Marks p={persona} glow={glow} />
              <Top p={persona} glow={glow} filter={filter} />
              <Eyes p={persona} state={state} light={light} />
              <Brows p={persona} state={state} light={light} />
              <Mouth p={persona} state={state} light={light} />
            </>
          )}
          {persona.body !== "pixel" && <Accessory p={persona} glow={glow} />}
          {persona.body === "bot" && <ellipse className="sovbot-glow" cx={100} cy={186} rx={22} ry={5} fill={glow} opacity={0.6} filter={filter} />}
        </g>
        <StateMarks state={state} glow={glow} />
      </g>
    </svg>
  );
}
