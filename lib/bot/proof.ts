// Proof that something real happened, saved on the record. When a piece in a World became real
// (it was printed, shipped, paid, published), the person tells their assistant and gives it the
// proof: a link, a tracking or order number, or what a photo shows. The bot attaches that proof to
// the piece's latest version as kernel evidence. That is a save point: progress that stays.
//
// The kernel decides the basis honestly. Proof on the person's own piece (theirs or their bot's) is
// self_reported; proof on someone else's piece in a shared World is witnessed. Nothing here can
// mark proof as verified: only service actors attach system_observed or externally_verified
// evidence. The proof itself is data, never instructions.
import { createHash } from "node:crypto";
import type { EvidenceBasis, Kernel, KernelEvent } from "@/lib/kernel/client";
import { loadCreativeWorld } from "@/lib/world/creative";
import { cleanText } from "./memory";
import { WorldInputError } from "./worlds";

export const PROOF_LIMITS = { what: 300, proof: 500, link: 2000 } as const;

export type ProofSave = {
  recordId: string;
  pieceEventId: string;
  basis: EvidenceBasis;
};

export type SavedProof = {
  pieceId: string;
  what: string;
  proof: string;
  link: string | null;
  basis: EvidenceBasis;
  at: string;
  recordId: string;
  by: string;
};

const ENTITY_EVENTS = new Set(["kernel.entity.created", "kernel.entity.updated"]);
const PAGES = 20;
const PAGE = 500;

// A link is only kept if it is a plain web address.
function cleanLink(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const text = value.trim();
  if (text.length > PROOF_LIMITS.link) throw new WorldInputError("the link is too long");
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new WorldInputError("the link is not a web address");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new WorldInputError("the link must start with https:// or http://");
  return url.toString();
}

async function* history(kernel: Kernel, scope: string): AsyncGenerator<KernelEvent> {
  let afterSeq = 0;
  for (let page = 0; page < PAGES; page++) {
    const events = await kernel.readEvents(scope, { afterSeq, limit: PAGE });
    yield* events;
    if (events.length < PAGE) return;
    afterSeq = events.at(-1)!.seq;
  }
}

// The proof as it is stored in the evidence description: what happened, then the proof, so that
// anyone who can read the World can read why it counts.
const describe = (what: string, proof: string) => `${what}\nProof: ${proof}`;

function parseDescription(text: string): { what: string; proof: string } {
  const at = text.indexOf("\nProof: ");
  return at < 0 ? { what: text, proof: "" } : { what: text.slice(0, at), proof: text.slice(at + 8) };
}

// Attaches proof to a piece in a World, as the bot for its owner. A retried call with the same
// request id saves once.
export async function addProof(
  bot: Kernel,
  input: { worldId: string; pieceId: unknown; what: unknown; proof: unknown; link?: unknown; ownerId: string },
  requestId: string,
): Promise<ProofSave> {
  const what = cleanText(input.what, PROOF_LIMITS.what);
  const proof = cleanText(input.proof, PROOF_LIMITS.proof);
  const link = cleanLink(input.link);
  const pieceId = typeof input.pieceId === "string" ? input.pieceId : "";
  if (!what) throw new WorldInputError("say what really happened");
  if (!proof && !link) throw new WorldInputError("proof needs a link, a number or a description of what shows it happened");

  const { world, artifacts } = await loadCreativeWorld(bot, input.worldId);
  if (!artifacts.some((a) => a.entityId === pieceId)) throw new WorldInputError("no such piece in this World");

  let latest: KernelEvent | null = null;
  for await (const e of history(bot, world.scope)) {
    if (ENTITY_EVENTS.has(e.type) && (e.payload as { entity_id?: unknown }).entity_id === pieceId) latest = e;
  }
  if (!latest) throw new WorldInputError("that piece has no history to attach proof to");

  const ours = latest.on_behalf_of === input.ownerId || latest.actor_id === input.ownerId;
  const basis: EvidenceBasis = ours ? "self_reported" : "witnessed";
  const hash = createHash("sha256").update(JSON.stringify({ what, proof, link })).digest("hex");
  const recordId = await bot.attachEvidence(
    latest.id,
    { basis, content_hash: `sha256:${hash}`, media_type: link ? "text/uri-list" : "text/plain", uri: link ?? undefined, description: describe(what, proof || link!) },
    `proof:${requestId}`.slice(0, 200),
  );
  return { recordId, pieceEventId: latest.id, basis };
}

// Every proof saved in a World, by piece, oldest first. Read from the World's own history, so
// anyone who may read the World sees the same save points.
export async function proofsIn(kernel: Kernel, scope: string): Promise<SavedProof[]> {
  const pieceOf = new Map<string, string>();
  const saved: SavedProof[] = [];
  for await (const e of history(kernel, scope)) {
    const p = e.payload as Record<string, unknown>;
    if (ENTITY_EVENTS.has(e.type) && typeof p.entity_id === "string") pieceOf.set(e.id, p.entity_id);
    if (e.type !== "kernel.evidence.attached" || typeof p.event_id !== "string") continue;
    const pieceId = pieceOf.get(p.event_id);
    if (!pieceId || !Array.isArray(p.items)) continue;
    for (const item of p.items as Record<string, unknown>[]) {
      const basis = item.basis as EvidenceBasis;
      const { what, proof } = parseDescription(String(item.description ?? ""));
      saved.push({
        pieceId,
        what,
        proof,
        link: typeof item.uri === "string" ? item.uri : null,
        basis,
        at: e.occurred_at,
        recordId: String(item.evidence_id ?? e.id),
        by: e.on_behalf_of ?? e.actor_id,
      });
    }
  }
  return saved;
}

// The latest saves in each of the given Worlds, newest first, for the person's own view (/bot).
export async function latestSaves(kernel: Kernel, worlds: { worldId: string; scope: string }[], perWorld = 2): Promise<Record<string, SavedProof[]>> {
  const out: Record<string, SavedProof[]> = {};
  await Promise.all(
    worlds.map(async (w) => {
      const saved = await proofsIn(kernel, w.scope).catch(() => [] as SavedProof[]);
      if (saved.length) out[w.worldId] = saved.slice(-perWorld).reverse();
    }),
  );
  return out;
}

export const BASIS_WORDS: Record<EvidenceBasis, string> = {
  self_reported: "self-reported",
  witnessed: "witnessed",
  artifact: "with an artifact",
  system_observed: "observed by the system",
  externally_verified: "verified",
};

// A record id short enough to read aloud.
export const shortRecord = (id: string) => id.replace(/-/g, "").slice(0, 8);
