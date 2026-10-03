// Providers perform a capability in the world outside the kernel and report what happened. Their
// response is evidence for the reconciliation step, never canonical truth by itself. Routes name
// capabilities, not providers, so a provider can be replaced (email, an API, a supplier portal, a
// human) without changing routes or rewriting the history that names who performed what.
//
// A provider's `perform` is idempotent per action and re-performable: the first call asks, a
// later call for the same action looks for the answer. "unknown" means the answer is not here yet;
// the action waits as needs_reconciliation with no consequence, and the next run asks again. That
// is how a counterparty that answers tomorrow, from its own session on its own device, settles a
// step without the step ever assuming the answer.
import type { Kernel, WorldEntity } from "../kernel/client";
import { sha256Hex } from "../money/settlement";
import type { CapabilityAnswer } from "../world/counterparty";
import { AnswerService } from "../agents/answer-service";
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

// How counterparties are reached through the kernel: each organization's agent principal, which
// answers from wherever it runs (this device in Arcadia; its own session anywhere else).
export type Counterparts = {
  agentFor(orgRef: string): string | null;
  as(actorId: string): Kernel;
  claimEventFor(orgRef: string): string | null;
  // Where counterparties speak: the market World their agents hold authority in.
  replyScope: string;
  // The market's independent verification service (Kestrel), a service actor.
  verifierId: string;
};

// The sandbox runs the other side too: hooks that make the counterparty or verifier act on this
// device between asking and looking. A real deployment has none; the other side acts when it acts.
export type LocalSide = {
  respond?(agentId: string, entity: WorldEntity, orgRef: string): Promise<unknown>;
  verify?(claimEvent: string, orgRef: string, actionId: string, title: string): Promise<unknown>;
};

export const evidenceOf = async (description: string, facts: unknown) => ({
  basis: "artifact" as const,
  content_hash: `sha256:${await sha256Hex(JSON.stringify(facts))}` as const,
  description: description.slice(0, 500),
});

// The message is the mechanism; its idempotency key ties it to the action it serves, so a retry
// after a crash or a reconciliation run never sends a second inquiry.
async function deliver(actor: Kernel, step: RouteStep, agentId: string, payload: Record<string, unknown>, capability: string, key: string) {
  const id = await actor.proposeAction({ kind: "message.send", capability, scope: step.scope, targetRef: `actor:${agentId}`, payload, idempotencyKey: key });
  const message = await actor.readAction(id);
  if (message.status === "rejected") return { id, rejected: message.reasons.join("; ") || "refused" };
  if (message.status !== "completed") await actor.enactAction(id);
  return { id, rejected: null };
}

const answerResult = (answer: CapabilityAnswer, reply: string, provider: string) => ({
  capacity_per_year: answer.capacity_per_year,
  lead_time_days: answer.lead_time_days,
  unit_price_usd: answer.unit_price_usd,
  minimum_order: answer.minimum_order,
  can_fulfill: answer.can_fulfill,
  reply,
  provider,
});

// Inquiry through the kernel's own messaging: the question is a message action to the
// organization's agent; the answer is that agent's reply, performed under its own authority, for
// its own principal, whenever it answers. Until then the step is unknown, not assumed.
export function messagingInquiry(counterparts: Counterparts, local: LocalSide = {}, id = "kernel.messaging.inquiry"): Provider {
  return {
    id,
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
      if (local.respond) await local.respond(agentId, entity, org);
      const reply = (await actor.inbox()).find((m) => m.in_reply_to === sent.id);
      if (!reply) return { provider: this.id, status: "unknown", result: { query: `action:${sent.id}` }, evidence: [], detail: `${entity.title}'s agent has not answered yet` };
      const answer = reply.payload as unknown as CapabilityAnswer;
      return {
        provider: this.id,
        status: "succeeded",
        result: answerResult(answer, `action:${reply.action_id}`, this.id),
        evidence: [await evidenceOf(`Reply from ${entity.title}'s agent (action ${reply.action_id}) for its principal ${reply.on_behalf_of ?? "itself"}`, { reply: reply.action_id, answer })],
        detail: `${entity.title} replied`,
      };
    },
  };
}

