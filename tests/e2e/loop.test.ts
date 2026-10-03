// The first complete SOLVE loop, on the real kernel and Arcadia:
//
//   World → intent → Horizon → actor context → route → authority → action → evidence →
//   reconciliation → consequence → canonical World → new Horizon
//
// No step is mocked: the kernel decides authority, providers produce evidence (Arcadia's
// counterparty agents running locally), settlement applies declared consequences atomically, and
// the next Horizon is computed from the changed World.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { kernelClient, type Kernel } from "../../lib/kernel/client";
import { localSupabase, service, user } from "../../lib/kernel/local";
import { buildContext } from "../../lib/causal/context";
import { computeHorizon, RANKING_V1, type RankingPolicy } from "../../lib/causal/horizon";
import { executeRoute, executeStep, loadRoute, recordRoute, ROUTE_EVENT, type Executor } from "../../lib/causal/pipeline";
import { arcadiaProviders, arcadiaInquiry, Providers, type Provider } from "../../lib/causal/providers";
import { routerPayment } from "../../lib/causal/money";
import { depositGoal, STANDARD, supplyGoal, verifyGoal, type Transition } from "../../lib/causal/transitions";
import { loadWorld } from "../../lib/causal/world";
import { WorldEngine, avatarAgent } from "../../lib/world/engine";
import { buildSpatialView } from "../../lib/world/spatial";
import { buildArcadia } from "../support/arcadia";

const WRITES = /^(propose|approve|challenge|cancel|enact|begin|settle|record|attach|issue|revoke|create|transition|upsert|relate|end|claim|spawn|set|link|define|register|post|select)/;

// A client that remembers every method called on it.
function recording(k: Kernel, calls: string[]): Kernel {
  return new Proxy(k, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? (...args: unknown[]) => (calls.push(String(prop)), value.apply(target, args)) : value;
    },
  });
}

async function loop() {
  const { k, manifest, treasury, market } = await buildArcadia();
  const you = kernelClient(localSupabase(k, user(manifest.personas.you)));
  const as = (id: string) => kernelClient(localSupabase(k, service), { actAs: id });
  const engine = new WorldEngine({ manifest, you, as });
  await engine.createAvatar({ type: "ai_companion", name: "Nova", relationship: "assist", seed: {}, representation: "abstract" });
  let model = await engine.load();
  const agentId = avatarAgent(model)!.agent_id;
  const { scope } = await engine.buildVenture("a car company with the least upfront capital", true, model);
  model = await engine.load();
  const worldRef = model.venture!.worldRef;
  const orgs = manifest.orgs;
  const org = (key: string) => `entity:${orgs[key].entityId}`;
  const counterparts = {
    agentFor: (ref: string) => Object.values(orgs).find((o) => `entity:${o.entityId}` === ref)?.agentId ?? null,
    claimEventFor: (ref: string) => Object.values(orgs).find((o) => `entity:${o.entityId}` === ref)?.claimEventId ?? null,
    as,
    replyScope: manifest.world,
    verifierId: manifest.steward.verifierId,
  };
  const providers = arcadiaProviders(counterparts);
  const youId = manifest.you.actorId;
  const kernelFor = (id: string) => (id === youId ? you : as(id));
  const goal = supplyGoal({ worldRef, scope, capability: "contract_manufacturing", capabilityRef: `entity:${manifest.capabilities.contract_manufacturing}`, quantity: 10000, what: "vehicles" });
  const horizonFor = async (actorId: string, policy?: RankingPolicy) =>
    computeHorizon({ world: await loadWorld(kernelFor(actorId), actorId), actorId, principalId: actorId === youId ? null : youId, goal, kernelFor, providers, policy });
  const executor = async (actorId: string, p = providers): Promise<Executor> => ({ kernelFor, providers: p, world: await loadWorld(kernelFor(actorId), actorId), worldFor: (id) => loadWorld(kernelFor(id), id) });
  return { k, manifest, you, as, engine, agentId, scope, worldRef, org, counterparts, providers, youId, kernelFor, goal, horizonFor, executor, treasury, market };
}

const count = async (k: Awaited<ReturnType<typeof loop>>["k"], sql: string, params: unknown[] = []) => Number((await k.owner(sql, params))[0].n);

