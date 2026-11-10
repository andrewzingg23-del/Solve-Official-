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

export type RoomSourceRef = { entityId: string; version: number; title: string };



export type ChainCheck = { ok: boolean; events_checked: number; first_bad_seq: number | null; problem: string | null };

export type SettlementChain = "litesvm" | "solana-devnet" | "solana-mainnet";
export type SettlementStatus = "prepared" | "submitted" | "confirmed" | "failed" | "needs_reconciliation";



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

export type PaymentStatus = "created" | "routed" | "submitted" | "confirmed" | "failed" | "needs_reconciliation";

export type ChainAsset = { asset: string; mint_address: string; decimals: number; label: string };

export type PaymentProfile = {
  actor_id: string;
  chain: SettlementChain;
  version: number;
  receive_address: string;
  accept_assets: string[];
};

// Amounts are minor units as integer strings.
export type Payment = {
  payment_id: string;
  intent_id: string;
  payer_id: string;
  recipient_id: string;
  chain: SettlementChain;
  asset: string;
  amount: string;
  max_slippage_bps: number;
  recipient_address: string;
  accept_assets: string[];
  memo: string;
  status: PaymentStatus;
  attempt: number;
  payer_address: string | null;
  input_asset: string | null;
  input_amount: string | null;
  max_input: string | null;
  deliver_asset: string | null;
  deliver_amount: string | null;
  expires_at: string | null;
  tx_signature: string | null;
  executed_input: string | null;
  wire_transaction: string | null;
  created_at: string;
};

export type PaymentSummary = {
  payment_id: string;
  direction: "sent" | "received";
  counterparty_id: string;
  chain: SettlementChain;
  asset: string;
  amount: string;
  status: PaymentStatus;
  deliver_asset: string | null;
  deliver_amount: string | null;
  tx_signature: string | null;
  created_at: string;
};

export type Decision =
  | "ALLOW"
  | "REQUIRE_SECOND_AUTHORITY"
  | "REQUIRE_QUORUM"
  | "REQUIRE_MULTISIG"
  | "REQUIRE_DELAY"
  | "REQUIRE_CHALLENGE_WINDOW"
  | "DENY";

export type AuthorityDecision = {
  decision: Decision;
  grant_id: string | null;
  policy_id: string | null;
  threshold: number | null;
  delay_seconds: number | null;
  reasons: string[];
};

export type PolicyRequirement = "allow" | "second_authority" | "quorum" | "multisig" | "delay" | "challenge_window" | "deny";

export type AgentRole =
  | "personal_avatar"
  | "ai_companion"
  | "world_agent"
  | "organization_agent"
  | "state_agent"
  | "system_agent"
  | "engineering_agent"
  | "specialist";

export type EntityKind =
  | "world"
  | "place"
  | "organization"
  | "resource"
  | "need"
  | "capability"
  | "asset"
  | "milestone"
  | "agreement"
  | "offer"
  | "document";

export type LocationTruth = "declared" | "device_observed" | "provider_derived" | "legal_address" | "estimated";
export type Visibility = "public" | "members" | "private";

/** What anyone may see of a page its owner published (kernel_api.read_page). */
export type PublicPiece = { id: string; kind: "text" | "photo"; text: string; file: string | null; at: string };
export type PublicPage = { title: string; summary: string; by: string; look: unknown; space: string | null; pieces: PublicPiece[] };
/** A person's shared Space (kernel_api.read_space): their name, card look, and published pages. */
export type PublicSpace = { by: string; look: unknown; pages: Array<{ id: string; title: string; cover: string | null; at: string }> };

export type WorldEntity = {
  entity_id: string;
  kind: EntityKind;
  scope: string;
  version: number;
  title: string;
  summary: string;
  attributes: Record<string, unknown>;
  latitude: string | null;
  longitude: string | null;
  altitude_m?: string | null;
  location_truth: LocationTruth | null;
  visibility?: Visibility;
  importance: number;
  created_at?: string;
  updated_at: string;
};

