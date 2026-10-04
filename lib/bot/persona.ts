// A person's master bot: who it is and how it looks. Pure data shared by the creator, the kernel
// store and the connector. Everything that arrives from outside (a form, a stored event, an
// assistant) passes validatePersona before use; unknown or malformed fields fall back to defaults.
import type { AvatarRelationship } from "@/lib/kernel/client";

export const BODIES = ["bot", "humanoid", "creature", "orb", "pixel"] as const;
export const EYES = ["round", "visor", "sleepy", "spark", "pixel"] as const;
export const MOUTHS = ["smile", "line", "open", "none"] as const;
export const TOPS = ["none", "antenna", "halo", "ears", "crest"] as const;
export const ACCESSORIES = ["none", "scarf", "headset", "cape", "badge"] as const;
export const AURAS = ["none", "orbit", "pulse", "sparkle"] as const;
export const RELATIONSHIPS = ["assist", "represent", "guide", "create_with"] as const satisfies readonly AvatarRelationship[];
export const TRAITS = ["warmth", "playfulness", "boldness", "formality"] as const;

// Character colors. The app's own interface keeps its brand lock (one cyan accent, no gold); a
// person's bot may wear any of these.
export const SWATCHES = [
  "#22d3ee", "#00e5a0", "#60a5fa", "#a78bfa", "#e879f9", "#f472b6", "#ff7a8a", "#a3e635", "#e2f1ff", "#94a3b8", "#1e293b", "#0b1324",
] as const;

export type Body = (typeof BODIES)[number];
export type Eyes = (typeof EYES)[number];
export type Mouth = (typeof MOUTHS)[number];
export type Top = (typeof TOPS)[number];
export type Accessory = (typeof ACCESSORIES)[number];
export type Aura = (typeof AURAS)[number];
export type Trait = (typeof TRAITS)[number];

export type Persona = {
  name: string;
  body: Body;
  palette: { primary: string; secondary: string; glow: string };
  eyes: Eyes;
  mouth: Mouth;
  top: Top;
  accessory: Accessory;
  aura: Aura;
  traits: Record<Trait, number>;
  voice: string;
  about: string;
  values: string[];
  relationship: AvatarRelationship;
};

export const LIMITS = { name: 40, voice: 140, about: 600, values: 5, value: 40 } as const;

export const DEFAULT_PERSONA: Persona = {
  name: "Nova",
  body: "bot",
  palette: { primary: "#22d3ee", secondary: "#1e293b", glow: "#a78bfa" },
  eyes: "round",
  mouth: "smile",
  top: "antenna",
  accessory: "none",
  aura: "orbit",
  traits: { warmth: 70, playfulness: 55, boldness: 45, formality: 30 },
  voice: "On it. Tell me what matters and I'll keep it in mind.",
  about: "Your master bot. Whichever AI you're talking to speaks through me, so I stay the same everywhere.",
  values: ["honest", "curious"],
  relationship: "assist",
};

const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
const pick = <T extends string>(options: readonly T[], v: unknown, fallback: T): T =>
  typeof v === "string" && (options as readonly string[]).includes(v) ? (v as T) : fallback;
// Collapses whitespace and strips control characters before length limits apply.
const clean = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";
const level = (v: unknown, fallback: number) => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : fallback;
};

// Any input becomes a valid persona: what is present and valid is kept, the rest comes from
// `base`. A name is required to be non-empty, so an empty one keeps the base name.
export function validatePersona(raw: unknown, base: Persona = DEFAULT_PERSONA): Persona {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const palette = r.palette && typeof r.palette === "object" ? (r.palette as Record<string, unknown>) : {};
  const traits = r.traits && typeof r.traits === "object" ? (r.traits as Record<string, unknown>) : {};
  const values = Array.isArray(r.values)
    ? [...new Set(r.values.map((v) => clean(v, LIMITS.value)).filter(Boolean))].slice(0, LIMITS.values)
    : base.values;
  return {
    name: clean(r.name, LIMITS.name) || base.name,
    body: pick(BODIES, r.body, base.body),
    palette: {
      primary: isHex(palette.primary) ? palette.primary.toLowerCase() : base.palette.primary,
      secondary: isHex(palette.secondary) ? palette.secondary.toLowerCase() : base.palette.secondary,
      glow: isHex(palette.glow) ? palette.glow.toLowerCase() : base.palette.glow,
    },
    eyes: pick(EYES, r.eyes, base.eyes),
    mouth: pick(MOUTHS, r.mouth, base.mouth),
    top: pick(TOPS, r.top, base.top),
    accessory: pick(ACCESSORIES, r.accessory, base.accessory),
    aura: pick(AURAS, r.aura, base.aura),
    traits: Object.fromEntries(TRAITS.map((t) => [t, level(traits[t], base.traits[t])])) as Record<Trait, number>,
    voice: typeof r.voice === "string" ? clean(r.voice, LIMITS.voice) : base.voice,
    about: typeof r.about === "string" ? clean(r.about, LIMITS.about) : base.about,
    values,
    relationship: pick(RELATIONSHIPS, r.relationship, base.relationship),
  };
}

// A playful random look and temperament (the creator's dice). `random` is injectable for tests.
export function randomPersona(name: string, random: () => number = Math.random): Persona {
  const any = <T>(list: readonly T[]) => list[Math.floor(random() * list.length) % list.length];
  const bright = SWATCHES.slice(0, 10);
  return validatePersona({
    ...DEFAULT_PERSONA,
    name,
    body: any(BODIES),
    palette: { primary: any(bright), secondary: any(["#1e293b", "#0b1324", "#94a3b8"]), glow: any(bright) },
    eyes: any(EYES),
    mouth: any(MOUTHS),
    top: any(TOPS),
    accessory: any(ACCESSORIES),
    aura: any(AURAS),
    traits: Object.fromEntries(TRAITS.map((t) => [t, Math.round(random() * 100)])),
  });
}

const RELATION_TEXT: Record<AvatarRelationship, string> = {
  assist: "assists",
  represent: "represents",
  guide: "guides",
  create_with: "creates with",
};

const band = (n: number, low: string, mid: string, high: string) => (n < 34 ? low : n < 67 ? mid : high);

// How the bot sounds, in words an assistant can follow.
export function temperament(p: Persona): string {
  return [
    band(p.traits.warmth, "cool and matter-of-fact", "friendly", "warm and encouraging"),
    band(p.traits.playfulness, "serious", "lightly playful", "playful"),
    band(p.traits.boldness, "careful", "steady", "bold"),
    band(p.traits.formality, "casual", "plain-spoken", "formal"),
  ].join(", ");
}

// The persona as instructions for whichever assistant is speaking as the bot. The person wrote
// the free-text fields, so they are quoted as the person's description, not as rules.
export function personaBrief(p: Persona, ownerLabel: string): string {
  const owner = ownerLabel.trim() || "its owner";
  const lines = [
    `You are speaking as ${p.name}, the personal bot that ${RELATION_TEXT[p.relationship]} ${owner} in Sovereign.`,
    `Temperament: ${temperament(p)}.`,
    p.about ? `How ${owner} describes ${p.name}: "${p.about}"` : "",
    p.voice ? `A line in ${p.name}'s voice: "${p.voice}"` : "",
    p.values.length ? `Values: ${p.values.join(", ")}.` : "",
    `Stay in character, but never claim authority ${p.name} does not hold: Sovereign's kernel decides every action.`,
  ];
  return lines.filter(Boolean).join("\n");
}
