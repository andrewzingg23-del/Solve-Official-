// A receipt for a save that its owner chose to share. Worlds are private, and the server cannot
// read one on a person's behalf (the service key never acts as a human), so a receipt is a signed
// snapshot: when the person shares a save, it is read from the record with their own sign-in,
// written into the link and signed by the server. The public page checks the signature and shows
// exactly what was shared, nothing more. A receipt cannot be withdrawn once sent, like a photo;
// the record it came from is still the person's to erase.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { EvidenceBasis, Kernel } from "@/lib/kernel/client";
import { loadCreativeWorld } from "@/lib/world/creative";
import type { ProofStep } from "@/lib/chain/anchor";
import type { Cluster } from "@/lib/chain/gateway";
import { inclusionOf } from "./anchor";
import { parsePart, sizeText, type Hole, type Point } from "./part";
import { proofsIn } from "./proof";

export type Receipt = {
  v: 1;
  n: number; // the save's number: its place in the record
  what: string;
  basis: EvidenceBasis;
  at: string; // when it was saved
  issued: string; // when the receipt was made
  title: string; // the piece it belongs to
  owner: string; // the person who shared it, by their own label
  part?: { outline: Point[]; holes?: Hole[]; size: string; material: string };
  // When the save is inside an anchored history: the proof anyone can check against the root on chain.
  anchor?: { cluster: Cluster; signature: string; root: string; seq: number; hash: string; proof: ProofStep[]; at: string };
};

const CLUSTERS: Cluster[] = ["litesvm", "solana-devnet", "solana-mainnet"];

export class ReceiptError extends Error {}

const BASES: EvidenceBasis[] = ["self_reported", "witnessed", "artifact", "system_observed", "externally_verified"];
const b64 = (s: string | Buffer) => Buffer.from(s).toString("base64url");
const keyFrom = (secret: string) => createHmac("sha256", secret).update("solve receipts v1").digest();
const sign = (payload: string, secret: string) => createHmac("sha256", keyFrom(secret)).update(payload).digest("base64url").slice(0, 32);

export function receiptSecret(): string | null {
  return process.env.SUPABASE_SECRET_KEY || null;
}

export function signReceipt(receipt: Receipt, secret: string): string {
  const payload = b64(JSON.stringify(receipt));
  return `${payload}.${sign(payload, secret)}`;
}

const str = (v: unknown, max: number) => (typeof v === "string" && v.length > 0 && v.length <= max ? v : null);

export function openReceipt(token: string, secret: string): Receipt | null {
  const [payload, sig, extra] = token.split(".");
  if (!payload || !sig || extra !== undefined || payload.length > 12000) return null;
  const want = Buffer.from(sign(payload, secret));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const r = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
    const what = str(r.what, 300), title = str(r.title, 160), owner = str(r.owner, 80), at = str(r.at, 40), issued = str(r.issued, 40);
    if (r.v !== 1 || !Number.isInteger(r.n) || !what || !title || !owner || !at || !issued || !BASES.includes(r.basis as EvidenceBasis)) return null;
    let part: Receipt["part"];
    if (r.part !== undefined) {
      const p = r.part as Record<string, unknown>;
      const outline = Array.isArray(p.outline) && p.outline.length >= 3 && p.outline.length <= 120 && p.outline.every((q) => Array.isArray(q) && q.length === 2 && q.every((x) => typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 256)) ? (p.outline as Point[]) : null;
      const size = str(p.size, 40), material = str(p.material, 10);
      const holes = p.holes === undefined ? undefined : Array.isArray(p.holes) && p.holes.length <= 20 && p.holes.every((h) => Array.isArray(h) && h.length === 3 && h.every((x) => typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 256)) ? (p.holes as Hole[]) : null;
      if (!outline || !size || !material || holes === null) return null;
      part = { outline, ...(holes ? { holes } : {}), size, material };
    }
    let anchor: Receipt["anchor"];
    if (r.anchor !== undefined) {
      const a = r.anchor as Record<string, unknown>;
      const proof = Array.isArray(a.proof) && a.proof.length <= 64 && a.proof.every((s) => s && typeof s === "object" && ((s as ProofStep).side === "left" || (s as ProofStep).side === "right") && /^[0-9a-f]{64}$/.test(String((s as ProofStep).hash))) ? (a.proof as ProofStep[]) : null;
      const signature = str(a.signature, 120), hash = str(a.hash, 200), anchoredAt = str(a.at, 40);
      if (!proof || !signature || !hash || !anchoredAt || !CLUSTERS.includes(a.cluster as Cluster) || !/^[0-9a-f]{64}$/.test(String(a.root)) || !Number.isInteger(a.seq)) return null;
      anchor = { cluster: a.cluster as Cluster, signature, root: String(a.root), seq: a.seq as number, hash, proof, at: anchoredAt };
    }
    return { v: 1, n: r.n as number, what, basis: r.basis as EvidenceBasis, at, issued, title, owner, ...(part ? { part } : {}), ...(anchor ? { anchor } : {}) };
  } catch {
    return null;
  }
}

// Builds the receipt for one of the caller's own saves, read with their own sign-in.
export async function buildReceipt(kernel: Kernel, worldId: string, recordId: string, now = new Date()): Promise<Receipt> {
  const [me, { world, artifacts }] = await Promise.all([kernel.whoami(), loadCreativeWorld(kernel, worldId)]);
  const save = (await proofsIn(kernel, world.scope)).find((p) => p.recordId === recordId);
  if (!save) throw new ReceiptError("that save isn't in this World");
  if (save.by !== me.actor_id) throw new ReceiptError("only the person who saved it can share it");
  const piece = artifacts.find((a) => a.entityId === save.pieceId);
  const part = piece ? parsePart(piece.body) : null;
  const inclusion = await inclusionOf(kernel, world.scope, save.number).catch(() => null);
  return {
    v: 1,
    n: save.number,
    what: save.what.slice(0, 300),
    basis: save.basis,
    at: save.at,
    issued: now.toISOString(),
    title: (piece?.title ?? world.title).slice(0, 160),
    owner: (me.label || "Someone").slice(0, 80),
    ...(part ? { part: { outline: part.profile.map(([x, z]) => [Math.round(x), Math.round(z)] as Point), ...(part.holes?.length ? { holes: part.holes } : {}), size: sizeText(part), material: part.material } } : {}),
    ...(inclusion ? { anchor: { cluster: inclusion.cluster, signature: inclusion.signature, root: inclusion.root, seq: inclusion.seq, hash: inclusion.hash, proof: inclusion.proof, at: inclusion.anchoredAt } } : {}),
  };
}

export const receiptUrl = (appUrl: string, token: string) => `${appUrl}/saved/${token}`;

// Opens the token from a /saved/<token> path with this deployment's secret.
export function receiptFromPath(token: string): Receipt | null {
  const secret = receiptSecret();
  if (!secret) return null;
  try {
    return openReceipt(decodeURIComponent(token), secret);
  } catch {
    return null;
  }
}
