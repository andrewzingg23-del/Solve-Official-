// An organization's agent runs the loop on its own authority: context from what its principal
// delegated, a goal for its organization, a route it can run alone, consequences in the market
// World, and refusal of everything it was never given. No human clicks; no code path differs
// from the one a person uses.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildContext } from "../../lib/causal/context";
import { executeRoute, recordRoute } from "../../lib/causal/pipeline";
import { arcadiaProviders } from "../../lib/causal/providers";
import { verifyGoal } from "../../lib/causal/transitions";
import { loadWorld } from "../../lib/causal/world";
import { KernelError, kernelClient } from "../../lib/kernel/client";
import { localSupabase, service, user } from "../../lib/kernel/local";
import { buildArcadia } from "../support/arcadia";

describe("an organization's agent", () => {
  it("pursues its organization's goal end to end on delegated authority, and is refused the rest", async () => {
    const { k, manifest } = await buildArcadia();
    const as = (id: string) => kernelClient(localSupabase(k, service), { actAs: id });
    const orgs = Object.values(manifest.orgs);
    const orrin = manifest.orgs.orrin;
    const orgRef = `entity:${orrin.entityId}`;
    const agent = as(orrin.agentId);
    const owner = kernelClient(localSupabase(k, user("sandbox:owner-orrin")));
    const kernelFor = (id: string) => (id === orrin.ownerId ? owner : as(id));
    const providers = arcadiaProviders({
      agentFor: (ref) => orgs.find((o) => `entity:${o.entityId}` === ref)?.agentId ?? null,
      claimEventFor: (ref) => orgs.find((o) => `entity:${o.entityId}` === ref)?.claimEventId ?? null,
      as,
      replyScope: manifest.world,
      verifierId: manifest.steward.verifierId,
    });
    const goal = verifyGoal({ orgRef, scope: manifest.world, title: "Orrin Assembly" });

    // Organization → agent delegation is recorded by the owner, not assumed.
    const delegated = await k.owner(
      "select count(*)::int as n from kernel.events where type = 'kernel.grant.issued' and actor_id = $1 and payload->>'grantee_id' = $2",
      [orrin.ownerId, orrin.agentId],
    );
    assert.ok(Number(delegated[0].n) >= 4, "reading, verification requests and planning come from the owner");

    // Context from its own authority: it sees the market and nothing else; it may read, speak and
    // request verification; it may not commit, pay, or delegate.
    const ctx = await buildContext({ kernel: agent, actorId: orrin.agentId, goal, kernelFor, providers });
    assert.deepEqual([ctx.who.kind, ctx.who.role, ctx.who.principalId], ["agent", "organization_agent", orrin.ownerId]);
    assert.deepEqual(ctx.sees.scopes, [manifest.world], "authorization before visibility: no venture Worlds, no private records");
    assert.deepEqual(ctx.can.map((c) => c.capability).sort(), ["kernel.read", "message.send", "verification.request"]);
    assert.deepEqual(ctx.cannot.map((c) => c.capability).sort(), ["commitment.make", "kernel.grant.issue", "payment.send", "world.relation.write"]);
    assert.equal(ctx.beliefs.find((f) => f.subject === orgRef && f.predicate === "claims")?.status, "asserted");

    // Its Horizon: one step it performs itself, allowed.
    const route = ctx.horizon!.routes[0];
    assert.deepEqual(route.steps.map((s) => [s.transition, s.actorId === orrin.agentId, s.authority.decision]), [["claim.verify", true, "ALLOW"]]);
    assert.equal(route.needsHuman, false);

    // It selects and runs the route alone. The selection is its own record, in its own scope.
    const recorded = await recordRoute(agent, route);
    const [selection] = await k.owner("select scope, actor_id, on_behalf_of from kernel.events where id = $1", [recorded.eventId]);
    assert.deepEqual(selection, { scope: `actor:${orrin.agentId}`, actor_id: orrin.agentId, on_behalf_of: orrin.ownerId });
    const run = await executeRoute({ kernelFor, providers, world: ctx.world, worldFor: (id) => loadWorld(kernelFor(id), id) }, recorded, { only: orrin.agentId });
    assert.deepEqual(run.map((o) => o.status), ["completed"]);
    assert.equal(run[0].provider, "arcadia.kestrel.verification");

    // The consequence is canonical, visible to everyone who may read the market, and the agent's
    // next Horizon starts from it.
    const you = kernelClient(localSupabase(k, user(manifest.personas.you)));
    const seenByYou = await loadWorld(you, manifest.you.actorId);
    assert.equal(seenByYou.facts.find((f) => f.subject === orgRef && f.predicate === "claims")?.status, "verified");
    const after = await buildContext({ kernel: agent, actorId: orrin.agentId, goal, kernelFor, providers });
    assert.equal(after.horizon!.satisfied?.status, "verified");
    const action = await agent.readAction(run[0].actionId!);
    assert.deepEqual([action.proposer_id, action.on_behalf_of, action.status], [orrin.agentId, orrin.ownerId, "completed"], "provenance: the agent acted, for its principal");

    // What it was never given, it cannot take: no sub-agents, no commitments, no grants to itself.
    const forbidden = (error: unknown) => error instanceof KernelError && error.name === "forbidden";
    await assert.rejects(agent.spawnAgent({ label: "Scout", role: "specialist", serves: manifest.world }), forbidden);
    await assert.rejects(agent.issueGrant({ grantee: orrin.agentId, capability: "commitment.make", scope: manifest.world }), forbidden);
    assert.equal((await agent.authorize({ capability: "commitment.make", scope: manifest.world })).decision, "DENY");
    assert.equal((await kernelClient(localSupabase(k, service)).verifyChain()).ok, true);
  });
});