// The acceptance is a commitment the actor makes; delivering it to the organization's agent is
// the mechanism, and the delivered message is the evidence.
export function messagingAcceptance(counterparts: Counterparts, id = "kernel.messaging.acceptance"): Provider {
  return {
    id,
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

// Verification by an independent service: the request is recorded; the verifier, a service actor
// acting from its own session, attaches externally verified evidence to the claim's event (only a
// service actor may attach that basis) or challenges the claim. The step settles on what the
// claim's evidence shows, never on the requester's word.
export function verificationRequest(counterparts: Counterparts, local: LocalSide = {}, id = "kernel.verification.request"): Provider {
  return {
    id,
    capability: "verification.service",
    async perform({ actor, actionId, step, world }) {
      const org = step.binding.org;
      const claimEvent = typeof step.payload.claim_event === "string" ? step.payload.claim_event : null;
      const title = world.entities.get(org)?.title ?? org;
      if (!claimEvent) return { provider: this.id, status: "failed", result: {}, evidence: [], detail: `${title} has no claim on record` };
      if (local.verify) await local.verify(claimEvent, org, actionId, title);
      // What the verifier recorded, read with the requester's own authority over the market.
      const challenged = (await actor.readEvents(counterparts.replyScope, { limit: 500 })).some((e) => e.type === "claim.challenge" && e.payload.claim_event_id === claimEvent);
      if (challenged) return { provider: this.id, status: "failed", result: { claim_event: claimEvent, verified: false }, evidence: [], detail: `the verifier's audit of ${title} found otherwise` };
      const verified = (await actor.readEvidence(claimEvent)).find((ev) => ev.basis === "externally_verified");
      if (!verified) return { provider: this.id, status: "unknown", result: { claim_event: claimEvent }, evidence: [], detail: `the verifier has not attached its finding on ${title} yet` };
      return {
        provider: this.id,
        status: "succeeded",
        result: { claim_event: claimEvent, verified: true, provider: this.id },
        evidence: [await evidenceOf(`Externally verified evidence attached to ${title}'s claim (event ${claimEvent}): ${verified.description}`, { claimEvent, evidence: verified.content_hash })],
        detail: `${title}'s claim verified`,
      };
    },
  };
}

// --- Arcadia: the same providers, with the other side running on this device --------------------

// Arcadia's counterparty answers on this device through the same service and loop a remote agent
// runs: woken by the delivery, its own World, its own Horizon (`inquiry.answer`), its own selection,
// its own authority in the market.
export function arcadiaInquiry(counterparts: Counterparts): Provider {
  // Each organization's answer service, running on this device; delivery wakes it.
  const services = new Map<string, AnswerService>();
  const serviceFor = (agentId: string, orgRef: string) => {
    let service = services.get(agentId);
    if (!service) {
      service = new AnswerService({ kernel: counterparts.as(agentId), actorId: agentId, orgRef, kernelFor: counterparts.as, providers: new Providers([]), safetyNetMs: 0 });
      services.set(agentId, service);
    }
    return service;
  };
  return messagingInquiry(counterparts, { respond: (agentId, _entity, org) => serviceFor(agentId, org).wake() }, "arcadia.agent-messaging.inquiry");
}

export const arcadiaAcceptance = (counterparts: Counterparts): Provider => messagingAcceptance(counterparts, "arcadia.agent-messaging.acceptance");

// Kestrel in the sandbox inspects the claim and, unless its own audit has challenged it, attaches
// externally verified evidence (simulated, and it says so); the provider then reads what it found.
export const arcadiaVerification = (counterparts: Counterparts): Provider =>
  verificationRequest(
    counterparts,
    {
      async verify(claimEvent, _org, actionId, title) {
        const kestrel = counterparts.as(counterparts.verifierId);
        const challenged = (await kestrel.readEvents(counterparts.replyScope, { limit: 500 })).some((e) => e.type === "claim.challenge" && e.payload.claim_event_id === claimEvent);
        if (challenged) return;
        const already = (await kestrel.readEvidence(claimEvent)).some((ev) => ev.basis === "externally_verified");
        if (already) return;
        await kestrel.attachEvidence(
          claimEvent,
          {
            basis: "externally_verified",
            content_hash: `sha256:${await sha256Hex(`kestrel:${claimEvent}:${actionId}`)}`,
            description: `Kestrel verification service: ${title}'s claim confirmed on site (simulated in your sandbox)`,
          },
          `verify:${actionId}`,
        );
      },
    },
    "arcadia.kestrel.verification",
  );

export const arcadiaProviders = (counterparts: Counterparts) =>
  new Providers([arcadiaInquiry(counterparts), arcadiaAcceptance(counterparts), arcadiaVerification(counterparts)]);

// The real kernel-mediated set: nothing on this device answers for anyone else.
export const messagingProviders = (counterparts: Counterparts) =>
  new Providers([messagingInquiry(counterparts), messagingAcceptance(counterparts), verificationRequest(counterparts)]);
