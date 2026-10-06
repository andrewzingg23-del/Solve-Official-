// Per-user consent gates for the shared team agent (Instinct pattern).
//
// The rule: one person's data becomes visible to another person's agent
// only through an explicit, revocable grant the data owner issued. The grant
// is issued ON the data scope itself (e.g. `actor:<id>/bot:memory`), so the
// kernel's own read authority enforces it — the grant is the enforcement.
// The request and every state change are recorded as kernel events on the
// same scope, so consent has provenance like everything else.

import type { kernelClient } from "@/lib/kernel/client";

type Kernel = ReturnType<typeof kernelClient>;

export type ConsentRequest = {
  /** Actor id of the person whose data is wanted. */
  ownerActorId: string;
  /** Actor id of the agent asking (usually the team agent). */
  granteeActorId: string;
  /** The data scope being shared, e.g. `actor:<id>/bot:memory`. */
  scope: string;
  /** Defaults to "read" — consent is read-scoped. */
  capability?: string;
  /** Human label for the area, e.g. "memories" — for event payloads. */
  area?: string;
};

const capabilityFor = (req: ConsentRequest) => req.capability ?? "read";

/** Convenience: consent over someone's bot memories. */
export function memoryConsent(ownerActorId: string, granteeActorId: string): ConsentRequest {
  return {
    ownerActorId,
    granteeActorId,
    scope: `actor:${ownerActorId}/bot:memory`,
    capability: "bot.memory.*",
    area: "memories",
  };
}

/**
 * Record that consent was asked for. Returns the kernel event id.
 * The owner approves out-of-band (or via grantConsent); asking alone
 * grants nothing.
 */
export async function requestConsent(client: Kernel, req: ConsentRequest): Promise<string> {
  return client.recordEvent({
    type: "consent.requested",
    scope: req.scope,
    payload: {
      owner_actor_id: req.ownerActorId,
      grantee_actor_id: req.granteeActorId,
      area: req.area ?? "",
      capability: capabilityFor(req),
    },
  });
}

/**
 * The owner approves: issues the kernel grant on the data scope and
 * records it. Call with a client acting as the owner.
 */
export async function grantConsent(
  client: Kernel,
  req: ConsentRequest,
  opts: { expiresAt?: Date; idempotencyKey?: string } = {},
): Promise<{ grantId: string; eventId: string }> {
  const grantId = await client.issueGrant({
    grantee: req.granteeActorId,
    capability: capabilityFor(req),
    scope: req.scope,
    expiresAt: opts.expiresAt,
    idempotencyKey: opts.idempotencyKey,
  });
  const eventId = await client.recordEvent({
    type: "consent.granted",
    scope: req.scope,
    payload: {
      grant_id: grantId,
      owner_actor_id: req.ownerActorId,
      grantee_actor_id: req.granteeActorId,
      area: req.area ?? "",
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
    scope: req.scope,
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
  return grants.some((g) => g.scope === req.scope && g.capability === capabilityFor(req));
}
