const PREFIX = "SOV_PIXEL_ART_V1\\n";
const MAX_SIDE = 32;
const MAX_CELLS = MAX_SIDE * MAX_SIDE;

export type PixelArt = { prompt: string; palette: string[]; rows: string[] };
export const PIXEL_ART_LIMITS = { side: MAX_SIDE, colors: 10, prompt: 500 } as const;

export function encodePixelArt(input: { prompt: unknown; rows: unknown; palette: unknown }): string {
  const prompt = typeof input.prompt === "string" ? input.prompt.trim().slice(0, PIXEL_ART_LIMITS.prompt) : "";
  const rows = input.rows;
  const palette = input.palette;
  if (!prompt) throw new Error("include a short description of the pixel art");
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > MAX_SIDE || rows.some((row) => typeof row !== "string" || row.length < 1 || row.length > MAX_SIDE)) {
    throw new Error("the pixel grid must be between 1×1 and 32×32");
  }
  const width = (rows[0] as string).length;
  if (rows.some((row) => (row as string).length !== width)) throw new Error("every pixel row must have the same width");
  if (!Array.isArray(palette) || palette.length < 1 || palette.length > PIXEL_ART_LIMITS.colors || palette.some((color) => typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color))) {
    throw new Error("use between 1 and 10 six-digit hex colors");
  }
  if (rows.length * width > MAX_CELLS || rows.some((row) => !/^[.0-9]+$/.test(row as string))) {
    throw new Error("pixel rows may contain only dots (transparent) and palette indexes 0–9");
  }
  const used = new Set((rows as string[]).join("").split("").filter((cell) => cell !== ".").map(Number));
  if ([...used].some((index) => index >= palette.length)) throw new Error("a pixel references a color missing from the palette");
  return PREFIX + JSON.stringify({ prompt, palette: palette.map((color) => (color as string).toLowerCase()), rows });
}

export function parsePixelArt(body: string): PixelArt | null {
  if (!body.startsWith(PREFIX)) return null;
  try {
    const value = JSON.parse(body.slice(PREFIX.length)) as { prompt?: unknown; palette?: unknown; rows?: unknown };
    if (typeof value.prompt !== "string" || !Array.isArray(value.rows) || !Array.isArray(value.palette)) return null;
    // Re-validate stored data before rendering it as inline CSS.
    const canonical = encodePixelArt({ prompt: value.prompt, rows: value.rows, palette: value.palette });
    const parsed = JSON.parse(canonical.slice(PREFIX.length)) as PixelArt;
    return parsed;
  } catch {
    return null;
  }
}
