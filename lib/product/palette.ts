// One colour in, a whole readable look out.
//
// The reference is Material You, which showed that a single seed colour can generate a coherent
// palette for an entire interface. SOLVE's improvement is that readability is computed and enforced
// rather than hoped for: every text colour this module returns meets WCAG AA (4.5:1) against the
// surface it sits on, whatever seed a person picks — pure yellow, near-white, near-black, anything.
// That is the protected floor in DECISIONS.md (2026-11-09): personal expression may change
// everything about a look except whether a person can read it.
//
// Colour work happens in OKLCH, where lightness is perceptual, so stepping lightness changes how
// light a colour looks and nothing else. All maths is Björn Ottosson's published OKLab transform.

export type Rgb = { r: number; g: number; b: number }; // 0..1, gamma-encoded sRGB
export type Oklch = { l: number; c: number; h: number }; // l 0..1, c ≥ 0, h radians

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function parseHex(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

export function toHex({ r, g, b }: Rgb): string {
  const h = (x: number) => Math.round(clamp01(x) * 255).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function rgbToOklch({ r, g, b }: Rgb): Oklch {
  const lr = toLinear(r), lg = toLinear(g), lb = toLinear(b);
  const l_ = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m_ = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s_ = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
  return { l: L, c: Math.hypot(a, bb), h: Math.atan2(bb, a) };
}

function oklchToLinear({ l, c, h }: Oklch): [number, number, number] {
  const a = c * Math.cos(h), b = c * Math.sin(h);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.2914855480 * b;
  const L = l_ ** 3, M = m_ ** 3, S = s_ ** 3;
  return [
    +4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.7076147010 * S,
  ];
}

/** An OKLCH colour as displayable sRGB. Out-of-gamut colours keep their lightness and hue and lose chroma. */
export function oklchToRgb(colour: Oklch): Rgb {
  const fits = (c: number) => oklchToLinear({ ...colour, c }).every(v => v >= -1e-4 && v <= 1 + 1e-4);
  let c = colour.c;
  if (!fits(c)) {
    let lo = 0, hi = c;
    for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; }
    c = lo;
  }
  const [r, g, b] = oklchToLinear({ ...colour, c });
  return { r: clamp01(toGamma(r)), g: clamp01(toGamma(g)), b: clamp01(toGamma(b)) };
}

/** WCAG 2.x relative luminance. */
export function luminance({ r, g, b }: Rgb): number {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** WCAG 2.x contrast ratio, 1 to 21. */
export function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Move a colour's lightness away from the surface until it reaches the required contrast, keeping
 * its hue. Returns the original colour when it already passes. Always terminates: pure white or
 * pure black meets 4.5:1 against any surface this module produces.
 */
export function ensureContrast(text: Oklch, surface: Rgb, minimum = 4.5): Oklch {
  if (contrast(oklchToRgb(text), surface) >= minimum) return text;
  const lighter = luminance(surface) < 0.18;
  let l = text.l;
  for (let i = 0; i < 100; i++) {
    l = lighter ? Math.min(1, l + 0.01) : Math.max(0, l - 0.01);
    const candidate = { ...text, l };
    if (contrast(oklchToRgb(candidate), surface) >= minimum) return candidate;
  }
  return { l: lighter ? 1 : 0, c: 0, h: text.h };
}

export type Palette = {
  surface: string;   // the card face, or a page surface
  text: string;      // primary text, AA on surface
  muted: string;     // secondary text, also AA on surface — muted never means unreadable
  accent: string;    // a non-text accent (rules, marks, focus)
  border: string;
};

export type PaletteRecipe = {
  /** Surface lightness and the share of the seed's chroma it keeps. */
  surfaceL: number;
  surfaceChroma: number;
  accentL: number;
  accentChroma: number;
};

/** A complete palette from one seed and a recipe, with every text colour guaranteed readable. */
export function paletteFrom(seedHex: string, recipe: PaletteRecipe): Palette {
  const seed = rgbToOklch(parseHex(seedHex) ?? { r: 0.1, g: 0.1, b: 0.1 });
  const surfaceColour = oklchToRgb({ l: recipe.surfaceL, c: seed.c * recipe.surfaceChroma, h: seed.h });
  const dark = luminance(surfaceColour) < 0.18;
  const text = ensureContrast({ l: dark ? 0.97 : 0.18, c: Math.min(seed.c, 0.02), h: seed.h }, surfaceColour, 4.5);
  const muted = ensureContrast({ l: dark ? 0.78 : 0.42, c: Math.min(seed.c, 0.04), h: seed.h }, surfaceColour, 4.5);
  const accent = { l: recipe.accentL, c: seed.c * recipe.accentChroma, h: seed.h };
  const border = { l: dark ? recipe.surfaceL + 0.14 : recipe.surfaceL - 0.14, c: seed.c * recipe.surfaceChroma, h: seed.h };
  return {
    surface: toHex(surfaceColour),
    text: toHex(oklchToRgb(text)),
    muted: toHex(oklchToRgb(muted)),
    accent: toHex(oklchToRgb(accent)),
    border: toHex(oklchToRgb(border)),
  };
}
