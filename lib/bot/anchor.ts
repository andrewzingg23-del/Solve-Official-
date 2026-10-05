// Anchoring a World's record on Solana (crypto stage 1, docs/plans/2026-10-05-business-leverage-outreach.md §5).
// The World's owner commits every event so far (sequence numbers and chained hashes, never content)
// to a Merkle root on chain. The anchor is then saved on the record itself as an artifact: the
// transaction anyone can look up. Any save made before it can carry an inclusion proof that anyone can
// check against that root. A mismatch means the history changed after it was anchored.
//
// No money moves: the anchor key only pays the network fee for a memo. Only devnet is allowed until
// the founder decides on mainnet anchoring (monetary constitution Part XV, open decision 5).
import { createHash } from "node:crypto";
import { createKeyPairSignerFromBytes, type TransactionSigner } from "@solana/kit";
import { explorerUrl, leafHash, merkleProof, merkleRoot, sendAnchor, type ProofStep } from "@/lib/chain/anchor";
import type { ChainGateway, Cluster } from "@/lib/chain/gateway";
import { RpcGateway } from "@/lib/chain/rpc-gateway";
import { KernelError, type Kernel, type KernelEvent } from "@/lib/kernel/client";
import { loadCreativeWorld } from "@/lib/world/creative";
import { history } from "./proof";

export const ANCHOR_MEDIA = "application/vnd.sov.anchor+json";

export type Checkpoint = { root: string; from: number; to: number; count: number; signature: string; slot: number; cluster: Cluster; at: string; url: string | null };
export type Inclusion = { cluster: Cluster; signature: string; root: string; seq: number; hash: string; proof: ProofStep[]; anchoredAt: string };
export type AnchorChain = { gateway: ChainGateway; payer: TransactionSigner };

async function eventsOf(kernel: Kernel, scope: string): Promise<KernelEvent[]> {
  const out: KernelEvent[] = [];
  for await (const e of history(kernel, scope)) out.push(e);
  return out;
}

const leavesOf = (events: KernelEvent[]) => events.map((e) => leafHash({ seq: e.seq, hash: e.hash }));

// Every anchor saved on a World's record, oldest first.
export async function anchorsIn(kernel: Kernel, scope: string): Promise<Checkpoint[]> {
  const out: Checkpoint[] = [];
  for await (const e of history(kernel, scope)) {
    const p = e.payload as { items?: unknown };
    if (e.type !== "kernel.evidence.attached" || !Array.isArray(p.items)) continue;
    for (const item of p.items as Record<string, unknown>[]) {
      if (item.media_type !== ANCHOR_MEDIA) continue;
      try {
        const c = JSON.parse(String(item.description)) as Omit<Checkpoint, "at" | "url">;
        if (!/^[0-9a-f]{64}$/.test(c.root) || !Number.isInteger(c.to) || !Number.isInteger(c.from)) continue;
        out.push({ ...c, at: new Date(e.occurred_at).toISOString(), url: explorerUrl(c.cluster, c.signature) });
      } catch {
        // Not an anchor this version can read; leave it.
      }
    }
  }
  return out;
}

// Commits the World's whole history so far on chain, then saves the anchor on the record.
export async function anchorWorld(person: Kernel, worldId: string, chain: AnchorChain): Promise<Checkpoint> {
  const { world } = await loadCreativeWorld(person, worldId);
  // Check the caller may record the anchor before anything is written on chain, so a refusal never
  // leaves an orphan root behind or spends a fee.
  const may = await person.authorize({ capability: "kernel.evidence.attach", scope: world.scope });
  if (may.decision !== "ALLOW") throw new KernelError("forbidden", "only someone who may add to this World's record can anchor it", "");
  const events = await eventsOf(person, world.scope);
  const leaves = leavesOf(events);
  const root = merkleRoot(leaves);
  const sent = await sendAnchor(chain.gateway, chain.payer, root, leaves.length);
  const checkpoint = { root, from: events[0].seq, to: events.at(-1)!.seq, count: leaves.length, signature: sent.signature, slot: sent.slot, cluster: sent.cluster };
  await person.attachEvidence(
    events.at(-1)!.id,
    {
      basis: "artifact",
      content_hash: `sha256:${createHash("sha256").update(root).digest("hex")}`,
      media_type: ANCHOR_MEDIA,
      uri: explorerUrl(sent.cluster, sent.signature) ?? `solana:${sent.cluster}:${sent.signature}`,
      description: JSON.stringify(checkpoint),
    },
    `anchor:${worldId}:${checkpoint.to}:${root}`.slice(0, 200),
  );
  return (await anchorsIn(person, world.scope)).find((c) => c.signature === sent.signature)!;
}

// The proof that one event was in a World's anchored history, from the latest anchor that covers
// it. It returns null when no anchor covers it yet, and throws if the history no longer matches the
// root on chain.
export async function inclusionOf(kernel: Kernel, scope: string, seq: number): Promise<Inclusion | null> {
  const anchor = (await anchorsIn(kernel, scope)).filter((c) => c.from <= seq && seq <= c.to).at(-1);
  if (!anchor) return null;
  const events = (await eventsOf(kernel, scope)).filter((e) => e.seq <= anchor.to);
  const leaves = leavesOf(events);
  if (leaves.length !== anchor.count || merkleRoot(leaves) !== anchor.root) throw new Error("this World's history no longer matches what was anchored");
  const index = events.findIndex((e) => e.seq === seq);
  if (index < 0) return null;
  return { cluster: anchor.cluster, signature: anchor.signature, root: anchor.root, seq, hash: events[index].hash, proof: merkleProof(leaves, index), anchoredAt: anchor.at };
}

// The anchor key and cluster for this deployment, or null when anchoring isn't set up. Only devnet.
export async function anchorChainFromEnv(env: NodeJS.ProcessEnv = process.env): Promise<AnchorChain | null> {
  const cluster = env.ANCHOR_CLUSTER;
  const url = env.SOLANA_RPC_URL;
  const key = env.ANCHOR_PAYER_KEY;
  if (!cluster || !url || !key) return null;
  if (cluster !== "solana-devnet") throw new Error("anchoring runs on devnet until the founder decides on mainnet");
  const bytes = Uint8Array.from(JSON.parse(key) as number[]);
  if (bytes.length !== 64) throw new Error("ANCHOR_PAYER_KEY must be a 64-byte keypair as a JSON array");
  return { gateway: new RpcGateway("solana-devnet", url), payer: await createKeyPairSignerFromBytes(bytes) };
}
