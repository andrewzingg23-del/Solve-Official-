// A printable part, designed by a person's AI and made real on their own printer. The shape most
// useful parts share: an outline, with round holes if needed, extruded to a width. Stood on edge,
// the outline is the side view (stands, brackets, hooks); laid flat, it is the top view (plates,
// spacers, washers, clips, tags). The outline is millimetres in its own x–z plane. It is stored as a World piece, like pixel art, and served as a binary STL
// that any slicer opens (Bambu Studio, PrusaSlicer, Cura).
//
// Everything stored is re-validated before it is drawn or turned into a file: the outline must be
// one closed, non-crossing loop inside a 256 mm build volume.
import type { Kernel } from "@/lib/kernel/client";
import { loadCreativeWorld } from "@/lib/world/creative";

const PREFIX = "SOV_PART_V1\n";
export const PART_LIMITS = { points: 120, size: 256, purpose: 300, minArea: 10, minWidth: 1, holes: 20, wall: 0.8 } as const;
export const MATERIALS = ["PLA", "PETG", "ABS", "ASA", "TPU", "other"] as const;
export type Material = (typeof MATERIALS)[number];
export type Point = [number, number];
// A round hole through the part: centre x, centre z and diameter, in the outline's coordinates.
export type Hole = [number, number, number];
export type Part = { purpose: string; material: Material; width: number; profile: Point[]; holes?: Hole[]; lay?: "flat" };

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
// Returns the shift it applied, so holes given in the same coordinates move with it.
function cleanProfile(raw: unknown): { pts: Point[]; dx: number; dz: number } {
  if (!Array.isArray(raw) || raw.length < 3 || raw.length > PART_LIMITS.points) throw new PartInputError(`the outline needs 3 to ${PART_LIMITS.points} points`);
  let pts = raw.map((p) => {
    if (!Array.isArray(p) || p.length !== 2 || !p.every((v) => typeof v === "number" && Number.isFinite(v))) throw new PartInputError("each point is [x, z] in millimetres");
    return [round(p[0]), round(p[1])] as Point;
  });
  const dx = Math.min(...pts.map((p) => p[0])), dz = Math.min(...pts.map((p) => p[1]));
  pts = pts.map(([x, z]) => [round(x - dx), round(z - dz)] as Point);
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
  return { pts, dx, dz };
}

function insidePolygon(p: Point, poly: Point[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function distanceToSegment(p: Point, a: Point, b: Point) {
  const vx = b[0] - a[0], vz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vz) / (vx * vx + vz * vz || 1)));
  return Math.hypot(p[0] - (a[0] + t * vx), p[1] - (a[1] + t * vz));
}

// Round holes through the part: [x, z, diameter] in the outline's coordinates. Each must sit inside
// the outline with a printable wall around it, and holes must not touch each other.
function cleanHoles(raw: unknown, outline: Point[], dx: number, dz: number): Hole[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || raw.length > PART_LIMITS.holes) throw new PartInputError(`a part can have up to ${PART_LIMITS.holes} holes`);
  const holes = raw.map((h) => {
    if (!Array.isArray(h) || h.length !== 3 || !h.every((v) => typeof v === "number" && Number.isFinite(v))) throw new PartInputError("each hole is [x, z, diameter] in millimetres");
    const hole: Hole = [round(h[0] - dx), round(h[1] - dz), round(h[2])];
    if (!(hole[2] >= 1 && hole[2] <= 200)) throw new PartInputError("a hole's diameter must be 1 to 200 mm");
    const r = hole[2] / 2;
    const centre: Point = [hole[0], hole[1]];
    const clear = outline.every((a, i) => distanceToSegment(centre, a, outline[(i + 1) % outline.length]) >= r + PART_LIMITS.wall);
    if (!insidePolygon(centre, outline) || !clear) throw new PartInputError(`each hole needs at least ${PART_LIMITS.wall} mm of wall around it, inside the outline`);
    return hole;
  });
  for (let i = 0; i < holes.length; i++) {
    for (let j = i + 1; j < holes.length; j++) {
      if (Math.hypot(holes[i][0] - holes[j][0], holes[i][1] - holes[j][1]) < holes[i][2] / 2 + holes[j][2] / 2 + PART_LIMITS.wall) throw new PartInputError("two holes are too close together");
    }
  }
  return holes;
}

const HOLE_SIDES = 32;
// A hole as a clockwise loop, the opposite way round from the outline.
export const holeLoop = ([x, z, d]: Hole): Point[] =>
  Array.from({ length: HOLE_SIDES }, (_, i) => {
    const a = (-2 * Math.PI * i) / HOLE_SIDES;
    return [x + (d / 2) * Math.cos(a), z + (d / 2) * Math.sin(a)] as Point;
  });

