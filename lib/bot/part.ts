// A printable part, designed by a person's AI and made real on their own printer. The first shape
// is the one most useful parts share: a side outline, extruded to a width (stands, brackets, hooks,
// clips, spacers, shims). The outline is millimetres in the x–z plane with z = 0 on the print bed;
// the width runs along y. It is stored as a World piece, like pixel art, and served as a binary STL
// that any slicer opens (Bambu Studio, PrusaSlicer, Cura).
//
// Everything stored is re-validated before it is drawn or turned into a file: the outline must be
// one closed, non-crossing loop inside a 256 mm build volume.
import type { Kernel } from "@/lib/kernel/client";
import { loadCreativeWorld } from "@/lib/world/creative";

const PREFIX = "SOV_PART_V1\n";
export const PART_LIMITS = { points: 120, size: 256, purpose: 300, minArea: 10, minWidth: 1 } as const;
export const MATERIALS = ["PLA", "PETG", "ABS", "ASA", "TPU", "other"] as const;
export type Material = (typeof MATERIALS)[number];
export type Point = [number, number];
export type Part = { purpose: string; material: Material; width: number; profile: Point[] };

export class PartInputError extends Error {}

const round = (n: number) => Math.round(n * 10) / 10;
const cross = (o: Point, a: Point, b: Point) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
export const signedArea = (p: Point[]) => p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0) / 2;

function segmentsCross(a: Point, b: Point, c: Point, d: Point) {
  const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  const on = (p: Point, q: Point, r: Point) => Math.min(p[0], q[0]) <= r[0] && r[0] <= Math.max(p[0], q[0]) && Math.min(p[1], q[1]) <= r[1] && r[1] <= Math.max(p[1], q[1]);
  return (d1 === 0 && on(c, d, a)) || (d2 === 0 && on(c, d, b)) || (d3 === 0 && on(a, b, c)) || (d4 === 0 && on(a, b, d));
}

// Cleans an outline: numbers only, rounded to 0.1 mm, moved so it sits on the bed at the origin,
// repeated and in-line points dropped, wound counter-clockwise; then checks it is one simple loop.
function cleanProfile(raw: unknown): Point[] {
  if (!Array.isArray(raw) || raw.length < 3 || raw.length > PART_LIMITS.points) throw new PartInputError(`the outline needs 3 to ${PART_LIMITS.points} points`);
  let pts = raw.map((p) => {
    if (!Array.isArray(p) || p.length !== 2 || !p.every((v) => typeof v === "number" && Number.isFinite(v))) throw new PartInputError("each point is [x, z] in millimetres");
    return [round(p[0]), round(p[1])] as Point;
  });
  const minX = Math.min(...pts.map((p) => p[0])), minZ = Math.min(...pts.map((p) => p[1]));
  pts = pts.map(([x, z]) => [round(x - minX), round(z - minZ)] as Point);
  pts = pts.filter((p, i) => { const q = pts[(i + 1) % pts.length]; return p[0] !== q[0] || p[1] !== q[1]; });
  for (let changed = true; changed && pts.length > 3; ) {
    changed = false;
    for (let i = 0; i < pts.length; i++) {
      if (cross(pts[(i + pts.length - 1) % pts.length], pts[i], pts[(i + 1) % pts.length]) === 0) { pts.splice(i, 1); changed = true; break; }
    }
  }
  if (pts.length < 3 || pts.every((p) => cross(pts[0], pts[1], p) === 0)) throw new PartInputError("the outline is a line, not a shape");
  if (Math.max(...pts.flat()) > PART_LIMITS.size) throw new PartInputError(`the outline must fit in ${PART_LIMITS.size} mm`);
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      if (j === i + 1 || (i === 0 && j === pts.length - 1)) continue;
      if (segmentsCross(pts[i], pts[(i + 1) % pts.length], pts[j], pts[(j + 1) % pts.length])) throw new PartInputError("the outline crosses itself");
    }
  }
  if (signedArea(pts) < 0) pts.reverse();
  if (signedArea(pts) < PART_LIMITS.minArea) throw new PartInputError("the outline is too small to print");
  return pts;
}

export function encodePart(input: { purpose: unknown; profile: unknown; width: unknown; material: unknown }): string {
  const purpose = typeof input.purpose === "string" ? input.purpose.trim().slice(0, PART_LIMITS.purpose) : "";
  if (!purpose) throw new PartInputError("say what the part is for");
  const width = typeof input.width === "number" && Number.isFinite(input.width) ? round(input.width) : NaN;
  if (!(width >= PART_LIMITS.minWidth && width <= PART_LIMITS.size)) throw new PartInputError(`the width must be ${PART_LIMITS.minWidth} to ${PART_LIMITS.size} mm`);
  const material = MATERIALS.includes(input.material as Material) ? (input.material as Material) : "other";
  return PREFIX + JSON.stringify({ purpose, material, width, profile: cleanProfile(input.profile) });
}

