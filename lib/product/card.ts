// The SOV card: the first object that has to express SOLVE convincingly (DECISIONS.md, 2026-11-09).
//
// A card's look is a restricted presentation contract, like the Space appearance contract next to
// it: named choices only — never CSS, URLs, scripts or permissions — so a look can be proposed by a
// person or by an AI and can never do anything but change how the card looks.
//
// Lessons taken from the leaders, and what SOLVE does better:
//   * Apple Card prints nothing sensitive on its face. Neither does this: the brand, the instrument,
//     the person's chosen name, and a link mark. Everything else lives behind the scan, revocable.
//   * Revolut and Monzo let people design card art, but the art is a static image unrelated to
//     anything else they own. Here one look record drives the physical card, the digital card and
//     the person's world, so they cannot drift.
//   * Material You generates a palette from one seed colour. Here that palette is also guaranteed
//     readable (lib/product/palette.ts) — personal expression cannot make the card illegible.
//   * NFC identity cards (Linq, Popl, Blinq) open a static link page. Here the scan resolves to the
//     person's own published world, which they can change or withdraw at any time.
//
// The face never carries a payment-network mark, the EMV contactless symbol, a number, an expiry or
// a claim of verification: none of those is true of this card, and printing one would be a lie.

import { paletteFrom, type Palette } from "./palette";

/** ISO/IEC 7810 ID-1, the size of every bank and identity card: 85.60 × 53.98 mm. */
export const ID1 = { widthMm: 85.6, heightMm: 53.98, ratio: 85.6 / 53.98, cornerMm: 3.18 } as const;

export const EXPRESSIONS = ["base", "personal", "expressive"] as const;
export const TONES = ["dark", "light"] as const;
export const FINISHES = ["matte", "metal", "glass"] as const;

export type CardLook = {
  /** Base is SOLVE's restrained monochrome; Personal and Expressive grow from the person's colour. */
  expression: (typeof EXPRESSIONS)[number];
  /** The one colour everything else is derived from. Ignored by Base. */
  seed: string;
  tone: (typeof TONES)[number];
  /** A surface treatment only. It never changes colour enough to affect readability. */
  finish: (typeof FINISHES)[number];
};

export const BASE_LOOK: CardLook = { expression: "base", seed: "#101318", tone: "dark", finish: "matte" };

/** Seeds offered without a colour picker. Chosen to span hue, not to suggest a "correct" choice. */
export const SEEDS = ["#1f3d7a", "#2f6b4f", "#7a2f5c", "#8a5a1f", "#3d3d4f", "#b8442f", "#5b3fa0", "#1f6b75"] as const;

export function normalizeCardLook(value: unknown): CardLook {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...BASE_LOOK };
  const v = value as Record<string, unknown>;
  const pick = <T extends readonly string[]>(list: T, x: unknown, fallback: T[number]): T[number] =>
    typeof x === "string" && (list as readonly string[]).includes(x) ? x as T[number] : fallback;
  return {
    expression: pick(EXPRESSIONS, v.expression, BASE_LOOK.expression),
    seed: typeof v.seed === "string" && /^#[0-9a-f]{6}$/i.test(v.seed) ? v.seed.toLowerCase() : BASE_LOOK.seed,
    tone: pick(TONES, v.tone, BASE_LOOK.tone),
    finish: pick(FINISHES, v.finish, BASE_LOOK.finish),
  };
}

/** The card's colours, derived from its look. Every text colour meets WCAG AA on the face. */
export function cardPalette(look: CardLook): Palette {
  const { expression, tone } = look;
  if (expression === "base") {
    // Monochrome: a near-neutral surface, regardless of seed.
    return paletteFrom("#14161b", tone === "dark"
      ? { surfaceL: 0.19, surfaceChroma: 0.4, accentL: 0.86, accentChroma: 0.3 }
      : { surfaceL: 0.95, surfaceChroma: 0.4, accentL: 0.35, accentChroma: 0.3 });
  }
  const vivid = expression === "expressive";
  return paletteFrom(look.seed, tone === "dark"
    ? { surfaceL: vivid ? 0.42 : 0.30, surfaceChroma: vivid ? 1.1 : 0.55, accentL: 0.86, accentChroma: vivid ? 1.2 : 0.8 }
    : { surfaceL: vivid ? 0.86 : 0.93, surfaceChroma: vivid ? 0.9 : 0.35, accentL: 0.38, accentChroma: vivid ? 1.2 : 0.9 });
}

/** The words on the face. Nothing sensitive, nothing that isn't true of this card. */
export function cardFace(name: string): { name: string; named: boolean; instrument: string; line: string } {
  const trimmed = name.trim();
  return {
    name: trimmed || "Add your name",
    named: Boolean(trimmed),
    instrument: "SOV ID",
    line: "Your digital life. In your hands.",
  };
}