export function encodePart(input: { purpose: unknown; profile: unknown; width: unknown; material: unknown; holes?: unknown; lay?: unknown }): string {
  const purpose = typeof input.purpose === "string" ? input.purpose.trim().slice(0, PART_LIMITS.purpose) : "";
  if (!purpose) throw new PartInputError("say what the part is for");
  const width = typeof input.width === "number" && Number.isFinite(input.width) ? round(input.width) : NaN;
  if (!(width >= PART_LIMITS.minWidth && width <= PART_LIMITS.size)) throw new PartInputError(`the width must be ${PART_LIMITS.minWidth} to ${PART_LIMITS.size} mm`);
  const material = MATERIALS.includes(input.material as Material) ? (input.material as Material) : "other";
  const { pts, dx, dz } = cleanProfile(input.profile);
  const holes = cleanHoles(input.holes, pts, dx, dz);
  const lay = input.lay === "flat" ? "flat" : undefined;
  return PREFIX + JSON.stringify({ purpose, material, width, profile: pts, ...(holes.length ? { holes } : {}), ...(lay ? { lay } : {}) });
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

// Size on the bed (x × y × z, mm) and solid volume (cm³). A part laid flat stands its outline on
// the bed and rises by its width; on edge, the outline stands up and runs back by its width.
export function partFacts(part: Part) {
  const x = Math.max(...part.profile.map((p) => p[0]));
  const z = Math.max(...part.profile.map((p) => p[1]));
  const area = signedArea(part.profile) + (part.holes ?? []).reduce((sum, h) => sum + signedArea(holeLoop(h)), 0);
  const size: [number, number, number] = part.lay === "flat" ? [x, z, part.width] : [x, part.width, z];
  return { size, volumeCm3: Math.round((area * part.width) / 100) / 10 };
}

export const sizeText = (part: Part) => partFacts(part).size.map((n) => `${n}`).join(" × ");

const same = (p: Point, q: Point) => p[0] === q[0] && p[1] === q[1];

// How it will print, from the outline alone. On edge, a face that points down at less than 45°
// from the bed, off the bed, needs supports unless it is a short bridge (5 mm or less). Laid
// flat, every wall is vertical. Little contact with the bed calls for a brim, and a large
// sideways hole may sag at the top.
export function printNotes(part: Part): { supports: boolean; overhangMm: number; note: string } {
  const pts = part.profile;
  const bed = pts.reduce((sum, p, i) => { const q = pts[(i + 1) % pts.length]; return p[1] === 0 && q[1] === 0 ? sum + Math.abs(q[0] - p[0]) : sum; }, 0);
  const notes: string[] = [];
  let overhang = 0;
  if (part.lay !== "flat") {
    pts.forEach((p, i) => {
      const q = pts[(i + 1) % pts.length];
      const dx = q[0] - p[0], dz = q[1] - p[1];
      const facesDown = -dx < 0; // outward normal (dz, -dx) of a counter-clockwise outline
      const shallow = Math.abs(dz) < Math.abs(dx);
      if (facesDown && shallow && Math.min(p[1], q[1]) > 0 && Math.abs(dx) > 5) overhang += Math.abs(dx);
    });
  }
  overhang = Math.round(overhang);
  notes.push(overhang ? `Needs supports under ${overhang} mm of overhang.` : part.lay === "flat" ? "Prints flat, no supports." : "Prints without supports.");
  if (part.lay !== "flat" && bed > 0 && bed < 10) notes.push("Little of it touches the bed; add a brim.");
  if (part.lay !== "flat" && (part.holes ?? []).some((h) => h[2] >= 10)) notes.push("A large sideways hole may sag at the top; print it flat if you can.");
  return { supports: overhang > 0, overhangMm: overhang, note: notes.join(" ") };
}

// Joins each hole to the outline with a two-way cut, so the face is one loop to fill. Holes are
// taken right to left. Each cut runs straight right from the hole's rightmost point to the first
// edge it meets; a point is added there, so nothing can lie across the cut.
export function mergeHoles(outer: Point[], holes: Point[][]): Point[] {
  let poly = outer.slice();
  const near = (p: Point, q: Point) => Math.abs(p[0] - q[0]) < 1e-9 && Math.abs(p[1] - q[1]) < 1e-9;
  const byRight = holes.slice().sort((a, b) => Math.max(...b.map((p) => p[0])) - Math.max(...a.map((p) => p[0])));
  for (const hole of byRight) {
    let mi = 0;
    hole.forEach((p, i) => { if (p[0] > hole[mi][0]) mi = i; });
    const m = hole[mi];
    let hitX = Infinity, edge = -1;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      if (a[1] > m[1] === b[1] > m[1]) continue;
      const x = a[0] + ((m[1] - a[1]) * (b[0] - a[0])) / (b[1] - a[1]);
      if (x >= m[0] && x < hitX) { hitX = x; edge = i; }
    }
    if (edge < 0) throw new PartInputError("a hole could not be joined to the outline");
    const hit: Point = [hitX, m[1]];
    const a = poly[edge], b = poly[(edge + 1) % poly.length];
    let target: number;
    if (near(hit, a)) target = edge;
    else if (near(hit, b)) target = (edge + 1) % poly.length;
    else {
      poly.splice(edge + 1, 0, hit);
      target = edge + 1;
    }
    const ring = [...hole.slice(mi), ...hole.slice(0, mi), m];
    poly = [...poly.slice(0, target + 1), ...ring, poly[target], ...poly.slice(target + 1)];
  }
  return poly;
}

