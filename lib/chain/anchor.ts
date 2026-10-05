// Anchoring: the record's integrity, witnessed on chain (master spec §13; monetary constitution Part I:
// "the chain records commitments and proofs about kernel state, never the causal record itself").
// A set of kernel events becomes a Merkle root over their sequence numbers and hashes. Only the root
// goes on chain, in a memo, so no content, names or amounts are ever published. Anyone holding one
// event's leaf and its proof can check it against that root, without seeing any other event.
// Anchoring shows the record wasn't changed after the fact. It never shows that the thing recorded
// happened in the world (constitution Part XI).
import { createHash } from "node:crypto";
import {
  appendTransactionMessageInstructions,
  createTransactionMessage,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type TransactionSigner,
} from "@solana/kit";
import { getAddMemoInstruction } from "@solana-program/memo";
import type { ChainGateway, Cluster } from "./gateway";
import { MEMO_PROGRAM } from "./solve";

export type Leaf = { seq: number; hash: string };
export type ProofStep = { side: "left" | "right"; hash: string };

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

// A leaf commits to an event's place in the record and its chained hash.
export const leafHash = (l: Leaf) => sha256(`solve:event:v1:${l.seq}:${l.hash}`);
const parent = (a: string, b: string) => sha256(`solve:node:v1:${a}:${b}`);

// Pairs hash upward; an odd node at the end of a level carries up unchanged.
function levels(leaves: string[]): string[][] {
  if (!leaves.length) throw new Error("nothing to anchor");
  const out = [leaves];
  while (out.at(-1)!.length > 1) {
    const level = out.at(-1)!;
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) next.push(i + 1 < level.length ? parent(level[i], level[i + 1]) : level[i]);
    out.push(next);
  }
  return out;
}

export const merkleRoot = (leaves: string[]) => levels(leaves).at(-1)![0];

export function merkleProof(leaves: string[], index: number): ProofStep[] {
  if (index < 0 || index >= leaves.length) throw new Error("no such leaf");
  const proof: ProofStep[] = [];
  let i = index;
  for (const level of levels(leaves).slice(0, -1)) {
    const sibling = i % 2 === 0 ? i + 1 : i - 1;
    if (sibling < level.length) proof.push({ side: i % 2 === 0 ? "right" : "left", hash: level[sibling] });
    i = Math.floor(i / 2);
  }
  return proof;
}

export function verifyProof(leaf: string, proof: ProofStep[], root: string): boolean {
  let h = leaf;
  for (const step of proof) {
    if (!/^[0-9a-f]{64}$/.test(step.hash)) return false;
    h = step.side === "right" ? parent(h, step.hash) : parent(step.hash, h);
  }
  return h === root;
}

// What goes on chain: the root and how many events it covers. Nothing else.
export const anchorMemo = (root: string, count: number) => `solve:anchor:v1:${root}:${count}`;

export function explorerUrl(cluster: Cluster, signature: string): string | null {
  if (cluster === "solana-devnet") return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
  if (cluster === "solana-mainnet") return `https://explorer.solana.com/tx/${signature}`;
  return null; // a local test chain has no public explorer
}

export class AnchorError extends Error {}

// Writes the root on chain in a memo, paid by the anchor key. No tokens move.
export async function sendAnchor(gateway: ChainGateway, payer: TransactionSigner, root: string, count: number) {
  const lifetime = await gateway.latestBlockhash();
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(payer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(lifetime, m),
    (m) => appendTransactionMessageInstructions([getAddMemoInstruction({ memo: anchorMemo(root, count) }, { programAddress: MEMO_PROGRAM })], m),
  );
  const outcome = await gateway.send(await signTransactionMessageWithSigners(message));
  if (outcome.status !== "confirmed") throw new AnchorError(`the anchor transaction failed: ${outcome.error}`);
  return { signature: String(outcome.signature), slot: Number(outcome.slot), cluster: gateway.cluster };
}
