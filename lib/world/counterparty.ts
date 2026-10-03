// What an organization's agent answers to a capability query: only its organization's published
// record in the World Graph, and it says so. The answering itself is the `inquiry.answer`
// transition (lib/causal/transitions.ts), run by the agent through its own Horizon.
import type { WorldEntity } from "../kernel/client";

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
