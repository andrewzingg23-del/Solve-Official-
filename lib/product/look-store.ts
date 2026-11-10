import type { Kernel } from "@/lib/kernel/client";
import { BASE_LOOK, normalizeCardLook, type CardLook } from "./card";

// A person's card look lives in the kernel, in their own scope, as an ordinary versioned record —
// not in account metadata. That is what lets it grow (DECISIONS.md, 2026-11-09): a visitor can keep
// it, every change is a new version in an append-only history, undo is a real act rather than a
// browser trick, export carries it, and later a published version is what their public world and
// their printed card read from. One record, so the card and the world can never drift apart.
//
// It reuses `upsert_entity` with an attributes marker, exactly as community projects already do;
// no new store, no new kernel function, and the person's own type vocabulary is left untouched.

const MARK = "solve.look";

export type StoredLook = {
  entityId: string | null;
  look: CardLook;
  /** The look before the latest change, so undo restores what the person actually had. */
  previous: CardLook | null;
  version: number;
};

export async function readLook(kernel: Kernel, actorId: string): Promise<StoredLook> {
  const entities = await kernel.readWorld(`actor:${actorId}`);
  const record = entities.find(entity => entity.attributes?.sov === MARK);
  if (!record) return { entityId: null, look: { ...BASE_LOOK }, previous: null, version: 0 };
  return {
    entityId: record.entity_id,
    look: normalizeCardLook(record.attributes.look),
    previous: record.attributes.previous ? normalizeCardLook(record.attributes.previous) : null,
    version: record.version,
  };
}

/**
 * Record a new look as a new version of the same record. Undo and "return to Base" are just writes
 * of an earlier look, so they are attributable acts in the history like any other.
 */
export async function writeLook(kernel: Kernel, actorId: string, current: StoredLook, next: CardLook, requestId: string): Promise<string> {
  return kernel.upsertEntity({
    entityId: current.entityId ?? undefined,
    kind: "resource",
    scope: `actor:${actorId}`,
    title: "Card look",
    // Before a person's first change their look is Base, so that is what undo restores — the first
    // thing a person tries must be undoable too (staging acceptance run, 2026-11-10).
    attributes: { sov: MARK, look: normalizeCardLook(next), previous: current.look },
    visibility: "private",
    idempotencyKey: requestId,
  });
}
