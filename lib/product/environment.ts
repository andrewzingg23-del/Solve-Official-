// A person's whole SOLVE takes its colours from their own card.
//
// The card's tone becomes the environment's tone, and the card's colour becomes the environment's
// accent — so the card, the person's world and every screen they use read from one look record
// and cannot drift apart (DECISIONS.md 2026-11-09: "everything needs to be uniform and also
// customized").
//
// SOLVE owns the frame, so structure stays monochrome: page, surfaces, text, lines. The person
// owns the expression, which enters through exactly one channel, the accent. Protected zones —
// consent, approval, revocation — are built from the frame colours only, never the accent, so no
// look can change how serious an authorising act appears.

import { BASE_LOOK, cardPalette, type CardLook } from "./card";
import { contrast, ensureContrast, oklchToRgb, parseHex, rgbToOklch, toHex } from "./palette";

export type Environment = {
  tone: "dark" | "light";
  page: string;
  surface: string;
  raised: string;
  line: string;
  text: string;
  muted: string;
  /** The person's colour. Never used for body text; used for their presence, selection and focus. */
  accent: string;
  /** Text that sits on the accent. */
  onAccent: string;
};

const FRAME = {
  dark: { page: "#0a0b0d", surface: "#121418", raised: "#1a1d23", line: "#262a31", text: "#f2f3f5", muted: "#a3a8b2" },
  light: { page: "#f7f7f5", surface: "#ffffff", raised: "#efefec", line: "#dcdcd7", text: "#121316", muted: "#5b5f68" },
} as const;

export function environmentFor(look: CardLook = BASE_LOOK): Environment {
  const tone = look.tone;
  const frame = FRAME[tone];
  const page = parseHex(frame.page)!;

  // Base keeps the frame's own neutral accent; Personal and Expressive bring the person's colour,
  // pushed far enough from the page to be visible as a mark or a focus ring (3:1, WCAG non-text).
  let accentHex: string;
  if (look.expression === "base") {
    accentHex = frame.text;
  } else {
    const seed = rgbToOklch(parseHex(cardPalette(look).accent) ?? page);
    accentHex = toHex(oklchToRgb(ensureContrast(seed, page, 3)));
  }
  const accent = parseHex(accentHex)!;
  const onAccent = contrast(accent, parseHex("#ffffff")!) >= contrast(accent, parseHex("#0a0b0d")!) ? "#ffffff" : "#0a0b0d";

  return { tone, ...frame, accent: accentHex, onAccent };
}

/** The environment as CSS custom properties, for the root element. */
export function environmentStyle(env: Environment): Record<string, string> {
  return {
    "--page": env.page, "--surface": env.surface, "--raised": env.raised, "--line": env.line,
    "--text": env.text, "--muted": env.muted, "--accent": env.accent, "--on-accent": env.onAccent,
    colorScheme: env.tone,
  };
}
