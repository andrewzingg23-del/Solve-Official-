// Typed access to kernel_api, the only gated interface to kernel memory.
// The database enforces identity, authority and append-only history; this module only shapes calls.
import type { SupabaseClient } from "@supabase/supabase-js";

export type AuthMethod = "user_jwt" | "service_role" | "kernel";
export type EvidenceBasis =
  | "self_reported"
  | "witnessed"
  | "artifact"
  | "system_observed"
  | "externally_verified";

export type KernelEvent = {
  seq: number;
  id: string;
  occurred_at: string;
  type: string;
  scope: string;
  actor_id: string;
  on_behalf_of: string | null;
  grant_id: string | null;
  auth_method: AuthMethod;
  payload: Record<string, unknown>;
  corrects: string | null;
  correlation_id: string | null;
  hash: string;
};

export type Evidence = {
  basis: EvidenceBasis;
  content_hash: `sha256:${string}`;
  media_type?: string;
  uri?: string;
  description?: string;
};

export type Grant = {
  id: string;
  capability: string;
  scope: string;
  issued_by: string;
  expires_at: string | null;
  created_at: string;
};

export type Actor = { actor_id: string; kind: "human" | "agent" | "service"; label: string; owner_id: string | null };

export type Balance = {
  account_id: string;
  scope: string;
  asset: string;
  normal_balance: "debit" | "credit";
  // Minor units as an integer string; parse with BigInt.
  balance: string;
};

// Positive amounts are debits, negative are credits, in minor units.
export type Entry = { account_id: string; amount: bigint | string };

export type ChainCheck = { ok: boolean; events_checked: number; first_bad_seq: number | null; problem: string | null };

export type SettlementChain = "litesvm" | "solana-devnet" | "solana-mainnet";
export type SettlementStatus = "prepared" | "submitted" | "confirmed" | "failed" | "needs_reconciliation";

export type Rail = { chain: SettlementChain; asset: string; mint_address: string; settlement_authority: string };
export type Wallet = { id: string; chain: SettlementChain; address: string; created_at: string };

export type Entitlement = {
  entitlement_id: string;
  settlement_id: string;
  world_scope: string;
  obligation_event_id: string;
  outcome_event_id: string;
  policy_key: string;
  policy_version: number;
  attribution_bps: number;
  asset: string;
  amount: string;
  evidence_root: string;
  created_at: string;
  chain: SettlementChain | null;
  recipient_address: string | null;
  status: SettlementStatus | "unsettled";
  tx_signature: string | null;
};

export type Settlement = {
  settlement_id: string;
  entitlement_id: string;
  beneficiary_id: string;
  chain: SettlementChain;
  recipient_address: string;
  asset: string;
  // Minor units as an integer string.
  amount: string;
  status: SettlementStatus;
  tx_signature: string | null;
};

const errorNames = {
  KA001: "unauthenticated",
  KA002: "forbidden",
  KA003: "invalid",
  KA004: "conflict",
  KA005: "insufficient_balance",
  KA006: "append_only",
  KA007: "not_found",
} as const;

export type KernelErrorName = (typeof errorNames)[keyof typeof errorNames] | "unavailable";

export class KernelError extends Error {
  constructor(
    readonly name: KernelErrorName,
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

function toKernelError(error: { code?: string; message: string }) {
  const name = errorNames[error.code as keyof typeof errorNames] ?? "unavailable";
  return new KernelError(name, error.message, error.code ?? "");
}

type Options = {
  // Server-side only, with the service key: the agent or service actor to act as.
  actAs?: string;
};

export function kernelClient(supabase: SupabaseClient, { actAs }: Options = {}) {
  const api = supabase.schema("kernel_api");
  const as = actAs ? { p_as_actor: actAs } : {};

  async function call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await api.rpc(fn, args);
    if (error) throw toKernelError(error);
    return data as T;
  }

  async function one<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const [row] = await call<T[]>(fn, args);
    if (!row) throw new KernelError("not_found", `${fn} returned nothing`, "");
    return row;
  }

