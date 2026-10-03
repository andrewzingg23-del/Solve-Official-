// Providers perform a capability in the world outside the kernel and report what happened. Their
// response is evidence for the reconciliation step, never canonical truth by itself. Routes name
// capabilities, not providers, so a provider can be replaced (email, an API, a supplier portal, a
// human) without changing routes or rewriting the history that names who performed what.
import type { Kernel, WorldEntity } from "../kernel/client";
import { sha256Hex } from "../money/settlement";
import { respondToQueries, type CapabilityAnswer } from "../world/counterparty";
import type { ProviderResponse, RouteStep } from "./types";
import type { WorldState } from "./world";

export type ProviderContext = { actor: Kernel; actorId: string; actionId: string; step: RouteStep; world: WorldState };

export interface Provider {
  id: string;
  capability: string;
  perform(ctx: ProviderContext): Promise<ProviderResponse>;
}

export class Providers {
  private readonly byCapability = new Map<string, Provider>();
  constructor(list: Provider[]) {
    for (const p of list) this.byCapability.set(p.capability, p);
  }
  resolve(capability: string): Provider | null {
    return this.byCapability.get(capability) ?? null;
  }
  with(provider: Provider) {
    return new Providers([...this.byCapability.values(), provider]);
  }
}

// How Arcadia's counterparties are reached in the sandbox: each organization's agent principal,
// which runs on this device and answers only from the organization's published record.
export type Counterparts = {
  agentFor(orgRef: string): string | null;
  as(actorId: string): Kernel;
  claimEventFor(orgRef: string): string | null;
  // Where counterparties speak: the market World their agents hold authority in.
  replyScope: string;
};

const evidenceOf = async (description: string, facts: unknown) => ({
  basis: "artifact" as const,
  content_hash: `sha256:${await sha256Hex(JSON.stringify(facts))}` as const,
  description: description.slice(0, 500),
});

// The message is the mechanism; its idempotency key ties it to the action it serves, so a retry
// after a crash never sends a second inquiry.
async function deliver(actor: Kernel, step: RouteStep, agentId: string, payload: Record<string, unknown>, capability: string, key: string) {
  const id = await actor.proposeAction({ kind: "message.send", capability, scope: step.scope, targetRef: `actor:${agentId}`, payload, idempotencyKey: key });
  const message = await actor.readAction(id);
  if (message.status === "rejected") return { id, rejected: message.reasons.join("; ") || "refused" };
  if (message.status !== "completed") await actor.enactAction(id);
  return { id, rejected: null };
}

export function arcadiaInquiry(counterparts: Counterparts): Provider {
  return {
    id: "arcadia.agent-messaging.inquiry",
    capability: "counterparty.inquiry",
    async perform({ actor, actionId, step, world }) {
      const org = step.binding.org;
      const agentId = counterparts.agentFor(org);
      const entity = world.entities.get(org) as WorldEntity | undefined;
      if (!agentId || !entity) return { provider: this.id, status: "failed", result: {}, evidence: [], detail: "the organization has no reachable agent" };
      const quantity = typeof step.payload.quantity === "number" ? step.payload.quantity : null;
      const sent = await deliver(
        actor,
        step,
        agentId,
        { type: "CAPABILITY_QUERY", organization: org, capability: step.binding.capability, quantity, for_action: `action:${actionId}` },
        "message.send",
        `provider:inquiry:${actionId}`,
      );
      if (sent.rejected) return { provider: this.id, status: "failed", result: {}, evidence: [], detail: sent.rejected };
      // Arcadia's counterparty answers on this device; a real one answers when it answers.
      await respondToQueries(counterparts.as(agentId), entity, counterparts.claimEventFor(org), counterparts.replyScope);
      const reply = (await actor.inbox()).find((m) => m.in_reply_to === sent.id);
      if (!reply) return { provider: this.id, status: "unknown", result: { query: `action:${sent.id}` }, evidence: [], detail: "no reply yet" };
      const answer = reply.payload as unknown as CapabilityAnswer;
      return {
        provider: this.id,
        status: "succeeded",
        result: {
          capacity_per_year: answer.capacity_per_year,
          lead_time_days: answer.lead_time_days,
          unit_price_usd: answer.unit_price_usd,
          minimum_order: answer.minimum_order,
          can_fulfill: answer.can_fulfill,
          reply: `action:${reply.action_id}`,
          provider: this.id,
        },
        evidence: [await evidenceOf(`Reply from ${entity.title}'s agent (action ${reply.action_id}) for its principal ${reply.on_behalf_of ?? "itself"}`, { reply: reply.action_id, answer })],
        detail: `${entity.title} replied`,
      };
    },
  };
}

export function arcadiaAcceptance(counterparts: Counterparts): Provider {
  return {
    id: "arcadia.agent-messaging.acceptance",
    capability: "counterparty.acceptance",
    async perform({ actor, actionId, step, world }) {
      const org = step.binding.org;
      const agentId = counterparts.agentFor(org);
      const title = world.entities.get(org)?.title ?? org;
      if (!agentId) return { provider: this.id, status: "failed", result: {}, evidence: [], detail: "the organization has no reachable agent" };
      const sent = await deliver(
        actor,
        step,
        agentId,
        { type: "ACCEPTANCE", organization: org, ...(step.payload.terms as Record<string, unknown>), for_action: `action:${actionId}` },
        "commitment.make",
        `provider:acceptance:${actionId}`,
      );
      if (sent.rejected) return { provider: this.id, status: "failed", result: {}, evidence: [], detail: sent.rejected };
      return {
        provider: this.id,
        status: "succeeded",
        result: { delivered: `action:${sent.id}`, provider: this.id },
        evidence: [await evidenceOf(`Acceptance delivered to ${title}'s agent (action ${sent.id})`, { delivered: sent.id, terms: step.payload.terms })],
        detail: `acceptance delivered to ${title}`,
      };
    },
  };
}

export const arcadiaProviders = (counterparts: Counterparts) => new Providers([arcadiaInquiry(counterparts), arcadiaAcceptance(counterparts)]);
