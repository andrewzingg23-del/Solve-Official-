"use client";

// The master bot, drawn and animated from its persona. Every part is procedural (no image assets),
// so any combination of body, eyes, mouth, top, accessory, aura and palette is a valid character.
// States animate what is really happening; callers choose the state from real activity only.
// Motion stops for people who ask for reduced motion.
import { useId } from "react";
import type { Persona } from "@/lib/bot/persona";

export type BotState = "idle" | "listening" | "thinking" | "working" | "happy" | "sleeping";

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
  const closed = state === "sleeping";
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
  return (
    <g className="sovbot-blink">
      {[cx - dx, cx + dx].map((x) => (
        <g key={x}>
          <circle cx={x} cy={cy} r={8.5 * s} fill={white} />
          <circle cx={x + look} cy={cy - (state === "thinking" ? 2.5 * s : 0)} r={screen ? 7 * s : 4.4 * s} fill={ink} />
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
  if (p.mouth === "none" || state === "sleeping") return null;
  if (p.mouth === "open" || state === "happy") {
    return <ellipse className={state === "working" || state === "listening" ? undefined : "sovbot-talk"} cx={cx} cy={y + 1} rx={7 * s} ry={5 * s} fill={ink} />;
  }
  if (p.mouth === "line") return <path d={`M${cx - 8 * s} ${y} h${16 * s}`} stroke={ink} strokeWidth={3 * s} strokeLinecap="round" />;
  return <path d={`M${cx - 10 * s} ${y - 2 * s} q${10 * s} ${10 * s} ${20 * s} 0`} stroke={ink} strokeWidth={3 * s} strokeLinecap="round" fill="none" />;
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

function Body({ p, ids }: { p: Persona; ids: { body: string } }) {
  const c = p.palette.primary;
  const dark = shade(c, -0.35);
  switch (p.body) {
    case "bot":
      return (
        <g>
          <rect x={70} y={122} width={60} height={52} rx={18} fill={`url(#${ids.body})`} stroke={dark} strokeWidth={2} />
          <rect className="sovbot-arm-l" x={52} y={130} width={16} height={34} rx={8} fill={c} stroke={dark} strokeWidth={2} style={{ transformOrigin: "60px 132px" }} />
          <rect className="sovbot-arm-r" x={132} y={130} width={16} height={34} rx={8} fill={c} stroke={dark} strokeWidth={2} style={{ transformOrigin: "140px 132px" }} />
          <rect x={48} y={40} width={104} height={84} rx={28} fill={`url(#${ids.body})`} stroke={dark} strokeWidth={2} />
          <rect x={60} y={54} width={80} height={58} rx={18} fill={shade(p.palette.secondary, -0.2)} />
        </g>
      );
    case "humanoid":
      return (
        <g>
          <path d="M54 192 C56 150 76 134 100 134 C124 134 144 150 146 192 Z" fill={p.palette.secondary} stroke={shade(p.palette.secondary, 0.2)} strokeWidth={2} />
          <path d="M88 124 h24 v14 h-24 Z" fill={dark} />
          <circle cx={100} cy={84} r={40} fill={`url(#${ids.body})`} stroke={dark} strokeWidth={2} />
        </g>
      );
    case "creature":
      return (
        <g>
          <path className="sovbot-tail" d="M140 160 C168 160 172 130 160 120" stroke={c} strokeWidth={9} strokeLinecap="round" fill="none" style={{ transformOrigin: "140px 160px" }} />
          <path d="M100 52 C142 52 156 96 156 132 C156 168 132 182 100 182 C68 182 44 168 44 132 C44 96 58 52 100 52 Z" fill={`url(#${ids.body})`} stroke={dark} strokeWidth={2} />
          <ellipse cx={100} cy={146} rx={34} ry={26} fill={shade(c, 0.45)} opacity={0.8} />
          <ellipse cx={78} cy={184} rx={12} ry={6} fill={dark} />
          <ellipse cx={122} cy={184} rx={12} ry={6} fill={dark} />
        </g>
      );
    case "orb":
      return (
        <g>
          <circle cx={100} cy={100} r={58} fill={`url(#${ids.body})`} stroke={dark} strokeWidth={2} />
          <ellipse cx={80} cy={72} rx={18} ry={11} fill="#ffffff" opacity={0.25} transform="rotate(-25 80 72)" />
        </g>
      );
    case "pixel":
      return null;
  }
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
.sovbot-body{animation:sovbot-bob 3.2s ease-in-out infinite;transform-origin:100px 200px}
.sovbot--happy .sovbot-body{animation:sovbot-hop .7s ease-in-out infinite}
.sovbot--sleeping .sovbot-body{animation:sovbot-bob 6s ease-in-out infinite}
.sovbot--listening .sovbot-body{animation:sovbot-lean 2.4s ease-in-out infinite}
.sovbot-shadow{animation:sovbot-shadow 3.2s ease-in-out infinite;transform-origin:100px 206px}
.sovbot-blink{animation:sovbot-blink 5s infinite;transform-box:fill-box;transform-origin:center}
.sovbot-scan{animation:sovbot-scan 2.6s ease-in-out infinite}
.sovbot-talk{animation:sovbot-talk .45s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.sovbot-wiggle{animation:sovbot-wiggle 2.8s ease-in-out infinite}
.sovbot--listening .sovbot-wiggle{animation-duration:.9s}
.sovbot-float{animation:sovbot-float 3s ease-in-out infinite}
.sovbot-ear-l{animation:sovbot-ear 4s ease-in-out infinite}
.sovbot-ear-r{animation:sovbot-ear 4s ease-in-out infinite reverse}
.sovbot-flutter{animation:sovbot-wiggle 1.6s ease-in-out infinite}
.sovbot-sway{animation:sovbot-sway 3.6s ease-in-out infinite}
.sovbot-tail{animation:sovbot-wiggle 1.8s ease-in-out infinite}
.sovbot--working .sovbot-arm-r{animation:sovbot-wave-arm .6s ease-in-out infinite}
.sovbot--happy .sovbot-arm-l,.sovbot--happy .sovbot-arm-r{animation:sovbot-wave-arm .5s ease-in-out infinite}
.sovbot-spin{animation:sovbot-spin 18s linear infinite}
.sovbot-spin-fast{animation:sovbot-spin 2.4s linear infinite}
.sovbot-pulse{animation:sovbot-pulse 2.8s ease-out infinite}
.sovbot-pulse-2{animation-delay:1.4s}
.sovbot-twinkle{animation:sovbot-twinkle 2.6s ease-in-out infinite}
.sovbot-dot{animation:sovbot-dot 1.2s ease-in-out infinite}
.sovbot-wave{animation:sovbot-fade 1.4s ease-in-out infinite}
.sovbot-wave-2{animation-delay:.35s}
.sovbot-z{animation:sovbot-z 2.4s ease-in-out infinite}
.sovbot-z-2{animation-delay:1.2s}
.sovbot--working .sovbot-glow{animation:sovbot-fade 1s ease-in-out infinite}
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

const LABEL: Record<BotState, string> = {
  idle: "idle",
  listening: "listening",
  thinking: "thinking",
  working: "working",
  happy: "happy",
  sleeping: "resting",
};

export function BotCharacter({ persona, state = "idle", size = 220, className = "" }: { persona: Persona; state?: BotState; size?: number; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ids = { body: `sovbot-body-${uid}`, glow: `sovbot-glow-${uid}` };
  const glow = persona.palette.glow;
  const light = shade(persona.palette.primary, 0.55);
  const filter = `url(#${ids.glow})`;
  return (
    <svg
      viewBox="0 0 200 220"
      width={size}
      height={(size * 220) / 200}
      role="img"
      aria-label={`${persona.name}, ${LABEL[state]}`}
      className={`sovbot sovbot--${state} ${className}`}
    >
      <style>{STYLE}</style>
      <defs>
        <radialGradient id={ids.body} cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor={shade(persona.palette.primary, 0.35)} />
          <stop offset="60%" stopColor={persona.palette.primary} />
          <stop offset="100%" stopColor={shade(persona.palette.primary, -0.4)} />
        </radialGradient>
        <filter id={ids.glow} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g>
        <Aura p={persona} glow={glow} />
        <ellipse className="sovbot-shadow" cx={100} cy={206} rx={46} ry={7} fill="#000" opacity={0.5} />
        <g className="sovbot-body">
          <Cape p={persona} glow={glow} />
          {persona.body === "pixel" ? (
            <PixelSprite p={persona} state={state} />
          ) : (
            <>
              <Body p={persona} ids={ids} />
              <Top p={persona} glow={glow} filter={filter} />
              <Eyes p={persona} state={state} light={light} />
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