  return {
    // Signed-in users: links the session to a canonical actor. Safe on every sign-in.
    register: (label = "") => call<string>("register", { p_label: label }),

    whoami: () => one<Actor>("whoami", { ...as }),

    createAgent: (label: string, idempotencyKey?: string) =>
      call<string>("create_agent", { p_label: label, p_idempotency_key: idempotencyKey ?? null }),

    createServiceActor: (label: string, idempotencyKey?: string) =>
      call<string>("create_service_actor", { p_label: label, p_idempotency_key: idempotencyKey ?? null, ...as }),

    recordEvent: (input: {
      type: string;
      scope: string;
      payload?: Record<string, unknown>;
      evidence?: Evidence[];
      corrects?: string;
      idempotencyKey?: string;
      correlationId?: string;
    }) =>
      call<string>("record_event", {
        p_type: input.type,
        p_scope: input.scope,
        p_payload: input.payload ?? {},
        p_evidence: input.evidence ?? [],
        p_corrects: input.corrects ?? null,
        p_idempotency_key: input.idempotencyKey ?? null,
        p_correlation_id: input.correlationId ?? null,
        ...as,
      }),

    attachEvidence: (eventId: string, evidence: Evidence, idempotencyKey?: string) =>
      call<string>("attach_evidence", {
        p_event_id: eventId,
        p_basis: evidence.basis,
        p_content_hash: evidence.content_hash,
        p_media_type: evidence.media_type ?? null,
        p_uri: evidence.uri ?? null,
        p_description: evidence.description ?? "",
        p_idempotency_key: idempotencyKey ?? null,
        ...as,
      }),

    issueGrant: (input: {
      grantee: string;
      capability: string;
      scope: string;
      expiresAt?: Date;
      idempotencyKey?: string;
    }) =>
      call<string>("issue_grant", {
        p_grantee: input.grantee,
        p_capability: input.capability,
        p_scope: input.scope,
        p_expires_at: input.expiresAt?.toISOString() ?? null,
        p_idempotency_key: input.idempotencyKey ?? null,
        ...as,
      }),

    revokeGrant: (grantId: string, reason = "", idempotencyKey?: string) =>
      call<string>("revoke_grant", {
        p_grant_id: grantId,
        p_reason: reason,
        p_idempotency_key: idempotencyKey ?? null,
        ...as,
      }),

    claimScope: (scope: string) => call<string>("claim_scope", { p_scope: scope, ...as }),

    defineAsset: (input: { code: string; issuerScope: string; decimals: number; label?: string; idempotencyKey?: string }) =>
      call<string>("define_asset", {
        p_code: input.code,
        p_issuer_scope: input.issuerScope,
        p_decimals: input.decimals,
        p_label: input.label ?? "",
        p_idempotency_key: input.idempotencyKey ?? null,
        ...as,
      }),

    openAccount: (input: {
      scope: string;
      asset: string;
      normalBalance?: "debit" | "credit";
      allowNegative?: boolean;
      label?: string;
      idempotencyKey?: string;
    }) =>
      call<string>("open_account", {
        p_scope: input.scope,
        p_asset: input.asset,
        p_normal_balance: input.normalBalance ?? "debit",
        p_allow_negative: input.allowNegative ?? false,
        p_label: input.label ?? "",
        p_idempotency_key: input.idempotencyKey ?? null,
        ...as,
      }),

    postTransaction: (input: {
      scope: string;
      entries: Entry[];
      memo?: string;
      evidence?: Evidence[];
      idempotencyKey?: string;
      correlationId?: string;
    }) =>
      call<string>("post_transaction", {
        p_scope: input.scope,
        p_entries: input.entries.map((e) => ({ account_id: e.account_id, amount: e.amount.toString() })),
        p_memo: input.memo ?? "",
        p_evidence: input.evidence ?? [],
        p_idempotency_key: input.idempotencyKey ?? null,
        p_correlation_id: input.correlationId ?? null,
        ...as,
      }),

    readEvents: (scope: string, { afterSeq = 0, limit = 50, newestFirst = false } = {}) =>
      call<KernelEvent[]>("read_events", {
        p_scope: scope,
        p_after_seq: afterSeq,
        p_limit: limit,
        p_newest_first: newestFirst,
        ...as,
      }),

    readEvidence: (eventId: string) =>
      call<(Required<Evidence> & { id: string; attached_by: string; attached_at: string })[]>("read_evidence", {
        p_event_id: eventId,
        ...as,
      }),

    accountBalance: (accountId: string) => one<Balance>("account_balance", { p_account_id: accountId, ...as }),

    myGrants: () => call<Grant[]>("my_grants", { ...as }),

    // Service role only.
    verifyChain: () => one<ChainCheck>("verify_chain", {}),

    // Money: rails and policies (system authority).
    registerRail: (input: {
      chain: SettlementChain;
      mintAddress: string;
      settlementAuthority: string;
      onchainAccount: string;
      unallocatedAccount: string;
      payableAccount: string;
    }) =>
      call<string>("register_rail", {
        p_chain: input.chain,
        p_mint_address: input.mintAddress,
        p_settlement_authority: input.settlementAuthority,
        p_onchain_account: input.onchainAccount,
        p_unallocated_account: input.unallocatedAccount,
        p_payable_account: input.payableAccount,
        ...as,
      }),

    defineRewardPolicy: (input: {
      policyKey: string;
      chain: SettlementChain;
      outcomeType: string;
      amount: bigint | string;
      maxPerRelease: bigint | string;
      totalCap: bigint | string;
      requiredBases: Exclude<EvidenceBasis, "self_reported">[];
      minIndependentParties?: number;
      active?: boolean;
    }) =>
      call<number>("define_reward_policy", {
        p_policy_key: input.policyKey,
        p_chain: input.chain,
        p_outcome_type: input.outcomeType,
        p_amount: input.amount.toString(),
        p_max_per_release: input.maxPerRelease.toString(),
        p_total_cap: input.totalCap.toString(),
        p_required_bases: input.requiredBases,
        p_min_independent_parties: input.minIndependentParties ?? 1,
        p_active: input.active ?? true,
        ...as,
      }),

    readRail: (chain: SettlementChain) => one<Rail>("read_rail", { p_chain: chain }),

    // Money: wallets, entitlements, settlements.
    linkWallet: (chain: SettlementChain, address: string) =>
      call<string>("link_wallet", { p_chain: chain, p_address: address, ...as }),

    myWallets: () => call<Wallet[]>("my_wallets", { ...as }),

    createEntitlement: (input: {
      obligationEventId: string;
      outcomeEventId: string;
      beneficiaryId: string;
      policyKey: string;
      policyVersion: number;
    }) =>
      call<string>("create_entitlement", {
        p_obligation_event_id: input.obligationEventId,
        p_outcome_event_id: input.outcomeEventId,
        p_beneficiary_id: input.beneficiaryId,
        p_policy_key: input.policyKey,
        p_policy_version: input.policyVersion,
        ...as,
      }),

    myEntitlements: () => call<Entitlement[]>("my_entitlements", { ...as }),

    prepareSettlement: (entitlementId: string, recipientAddress: string) =>
      call<string>("prepare_settlement", { p_entitlement_id: entitlementId, p_recipient_address: recipientAddress, ...as }),

    readSettlement: (settlementId: string) => one<Settlement>("read_settlement", { p_settlement_id: settlementId, ...as }),

    pendingSettlements: (chain: SettlementChain, limit = 50) =>
      call<{ settlement_id: string; status: SettlementStatus; created_at: string }[]>("pending_settlements", {
        p_chain: chain,
        p_limit: limit,
        ...as,
      }),

    // Settlement service only.
    recordSettlement: (input: {
      settlementId: string;
      status: Exclude<SettlementStatus, "prepared">;
      txSignature?: string;
      slot?: bigint;
      detail?: string;
      evidence?: Evidence[];
    }) =>
      call<string>("record_settlement", {
        p_settlement_id: input.settlementId,
        p_status: input.status,
        p_tx_signature: input.txSignature ?? null,
        p_slot: input.slot === undefined ? null : Number(input.slot),
        p_detail: input.detail ?? "",
        p_evidence: input.evidence ?? [],
        ...as,
      }),
  };
}

export type Kernel = ReturnType<typeof kernelClient>;
