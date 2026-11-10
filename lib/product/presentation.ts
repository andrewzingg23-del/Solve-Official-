// How a Space is composed — separate from what is in it (DECISIONS.md 2026-11-10, "the shell is the
// floor, not the ceiling"; docs/architecture/2026-11-10-reusable-foundation.md §5).
//
// A presentation is one small versioned record in the Space's own scope that *points at* the Space's
// resources by id. It never copies or changes a note or a photo, so composing a Space can't touch a
// resource's versions, its authorship, its permissions or what the public page may show. It holds
// named choices only — never CSS, URLs, scripts or permissions — so a person, or later an outside AI
// proposing a draft, can only ever change how the Space looks. Writing it needs world.entity.write on
// the Space, which the kernel checks: whoever can add to the Space can arrange it.
//
// Undo writes the previous version back; Return to Base writes Base. Both are ordinary, attributable
// versions in the Space's history.
import type { Kernel } from "@/lib/kernel/client";

const MARK = "solve.presentation";

export const COMPOSITIONS = ["base", "story"] as const;
export type Composition = (typeof COMPOSITIONS)[number];
export const MAX_FEATURED = 3;

export type Presentation = {
  /** base: the shell's own layout. story: a cover leads, highlights first, the rest as a journal. */
  composition: Composition;
  /** One of the Space's own photos, by id. */
  cover: string | null;
  /** Up to three of the Space's own notes, by id, in order. */
  featured: string[];
  /** The Space's own colour — any colour, often taken from its own cover. Readability is computed from
   *  it (lib/product/environment.ts), never assumed. */
  tint: string | null;
};

export const BASE_PRESENTATION: Presentation = { composition: "base", cover: null, featured: [], tint: null };

export type StoredPresentation = { entityId: string | null; presentation: Presentation; previous: Presentation | null; version: number };

/** What the Space actually holds: a presentation may only point at these. */
export type SpaceResources = { photos: ReadonlySet<string>; notes: ReadonlySet<string> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Any input — a stored record, a form, a link, an AI's proposal — reduced to named choices over this
 * Space's real resources. Anything else is dropped, never trusted.
 */
export function normalizePresentation(raw: unknown, resources?: SpaceResources): Presentation {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...BASE_PRESENTATION };
  const v = raw as Record<string, unknown>;
  const composition = (COMPOSITIONS as readonly string[]).includes(String(v.composition)) ? v.composition as Composition : "base";
  const id = (x: unknown) => typeof x === "string" && UUID.test(x) ? x.toLowerCase() : null;
  let cover = id(v.cover);
  if (cover && resources && !resources.photos.has(cover)) cover = null;
  const featured = [...new Set((Array.isArray(v.featured) ? v.featured : []).map(id).filter((x): x is string => Boolean(x)))]
    .filter(x => !resources || resources.notes.has(x)).slice(0, MAX_FEATURED);
  const tint = typeof v.tint === "string" && /^#[0-9a-f]{6}$/i.test(v.tint) ? v.tint.toLowerCase() : null;
  return { composition, cover, featured, tint };
}

export function samePresentation(a: Presentation, b: Presentation): boolean {
  return a.composition === b.composition && a.cover === b.cover && a.tint === b.tint
    && a.featured.length === b.featured.length && a.featured.every((x, i) => x === b.featured[i]);
}

export async function readPresentation(kernel: Kernel, worldId: string, resources?: SpaceResources): Promise<StoredPresentation> {
  const record = (await kernel.readWorld(`world:${worldId}`)).find(e => e.attributes?.sov === MARK && e.attributes?.worldId === worldId);
  if (!record) return { entityId: null, presentation: { ...BASE_PRESENTATION }, previous: null, version: 0 };
  return {
    entityId: record.entity_id,
    presentation: normalizePresentation(record.attributes.presentation, resources),
    previous: record.attributes.previous ? normalizePresentation(record.attributes.previous, resources) : null,
    version: record.version,
  };
}

/** A new version of the Space's one presentation record; the one before it is kept for undo. */
export async function writePresentation(kernel: Kernel, worldId: string, current: StoredPresentation, next: Presentation, requestId: string): Promise<string> {
  return kernel.upsertEntity({
    entityId: current.entityId ?? undefined,
    kind: "resource",
    scope: `world:${worldId}`,
    title: "How this Space looks",
    attributes: { sov: MARK, worldId, presentation: normalizePresentation(next), previous: current.presentation },
    visibility: "members",
    idempotencyKey: requestId,
  });
}

/** A draft as an address, so it can be previewed — by the person, or proposed by their AI — before anything is saved. */
export function presentationParams(p: Presentation): string {
  const q = new URLSearchParams({ preview: "1", composition: p.composition });
  if (p.cover) q.set("cover", p.cover);
  if (p.featured.length) q.set("featured", p.featured.join(","));
  if (p.tint) q.set("tint", p.tint);
  return q.toString();
}

export function presentationFromParams(params: Record<string, string | string[] | undefined>, resources: SpaceResources): Presentation | null {
  if (params.preview !== "1") return null;
  const one = (k: string) => typeof params[k] === "string" ? params[k] as string : undefined;
  return normalizePresentation({ composition: one("composition"), cover: one("cover"), featured: (one("featured") ?? "").split(",").filter(Boolean), tint: one("tint") }, resources);
}
