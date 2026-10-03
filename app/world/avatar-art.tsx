"use client";

// Avatar representations drawn from one identity seed. The seed carries approved continuity
// traits (silhouette, hair, palette, motif); each representation is a projection of it, so the
// same avatar reads as the same identity whether abstract, pixel or stylized.
import type { RepresentationKind } from "@/lib/kernel/client";

export type Seed = { hair?: string; tone?: string; style?: string; motif?: string; accent?: string; description?: string };

const HAIR: Record<string, string> = { dark: "#1b2433", black: "#0e1218", brown: "#5a3f2b", blond: "#c9a96a", red: "#8f3b2a", silver: "#b9c3cf", white: "#e8edf2" };
const TONE: Record<string, string> = { light: "#e9d2bf", medium: "#c69c7d", deep: "#7a5a45", cool: "#cfd8e3" };

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

// Derives continuity traits from a description; never infers sensitive characteristics.
export function seedFromDescription(description: string, variant: number): Seed {
  const d = description.toLowerCase();
  const hair = Object.keys(HAIR).find((h) => d.includes(h)) ?? ["dark", "silver", "brown"][variant % 3];
  const style = /futur|minimal|sleek/.test(d) ? "minimal" : /warm|soft|friendly/.test(d) ? "soft" : /serious|sharp|formal/.test(d) ? "sharp" : ["minimal", "soft", "sharp"][variant % 3];
  const tone = ["cool", "light", "medium", "deep"][(hash(description) + variant) % 4];
  const motif = ["orbit", "rise", "point"][(hash(description) >> 3) % 3];
  return { hair, tone, style, motif, accent: "#22d3ee" };
}

function Stylized({ seed, size }: { seed: Seed; size: number }) {
  const hair = HAIR[seed.hair ?? "dark"] ?? HAIR.dark;
  const skin = TONE[seed.tone ?? "cool"] ?? TONE.cool;
  const hairPath =
    seed.style === "soft"
      ? "M30 44 C26 18 74 14 70 44 C70 34 62 26 50 26 C38 26 30 34 30 44 Z M28 46 C26 60 30 70 34 74 L34 50 Z M72 46 C74 60 70 70 66 74 L66 50 Z"
      : seed.style === "sharp"
        ? "M30 46 L32 26 L50 20 L68 26 L70 46 C66 34 58 30 50 30 C42 30 34 34 30 46 Z"
        : "M31 44 C30 24 70 22 69 44 C64 32 56 29 50 29 C44 29 36 32 31 44 Z";
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label="Stylized avatar">
      <rect width="100" height="100" rx="50" fill="#0a1220" />
      <path d="M18 100 C20 78 34 70 50 70 C66 70 80 78 82 100 Z" fill="#16233a" />
      <path d="M44 62 L56 62 L55 72 L45 72 Z" fill={skin} />
      <ellipse cx="50" cy="47" rx="17" ry="20" fill={skin} />
      <path d={hairPath} fill={hair} />
      <circle cx="43.5" cy="48" r="1.6" fill="#04070d" />
      <circle cx="56.5" cy="48" r="1.6" fill="#04070d" />
      <path d="M45 57 Q50 59.5 55 57" stroke="#04070d" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <circle cx="50" cy="50" r="48" fill="none" stroke={seed.accent ?? "#22d3ee"} strokeOpacity="0.35" strokeWidth="1" />
    </svg>
  );
}

function Pixel({ seed, size }: { seed: Seed; size: number }) {
  // 12x12 sprite from the same traits as the stylized portrait.
  const hair = HAIR[seed.hair ?? "dark"] ?? HAIR.dark;
  const skin = TONE[seed.tone ?? "cool"] ?? TONE.cool;
  const map = [
    "............",
    "...HHHHHH...",
    "..HHHHHHHH..",
    "..HSSSSSSH..",
    "..SSESSESS..",
    "..SSSSSSSS..",
    "..SSSMMSSS..",
    "...SSSSSS...",
    "....SSSS....",
    "..BBBBBBBB..",
    ".BBBBBBBBBB.",
    ".BBBBBBBBBB.",
  ];
  const color: Record<string, string> = { H: hair, S: skin, E: "#04070d", M: "#5b3a3a", B: "#16233a" };
  return (
    <svg viewBox="0 0 12 12" width={size} height={size} role="img" aria-label="Pixel avatar" shapeRendering="crispEdges">
      <rect width="12" height="12" fill="#0a1220" />
      {map.flatMap((row, y) => [...row].map((c, x) => (color[c] ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={color[c]} /> : null)))}
    </svg>
  );
}

function Abstract({ size, glyph }: { size: number; glyph: "point" | "presence" }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label="Abstract presence">
      <circle cx="50" cy="50" r="46" fill="#0a1220" />
      <circle cx="50" cy="50" r="30" fill="none" stroke="#f2f7fb" strokeOpacity="0.25" strokeWidth="1.5" />
      <circle cx="50" cy="50" r={glyph === "point" ? 7 : 12} fill="#22d3ee" />
    </svg>
  );
}

export function AvatarArt({ kind, seed, size = 40 }: { kind: RepresentationKind; seed: Seed; size?: number }) {
  if (kind === "pixel") return <Pixel seed={seed} size={size} />;
  if (kind === "stylized_3d" || kind === "realistic" || kind === "cartoon") return <Stylized seed={seed} size={size} />;
  return <Abstract size={size} glyph={kind === "voice_only" ? "presence" : "point"} />;
}
