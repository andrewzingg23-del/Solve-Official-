// The narrow pilot, rehearsed on Arcadia through the same engine the World uses: a person
// explicitly grants their AI companion task-scoped supplier-contact authority, the companion asks a
// supplier, the supplier's answer service replies, and the evidenced result persists. No purchasing
// authority exists at any point, and the authority ends with the task. On the live store the same
// path runs once kernel v4 is applied and sign-in is restored.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadWorld } from "../../lib/causal/world";
import { kernelClient } from "../../lib/kernel/client";
import { localSupabase, service, user } from "../../lib/kernel/local";
import { avatarAgent, WorldEngine } from "../../lib/world/engine";
import { buildArcadia } from "../support/arcadia";

describe("the narrow pilot", () => {
  it("grants task-scoped supplier contact, gets an evidenced answer that persists, and never grants purchasing", async () => {
    const { k, manifest } = await buildArcadia();
    const you = kernelClient(localSupabase(k, user(manifest.personas.you)));
    const as = (id: string) => kernelClient(localSupabase(k, service), { actAs: id });
    const engine = new WorldEngine({ manifest, you, as });
    await engine.createAvatar({ type: "ai_companion", name: "Nova", relationship: "assist", seed: {}, representation: "abstract" });
    let model = await engine.load();
    const nova = avatarAgent(model)!.agent_id;
    const { scope } = await engine.buildVenture("a car company with the least upfront capital", true, model);
    model = await engine.load();
    const halden = `entity:${manifest.orgs.halden.entityId}`;
    const novaKernel = as(nova);
    const decision = async (capability: string, taskRef?: string, amount?: string) =>
      (await novaKernel.authorize({ capability, scope, taskRef, amount, asset: amount ? "DEV_USDC" : undefined })).decision;

    // Before consent: Nova may not contact anyone; its attempt is refused and recorded.
    assert.equal(engine.contactTask(model), null);
    const refused = await engine.ask(halden, 10000, model, nova);
    assert.equal(refused.outcome?.status, "denied");

    // The person's explicit consent: a supplier-contact task, and contact authority leased for that
    // task only. Both are the person's own recorded acts.
    const granted = await engine.allowContact(model, nova);
    assert.equal(granted?.status, "completed");
    model = await engine.load();
    const task = engine.contactTask(model)!;
    assert.deepEqual([task.task_id, task.required_capability, task.inputs.kind, task.created_by], [granted!.taskId, "message.send", "supplier.contact", manifest.you.actorId]);
    const [lease] = await k.owner("select task_ref, max_amount, counterparty_ref from kernel.grant_limits where grant_id = $1", [granted!.leaseId]);
    assert.deepEqual(lease, { task_ref: `task:${task.task_id}`, max_amount: null, counterparty_ref: null });
    assert.equal((await engine.allowContact(model, nova))?.leaseId, granted!.leaseId, "granting again changes nothing");

    // What Nova may do now: contact suppliers for this task, and nothing else.
    assert.equal(await decision("message.send", `task:${task.task_id}`), "ALLOW");
    assert.equal(await decision("message.send"), "DENY", "not outside the task");
    assert.equal(await decision("commitment.make", `task:${task.task_id}`), "DENY", "no commitments");
    assert.equal(await decision("payment.send", `task:${task.task_id}`, "1"), "DENY", "no purchasing");
    assert.equal((await novaKernel.authorize({ capability: "message.send", scope: manifest.world })).decision, "DENY", "not in other Worlds");

    // Nova asks; Halden's answer service replies; the quote is recorded from the evidence.
    const asked = await engine.ask(halden, 10000, model, nova);
    assert.equal(asked.outcome?.status, "completed");
    const inquiry = await novaKernel.readAction(asked.outcome!.actionId!);
    assert.deepEqual([inquiry.proposer_id, inquiry.on_behalf_of, inquiry.task_ref, inquiry.decision, inquiry.status], [nova, manifest.you.actorId, `task:${task.task_id}`, "ALLOW", "completed"]);
    assert.equal(asked.quote?.status, "reconciled");
    assert.equal(asked.quote?.value?.capacity_per_year, 12000);
    const evidence = await k.owner(
      "select ev.basis from kernel.evidence ev join kernel.events e on e.id = ev.event_id where e.type = 'kernel.action.completed' and e.payload ->> 'action_id' = $1",
      [inquiry.action_id],
    );
    assert.deepEqual(evidence.map((e) => e.basis), ["artifact"], "the completion carries the reply as evidence");

    // It persists: a fresh engine (a reload) sees the same quote with the same provenance.
    const reloaded = new WorldEngine({ manifest, you: kernelClient(localSupabase(k, user(manifest.personas.you))), as });
    const quote = await reloaded.quote(halden, model.venture!.worldRef);
    assert.deepEqual([quote?.status, quote?.provenance.actions, quote?.value?.provider], [asked.quote?.status, asked.quote?.provenance.actions, "arcadia.agent-messaging.inquiry"]);

    // Nova reports the task done with the quote as its result; the authority ends with the task.
    for (const status of ["claimed", "in_progress"] as const) await novaKernel.transitionTask({ taskId: task.task_id, status });
    await novaKernel.transitionTask({
      taskId: task.task_id,
      status: "completed",
      result: { quote: quote?.value ?? null, inquiry: `action:${inquiry.action_id}` },
      evidence: [{ basis: "artifact", content_hash: `sha256:${"ab".repeat(32)}`, description: "Halden's reply, recorded as the quote" }],
    });
    assert.equal(await decision("message.send", `task:${task.task_id}`), "DENY", "authority limited to a task ends with it");
    assert.equal(engine.contactTask(await engine.load()), null, "no open contact task remains");
    assert.equal((await loadWorld(you, manifest.you.actorId)).facts.find((f) => f.subject === halden && f.predicate === "offers:quoted")?.status, "reconciled", "the result outlives the authority");
    assert.equal((await kernelClient(localSupabase(k, service)).verifyChain()).ok, true);
  });
});
