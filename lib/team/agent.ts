// The shared team agent: one AI brain across the whole team.
// The selling hook is "never misses a lead" — every call, lead, follow-up.
//
// How it works: the owner creates a team agent (an agent actor). Each member
// grants the agent consent over their data scopes via lib/bot/consent —
// no consent, no visibility, and the member can revoke anytime. The digest
// reads only consented scopes and records itself as a kernel event, so the
// team's shared brain is inspectable like everything else.
//
// This is the kernel-native slice: agent lifecycle + consent-checked digest.
// The GoHighLevel lead bridge (leads/calls living in GHL today) is the next
// slice — it feeds lead events into member scopes this digest already reads.

import type { kernelClient } from "@/lib/kernel/client";
import { hasConsent, type ConsentRequest } from "@/lib/bot/consent";

type Kernel = ReturnType<typeof kernelClient>;

export const TEAM_AGENT_CREATED = "team.agent.created";
export const TEAM_MEMBER_INVITED = "team.member.invited";
export const TEAM_DIGEST = "team.digest";

export const teamScope = (ownerId: string) => `actor:${ownerId}/team`;

/**
 * Create the team's agent. Call with a client acting as the team owner.
 * Returns the agent's actor id.
 */
export async function createTeamAgent(
  ownerClient: Kernel,
  ownerActorId: string,
  label: string,
  idempotencyKey?: string,
): Promise<string> {
  const agentActorId = await ownerClient.createAgent(label, idempotencyKey);
  await ownerClient.recordEvent({
    type: TEAM_AGENT_CREATED,
    scope: teamScope(ownerActorId),
    payload: { agent_actor_id: agentActorId, owner_actor_id: ownerActorId, label },
    idempotencyKey: idempotencyKey ? `team-agent:${idempotencyKey}` : undefined,
  });
  return agentActorId;
}

/**
 * Invite a member: records the ask. The member completes it by granting
 * consent (lib/bot/consent) — the invite alone shares nothing.
 */
export async function inviteMember(
  ownerClient: Kernel,
  ownerActorId: string,
  agentActorId: string,
  memberOwnerActorId: string,
  area = "memories",
): Promise<string> {
  return ownerClient.recordEvent({
    type: TEAM_MEMBER_INVITED,
    scope: teamScope(ownerActorId),
    payload: { agent_actor_id: agentActorId, member_actor_id: memberOwnerActorId, area },
  });
}

export type DigestMember = {
  ownerActorId: string;
  consented: boolean;
  /** Recent activity by event type in the consented scope — counts, not content. Sealed stays sealed. */
  activity: { type: string; count: number; latestAt: string | null }[];
};

export type TeamDigest = {
  agentActorId: string;
  at: string;
  members: DigestMember[];
};

/**
 * The digest. Call with a client acting as the team agent.
 * For each member: consent check first; only consented scopes are read,
 * and only activity metadata (types, counts, timestamps) — never sealed content.
 * Records itself as a team.digest event on the team's scope.
 */
export async function teamDigest(
  agentClient: Kernel,
  agentActorId: string,
  teamOwnerActorId: string,
  consents: ConsentRequest[],
): Promise<TeamDigest> {
  const members: DigestMember[] = await Promise.all(
    consents.map(async (req) => {
      const consented = await hasConsent(agentClient, req).catch(() => false);
      if (!consented) return { ownerActorId: req.ownerActorId, consented: false, activity: [] };
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const events = await agentClient
        .readEvents(req.scope, { limit: 100 })
        .catch(() => []);
      const recent = events.filter((e) => (e.occurred_at ?? "") >= since);
      const byType = new Map<string, { count: number; latestAt: string | null }>();
      for (const e of recent) {
        const cur = byType.get(e.type) ?? { count: 0, latestAt: null };
        cur.count += 1;
        if (!cur.latestAt || (e.occurred_at ?? "") > cur.latestAt) cur.latestAt = e.occurred_at ?? null;
        byType.set(e.type, cur);
      }
      return {
        ownerActorId: req.ownerActorId,
        consented: true,
        activity: [...byType.entries()].map(([type, v]) => ({ type, ...v })),
      };
    }),
  );
  const digest: TeamDigest = { agentActorId, at: new Date().toISOString(), members };
  await agentClient
    .recordEvent({ type: TEAM_DIGEST, scope: teamScope(teamOwnerActorId), payload: digest as unknown as Record<string, unknown> })
    .catch(() => {});
  return digest;
}
