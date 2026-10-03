// The delivery-woken answer service, on the real kernel. Focused on what can go wrong between two
// parties who do not share a process: deliveries the service must notice, wakes that overlap,
// replies lost after the kernel committed, a kernel that is down, terms that move while an answer
// is in flight, and authority that is withdrawn. In every case: no inquiry is answered twice, no
// refusal is retried into a storm, and nothing is assumed that the kernel has not recorded.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AnswerService, watchInbox, type Timers } from "../../lib/agents/answer-service";
import { executeRoute, recordRoute } from "../../lib/causal/pipeline";
import { messagingProviders, Providers } from "../../lib/causal/providers";
import { KernelError, kernelClient, type Kernel } from "../../lib/kernel/client";
import { localSupabase, user } from "../../lib/kernel/local";
import { quoteOf, setting } from "../support/causal";

type Fault = { method: string; mode: "lost" | "down"; times: number };

// A session whose calls can fail the two ways a network does: before reaching the kernel ("down"),
// or after the kernel committed, with the reply lost on the way back ("lost").
function faulty(k: Kernel, faults: Fault[]): Kernel {
  return new Proxy(k, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") return value;
      return async (...args: unknown[]) => {
        const fault = faults.find((f) => f.method === prop && f.times > 0);
        if (fault) fault.times -= 1;
        if (fault?.mode === "down") throw new KernelError("unavailable", `fetch failed (${String(prop)})`, "");
        const result = await value.apply(target, args);
        if (fault?.mode === "lost") throw new KernelError("unavailable", `the reply to ${String(prop)} was lost`, "");
        return result;
      };
    },
  });
}

function fakeTimers(): Timers & { advance(ms: number): Promise<void>; delays(): number[] } {
  let now = 1_000_000;
  let next = 0;
  const pending = new Map<number, { at: number; fn: () => void }>();
  return {
    now: () => now,
    setTimeout(fn, ms) {
      pending.set(++next, { at: now + ms, fn });
      return next;
    },
    clearTimeout(handle) {
      pending.delete(handle as number);
    },
    delays: () => [...pending.values()].map((p) => p.at - now),
    async advance(ms) {
      now += ms;
      for (const [id, p] of [...pending]) {
        if (p.at > now) continue;
        pending.delete(id);
        p.fn();
      }
    },
  };
}

async function exchange() {
  const S = await setting();
  const asker = messagingProviders(S.counterparts);
  const halden = S.manifest.orgs.halden;
  const replies = async (inquiryAction: string) => Number((await S.k.owner("select count(*)::int as n from kernel.actions where in_reply_to = $1", [inquiryAction]))[0].n);
  const events = async () => Number((await S.k.owner("select count(*)::int as n from kernel.events"))[0].n);
  // You ask a supplier; nobody on this device answers for it. Returns your inquiry action.
  const ask = async (quantity = 10000, orgKey = "halden") => {
    const routes = (await S.horizon(asker, S.goal(quantity))).routes;
    const route = await recordRoute(S.you, routes.find((r) => r.orgRef === S.org(orgKey))!);
    const run = await executeRoute(await S.executor(asker), route);
    assert.equal(run[0].status, "unknown", "the asker's step waits for the answer");
    const [query] = (await S.as(S.manifest.orgs[orgKey].agentId).inbox()).filter((m) => m.message_type === "CAPABILITY_QUERY");
    return { route, inquiry: query.action_id };
  };
  const serviceFor = (orgKey: string, kernel: Kernel, timers: Timers, extra: Partial<ConstructorParameters<typeof AnswerService>[0]> = {}) =>
    new AnswerService({ kernel, actorId: S.manifest.orgs[orgKey].agentId, orgRef: S.org(orgKey), kernelFor: S.as, providers: new Providers([]), timers, safetyNetMs: 0, ...extra });
  return { S, asker, halden, replies, events, ask, serviceFor };
}