export type RelationKind =
  | "owns"
  | "controls"
  | "member_of"
  | "located_in"
  | "supplies"
  | "requires"
  | "blocks"
  | "produces"
  | "verifies"
  | "represents"
  | "assists"
  | "offers"
  | "needs"
  | "part_of"
  | "challenges"
  | "replaces"
  | "escalates_to"
  | "idea_derived_from"
  | "idea_supports"
  | "idea_contradicts"
  | "idea_supersedes"
  | "idea_implemented_by"
  | "idea_tested_by"
  | "idea_evidenced_by"
  | "idea_blocked_by";

export type WorldRelation = {
  relation_id: string;
  kind: RelationKind;
  from_ref: string;
  to_ref: string;
  scope: string;
  attributes: Record<string, unknown>;
  created_at: string;
  ended_at: string | null;
};

export type TaskStatus =
  | "created"
  | "ready"
  | "claimed"
  | "in_progress"
  | "blocked"
  | "waiting_external"
  | "verifying"
  | "escalated"
  | "completed"
  | "failed"
  | "needs_reconciliation"
  | "cancelled";

export type Task = {
  task_id: string;
  scope: string;
  title: string;
  objective: string;
  cause_ref: string | null;
  inputs: Record<string, unknown>;
  required_capability: string;
  risk: "low" | "medium" | "high" | "critical";
  reversible: boolean;
  budget_amount: string | null;
  budget_asset: string | null;
  evidence_bases: EvidenceBasis[];
  verification: "none" | "distinct_actor" | "distinct_party";
  created_by: string;
  status: TaskStatus;
  worker_id: string | null;
  detail: string;
  result: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type ActionStatus =
  | "proposed"
  | "authorized"
  | "enacting"
  | "completed"
  | "failed"
  | "needs_reconciliation"
  | "rejected"
  | "cancelled";

export type Action = {
  action_id: string;
  kind: string;
  capability: string;
  scope: string;
  proposer_id: string;
  on_behalf_of: string | null;
  target_ref: string | null;
  payload: Record<string, unknown>;
  amount: string | null;
  asset: string | null;
  counterparty_ref: string | null;
  task_ref: string | null;
  decision: Decision;
  reasons: string[];
  threshold: number | null;
  approvals: number;
  status: ActionStatus;
  detail: string;
  result: Record<string, unknown> | null;
  enact_after: string | null;
  in_reply_to: string | null;
  created_at: string;
};


export type MessageType =
  | "DISCOVERY_REQUEST"
  | "CAPABILITY_QUERY"
  | "PROOF_REQUEST"
  | "PROOF_RESPONSE"
  | "PROPOSAL"
  | "COUNTERPROPOSAL"
  | "INFORMATION_REQUEST"
  | "INFORMATION_RESPONSE"
  | "DECLINE"
  | "HUMAN_ATTENTION_REQUIRED"
  | "ACCEPTANCE";

export type InboxMessage = {
  action_id: string;
  sender_id: string;
  sender_kind: Actor["kind"];
  on_behalf_of: string | null;
  scope: string;
  message_type: MessageType;
  payload: Record<string, unknown>;
  in_reply_to: string | null;
  delivered_at: string;
};

export type AvatarType = "digital_self" | "ai_companion" | "abstract";
export type AvatarRelationship = "represent" | "assist" | "guide" | "create_with";
export type RepresentationKind = "abstract" | "pixel" | "cartoon" | "stylized_3d" | "realistic" | "voice_only";

export type ActorProfile = {
  actor_id: string;
  kind: Actor["kind"];
  label: string;
  owner_id: string | null;
  accountable_party: string | null;
  role: AgentRole | null;
};

export type Avatar = {
  avatar_id: string;
  agent_id: string;
  avatar_type: AvatarType;
  name: string;
  relationship: AvatarRelationship;
  seed_version: number;
  seed: Record<string, unknown>;
  representation: RepresentationKind;
  representations: RepresentationKind[];
  created_at: string;
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
    setPersonLabel: (label: string, requestId: string) => call<string>("set_person_label", { p_label: label, p_request_id: requestId }),

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



    readEvents: (scope: string, { afterSeq = 0, limit = 50, newestFirst = false } = {}) =>
      call<KernelEvent[]>("read_events", {
        p_scope: scope,
        p_after_seq: afterSeq,
        p_limit: limit,
        p_newest_first: newestFirst,
        ...as,
      }),

    // Kernel v5, erasable content: the key for an event this actor recorded, the keys of events
    // the caller may read (destroyed and never-sealed keys are absent), and destroying one for good.
    sealKey: (eventId: string, key: string) => call<null>("seal_key", { p_event_id: eventId, p_key: key, ...as }),

    unsealKeys: (eventIds: string[]) =>
      call<{ event_id: string; key: string }[]>("unseal_keys", { p_event_ids: eventIds, ...as }),

    destroyKey: (eventId: string, reason = "") =>
      call<string>("destroy_key", { p_event_id: eventId, p_reason: reason, ...as }),

    readEvidence: (eventId: string) =>
      call<(Required<Evidence> & { id: string; attached_by: string; attached_at: string })[]>("read_evidence", {
        p_event_id: eventId,
        ...as,
      }),


    myGrants: () => call<Grant[]>("my_grants", { ...as }),

    // Service role only.
    verifyChain: () => one<ChainCheck>("verify_chain", {}),




    // Money: wallets, entitlements, settlements.
    linkWallet: (chain: SettlementChain, address: string) =>
      call<string>("link_wallet", { p_chain: chain, p_address: address, ...as }),








    // Payments: assets on chains (system authority) and payment profiles.
    registerChainAsset: (chain: SettlementChain, asset: string, mintAddress: string) =>
      call<string>("register_chain_asset", { p_chain: chain, p_asset: asset, p_mint_address: mintAddress, ...as }),

    readChainAssets: (chain: SettlementChain) => call<ChainAsset[]>("read_chain_assets", { p_chain: chain }),

    setPaymentProfile: (input: { chain: SettlementChain; receiveAddress: string; acceptAssets: string[] }) =>
      call<number>("set_payment_profile", {
        p_chain: input.chain,
        p_receive_address: input.receiveAddress,
        p_accept_assets: input.acceptAssets,
        ...as,
      }),

    readPaymentProfile: (actorId: string, chain: SettlementChain) =>
      one<PaymentProfile>("read_payment_profile", { p_actor_id: actorId, p_chain: chain, ...as }),

    // Payments: intents, routes and reads.
    createPaymentIntent: (input: {
      recipientId: string;
      chain: SettlementChain;
      asset: string;
      amount: bigint | string;
      maxSlippageBps?: number;
      memo?: string;
      idempotencyKey?: string;
    }) =>
      call<string>("create_payment_intent", {
        p_recipient_id: input.recipientId,
        p_chain: input.chain,
        p_asset: input.asset,
        p_amount: input.amount.toString(),
        p_max_slippage_bps: input.maxSlippageBps ?? 100,
        p_memo: input.memo ?? "",
        p_idempotency_key: input.idempotencyKey ?? null,
        ...as,
      }),

    selectPaymentRoute: (input: {
      paymentId: string;
      route: Record<string, unknown>;
      payerAddress: string;
      recipientAddress: string;
      inputAsset: string;
      inputAmount: bigint | string;
      maxInput: bigint | string;
      deliverAsset: string;
      deliverAmount: bigint | string;
      quotedAt: string;
      expiresAt: string;
    }) =>
      call<number>("select_payment_route", {
        p_payment_id: input.paymentId,
        p_route: input.route,
        p_payer_address: input.payerAddress,
        p_recipient_address: input.recipientAddress,
        p_input_asset: input.inputAsset,
        p_input_amount: input.inputAmount.toString(),
        p_max_input: input.maxInput.toString(),
        p_deliver_asset: input.deliverAsset,
        p_deliver_amount: input.deliverAmount.toString(),
        p_quoted_at: input.quotedAt,
        p_expires_at: input.expiresAt,
        ...as,
      }),

    readPayment: (paymentId: string) => one<Payment>("read_payment", { p_payment_id: paymentId, ...as }),

    myPayments: () => call<PaymentSummary[]>("my_payments", { ...as }),

    // Payment service only.
    recordPayment: (input: {
      paymentId: string;
      attempt: number;
      status: Exclude<PaymentStatus, "created" | "routed">;
      txSignature?: string;
      inputAmount?: bigint | string;
      wireTransaction?: string;
      slot?: bigint;
      detail?: string;
      evidence?: Evidence[];
    }) =>
      call<string>("record_payment", {
        p_payment_id: input.paymentId,
        p_attempt: input.attempt,
        p_status: input.status,
        p_tx_signature: input.txSignature ?? null,
        p_input_amount: input.inputAmount?.toString() ?? null,
        p_wire_transaction: input.wireTransaction ?? null,
        p_slot: input.slot === undefined ? null : Number(input.slot),
        p_detail: input.detail ?? "",
        p_evidence: input.evidence ?? [],
        ...as,
      }),

    // Agents and leases.
    spawnAgent: (input: { label: string; role: AgentRole; serves?: string; idempotencyKey?: string }) =>
      call<string>("spawn_agent", {
        p_label: input.label,
        p_role: input.role,
        p_serves: input.serves ?? null,
        p_idempotency_key: input.idempotencyKey ?? null,
        ...as,
      }),

    issueLease: (input: {
      grantee: string;
      capability: string;
      scope: string;
      expiresAt?: Date;
      maxAmount?: bigint | string;
      asset?: string;
      counterpartyRef?: string;
      taskRef?: string;
      idempotencyKey?: string;
    }) =>
      call<string>("issue_lease", {
        p_grantee: input.grantee,
        p_capability: input.capability,
        p_scope: input.scope,
        p_expires_at: input.expiresAt?.toISOString() ?? null,
        p_max_amount: input.maxAmount?.toString() ?? null,
        p_asset: input.asset ?? null,
        p_counterparty_ref: input.counterpartyRef ?? null,
        p_task_ref: input.taskRef ?? null,
        p_idempotency_key: input.idempotencyKey ?? null,
        ...as,
      }),

    // Authority decisions and policies.
    authorize: (input: { capability: string; scope: string; amount?: bigint | string; asset?: string; counterpartyRef?: string; taskRef?: string }) =>
      one<AuthorityDecision>("authorize", {
        p_capability: input.capability,
        p_scope: input.scope,
        p_amount: input.amount?.toString() ?? null,
        p_asset: input.asset ?? null,
        p_counterparty_ref: input.counterpartyRef ?? null,
        p_task_ref: input.taskRef ?? null,
        ...as,
      }),

    setActionPolicy: (input: {
      scope: string;
      capability: string;
      requirement: PolicyRequirement;
      approverCapability?: string;
      threshold?: number;
      signers?: string[];
      delaySeconds?: number;
      distinctBy?: "party" | "actor";
    }) =>
      call<number>("set_action_policy", {
        p_scope: input.scope,
        p_capability: input.capability,
        p_requirement: input.requirement,
        p_approver_capability: input.approverCapability ?? null,
        p_threshold: input.threshold ?? null,
        p_signers: input.signers ?? null,
        p_delay_seconds: input.delaySeconds ?? null,
        p_distinct_by: input.distinctBy ?? "party",
        ...as,
      }),

    // Actions: the generic consequence lifecycle.
    proposeAction: (input: {
      kind: string;
      capability: string;
      scope: string;
      payload?: Record<string, unknown>;
      targetRef?: string;
      amount?: bigint | string;
      asset?: string;
      counterpartyRef?: string;
      taskRef?: string;
      inReplyTo?: string;
      idempotencyKey?: string;
    }) =>
      call<string>("propose_action", {
        p_kind: input.kind,
        p_capability: input.capability,
        p_scope: input.scope,
        p_payload: input.payload ?? {},
        p_target_ref: input.targetRef ?? null,
        p_amount: input.amount?.toString() ?? null,
        p_asset: input.asset ?? null,
        p_counterparty_ref: input.counterpartyRef ?? null,
        p_task_ref: input.taskRef ?? null,
        p_in_reply_to: input.inReplyTo ?? null,
        p_idempotency_key: input.idempotencyKey ?? null,
        ...as,
      }),

    approveAction: (actionId: string) => call<ActionStatus>("approve_action", { p_action_id: actionId, ...as }),

    challengeAction: (actionId: string, reason: string) =>
      call<ActionStatus>("challenge_action", { p_action_id: actionId, p_reason: reason, ...as }),


    enactAction: (actionId: string) => call<Record<string, unknown>>("enact_action", { p_action_id: actionId, ...as }),

    beginAction: (actionId: string, detail = "") =>
      call<ActionStatus>("begin_action", { p_action_id: actionId, p_detail: detail, ...as }),

    settleAction: (input: {
      actionId: string;
      status: "completed" | "failed" | "needs_reconciliation";
      result?: Record<string, unknown>;
      detail?: string;
      evidence?: Evidence[];
    }) =>
      call<ActionStatus>("settle_action", {
        p_action_id: input.actionId,
        p_status: input.status,
        p_result: input.result ?? null,
        p_detail: input.detail ?? "",
        p_evidence: input.evidence ?? [],
        ...as,
      }),

    readAction: (actionId: string) => one<Action>("read_action", { p_action_id: actionId, ...as }),


    inbox: () => call<InboxMessage[]>("inbox", { ...as }),

    // World Graph.
    createWorldInvitation: (input: { worldId: string; tokenHash: string; role: "viewer" | "editor"; requestId: string }) =>
      one<{ invitation_id: string; expires_at: string }>("create_world_invitation", {
        p_world_id: input.worldId, p_token_hash: input.tokenHash, p_role: input.role, p_request_id: input.requestId, ...as }),
    acceptWorldInvitation: (token: string) => call<string>("accept_world_invitation", { p_token: token, ...as }),
    // Connected apps (SOLVE Connect). Only the person, in their own session, can call these; a
    // connected app acts as its own agent and reaches only what it was granted.
    connectApp: (clientId: string, label: string, idempotencyKey?: string) =>
      call<string>("connect_app", { p_client_id: clientId, p_label: label, p_idempotency_key: idempotencyKey ?? null }),
    disconnectApp: (clientId: string, idempotencyKey?: string) =>
      call<void>("disconnect_app", { p_client_id: clientId, p_idempotency_key: idempotencyKey ?? null }),
    myConnections: () => call<Array<{ client_id: string; label: string; agent_id: string; connected_at: string;
      disconnected_at: string | null; scopes: Array<{ scope: string; capability: string; grant_id: string }> }>>("my_connections", {}),
    // A published page, readable by anyone — including callers with no identity at all.
    readPage: (worldId: string) => call<PublicPage>("read_page", { p_world_id: worldId }),
    readSpace: (actorId: string) => call<PublicSpace>("read_space", { p_actor_id: actorId }),
    // Who invited the holder of this link, and to what — without accepting or granting anything.
    readWorldInvitation: (token: string) => call<{ title: string; invited_by: string; role: "viewer" | "editor"; expires_at: string;
      expired: boolean; used: boolean; used_by_you: boolean; is_yours: boolean }>("read_world_invitation", { p_token: token, ...as }),
    cancelWorldInvitation: (invitationId: string) => call<void>("cancel_world_invitation", { p_invitation_id: invitationId, ...as }),
    updateDocument: (input: { entityId: string; scope: string; expectedVersion: number; title: string; summary: string; attributes: Record<string, unknown>; idempotencyKey: string }) =>
      call<string>("update_document_version", { p_entity_id: input.entityId, p_scope: input.scope,
        p_expected_version: input.expectedVersion, p_title: input.title, p_summary: input.summary,
        p_attributes: input.attributes, p_idempotency_key: input.idempotencyKey, ...as }),

    postRoomMessage: (input: { worldId: string; text: string; requestId: string; kind?: "message" | "decision"; askAi?: boolean }) =>
      call<string>("post_room_message", { p_world_id: input.worldId, p_text: input.text, p_request_id: input.requestId,
        p_kind: input.kind ?? "message", p_ask_ai: input.askAi ?? false, ...as }),





    upsertEntity: (input: {
      entityId?: string;
      kind: EntityKind;
      scope: string;
      title: string;
      summary?: string;
      attributes?: Record<string, unknown>;
      latitude?: number;
      longitude?: number;
      altitudeM?: number;
      locationTruth?: LocationTruth;
      visibility?: Visibility;
      importance?: number;
      idempotencyKey?: string;
    }) =>
      call<string>("upsert_entity", {
        p_kind: input.kind,
        p_scope: input.scope,
        p_title: input.title,
        p_summary: input.summary ?? "",
        p_attributes: input.attributes ?? {},
        p_latitude: input.latitude ?? null,
        p_longitude: input.longitude ?? null,
        p_altitude_m: input.altitudeM ?? null,
        p_location_truth: input.locationTruth ?? null,
        p_visibility: input.visibility ?? "members",
        p_importance: input.importance ?? 50,
        p_entity_id: input.entityId ?? null,
        p_idempotency_key: input.idempotencyKey ?? null,
        ...as,
      }),

    relate: (input: { kind: RelationKind; fromRef: string; toRef: string; scope: string; attributes?: Record<string, unknown>; idempotencyKey?: string }) =>
      call<string>("relate", {
        p_kind: input.kind,
        p_from_ref: input.fromRef,
        p_to_ref: input.toRef,
        p_scope: input.scope,
        p_attributes: input.attributes ?? {},
        p_idempotency_key: input.idempotencyKey ?? null,
        ...as,
      }),

    endRelation: (relationId: string, reason = "") =>
      call<string>("end_relation", { p_relation_id: relationId, p_reason: reason, ...as }),

    readWorld: (scope: string) => call<WorldEntity[]>("read_world", { p_scope: scope, ...as }),

    publicWorld: () => call<WorldEntity[]>("public_world", { ...as }),



    // Everything this actor holds authority over, as one document they can take away.
    exportMine: () => call<{ exported_at: string; actor: { actor_id: string; label: string }; scopes: string[];
      grants: Array<{ capability: string; scope: string }>;
      things: Array<{ id: string; type: string; scope: string; title: string; data: Record<string, unknown>; version: number }>;
      history: Array<{ seq: number; at: string; type: string; scope: string }> }>("export_mine", { ...as }),

    // Counterparty confirmation. The owner asks one named person about one thing; the bearer
    // token itself never reaches the kernel, only its SHA-256 hash.
    requestConfirmation: (input: { entityId: string; tokenHash: string; askedOf?: string; question?: string; requestId: string }) =>
      call<{ request_id: string; expires_at: string }[]>("request_confirmation", {
        p_entity_id: input.entityId, p_token_hash: input.tokenHash,
        p_asked_of: input.askedOf ?? "", p_question: input.question ?? "",
        p_request_id: input.requestId, ...as }),

    // What the person holding the link may see: that one thing, and nothing else.
    readConfirmationRequest: (tokenHash: string) =>
      call<{ thing: { title: string; summary: string; type: string; data: Record<string, unknown> };
        asked_by: string; asked_of: string; question: string; expires_at: string; expired: boolean;
        answered: boolean; answered_by_you: boolean; decision: "confirmed" | "disputed" | null; answered_at: string | null }>(
        "read_confirmation_request", { p_token_hash: tokenHash, ...as }),

    answerConfirmation: (input: { tokenHash: string; decision: "confirmed" | "disputed"; note?: string; requestId: string }) =>
      call<string>("answer_confirmation", { p_token_hash: input.tokenHash, p_decision: input.decision,
        p_note: input.note ?? "", p_request_id: input.requestId, ...as }),


    // An unanswered request is a state, not a gap, so the owner's surface can say so.
    readConfirmations: (entityId: string) =>
      call<Array<{ confirmation_id: string; asked_of: string; question: string; expires_at: string;
        state: "awaiting" | "confirmed" | "disputed" | "expired" | "withdrawn";
        answered_at: string | null; answered_by: string | null }>>(
        "read_confirmations", { p_entity_id: entityId, ...as }),

    readRelations: (scope: string, includeEnded = false) =>
      call<WorldRelation[]>("read_relations", { p_scope: scope, p_include_ended: includeEnded, ...as }),

    // Operational tasks.
    createTask: (input: {
      scope: string;
      title: string;
      requiredCapability: string;
      objective?: string;
      causeRef?: string;
      risk?: Task["risk"];
      reversible?: boolean;
      budgetAmount?: bigint | string;
      budgetAsset?: string;
      evidenceBases?: EvidenceBasis[];
      verification?: Task["verification"];
      inputs?: Record<string, unknown>;
      idempotencyKey?: string;
    }) =>
      call<string>("create_task", {
        p_scope: input.scope,
        p_title: input.title,
        p_required_capability: input.requiredCapability,
        p_objective: input.objective ?? "",
        p_cause_ref: input.causeRef ?? null,
        p_risk: input.risk ?? "low",
        p_reversible: input.reversible ?? true,
        p_budget_amount: input.budgetAmount?.toString() ?? null,
        p_budget_asset: input.budgetAsset ?? null,
        p_evidence_bases: input.evidenceBases ?? [],
        p_verification: input.verification ?? "none",
        p_inputs: input.inputs ?? {},
        p_idempotency_key: input.idempotencyKey ?? null,
        ...as,
      }),

    transitionTask: (input: { taskId: string; status: TaskStatus; detail?: string; result?: Record<string, unknown>; evidence?: Evidence[] }) =>
      call<TaskStatus>("transition_task", {
        p_task_id: input.taskId,
        p_status: input.status,
        p_detail: input.detail ?? "",
        p_result: input.result ?? null,
        p_evidence: input.evidence ?? [],
        ...as,
      }),

    readTasks: (scope: string) => call<Task[]>("read_tasks", { p_scope: scope, ...as }),

    // Avatars.
    createAvatar: (input: {
      type: AvatarType;
      name: string;
      relationship?: AvatarRelationship;
      seed?: Record<string, unknown>;
      representation?: RepresentationKind;
    }) =>
      call<string>("create_avatar", {
        p_avatar_type: input.type,
        p_name: input.name,
        p_relationship: input.relationship ?? "assist",
        p_seed: input.seed ?? {},
        p_representation: input.representation ?? "abstract",
        ...as,
      }),

    setAvatarRepresentation: (avatarId: string, kind: RepresentationKind, rendererVersion = "sov-1", assetRef?: string) =>
      call<string>("set_avatar_representation", {
        p_avatar_id: avatarId,
        p_kind: kind,
        p_renderer_version: rendererVersion,
        p_asset_ref: assetRef ?? null,
        ...as,
      }),

    myAvatars: () => call<Avatar[]>("my_avatars", { ...as }),

    readActors: (actorIds: string[]) => call<ActorProfile[]>("read_actors", { p_actor_ids: actorIds, ...as }),
  };
}

export type Kernel = ReturnType<typeof kernelClient>;
