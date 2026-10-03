// Counterparty agents in the sandbox. In Arcadia every organization has an agent principal with
// its own grants; on this device the sandbox runs that agent too. Its answers come only from the
// organization's published record in the World Graph, and it says so.
import type { Kernel, WorldEntity } from "../kernel/client";

export type CapabilityAnswer = {
  can_fulfill: boolean;
  quantity: number | null;
  capacity_per_year: number | null;
  lead_time_days: number | null;
  unit_price_usd: number | null;
  minimum_order: number | null;
  claim_event_id: string | null;
  note: string;
};

export function answerCapabilityQuery(org: WorldEntity, quantity: number | null, claimEventId: string | null): CapabilityAnswer {
  const a = org.attributes as Record<string, number | undefined>;
  const capacity = typeof a.capacity_per_year === "number" ? a.capacity_per_year : null;
  const can = capacity !== null && (quantity === null || capacity >= quantity);
  return {
    can_fulfill: can,
    quantity,
    capacity_per_year: capacity,
    lead_time_days: typeof a.lead_time_days === "number" ? a.lead_time_days : null,
    unit_price_usd: typeof a.unit_price_usd === "number" ? a.unit_price_usd : null,
    minimum_order: typeof a.minimum_order === "number" ? a.minimum_order : null,
    claim_event_id: claimEventId,
    note: "Answered by the organization's agent from its published record (simulated in your sandbox).",
  };
}

// Reads the agent's inbox and answers each capability query once: the idempotency key makes a
// repeat answer return the original action instead of sending another.
export async function respondToQueries(agent: Kernel, org: WorldEntity, claimEventId: string | null, scope: string) {
  const replies: string[] = [];
  for (const m of await agent.inbox()) {
    if (m.message_type !== "CAPABILITY_QUERY") continue;
    const q = m.payload as { quantity?: number | null };
    const answer = answerCapabilityQuery(org, q.quantity ?? null, claimEventId);
    const id = await agent.proposeAction({
      kind: "message.send",
      capability: "message.send",
      scope,
      targetRef: `actor:${m.sender_id}`,
      payload: { type: "INFORMATION_RESPONSE", organization: `entity:${org.entity_id}`, ...answer },
      inReplyTo: m.action_id,
      idempotencyKey: `answer:${m.action_id}`,
    });
    await agent.enactAction(id);
    replies.push(id);
  }
  return replies;
}