export function parsePart(body: string): Part | null {
  if (!body.startsWith(PREFIX)) return null;
  try {
    const value = JSON.parse(body.slice(PREFIX.length)) as Record<string, unknown>;
    return JSON.parse(encodePart(value as never).slice(PREFIX.length)) as Part;
  } catch {
    return null;
  }
}

// Size on the bed (x × y × z, mm) and solid volume (cm³).
export function partFacts(part: Part) {
  const x = Math.max(...part.profile.map((p) => p[0]));
  const z = Math.max(...part.profile.map((p) => p[1]));
  return { size: [x, part.width, z] as [number, number, number], volumeCm3: Math.round((signedArea(part.profile) * part.width) / 100) / 10 };
}

export const sizeText = (part: Part) => partFacts(part).size.map((n) => `${n}`).join(" × ");

// Ear clipping for one simple, counter-clockwise loop.
export function triangulate(pts: Point[]): [number, number, number][] {
  const idx = pts.map((_, i) => i);
  const tris: [number, number, number][] = [];
  const inside = (p: Point, a: Point, b: Point, c: Point) => cross(a, b, p) >= 0 && cross(b, c, p) >= 0 && cross(c, a, p) >= 0;
  while (idx.length > 3) {
    let clipped = false;
    for (let i = 0; i < idx.length; i++) {
      const a = idx[(i + idx.length - 1) % idx.length], b = idx[i], c = idx[(i + 1) % idx.length];
      if (cross(pts[a], pts[b], pts[c]) <= 0) continue;
      if (idx.some((j) => j !== a && j !== b && j !== c && inside(pts[j], pts[a], pts[b], pts[c]))) continue;
      tris.push([a, b, c]);
      idx.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) throw new PartInputError("the outline could not be filled");
  }
  tris.push([idx[0], idx[1], idx[2]]);
  return tris;
}

type Vec = [number, number, number];
// Every face of the extruded part, wound so its normal points out.
export function partTriangles(part: Part): [Vec, Vec, Vec][] {
  const p = part.profile, w = part.width;
  const front = (i: number): Vec => [p[i][0], 0, p[i][1]];
  const back = (i: number): Vec => [p[i][0], w, p[i][1]];
  const out: [Vec, Vec, Vec][] = [];
  for (const [a, b, c] of triangulate(p)) {
    out.push([front(a), front(b), front(c)]);
    out.push([back(a), back(c), back(b)]);
  }
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length;
    out.push([front(i), back(i), back(j)]);
    out.push([front(i), back(j), front(j)]);
  }
  return out;
}

// A binary STL: an 80-byte header, the triangle count, then 50 bytes per triangle.
export function partStl(part: Part, name: string): Uint8Array {
  const tris = partTriangles(part);
  const buf = new ArrayBuffer(84 + tris.length * 50);
  const view = new DataView(buf);
  const header = `solve part: ${name}`.replace(/[^\x20-\x7e]/g, "?").slice(0, 80);
  for (let i = 0; i < header.length; i++) view.setUint8(i, header.charCodeAt(i));
  view.setUint32(80, tris.length, true);
  let at = 84;
  for (const [a, b, c] of tris) {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const len = Math.hypot(n[0], n[1], n[2]) || 1;
    for (const value of [...n.map((x) => x / len), ...a, ...b, ...c]) {
      view.setFloat32(at, value, true);
      at += 4;
    }
    view.setUint16(at, 0, true);
    at += 2;
  }
  return new Uint8Array(buf);
}

// The outline as a small SVG path, z up, scaled into a 100-unit box, for previews.
export function partOutlinePath(part: Part) {
  const [x, , z] = partFacts(part).size;
  const k = 100 / Math.max(x, z);
  return { d: part.profile.map(([px, pz], i) => `${i ? "L" : "M"}${(px * k).toFixed(1)} ${((z - pz) * k).toFixed(1)}`).join(" ") + " Z", width: x * k, height: z * k };
}

export const partUrl = (appUrl: string, worldId: string, pieceId: string) => `${appUrl}/parts/${worldId}/${pieceId}.stl`;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "part";

// The STL for one piece, read as whoever asks: the kernel decides whether they may see the World.
export async function partFile(kernel: Kernel, worldId: string, file: string): Promise<{ bytes: Uint8Array; filename: string } | null> {
  const match = /^([0-9a-f-]{36})\.stl$/i.exec(file);
  if (!match) return null;
  const { artifacts } = await loadCreativeWorld(kernel, worldId);
  const piece = artifacts.find((a) => a.entityId === match[1].toLowerCase());
  const part = piece ? parsePart(piece.body) : null;
  if (!piece || !part) return null;
  return { bytes: partStl(part, piece.title), filename: `${slug(piece.title)}.stl` };
}
