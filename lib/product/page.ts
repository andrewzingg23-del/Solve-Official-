import type { Kernel } from "@/lib/kernel/client";

// Whether a thing has a public page. Like the card look, publication is an ordinary versioned
// record in the owner's own `actor:` scope — so only the owner (or their own agents) can publish,
// someone invited to build cannot, and publishing or withdrawing is history that can be undone.
// kernel_api.read_page reads this same record (20261110050000).

const MARK = "solve.page";

/** `pieces`: the ids the owner deliberately ticked. Nothing they made is public unless it is listed here. */
export type Publication = { entityId: string | null; published: boolean; pieces: string[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const MAX_SELECTED = 200;

/** A selection a person can make: well-formed ids, no repeats, a sane number. Anything else is dropped. */
export function cleanSelection(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((id): id is string => typeof id === "string" && UUID.test(id)))].slice(0, MAX_SELECTED);
}

export async function readPublication(kernel: Kernel, actorId: string, worldId: string): Promise<Publication> {
  const record = (await kernel.readWorld(`actor:${actorId}`))
    .find(entity => entity.attributes?.sov === MARK && entity.attributes?.worldId === worldId);
  return { entityId: record?.entity_id ?? null, published: record?.attributes?.published === true, pieces: cleanSelection(record?.attributes?.pieces) };
}

export async function setPublished(kernel: Kernel, actorId: string, worldId: string, published: boolean, requestId: string, pieces?: string[]): Promise<void> {
  const current = await readPublication(kernel, actorId, worldId);
  await kernel.upsertEntity({
    entityId: current.entityId ?? undefined,
    kind: "resource",
    scope: `actor:${actorId}`,
    title: "Public page",
    // Stopping sharing keeps the selection, so sharing again restores exactly what was shown before.
    attributes: { sov: MARK, worldId, published, pieces: pieces === undefined ? current.pieces : cleanSelection(pieces) },
    visibility: "private",
    idempotencyKey: requestId,
  });
}

export type { PublicPage, PublicPiece, PublicSpace } from "@/lib/kernel/client";

// Things made before the rebuild (or through older routes) carry a description SOLVE wrote, in our
// own word, rather than the person's. It is never shown, published or handed to another tool.
const SOLVE_WROTE = "A private World. Start with a blank canvas and shape it as you go.";
export function ownDescription(summary: string | null | undefined, title = ""): string {
  const text = (summary ?? "").trim();
  return text === SOLVE_WROTE || text === title.trim() ? "" : text;
}

/** Splits words into plain text and https links, so a page can carry someone's links like a link-in-bio. */
export type TextPart = { text: string } | { href: string; text: string };
export function linkParts(words: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of words.matchAll(/https:\/\/[^\s<>"']+/g)) {
    const raw = match[0].replace(/[.,;:!?)\]]+$/, "");
    const at = match.index ?? 0;
    let href: string | null = null;
    try {
      const url = new URL(raw);
      if (url.protocol === "https:" && !url.username && !url.password && url.hostname.includes(".")) href = url.toString();
    } catch { href = null; }
    if (!href) continue;
    if (at > last) parts.push({ text: words.slice(last, at) });
    parts.push({ href, text: raw.replace(/^https:\/\//, "") });
    last = at + raw.length;
  }
  if (last < words.length) parts.push({ text: words.slice(last) });
  return parts;
}

// A person's public Space: their card, and the things they chose to share as pages, at one link.
// Like a page, sharing it is a versioned record in their own scope; only they can write it.
const SPACE = "solve.space";

export async function readSpaceShared(kernel: Kernel, actorId: string): Promise<{ entityId: string | null; shared: boolean }> {
  const record = (await kernel.readWorld(`actor:${actorId}`)).find(entity => entity.attributes?.sov === SPACE);
  return { entityId: record?.entity_id ?? null, shared: record?.attributes?.published === true };
}

export async function setSpaceShared(kernel: Kernel, actorId: string, shared: boolean, requestId: string): Promise<void> {
  const current = await readSpaceShared(kernel, actorId);
  await kernel.upsertEntity({
    entityId: current.entityId ?? undefined,
    kind: "resource",
    scope: `actor:${actorId}`,
    title: "Public Space",
    attributes: { sov: SPACE, published: shared },
    visibility: "private",
    idempotencyKey: requestId,
  });
}
