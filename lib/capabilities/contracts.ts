/**
 * Provider-neutral contracts for the smallest SOLVE foundation.
 * The kernel remains the only source of identity, authority and saved truth.
 * These types do not themselves authorize a request or execute any tool.
 */
export type CapabilityKind = "inference" | "research" | "tool" | "execution" | "memory" | "workspace" | "communication";
export type SideEffect = "read_only" | "write_world" | "external_action" | "execute_code" | "payment";
export type CapabilityStatus = "available" | "configured_unverified" | "needs_connection" | "disabled";

export type CapabilityDescriptor = {
  schema: "solve.capability.v1";
  id: string;
  label: string;
  kind: CapabilityKind;
  provider: string;
  version: string;
  sideEffect: SideEffect;
  status: CapabilityStatus;
  requiresScopes: string[];
  inputSchema: string;
  outputSchema: string;
  // Explanation surfaced to a person before requiring more access.
  note?: string;
};

export type ContextSource = {
  id: string;
  version: string;
  kind: "world" | "document" | "message" | "memory" | "external";
  verified: boolean;
};
export type TaskContextSnapshot = {
  schema: "solve.task-context.v1";
  worldId: string;
  actorId: string;
  recipient: string;
  sourceRefs: ContextSource[];
  // A grant reference is an audit pointer, NOT a substitute for server authorization.
  grantRefs: string[];
  createdAt: string;
  sha256: string;
};

export type TaskStatus = "created" | "ready" | "claimed" | "in_progress" | "blocked" | "waiting_external" | "verifying" | "escalated" | "completed" | "failed" | "needs_reconciliation" | "cancelled";
export type TaskPlan = {
  schema: "solve.task.v1";
  id: string;
  worldId: string;
  authorId: string;
  title: string;
  instructions: string;
  capabilityId: string;
  status: TaskStatus;
  requestId: string;
  createdAt: string;
  updatedAt: string;
  context?: TaskContextSnapshot;
};
export type RunEvidence = {
  schema: "solve.evidence.v1";
  taskId: string;
  runId: string;
  providerId: string;
  recordedAt: string;
  status: "received" | "verified" | "rejected";
  artifactRefs: Array<{ uri: string; sha256?: string; version?: string }>;
  externalIds: string[];
  verification: Array<{ type: string; passed: boolean; detail: string }>;
};

export const CAPABILITY_ID = /^[a-z][a-z0-9._:-]{0,79}$/;
export const WORLD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const REQUEST_ID = /^[a-zA-Z0-9_-]{1,100}$/;

/** Parse only the small task envelope accepted from an untrusted browser. */
export function parseTaskRequest(value: unknown): { requestId: string; title: string; instructions: string; capabilityId: string } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.requestId !== "string" || !REQUEST_ID.test(v.requestId) ||
    typeof v.title !== "string" || !v.title.trim() || v.title.trim().length > 160 ||
    typeof v.instructions !== "string" || v.instructions.trim().length > 7000 ||
    typeof v.capabilityId !== "string" || !CAPABILITY_ID.test(v.capabilityId) ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v.title + v.instructions)) return null;
  return {
    requestId: v.requestId,
    title: v.title.trim(),
    instructions: v.instructions.trim(),
    capabilityId: v.capabilityId,
  };
}
