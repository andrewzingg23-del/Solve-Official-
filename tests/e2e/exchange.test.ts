// Both sides of an exchange run the same loop. You ask a supplier through the kernel; the
// supplier's agent, from its own session and its own authority, sees the inquiry as a fact of its
// World, plans the answer through its own Horizon, records its selection and replies. Your waiting
// step settles from that reply. No bespoke responder, no second code path, nobody on this device
// speaking for anyone else.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildContext } from "../../lib/causal/context";
import { answerInquiries } from "../../lib/causal/exchange";
import { executeRoute, recordRoute, ROUTE_EVENT } from "../../lib/causal/pipeline";
import { messagingProviders, Providers } from "../../lib/causal/providers";
import { answerGoal, openInquiryGoals } from "../../lib/causal/transitions";
import { loadWorld } from "../../lib/causal/world";
import { quoteOf, setting } from "../support/causal";

describe("the counterparty's side", () => {
  it("answers an inquiry as a transition through its own Horizon, and the asker's step settles from it", async () => {
    const S = await setting();
    const providers = messagingProviders(S.counterparts);
    const halden = S.manifest.orgs.halden;
    const agent = S.as(halden.agentId);
    const haldenRef = S.org("halden");

    // Nothing asked yet: the agent's World holds no inquiry and it has nothing to answer.
    const quiet = await loadWorld(agent, halden.agentId);
    assert.deepEqual(quiet.facts.filter((f) => f.predicate.startsWith("inquiry:")), []);
    assert.deepEqual(openInquiryGoals(quiet, haldenRef), []);

    // You ask through the kernel; your step waits.
    const route = await recordRoute(S.you, (await S.horizon(providers)).routes[0]);
    const asked = await executeRoute(await S.executor(providers), route);
    assert.equal(asked[0].status, "unknown");

    // The inquiry is now a fact of the agent's World, observed, with the asker's provenance.
    const seen = await loadWorld(agent, halden.agentId);
    const inquiry = seen.facts.find((f) => f.predicate === "inquiry:open")!;
    assert.ok(inquiry, "the delivered inquiry is a fact");
    assert.deepEqual([inquiry.object, inquiry.status, inquiry.value?.from, inquiry.value?.quantity, inquiry.value?.capability], [haldenRef, "observed", `actor:${S.youId}`, 10000, "contract_manufacturing"]);
    assert.equal(inquiry.provenance.by, S.youId);

    // Its context from its own authority: the goal is derived from the fact; the Horizon is one
    // native step it may perform itself, addressed to you, in reply to your message.
    const [goal] = openInquiryGoals(seen, haldenRef);
    assert.deepEqual(goal, answerGoal({ inquiryRef: inquiry.subject, orgRef: haldenRef, scope: S.manifest.world, title: "Halden Works" }));
    const ctx = await buildContext({ kernel: agent, actorId: halden.agentId, goal, kernelFor: S.as, providers: new Providers([]) });
    assert.deepEqual([ctx.who.kind, ctx.who.principalId], ["agent", halden.ownerId]);
    assert.ok(ctx.can.some((c) => c.capability === "message.send"));
    const step = ctx.horizon!.routes[0].steps[0];
    assert.deepEqual(
      [ctx.horizon!.routes.length, step.transition, step.native, step.actorId, step.authority.decision, step.targetRef, step.inReplyTo, step.payload.type, step.payload.can_fulfill],
      [1, "inquiry.answer", true, halden.agentId, "ALLOW", `actor:${S.youId}`, inquiry.subject.slice("action:".length), "INFORMATION_RESPONSE", true],
    );
    assert.equal(ctx.horizon!.routes[0].needsHuman, false);

    // It answers, alone. The selection is its own record; the reply is a kernel action in the
    // market under its own authority, for its principal, bound to the inquiry it answers.
    const answered = await answerInquiries({ kernel: agent, actorId: halden.agentId, orgRef: haldenRef, kernelFor: S.as, providers: new Providers([]) });
    assert.equal(answered.length, 1);
    assert.deepEqual(answered[0].outcomes.map((o) => [o.status, o.provider]), [["completed", "kernel"]]);
    const replyId = answered[0].outcomes[0].actionId!;
    const reply = await agent.readAction(replyId);
    assert.deepEqual(
      [reply.kind, reply.scope, reply.proposer_id, reply.on_behalf_of, reply.target_ref, reply.in_reply_to, reply.status, reply.payload.capacity_per_year],
      ["message.send", S.manifest.world, halden.agentId, halden.ownerId, `actor:${S.youId}`, inquiry.subject.slice("action:".length), "completed", 12000],
    );
    const selections = (await agent.readEvents(`actor:${halden.agentId}`, { limit: 100 })).filter((e) => e.type === ROUTE_EVENT);
    assert.equal(selections.length, 1);

    // Answered is now the agent's fact; its Horizon for that goal is satisfied; a second pass
    // finds nothing open and sends nothing.
    const after = await loadWorld(agent, halden.agentId);
    const done = after.facts.find((f) => f.subject === inquiry.subject)!;
    assert.deepEqual([done.predicate, done.value?.reply, done.provenance.actions], ["inquiry:answered", `action:${replyId}`, [inquiry.subject.slice("action:".length), replyId]]);
    assert.equal((await buildContext({ kernel: agent, actorId: halden.agentId, goal, kernelFor: S.as, providers: new Providers([]) })).horizon!.satisfied?.predicate, "inquiry:answered");
    assert.deepEqual(await answerInquiries({ kernel: agent, actorId: halden.agentId, orgRef: haldenRef, kernelFor: S.as, providers: new Providers([]) }), []);
    assert.equal(Number((await S.k.owner("select count(*)::int as n from kernel.actions where in_reply_to = $1", [inquiry.subject.slice("action:".length)]))[0].n), 1);

    // Your next run settles from the reply and goes on to the acceptance: the quote names the
    // agent's own reply action as its source.
    const settled = await executeRoute(await S.executor(providers), route);
    assert.deepEqual(settled.map((o) => o.status), ["completed", "completed"]);
    const quote = quoteOf(await S.youWorld(), haldenRef)!;
    assert.deepEqual([quote.status, quote.value?.reply, quote.value?.unit_price_usd], ["reconciled", `action:${replyId}`, 18500]);

    // Another organization's agent never saw the inquiry: nothing to answer, nothing sent.
    const orrin = S.manifest.orgs.orrin;
    assert.deepEqual(openInquiryGoals(await loadWorld(S.as(orrin.agentId), orrin.agentId), S.org("orrin")), []);
  });
});