describe("the SOLVE loop", () => {
  it("perceives, plans, acts within authority, reconciles evidence, records consequence and re-plans", async () => {
    const L = await loop();

    // Context is authority-scoped: the companion sees the venture and the market because it was
    // granted reads, can record into the World, and cannot contact or commit.
    const ctx = await buildContext({ kernel: L.as(L.agentId), actorId: L.agentId, goal: L.goal, kernelFor: L.kernelFor, providers: L.providers });
    assert.equal(ctx.who.kind, "agent");
    assert.equal(ctx.who.principalId, L.youId);
    assert.equal(ctx.where.world, L.worldRef);
    assert.deepEqual(ctx.cannot.map((c) => c.capability).sort(), ["commitment.make", "kernel.grant.issue", "message.send", "payment.send", "verification.request"]);
    assert.ok(ctx.can.some((c) => c.capability === "world.relation.write"));
    assert.ok(!ctx.world.entities.has(`entity:${L.manifest.privateEntityId}`), "authorization before visibility");
    assert.equal(ctx.beliefs.find((f) => f.subject === L.org("halden") && f.predicate === "claims")?.status, "verified");

    // Horizon: reachable futures from this World, with who acts and what the kernel decides.
    const h = ctx.horizon!;
    assert.equal(h.satisfied, null);
    assert.deepEqual(h.routes.map((r) => r.orgRef), [L.org("halden")]);
    const excluded = Object.fromEntries(h.excluded.map((e) => [e.orgRef, e.reasons.join("; ")]));
    assert.match(excluded[L.org("orrin")], /6,000 a year, below 10,000/);
    assert.match(excluded[L.org("cobalt")], /disputed: Site audit found one line rated near 4,000/);
    const route = h.routes[0];
    assert.deepEqual(route.steps.map((s) => [s.transition, s.actorId === L.youId ? "you" : "companion", s.authority.decision]), [
      ["authority.delegate", "you", "ALLOW"],
      ["supplier.inquire", "companion", "ALLOW"],
      ["supplier.accept", "you", "ALLOW"],
    ]);
    assert.ok(route.executable && route.needsHuman);
    assert.equal((await L.horizonFor(L.agentId)).routes[0].id, route.id, "the same World and goal give the same route");
    assert.deepEqual(h.next.map((s) => s.transition), ["authority.delegate"]);

    // The human selects the route; the companion, acting alone, stops at its principal's step.
    const recorded = await recordRoute(L.you, route);
    const alone = await executeRoute(await L.executor(L.agentId), recorded, { only: L.agentId });
    assert.deepEqual(alone.map((o) => o.status), ["awaiting_authority"]);

    // You delegate contact; the companion inquires autonomously; evidence settles the quote and
    // its consequence lands in the World. It then stops: committing is not its to do.
    const first = await executeStep(await L.executor(L.youId), recorded, 0);
    assert.equal(first.status, "completed");
    const companionRun = await executeRoute(await L.executor(L.agentId), recorded, { only: L.agentId });
    assert.deepEqual(companionRun.map((o) => o.status), ["completed", "completed", "awaiting_authority"]);
    assert.equal(companionRun[1].provider, "arcadia.agent-messaging.inquiry");

    let world = await loadWorld(L.you, L.youId);
    const quote = world.facts.find((f) => f.predicate === "offers:quoted" && f.subject === L.org("halden"));
    assert.equal(quote?.status, "reconciled", "the quote is canonical because evidence settled the action");
    assert.deepEqual([quote?.value?.capacity_per_year, quote?.value?.unit_price_usd, quote?.value?.can_fulfill], [12000, 18500, true]);
    const inquiry = await L.you.readAction(companionRun[1].actionId!);
    assert.equal(inquiry.status, "completed");
    assert.equal(inquiry.proposer_id, L.agentId);
    const [settled] = await L.k.owner(
      "select e.id from kernel.events e where e.type = 'kernel.action.completed' and e.payload->>'action_id' = $1",
      [inquiry.action_id],
    );
    const evidence = await L.you.readEvidence(settled.id as string);
    assert.match(evidence[0].description, /Reply from Halden Works's agent/);
    const [rel] = await L.k.owner("select correlation_id from kernel.events where type = 'kernel.relation.created' and payload->'request'->'attributes'->>'status' = 'quoted'");
    assert.equal(rel.correlation_id, inquiry.action_id, "the consequence names the action that caused it");

    // The changed World changes the Horizon: with a recorded quote, one step remains.
    const replanned = await L.horizonFor(L.youId);
    assert.deepEqual(replanned.routes[0].steps.map((s) => s.transition), ["supplier.accept"]);

    // You accept; the agreement becomes canonical; the goal is satisfied.
    const finish = await executeRoute(await L.executor(L.youId), recorded);
    assert.deepEqual(finish.map((o) => o.status), ["completed", "completed", "completed"]);
    world = await loadWorld(L.you, L.youId);
    const agreed = world.facts.find((f) => f.predicate === "supplies:agreed" && f.subject === L.org("halden") && f.object === L.worldRef);
    assert.equal(agreed?.status, "reconciled");
    assert.deepEqual([agreed?.value?.quantity, agreed?.value?.unit_price_usd], [10000, 18500]);
    const after = await L.horizonFor(L.agentId);
    assert.equal(after.satisfied?.subject, L.org("halden"), "the new Horizon starts from the new World");
    assert.deepEqual(after.routes, []);

    // One canonical identity across layers: Horizon binding, consequence, World and Earth.
    const spatial = buildSpatialView({ nodes: (await L.engine.load()).nodes, edges: (await L.engine.load()).edges, events: [] }, { selected: [L.org("halden")], highlights: [], routes: [], fields: [], effectsAfterSeq: Number.MAX_SAFE_INTEGER });
    assert.equal(route.steps[2].binding.org, agreed!.subject);
    assert.ok(world.entities.has(agreed!.subject));
    assert.equal(spatial.markers.find((m) => m.ref === agreed!.subject)?.state, "committed");

    // Duplicate execution changes nothing.
    const before = await count(L.k, "select count(*) as n from kernel.events");
    const again = await executeRoute(await L.executor(L.youId), recorded);
    assert.deepEqual(again.map((o) => o.status), ["completed", "completed", "completed"]);
    assert.equal(await count(L.k, "select count(*) as n from kernel.events"), before, "no new history from a repeat");
    assert.equal(await count(L.k, "select count(*) as n from kernel.relations where kind = 'supplies' and attributes->>'status' = 'agreed'"), 1);

    // Reload: new sessions on the same database find the recorded route and its finished state.
    const reloaded = kernelClient(localSupabase(L.k, user(L.manifest.personas.you)));
    const found = await loadRoute(reloaded, L.goal);
    assert.equal(found?.eventId, recorded.eventId);
    const resumed = await executeRoute({ kernelFor: (id) => (id === L.youId ? reloaded : L.as(id)), providers: L.providers, world: await loadWorld(reloaded, L.youId) }, found!);
    assert.deepEqual(resumed.map((o) => o.status), ["completed", "completed", "completed"]);
    assert.equal((await kernelClient(localSupabase(L.k, service)).verifyChain()).ok, true);
  });

  it("refuses unauthorized actors, records the refusal, and changes nothing", async () => {
    const L = await loop();
    const route = (await L.horizonFor(L.youId)).routes[0];
    const recorded = await recordRoute(L.you, route);
    await executeStep(await L.executor(L.youId), recorded, 0);

    // The companion takes the human's commitment step for itself: the kernel refuses and says so.
    const stolen = { ...recorded, steps: recorded.steps.map((s, i) => (i === 1 ? { ...s, actorId: L.agentId } : s)) };
    const refused = await executeStep(await L.executor(L.agentId), stolen, 1);
    assert.equal(refused.status, "denied");
    assert.match(refused.detail, /commitment.make/);
    // Bob, who has nothing to do with this World, cannot even declare consequences in it.
    const bob = L.manifest.bob.actorId;
    const intruder = { ...recorded, steps: recorded.steps.map((s, i) => (i === 1 ? { ...s, actorId: bob } : s)) };
    const bobKernel = kernelClient(localSupabase(L.k, user(L.manifest.personas.bob)));
    const asBob = (id: string) => (id === bob ? bobKernel : L.kernelFor(id));
    const blocked = await executeStep({ ...(await L.executor(L.youId)), kernelFor: asBob, worldFor: (id) => loadWorld(asBob(id), id) }, intruder, 1);
    assert.equal(blocked.status, "denied");
    assert.equal(await count(L.k, "select count(*) as n from kernel.relations where kind = 'supplies' and to_ref = $1", [L.worldRef]), 0, "no consequence from a refusal");
    const rejected = await count(L.k, "select count(*) as n from kernel.action_transitions where status = 'rejected'");
    assert.ok(rejected >= 1, "the refusal itself is history");
  });

  it("keeps causal order, and lets a refused agent succeed once its principal delegates", async () => {
    const L = await loop();
    const route = (await L.horizonFor(L.agentId)).routes[0];
    const recorded = await recordRoute(L.you, route);
    // Accepting before asking is not a route: the step waits for the ones before it.
    const early = await executeStep(await L.executor(L.youId), recorded, 2);
    assert.equal(early.status, "blocked");
    assert.match(early.detail, /step 1 .* must complete first/);

    // Told to ask on its own, the companion attempts it with its own authority: the kernel refuses
    // and the refusal is history. Asking again records nothing new while authority is unchanged.
    const own = await computeHorizon({ world: await loadWorld(L.as(L.agentId), L.agentId), actorId: L.agentId, principalId: L.youId, goal: L.goal, kernelFor: L.kernelFor, providers: L.providers, fallback: "none" });
    assert.equal(own.routes[0].executable, false);
    const attempt = await recordRoute(L.you, own.routes[0]);
    const refused = await executeStep(await L.executor(L.agentId), attempt, 0);
    assert.equal(refused.status, "denied");
    assert.match(refused.detail, /message.send/);
    const rejections = () => count(L.k, "select count(*) as n from kernel.action_transitions where status = 'rejected'");
    const before = await rejections();
    assert.equal((await executeStep(await L.executor(L.agentId), attempt, 0)).status, "denied");
    assert.equal(await rejections(), before, "no repeated refusal while nothing changed");

    // You delegate (the planned route's first step); the same attempt now goes through, under a
    // new key, and its consequence lands once.
    assert.equal((await executeStep(await L.executor(L.youId), recorded, 0)).status, "completed");
    assert.equal((await executeStep(await L.executor(L.agentId), attempt, 0)).status, "completed");
    assert.equal(await count(L.k, "select count(*) as n from kernel.relations where kind = 'offers' and attributes->>'status' = 'quoted'"), 1);
  });

  it("survives a crash between evidence and settlement, and concurrent runs, with one consequence", async () => {
    const L = await loop();
    const route = (await L.horizonFor(L.youId)).routes[0];
    const recorded = await recordRoute(L.you, route);
    // The provider gets its evidence, then the process dies before settling.
    const real = arcadiaInquiry(L.counterparts);
    let crashes = 1;
    const fragile: Provider = { ...real, async perform(ctx) {
      const response = await real.perform(ctx);
      if (crashes-- > 0) throw new Error("process died after the reply arrived");
      return response;
    } };
    const crashing = new Providers([fragile, L.providers.resolve("counterparty.acceptance")!]);
    await assert.rejects(executeRoute(await L.executor(L.youId, crashing), recorded), /process died/);
    const open = await L.you.readActions(L.scope);
    assert.ok(open.some((a) => a.kind === "supplier.inquire" && a.status === "enacting"), "attempted, not yet true");
    assert.equal(await count(L.k, "select count(*) as n from kernel.relations where kind = 'offers' and attributes->>'status' = 'quoted'"), 0);

    // Two runs at once after the restart: one inquiry message, one quote, one agreement.
    const outcomes = await Promise.all([executeRoute(await L.executor(L.youId, crashing), recorded), executeRoute(await L.executor(L.youId, crashing), recorded)]);
    for (const o of outcomes) assert.equal(o.at(-1)?.status, "completed");
    assert.equal(await count(L.k, "select count(*) as n from kernel.relations where kind = 'offers' and attributes->>'status' = 'quoted'"), 1);
    assert.equal(await count(L.k, "select count(*) as n from kernel.relations where kind = 'supplies' and to_ref = $1", [L.worldRef]), 1);
    assert.equal(await count(L.k, "select count(*) as n from kernel.actions where payload->>'type' = 'CAPABILITY_QUERY'"), 1, "the retry never asked twice");
  });

  it("swaps providers without changing routes or history, and keeps learning apart from truth", async () => {
    const L = await loop();
    const h1 = await L.horizonFor(L.youId);
    const portal: Provider = {
      id: "supplier-portal.inquiry",
      capability: "counterparty.inquiry",
      async perform() {
        return {
          provider: "supplier-portal.inquiry",
          status: "succeeded",
          result: { capacity_per_year: 12000, lead_time_days: 210, unit_price_usd: 18500, minimum_order: 2000, can_fulfill: true, provider: "supplier-portal.inquiry" },
          evidence: [{ basis: "artifact", content_hash: `sha256:${"ab".repeat(32)}`, description: "Supplier portal quote export" }],
          detail: "portal quote",
        };
      },
    };
    const swapped = L.providers.with(portal);
    const h2 = await computeHorizon({ world: await loadWorld(L.you, L.youId), actorId: L.youId, principalId: null, goal: L.goal, kernelFor: L.kernelFor, providers: swapped });
    assert.equal(h2.routes[0].id, h1.routes[0].id, "routes name capabilities, not providers");
    const recorded = await recordRoute(L.you, h2.routes[0]);
    const run = await executeRoute(await L.executor(L.youId, swapped), recorded);
    assert.equal(run[0].provider, "supplier-portal.inquiry");
    const [quote] = (await L.you.readRelations(L.scope)).filter((r) => r.kind === "offers");
    assert.equal(quote.attributes.provider, "supplier-portal.inquiry", "history names who performed it");

    // Learning boundary: a new ranking policy is a new interpretation, never a rewrite of history.
    const history = await L.k.owner("select id, hash from kernel.events order by seq");
    const cheapest: RankingPolicy = { id: "horizon-rank/2-cheapest", score: (r) => -Number((r.steps.at(-1)?.payload.terms as { unit_price_usd?: number })?.unit_price_usd ?? 0) };
    const reranked = await L.horizonFor(L.youId, cheapest);
    assert.equal(reranked.policy, "horizon-rank/2-cheapest");
    assert.deepEqual(await L.k.owner("select id, hash from kernel.events order by seq"), history, "planning wrote nothing");
    const selections = (await L.you.readEvents(`actor:${L.youId}`, { limit: 500 })).filter((e) => e.type === ROUTE_EVENT);
    assert.deepEqual(selections.map((e) => e.payload.policy), [RANKING_V1.id], "the selection keeps the policy it was made under");
  });

  it("reaches a second goal kind, verification, through the same registry and pipeline", async () => {
    const L = await loop();
    const youWorld = () => loadWorld(L.you, L.youId);
    const plan = async (goal: ReturnType<typeof supplyGoal>) => computeHorizon({ world: await youWorld(), actorId: L.youId, principalId: null, goal, kernelFor: L.kernelFor, providers: L.providers });
    const orrinVerified = verifyGoal({ orgRef: L.org("orrin"), scope: L.manifest.world, title: "Orrin Assembly" });
    const before = await plan(orrinVerified);
    assert.deepEqual(before.routes.map((r) => r.steps.map((s) => s.transition)), [["claim.verify"]], "a verification goal is one step");

    // At 5,000 vehicles Orrin is a route, through verification; Cobalt still is not.
    const small = supplyGoal({ worldRef: L.worldRef, scope: L.scope, capability: "contract_manufacturing", capabilityRef: `entity:${L.manifest.capabilities.contract_manufacturing}`, quantity: 5000, what: "vehicles" });
    const h = await plan(small);
    const byOrg = Object.fromEntries(h.routes.map((r) => [r.orgRef, r.steps.map((st) => st.transition)]));
    assert.deepEqual(byOrg[L.org("halden")], ["supplier.inquire", "supplier.accept"]);
    assert.deepEqual(byOrg[L.org("orrin")], ["supplier.inquire", "claim.verify", "supplier.accept"]);
    assert.match(h.excluded.find((e) => e.orgRef === L.org("cobalt"))!.reasons.join(), /disputed/);
    const verifyStep = h.routes.find((r) => r.orgRef === L.org("orrin"))!.steps[1];
    assert.equal(verifyStep.scope, L.manifest.world, "verification happens where the claim lives");
    assert.equal(verifyStep.authority.decision, "ALLOW");
    assert.ok(verifyStep.preconditions.every((c) => c.met) && !h.routes.find((r) => r.orgRef === L.org("orrin"))!.steps[2].preconditions[1].met, "accept's verified-claim precondition comes from the step before");

    const recorded = await recordRoute(L.you, h.routes.find((r) => r.orgRef === L.org("orrin"))!);
    const run = await executeRoute(await L.executor(L.youId), recorded);
    assert.deepEqual(run.map((o) => o.status), ["completed", "completed", "completed"]);
    assert.equal(run[1].provider, "arcadia.kestrel.verification");
    const world = await youWorld();
    assert.equal(world.facts.find((f) => f.subject === L.org("orrin") && f.predicate === "claims")?.status, "verified", "asserted → verified by evidence, not by assertion");
    assert.equal(world.facts.find((f) => f.predicate === "supplies:agreed" && f.subject === L.org("orrin"))?.status, "reconciled");
    const attached = await L.you.readEvidence(L.manifest.orgs.orrin.claimEventId!);
    assert.ok(attached.some((e) => e.basis === "externally_verified"), "the verifier's evidence sits on the claim itself");
    assert.equal((await plan(orrinVerified)).satisfied?.status, "verified");
    const cobalt = await plan(verifyGoal({ orgRef: L.org("cobalt"), scope: L.manifest.world, title: "Cobalt Ridge Motors" }));
    assert.deepEqual(cobalt.routes, []);
    assert.match(cobalt.excluded[0].reasons.join(), /disputed/);
  });

  it("re-checks guards at enactment: a route recorded before another supplier was agreed cannot agree a second", async () => {
    const L = await loop();
    const small = supplyGoal({ worldRef: L.worldRef, scope: L.scope, capability: "contract_manufacturing", capabilityRef: `entity:${L.manifest.capabilities.contract_manufacturing}`, quantity: 5000, what: "vehicles" });
    const h = await computeHorizon({ world: await loadWorld(L.you, L.youId), actorId: L.youId, principalId: null, goal: small, kernelFor: L.kernelFor, providers: L.providers });
    const halden = await recordRoute(L.you, h.routes.find((r) => r.orgRef === L.org("halden"))!);
    const orrin = await recordRoute(L.you, h.routes.find((r) => r.orgRef === L.org("orrin"))!);
    assert.deepEqual((await executeRoute(await L.executor(L.youId), halden)).map((o) => o.status), ["completed", "completed"]);
    // The stale route still asks and verifies (those guards hold), but the kernel refuses the
    // acceptance: the World already has an agreed supplier for this need, so it is not even an
    // action (a guard that lapses after proposal fails the action at enactment instead; see the
    // kernel tests).
    const stale = await executeRoute(await L.executor(L.youId), orrin);
    assert.deepEqual(stale.map((o) => o.status), ["completed", "completed", "failed"]);
    assert.match(stale[2].detail, /guard does not hold: already supplies .*"status": "agreed"/);
    assert.equal(stale[2].actionId, null, "refused before it became an action");
    assert.equal(await count(L.k, "select count(*) as n from kernel.relations where kind = 'supplies' and to_ref = $1", [L.worldRef]), 1);
    // And the Horizon now says the goal is reached, so no new route proposes it.
    assert.equal((await computeHorizon({ world: await loadWorld(L.you, L.youId), actorId: L.youId, principalId: null, goal: small, kernelFor: L.kernelFor, providers: L.providers })).satisfied?.subject, L.org("halden"));
  });

  it("lets a World extend the registry with its own transition and provider", async () => {
    const L = await loop();
    const referral: Transition = {
      id: "supplier.referral",
      kind: "supplier.referral",
      capability: "message.send",
      provider: "counterparty.referral",
      native: false,
      expectedEvidence: "The organization's terms relayed by a referral partner.",
      failures: ["the partner has no relationship with the organization"],
      requires: [
        { label: "offers the capability", pattern: { subject: "?org", predicate: "offers", object: "?capabilityRef" }, because: "its published record lists it" },
        { label: "no quote yet", pattern: { subject: "?org", predicate: "offers:quoted", object: "?world" }, present: false, because: "nothing recorded" },
      ],
      produces: [{ subject: "?org", predicate: "offers:quoted", object: "?world", value: { capability: "?capability" } }],
      scope: (b, w) => w.entities.get(b.world)?.scope ?? null,
      title: (b, w) => `Get ${w.entities.get(b.org)?.title}'s terms through a referral partner`,
      payload: () => ({}),
      consequences: (b, w) => [{ op: "relation.create", kind: "offers", from_ref: b.org, to_ref: b.world, scope: w.entities.get(b.world)!.scope, attributes: { status: "quoted", capability: b.capability, via: "referral" }, result_keys: ["capacity_per_year", "unit_price_usd", "lead_time_days", "can_fulfill", "provider"] }],
      uncertainty: () => ({ level: "medium", because: "second-hand terms" }),
    };
    const partner: Provider = {
      id: "referral-partner",
      capability: "counterparty.referral",
      perform: async () => ({
        provider: "referral-partner",
        status: "succeeded",
        result: { capacity_per_year: 12000, unit_price_usd: 18000, lead_time_days: 200, can_fulfill: true, provider: "referral-partner" },
        evidence: [{ basis: "artifact", content_hash: `sha256:${"cd".repeat(32)}`, description: "Referral partner's relayed quote" }],
        detail: "terms relayed",
      }),
    };
    const providers = L.providers.with(partner);
    const world = await loadWorld(L.you, L.youId);
    const h = await computeHorizon({ world, actorId: L.youId, principalId: null, goal: L.goal, kernelFor: L.kernelFor, providers, transitions: STANDARD.with(referral) });
    const halden = h.routes.filter((r) => r.orgRef === L.org("halden"));
    assert.deepEqual(halden.map((r) => r.steps.map((st) => st.transition)).sort(), [["supplier.inquire", "supplier.accept"], ["supplier.referral", "supplier.accept"]], "two ways to a quote, one agreement");
    const viaReferral = halden.find((r) => r.steps[0].transition === "supplier.referral")!;
    const run = await executeRoute({ kernelFor: L.kernelFor, providers, world, worldFor: (id) => loadWorld(L.kernelFor(id), id), transitions: STANDARD.with(referral) }, await recordRoute(L.you, viaReferral));
    assert.deepEqual(run.map((o) => o.status), ["completed", "completed"]);
    const quote = (await L.you.readRelations(L.scope)).find((r) => r.kind === "offers")!;
    assert.deepEqual([quote.attributes.via, quote.attributes.provider], ["referral", "referral-partner"]);
    const agreed = (await L.you.readRelations(L.scope)).find((r) => r.kind === "supplies")!;
    assert.equal(agreed.attributes.unit_price_usd, 18000, "the agreement carries the relayed terms");
  });

  it("moves money as a transition: a deposit through the router, under leases, guards and reconciliation", async () => {
    const L = await loop();
    const agreed = await recordRoute(L.you, (await L.horizonFor(L.youId)).routes[0]);
    assert.deepEqual((await executeRoute(await L.executor(L.youId), agreed)).map((o) => o.status), ["completed", "completed"]);
    const goal = depositGoal({ worldRef: L.worldRef, scope: L.scope, title: "Your car company" });
    const youWorld = () => loadWorld(L.you, L.youId);

    // Without a chain connected the route is honest about it.
    const dry = await computeHorizon({ world: await youWorld(), actorId: L.youId, principalId: null, goal, kernelFor: L.kernelFor, providers: L.providers });
    assert.deepEqual(dry.routes[0].steps.map((s) => [s.transition, s.amount, s.asset, s.authority.decision]), [["supplier.deposit", "25000000", "DEV_USDC", "ALLOW"]]);
    assert.match(dry.routes[0].blockedBy.join(), /no provider for payment.send/);

    // Budgets are authority: a companion leased $20 cannot pay $25, and the kernel says why.
    await L.you.issueLease({ grantee: L.agentId, capability: "payment.send", scope: L.scope, maxAmount: "20000000", asset: "DEV_USDC" });
    const providers = L.providers.with(routerPayment(L.treasury));
    const capped = await computeHorizon({ world: await loadWorld(L.as(L.agentId), L.agentId), actorId: L.agentId, principalId: L.youId, goal, kernelFor: L.kernelFor, providers, fallback: "none" });
    assert.equal(capped.routes[0].steps[0].authority.decision, "DENY");
    assert.match(capped.routes[0].steps[0].authority.reasons.join(), /exceeds the delegated limit/);

    // You pay. The chain reply is lost: the action waits for reconciliation; nothing is canonical
    // yet, although the money moved. The next run reconciles from the chain marker: one payment,
    // one consequence, the recipient paid exactly once.
    const [profile] = await L.k.owner("select receive_address from kernel.payment_profiles where actor_id = $1 order by version desc limit 1", [L.manifest.orgs.halden.ownerId]);
    const recipient = profile.receive_address as `${string}`;
    const before = await L.market.balance(recipient as never, "DEV_USDC");
    const route = await recordRoute(L.you, (await computeHorizon({ world: await youWorld(), actorId: L.youId, principalId: null, goal, kernelFor: L.kernelFor, providers })).routes[0]);
    const exec = async () => ({ ...(await L.executor(L.youId, providers)) });
    L.market.chain.gateway.loseNextResponse = true;
    const first = await executeRoute(await exec(), route);
    assert.equal(first[0].status, "unknown");
    assert.equal((await L.you.readAction(first[0].actionId!)).status, "needs_reconciliation");
    assert.equal((await youWorld()).facts.some((f) => f.predicate === "pays:paid"), false, "attempted, not yet true");
    assert.equal(await L.market.balance(recipient as never, "DEV_USDC"), before + BigInt(25_000_000), "the money moved; the record waits for evidence");

    const second = await executeRoute(await exec(), route);
    assert.equal(second[0].status, "completed");
    const paid = (await youWorld()).facts.find((f) => f.predicate === "pays:paid")!;
    assert.equal(paid.status, "reconciled");
    assert.equal(paid.value?.provider, "router.payment");
    const payment = await L.you.readPayment(String(paid.value?.payment_id));
    assert.deepEqual([payment.status, payment.amount, payment.asset, payment.tx_signature], ["confirmed", "25000000", "DEV_USDC", paid.value?.tx_signature]);
    assert.equal(await L.market.balance(recipient as never, "DEV_USDC"), before + BigInt(25_000_000), "paid exactly once");

    // A repeat changes nothing; the Horizon says the deposit is paid; the stale plan cannot pay twice.
    assert.equal((await executeRoute(await exec(), route))[0].detail, "already completed");
    assert.equal(await count(L.k, "select count(*) as n from kernel.relations where kind = 'pays'"), 1);
    assert.equal(await count(L.k, "select count(*) as n from kernel.payment_intents"), 4, "Arcadia's three payments and this one");
    assert.equal((await computeHorizon({ world: await youWorld(), actorId: L.youId, principalId: null, goal, kernelFor: L.kernelFor, providers })).satisfied?.status, "reconciled");
  });

  it("keeps rendering, Horizon and context read-only", async () => {
    const L = await loop();
    const calls: string[] = [];
    const watched = (id: string) => recording(L.kernelFor(id), calls);
    await buildContext({ kernel: watched(L.agentId), actorId: L.agentId, goal: L.goal, kernelFor: watched, providers: L.providers });
    await computeHorizon({ world: await loadWorld(watched(L.youId), L.youId), actorId: L.youId, principalId: null, goal: L.goal, kernelFor: watched, providers: L.providers });
    const model = await new WorldEngine({ manifest: L.manifest, you: watched(L.youId), as: (id) => watched(id) }).load();
    buildSpatialView(model, { selected: [L.org("halden")], highlights: [L.org("orrin")], routes: [], fields: [], effectsAfterSeq: 0 });
    assert.ok(calls.length > 0);
    assert.deepEqual(calls.filter((c) => WRITES.test(c)), [], "perception and planning never write");
  });
});
