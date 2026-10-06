// The settlement worker: an outbox between the kernel (causal truth) and the chain (monetary
// truth). It records "submitted" before anything is sent, never infers an outcome from a timeout,
// and reconciles with the on-chain settlement marker, which exists exactly when a release executed.
import { address, type TransactionSigner } from "@solana/kit";
import type { ChainGateway } from "../chain/gateway";
import { buildEarnRelease, settlementExecuted, settlementMarkerAddress, type GenesisManifest } from "../chain/solve";
import { KernelError, type Kernel, type Settlement, type SettlementStatus } from "../kernel/client";

export type SettlementRail = {
  // The kernel as the settlement service actor (service-role key, actAs the service actor).
  kernel: Kernel;
  gateway: ChainGateway;
  manifest: GenesisManifest;
  sponsor: TransactionSigner;
  settlementAuthority: TransactionSigner;
};

export type SettleResult = {
  settlementId: string;
  status: SettlementStatus;
  signature: string | null;
  detail?: string;
};

export async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(new TextEncoder().encode(text)));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function confirm(rail: SettlementRail, settlement: Settlement, signature: string, slot: bigint | undefined, detail = ""): Promise<SettleResult> {
  const marker = await settlementMarkerAddress(rail.settlementAuthority.address, settlement.settlement_id);
  try {
    await rail.kernel.recordSettlement({
      settlementId: settlement.settlement_id,
      status: "confirmed",
      txSignature: signature,
      slot,
      detail,
      evidence: [
        {
          basis: "externally_verified",
          content_hash: `sha256:${await sha256Hex(`${rail.gateway.cluster}|${signature}|${marker}|${slot ?? ""}`)}`,
          description: `${rail.gateway.cluster} transaction ${signature}; settlement marker ${marker}`,
        },
      ],
    });
  } catch (error) {
    // A concurrent worker confirmed it first (the kernel refuses a second confirmation with other
    // terms): the settlement is confirmed, once.
    if (error instanceof KernelError && error.name === "invalid") {
      const current = await rail.kernel.readSettlement(settlement.settlement_id);
      if (current.status === "confirmed") return { settlementId: settlement.settlement_id, status: "confirmed", signature: current.tx_signature };
    }
    throw error;
  }
  return { settlementId: settlement.settlement_id, status: "confirmed", signature, detail };
}

// Moves one settlement as far as it can go. Safe to call repeatedly and concurrently: the kernel
// serializes transitions and the chain marker makes a second transfer impossible.
export async function settle(rail: SettlementRail, settlementId: string): Promise<SettleResult> {
  const settlement = await rail.kernel.readSettlement(settlementId);
  if (settlement.status === "confirmed") {
    return { settlementId, status: "confirmed", signature: settlement.tx_signature };
  }
  if (settlement.chain !== rail.gateway.cluster) {
    throw new Error(`settlement ${settlementId} belongs to ${settlement.chain}, not ${rail.gateway.cluster}`);
  }

  // Reconcile before acting: if the release already executed, record it and send nothing. Re-read
  // first: a concurrent worker may have recorded its submission (and landed it) after our read.
  if (await settlementExecuted(rail.gateway, rail.settlementAuthority.address, settlementId)) {
    const current = await rail.kernel.readSettlement(settlementId);
    if (current.status === "confirmed") return { settlementId, status: "confirmed", signature: current.tx_signature };
    if (!current.tx_signature) {
      throw new Error(`settlement ${settlementId} executed on chain without a recorded signature`);
    }
    return confirm(rail, current, current.tx_signature, undefined, "reconciled: settlement marker present on chain");
  }

  if (settlement.status === "submitted" && settlement.tx_signature) {
    await rail.kernel.recordSettlement({
      settlementId,
      status: "needs_reconciliation",
      txSignature: settlement.tx_signature,
      detail: "submitted but not executed on chain; resubmitting",
    });
  }

  const release = await buildEarnRelease({
    gateway: rail.gateway,
    manifest: rail.manifest,
    sponsor: rail.sponsor,
    settlementAuthority: rail.settlementAuthority,
    settlementId,
    recipient: address(settlement.recipient_address),
    amount: BigInt(settlement.amount),
  });

  try {
    await rail.kernel.recordSettlement({ settlementId, status: "submitted", txSignature: release.signature });
  } catch (error) {
    // Another worker moved this settlement first. Report its state; never send twice.
    if (error instanceof KernelError && error.name === "invalid") {
      const current = await rail.kernel.readSettlement(settlementId);
      return { settlementId, status: current.status, signature: current.tx_signature, detail: "another worker is settling" };
    }
    throw error;
  }

  let outcome;
  try {
    outcome = await rail.gateway.send(release.transaction);
  } catch (error) {
    const detail = `outcome unknown: ${error instanceof Error ? error.message : String(error)}`.slice(0, 2000);
    await rail.kernel.recordSettlement({ settlementId, status: "needs_reconciliation", txSignature: release.signature, detail });
    return { settlementId, status: "needs_reconciliation", signature: release.signature, detail };
  }

  if (outcome.status === "confirmed") return confirm(rail, settlement, release.signature, outcome.slot);

  // A rejected send does not prove the release never happened: an identical transaction from a
  // concurrent worker may already have landed. Only an absent marker makes it a failure.
  if (await settlementExecuted(rail.gateway, rail.settlementAuthority.address, settlementId)) {
    const current = await rail.kernel.readSettlement(settlementId);
    if (current.status === "confirmed") {
      return { settlementId, status: "confirmed", signature: current.tx_signature };
    }
    return confirm(rail, settlement, current.tx_signature ?? release.signature, undefined, "reconciled: marker present after a rejected send");
  }

  const detail = outcome.error.slice(0, 2000);
  await rail.kernel.recordSettlement({ settlementId, status: "failed", txSignature: release.signature, detail });
  return { settlementId, status: "failed", signature: release.signature, detail };
}