describe("the delivery-woken answer service", () => {
  it("is woken by a delivery to its own inbox, answers once, and writes nothing when nothing was delivered", async () => {
    const { S, asker, halden, replies, events, ask, serviceFor } = await exchange();
    const timers = fakeTimers();
    const agent = S.as(halden.agentId);
    const service = serviceFor("halden", agent, timers);
    const watch = watchInbox({ kernel: agent, onDelivery: () => service.wake(), timers });

    // Nothing delivered: no wake; a wake anyway reads and writes nothing.
    assert.equal(await watch.look(), 0);
    assert.equal(service.status().passes, 0);
    const before = await events();
    assert.deepEqual((await service.wake()).outcomes, []);
    assert.equal(await events(), before, "an idle pass writes nothing");

    // You ask. The watch sees one new delivery and wakes the service, which answers on its own
    // authority; seeing the same delivery again wakes nothing.
    const { route, inquiry } = await ask();
    assert.equal(await watch.look(), 1);
    const report = service.status().last!;
    assert.deepEqual(report.outcomes.map((o) => [o.inquiry, o.state]), [[`action:${inquiry}`, "answered"]]);
    assert.equal(report.error, null);
    const passes = service.status().passes;
    assert.equal(await watch.look(), 0);
    assert.equal(service.status().passes, passes);

    // Your step settles from the service's reply; exactly one reply exists.
    const settled = await executeRoute(await S.executor(asker), route);
    assert.deepEqual(settled.map((o) => o.status), ["completed", "completed"]);
    assert.equal(quoteOf(await S.youWorld(), S.org("halden"))?.value?.reply, report.outcomes[0].reply);
    assert.equal(await replies(inquiry), 1);
    const reply = await agent.readAction(report.outcomes[0].reply!.slice("action:".length));
    assert.deepEqual([reply.proposer_id, reply.on_behalf_of, reply.in_reply_to], [halden.agentId, halden.ownerId, inquiry]);
  });

  it("coalesces overlapping wakes and never loses a delivery that lands during a pass", async () => {
    const { S, halden, replies, ask, serviceFor } = await exchange();
    const service = serviceFor("halden", S.as(halden.agentId), fakeTimers());
    const first = service.wake();
    assert.equal(service.wake(), first, "a wake during a pass joins it");
    assert.equal(service.wake(), first);
    const { inquiry } = await ask(); // delivered while that pass may already have read the inbox
    const after = service.wake();
    await Promise.all([first, after]);
    assert.ok(service.status().passes <= 3, "three wakes, at most one pass each plus the one in flight");
    assert.equal((await service.wake()).outcomes.length, 0, "nothing left open");
    assert.equal(await replies(inquiry), 1, "answered once");
  });

  it("treats a lost reply as an unknown outcome: retried with backoff, never repeated", async () => {
    const { S, asker, halden, replies, ask, serviceFor } = await exchange();
    const timers = fakeTimers();

    // The kernel enacts the answer and the reply is lost on the way back.
    const { route, inquiry } = await ask();
    const service = serviceFor("halden", faulty(S.as(halden.agentId), [{ method: "enactAction", mode: "lost", times: 1 }]), timers).start();
    const failed = await service.wake();
    assert.equal(failed.error, null, "the pass ran; this inquiry's outcome is what is unknown");
    assert.deepEqual(failed.outcomes.map((o) => [o.state, o.attempts]), [["unknown", 1]]);
    assert.match(failed.outcomes[0].detail, /unavailable: the reply to enactAction was lost/);
    assert.deepEqual([service.status().failures, service.status().nextRetryAt], [1, timers.now() + 1_000]);
    assert.deepEqual(timers.delays(), [1_000]);
    // The kernel holds the truth: the reply exists and the asker's step settles from it.
    assert.equal(await replies(inquiry), 1);
    assert.deepEqual((await executeRoute(await S.executor(asker), route)).map((o) => o.status), ["completed", "completed"]);

    // The retry finds nothing open and writes nothing.
    await timers.advance(1_000);
    await service.idle();
    assert.deepEqual([service.status().passes, service.status().failures, service.status().nextRetryAt, service.status().last?.error], [2, 0, null, null]);
    assert.equal(await replies(inquiry), 1);
    service.stop();
  });

  it("continues an answer whose proposal reply was lost, on the terms decided, even if the record changed since", async () => {
    const { S, asker, replies, ask, serviceFor } = await exchange();
    const timers = fakeTimers();
    const orrin = S.manifest.orgs.orrin;
    const { route, inquiry } = await ask(5000, "orrin");
    const service = serviceFor("orrin", faulty(S.as(orrin.agentId), [{ method: "proposeAction", mode: "lost", times: 1 }]), timers).start();
    assert.match((await service.wake()).outcomes[0].detail, /reply to proposeAction was lost/);
    const [proposed] = await S.k.owner("select id, payload from kernel.actions where in_reply_to = $1", [inquiry]);
    assert.ok(proposed, "the kernel recorded the answer although the agent never heard back");

    // Orrin's published price changes before the retry. The answer already decided is continued,
    // not proposed again with new terms (which the kernel would refuse as a different request).
    const steward = kernelClient(localSupabase(S.k, user(S.manifest.personas.steward)));
    const entity = (await S.as(orrin.agentId).readWorld(S.manifest.world)).find((e) => e.entity_id === orrin.entityId)!;
    await steward.upsertEntity({
      entityId: orrin.entityId,
      kind: "organization",
      scope: S.manifest.world,
      title: entity.title,
      summary: entity.summary,
      attributes: { ...entity.attributes, unit_price_usd: 15900 },
      visibility: "public",
      importance: entity.importance,
    });
    await timers.advance(1_000);
    await service.idle();
    const retried = service.status().last!;
    assert.deepEqual([retried.error, retried.outcomes.map((o) => o.state)], [null, ["answered"]]);
    const all = await S.k.owner("select id, payload, (select status from kernel.action_transitions t where t.action_id = a.id order by t.created_at desc limit 1) as status from kernel.actions a where in_reply_to = $1", [inquiry]);
    assert.deepEqual(all.map((a) => [a.id, a.status, (a.payload as { unit_price_usd: number }).unit_price_usd]), [[proposed.id, "completed", 16900]]);
    assert.equal(await replies(inquiry), 1);
    assert.equal((await executeRoute(await S.executor(asker), route))[0].status, "completed");
    service.stop();
  });

  it("backs off while the kernel is unreachable (an unreachable inbox is not an empty one) and recovers", async () => {
    const { S, halden, replies, ask, serviceFor } = await exchange();
    const timers = fakeTimers();
    const { inquiry } = await ask();
    const service = serviceFor("halden", faulty(S.as(halden.agentId), [{ method: "inbox", mode: "down", times: 3 }]), timers, { backoff: { baseMs: 1_000, maxMs: 3_000 } }).start();
    const delays: number[] = [];
    let report = await service.wake();
    while (report.error) {
      assert.match(report.error, /unavailable: fetch failed \(inbox\)/);
      assert.deepEqual(report.outcomes, [], "a failed pass claims nothing about the inquiries");
      delays.push(...timers.delays());
      await timers.advance(timers.delays()[0]);
      await service.idle();
      report = service.status().last!;
    }
    assert.deepEqual(delays, [1_000, 2_000, 3_000], "exponential, capped");
    assert.deepEqual(report.outcomes.map((o) => o.state), ["answered"]);
    assert.deepEqual([service.status().failures, service.status().nextRetryAt], [0, null]);
    assert.equal(await replies(inquiry), 1);
    service.stop();
  });

  it("spends a bounded retry budget, then holds the inquiry as needing reconciliation for review", async () => {
    const { S, halden, replies, events, ask, serviceFor } = await exchange();
    const timers = fakeTimers();
    const { inquiry } = await ask();
    const log: { kind: string; inquiry?: string }[] = [];
    // Every proposal fails before reaching the kernel, more times than the budget allows.
    const service = serviceFor("halden", faulty(S.as(halden.agentId), [{ method: "proposeAction", mode: "down", times: 10 }]), timers, {
      backoff: { baseMs: 1_000, maxMs: 60_000, maxAttempts: 3 },
      log: (e) => log.push({ kind: e.kind, inquiry: e.inquiry }),
    }).start();
    const states: string[] = [];
    let report = await service.wake();
    states.push(report.outcomes[0].state);
    while (timers.delays().length) {
      await timers.advance(timers.delays()[0]);
      await service.idle();
      report = service.status().last!;
      states.push(report.outcomes[0]?.state ?? "none");
    }
    assert.deepEqual(states, ["unknown", "unknown", "needs_reconciliation"], "three attempts, then held");
    const [held] = service.status().review;
    assert.deepEqual([held.inquiry, held.attempts], [`action:${inquiry}`, 3]);
    assert.match(held.detail, /unavailable: fetch failed \(proposeAction\)/);
    assert.deepEqual(log.filter((e) => e.kind === "needs_review").map((e) => e.inquiry), [`action:${inquiry}`], "surfaced once");
    assert.deepEqual([service.status().nextRetryAt, timers.delays()], [null, []], "no stuck retries");

    // Held means held: a later wake (another delivery) leaves it alone and writes nothing for it.
    const before = await events();
    assert.deepEqual((await service.wake()).outcomes, []);
    assert.equal(await events(), before);

    // The operator releases it (the kernel is reachable again): a fresh budget, answered once.
    // (A fresh session stands for the reachable kernel; held state lives in the service.)
    service.stop();
    const healthy = serviceFor("halden", S.as(halden.agentId), timers);
    assert.deepEqual((await healthy.release(`action:${inquiry}`)).outcomes.map((o) => o.state), ["answered"]);
    assert.equal(await replies(inquiry), 1);
  });

  it("stalls instead of polling a kernel that keeps failing, and recovers on the next wake", async () => {
    const { S, halden, replies, ask, serviceFor } = await exchange();
    const timers = fakeTimers();
    const { inquiry } = await ask();
    const service = serviceFor("halden", faulty(S.as(halden.agentId), [{ method: "inbox", mode: "down", times: 3 }]), timers, {
      backoff: { baseMs: 1_000, maxMs: 60_000, maxAttempts: 3 },
      safetyNetMs: 30_000,
    }).start();
    await service.wake();
    while (!service.status().stalled) {
      await timers.advance(timers.delays()[0]);
      await service.idle();
    }
    const { stalled } = service.status();
    assert.deepEqual([stalled!.passes, timers.delays()], [3, []], "no retry timer and no safety net while stalled");
    assert.match(stalled!.detail, /unavailable: fetch failed \(inbox\)/);
    assert.equal(await replies(inquiry), 0);

    // A wake (a delivery, or the operator) is new information: the kernel answers again.
    assert.deepEqual((await service.wake()).outcomes.map((o) => o.state), ["answered"]);
    assert.equal(service.status().stalled, null);
    assert.deepEqual(timers.delays(), [30_000], "back to the safety net");
    assert.equal(await replies(inquiry), 1);
    service.stop();
  });

  it("records a refusal without retrying it, and answers once authority is restored", async () => {
    const { S, halden, replies, events, ask, serviceFor } = await exchange();
    const timers = fakeTimers();
    const { inquiry } = await ask();
    const agent = S.as(halden.agentId);
    const steward = kernelClient(localSupabase(S.k, user(S.manifest.personas.steward)));
    const stewardId = (await steward.whoami()).actor_id;
    const grant = (await agent.myGrants()).find((g) => g.capability === "message.send" && g.scope === S.manifest.world && g.issued_by === stewardId)!;
    await steward.revokeGrant(grant.id, "pilot: speaking rights suspended");

    const service = serviceFor("halden", agent, timers).start();
    const before = await events();
    const refused = await service.wake();
    assert.deepEqual(refused.outcomes.map((o) => [o.inquiry, o.state]), [[`action:${inquiry}`, "refused"]]);
    assert.match(refused.outcomes[0].detail, /message\.send/);
    assert.deepEqual([service.status().failures, service.status().nextRetryAt, timers.delays()], [0, null, []], "no retry timer for a refusal");
    assert.equal(await events(), before, "the refusal wrote nothing: no selection, no attempt");
    assert.equal(await replies(inquiry), 0);

    await steward.issueGrant({ grantee: halden.agentId, capability: "message.send", scope: S.manifest.world });
    assert.deepEqual((await service.wake()).outcomes.map((o) => o.state), ["answered"]);
    assert.equal(await replies(inquiry), 1);
    service.stop();
  });
});