// Ear clipping for one counter-clockwise loop (holes already joined in). Points that coincide with
// a corner of the candidate ear, as the two ends of a cut do, never block it. When no ear is
// free, zero-area slivers (left by cuts and in-line points) are dropped first; only then is a
// point lying exactly on an ear's edge allowed, as a last resort.
export function triangulate(pts: Point[]): [number, number, number][] {
  const idx = pts.map((_, i) => i);
  const tris: [number, number, number][] = [];
  const inside = (p: Point, a: Point, b: Point, c: Point, strict: boolean) =>
    strict ? cross(a, b, p) > 0 && cross(b, c, p) > 0 && cross(c, a, p) > 0 : cross(a, b, p) >= 0 && cross(b, c, p) >= 0 && cross(c, a, p) >= 0;
  const blocked = (a: number, b: number, c: number, strict: boolean) =>
    idx.some((j) => j !== a && j !== b && j !== c && !same(pts[j], pts[a]) && !same(pts[j], pts[b]) && !same(pts[j], pts[c]) && inside(pts[j], pts[a], pts[b], pts[c], strict));
  while (idx.length > 3) {
    let clipped = false;
    for (const pass of ["ear", "sliver", "loose"] as const) {
      for (let i = 0; i < idx.length && !clipped; i++) {
        const a = idx[(i + idx.length - 1) % idx.length], b = idx[i], c = idx[(i + 1) % idx.length];
        const turn = cross(pts[a], pts[b], pts[c]);
        if (pass === "sliver") {
          if (turn !== 0) continue;
        } else if (turn <= 0 || blocked(a, b, c, pass === "loose")) continue;
        if (turn > 0) tris.push([a, b, c]);
        idx.splice(i, 1);
        clipped = true;
      }
      if (clipped) break;
    }
    if (!clipped) throw new PartInputError("the outline could not be filled");
  }
  if (cross(pts[idx[0]], pts[idx[1]], pts[idx[2]]) > 0) tris.push([idx[0], idx[1], idx[2]]);
  return tris;
}

type Vec = [number, number, number];
// Every face of the part, wound so its normal points out.
export function partTriangles(part: Part): [Vec, Vec, Vec][] {
  const w = part.width;
  const face = mergeHoles(part.profile, (part.holes ?? []).map(holeLoop));
  const front = (p: Point): Vec => [p[0], 0, p[1]];
  const back = (p: Point): Vec => [p[0], w, p[1]];
  const out: [Vec, Vec, Vec][] = [];
  for (const [a, b, c] of triangulate(face)) {
    out.push([front(face[a]), front(face[b]), front(face[c])]);
    out.push([back(face[a]), back(face[c]), back(face[b])]);
  }
  // Walls stand on the face's own boundary edges, so they meet the faces exactly. The edges of a
  // cut appear in both directions and are inside the part, so they get no wall.
  const key = (p: Point, q: Point) => `${p[0]},${p[1]}>${q[0]},${q[1]}`;
  const edges = face.map((p, i) => [p, face[(i + 1) % face.length]] as [Point, Point]).filter(([p, q]) => !same(p, q));
  const directed = new Set(edges.map(([p, q]) => key(p, q)));
  for (const [p, q] of edges) {
    if (directed.has(key(q, p))) continue;
    out.push([front(p), back(p), back(q)]);
    out.push([front(p), back(q), front(q)]);
  }
  if (part.lay !== "flat") return out;
  // Laid flat: the outline goes onto the bed and the width becomes height. Swapping two axes
  // mirrors the part, so each face is wound the other way to keep its normal pointing out.
  const flat = (v: Vec): Vec => [v[0], v[2], v[1]];
  return out.map(([a, b, c]) => [flat(a), flat(c), flat(b)]);
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

// The outline and its holes as one SVG path (draw with fill-rule evenodd), scaled into a
// 100-unit box. Edge parts are drawn from the side, z up; flat parts from above.
export function partOutlinePath(part: Pick<Part, "profile" | "holes">) {
  const x = Math.max(...part.profile.map((p) => p[0]));
  const z = Math.max(...part.profile.map((p) => p[1]));
  const k = 100 / Math.max(x, z);
  const sub = (loop: Point[]) => loop.map(([px, pz], i) => `${i ? "L" : "M"}${(px * k).toFixed(1)} ${((z - pz) * k).toFixed(1)}`).join(" ") + " Z";
  return { d: [part.profile, ...(part.holes ?? []).map(holeLoop)].map(sub).join(" "), width: x * k, height: z * k };
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
