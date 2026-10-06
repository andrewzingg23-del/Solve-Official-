// Per-user consent gates for the shared team agent (Instinct pattern).
//
// The rule: one person's data becomes visible to another person's agent
// only through an explicit, revocable grant the data owner issued. The grant
// itself lives in the kernel (issueGrant / revokeGrant / myGrants); the
// request and every state change are recorded as kernel events, so consent
// has provenance like everything else.
//
// Scope convention: `consent:<ownerActorId>:<area>` (area e.g. "memories").
// Capability defaults to "read" — consent is read-scoped; anything that
// writes goes through the kernel's own authority checks.

import type { kernelClient } from "@/lib/kernel/client";

type Kernel = ReturnType<typeof kernelClient>;

export type ConsentRequest = {
  /** Actor id of the person whose data is wanted. */
  ownerActorId: string;
  /** Actor id of the agent asking (usually the team agent). */
  granteeActorId: string;
  /** What data: "memories", "leads", "schedule", ... */
  area: string;
  capability?: string;
};

const scopeFor = (req: ConsentRequest) => `consent:${req.ownerActorId}:${req.area}`;
const capabilityFor = (req: ConsentRequest) => req.capability ?? "read";

/**
 * Record that consent was asked for. Returns the kernel event id.
 * The owner approves out-of-band (or via grantConsent); asking alone
 * grants nothing.
 */
export async function requestConsent(client: Kernel, req: ConsentRequest): Promise<string> {
  return client.recordEvent({
    type: "consent.requested",
    scope: scopeFor(req),
    payload: {
      owner_actor_id: req.ownerActorId,
      grantee_actor_id: req.granteeActorId,
      area: req.area,
      capability: capabilityFor(req),
    },
  });
}

/**
 * The owner approves: issues the kernel grant and records it.
 * Call with a client acting as the owner.
 */
export async function grantConsent(
  client: Kernel,
  req: ConsentRequest,
  opts: { expiresAt?: Date; idempotencyKey?: string } = {},
): Promise<{ grantId: string; eventId: string }> {
  const grantId = await client.issueGrant({
    grantee: req.granteeActorId,
    capability: capabilityFor(req),
    scope: scopeFor(req),
    expiresAt: opts.expiresAt,
    idempotencyKey: opts.idempotencyKey,
  });
  const eventId = await client.recordEvent({
    type: "consent.granted",
    scope: scopeFor(req),
    payload: {
      grant_id: grantId,
      owner_actor_id: req.ownerActorId,
      grantee_actor_id: req.granteeActorId,
      area: req.area,
      capability: capabilityFor(req),
    },
  });
  return { grantId, eventId };
}

/**
 * The owner takes it back. Revoking the grant is what enforces;
 * the event is the record.
 */
export async function revokeConsent(
  client: Kernel,
  req: ConsentRequest,
  grantId: string,
  reason = "",
): Promise<string> {
  await client.revokeGrant(grantId, reason);
  return client.recordEvent({
    type: "consent.revoked",
    scope: scopeFor(req),
    payload: { grant_id: grantId, reason },
  });
}

/**
 * Does the grantee currently hold live consent for this request?
 * Call with a client acting as the grantee — myGrants only sees the
 * caller's own active grants, so there is no way to overshoot.
 */
export async function hasConsent(granteeClient: Kernel, req: ConsentRequest): Promise<boolean> {
  const grants = await granteeClient.myGrants();
  const scope = scopeFor(req);
  const capability = capabilityFor(req);
  return grants.some((g) => g.scope === scope && g.capability === capability);
}
