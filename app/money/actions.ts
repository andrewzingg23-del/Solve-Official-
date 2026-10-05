"use server";

// Each call runs a fresh, private simulation: the real kernel migrations in an in-memory Postgres
// (PGlite) and the real Solana token programs in an in-process runtime (LiteSVM). Test assets
// only; nothing is saved and nothing touches a public network.
import { notFound } from "next/navigation";
import { moneyEnabled } from "@/lib/flags";
import { runProofOfLife } from "@/tests/support/proof-of-life";
import { runSendBob, type SendBobRun } from "@/tests/support/send-bob";

export type Outcome<T> = { ok: true; data: T; ms: number } | { ok: false; error: string } | null;

export type ProofRun = { steps: { n: number; title: string; detail: string }[]; settlementId: string; pass: boolean };

async function timed<T>(run: () => Promise<T>): Promise<Outcome<T>> {
  const started = Date.now();
  try {
    return { ok: true, data: await run(), ms: Date.now() - started };
  } catch (error) {
    console.error(error);
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// A Server Action is reachable by direct POST, so each one checks the switch itself, not only the page.
export async function proofOfLife(): Promise<Outcome<ProofRun>> {
  if (!moneyEnabled()) notFound();
  return timed(async () => {
    const steps: ProofRun["steps"] = [];
    const run = await runProofOfLife((step) => steps.push(step));
    return {
      steps,
      settlementId: run.prepared.settlementId,
      pass: run.result.status === "confirmed" && run.settled.status === "confirmed" && run.mirror.match && run.integrity.ok,
    };
  });
}

export async function sendBob(): Promise<Outcome<SendBobRun>> {
  if (!moneyEnabled()) notFound();
  return timed(runSendBob);
}
