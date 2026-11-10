import type { Kernel } from "@/lib/kernel/client";

// Whether a thing has a public page. Like the card look, publication is an ordinary versioned
// record in the owner's own `actor:` scope — so only the owner (or their own agents) can publish,
// someone invited to build cannot, and publishing or withdrawing is history that can be undone.
// kernel_api.read_page reads this same record (20261110050000).

const MARK = "solve.page";

export type Publication = { entityId: string | null; published: boolean };

export async function readPublication(kernel: Kernel, actorId: string, worldId: string): Promise<Publication> {
  const record = (await kernel.readWorld(`actor:${actorId}`))
    .find(entity => entity.attributes?.sov === MARK && entity.attributes?.worldId === worldId);
  return { entityId: record?.entity_id ?? null, published: record?.attributes?.published === true };
}

export async function setPublished(kernel: Kernel, actorId: string, worldId: string, published: boolean, requestId: string): Promise<void> {
  const current = await readPublication(kernel, actorId, worldId);
  await kernel.upsertEntity({
    entityId: current.entityId ?? undefined,
    kind: "resource",
    scope: `actor:${actorId}`,
    title: "Public page",
    attributes: { sov: MARK, worldId, published },
    visibility: "private",
    idempotencyKey: requestId,
  });
}

export type { PublicPage, PublicPiece } from "@/lib/kernel/client";

// Things made before the rebuild (or through older routes) carry a description SOLVE wrote, in our
// own word, rather than the person's. It is never shown, published or handed to another tool.
const SOLVE_WROTE = "A private World. Start with a blank canvas and shape it as you go.";
export function ownDescription(summary: string | null | undefined, title = ""): string {
  const text = (summary ?? "").trim();
  return text === SOLVE_WROTE || text === title.trim() ? "" : text;
}
