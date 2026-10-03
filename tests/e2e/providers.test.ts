// Real providers behind the same capabilities. The routes, the kernel's decisions and the declared
// consequences do not change when the other side is somewhere else and answers later: a counterparty
// agent on its own session, an organization's HTTP endpoint, a verifier attaching its finding from
// its own session. Until the answer exists the step is unknown and nothing is canonical; when it
// exists, the next run settles the step from it, once.
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server } from "node:http";
import { describe, it } from "node:test";
import { endpointAllowed, httpCounterparty, httpInquiry } from "../../lib/causal/http";
import { computeHorizon } from "../../lib/causal/horizon";
import { executeRoute, recordRoute, type Executor } from "../../lib/causal/pipeline";
import { messagingProviders, Providers, verificationRequest, type ProviderContext } from "../../lib/causal/providers";
import { supplyGoal, verifyGoal } from "../../lib/causal/transitions";
import type { Goal } from "../../lib/causal/types";
import { loadWorld, type WorldState } from "../../lib/causal/world";
import { kernelClient } from "../../lib/kernel/client";
import { localSupabase, service, user } from "../../lib/kernel/local";
import { sha256Hex } from "../../lib/money/settlement";
import { respondToQueries } from "../../lib/world/counterparty";
import { WorldEngine } from "../../lib/world/engine";
import { buildArcadia, ORGS } from "../support/arcadia";

async function setting() {
  const { k, manifest } = await buildArcadia();
  const you = kernelClient(localSupabase(k, user(manifest.personas.you)));
  const as = (id: string) => kernelClient(localSupabase(k, service), { actAs: id });
  const engine = new WorldEngine({ manifest, you, as });
  const model = await engine.load();
  const { scope } = await engine.buildVenture("a car company with the least upfront capital", true, model);
  const worldRef = (await engine.load()).venture!.worldRef;
  const orgs = Object.entries(manifest.orgs);
  const org = (key: string) => `entity:${manifest.orgs[key].entityId}`;
  const keyOf = (ref: string) => orgs.find(([, o]) => `entity:${o.entityId}` === ref)?.[0] ?? null;
  const counterparts = {
    agentFor: (ref: string) => orgs.find(([, o]) => `entity:${o.entityId}` === ref)?.[1].agentId ?? null,
    claimEventFor: (ref: string) => orgs.find(([, o]) => `entity:${o.entityId}` === ref)?.[1].claimEventId ?? null,
    as,
    replyScope: manifest.world,
    verifierId: manifest.steward.verifierId,
  };
  const youId = manifest.you.actorId;
  const kernelFor = (id: string) => (id === youId ? you : as(id));
  const youWorld = () => loadWorld(you, youId);
  const goal = (quantity = 10000) =>
    supplyGoal({ worldRef, scope, capability: "contract_manufacturing", capabilityRef: `entity:${manifest.capabilities.contract_manufacturing}`, quantity, what: "vehicles" });
  const horizon = async (providers: Providers, g: Goal = goal()) => computeHorizon({ world: await youWorld(), actorId: youId, principalId: null, goal: g, kernelFor, providers });
  const executor = async (providers: Providers): Promise<Executor> => ({ kernelFor, providers, world: await youWorld(), worldFor: (id) => loadWorld(kernelFor(id), id) });
  const queriesTo = async (agentId: string) => (await as(agentId).inbox()).filter((m) => m.message_type === "CAPABILITY_QUERY");
  return { k, manifest, you, as, scope, worldRef, org, keyOf, counterparts, youId, kernelFor, youWorld, goal, horizon, executor, queriesTo };
}

const quoteOf = (world: WorldState, org: string) => world.facts.find((f) => f.subject === org && f.predicate === "offers:quoted");

const completionEvidence = async (k: Awaited<ReturnType<typeof setting>>["k"], actionId: string) =>
  k.owner(
    `select ev.content_hash, ev.basis from kernel.evidence ev join kernel.events e on e.id = ev.event_id
     where e.type = 'kernel.action.completed' and e.payload ->> 'action_id' = $1 order by ev.created_at`,
    [actionId],
  );

describe("real providers behind the same capabilities", () => {
  it("settles a step from a counterparty that answers later, from its own session, through the kernel", async () => {
    const S = await setting();
    const providers = messagingProviders(S.counterparts);
    const halden = S.manifest.orgs.halden;
    const route = await recordRoute(S.you, (await S.horizon(providers)).routes[0]);
    assert.deepEqual(route.steps.map((s) => s.transition), ["supplier.inquire", "supplier.accept"]);

    // You ask. Nobody on this device answers for Halden: the question is delivered, the step waits.
    const first = await executeRoute(await S.executor(providers), route);
    assert.deepEqual(first.map((o) => [o.status, o.provider]), [["unknown", "kernel.messaging.inquiry"]]);
    assert.match(first[0].detail, /has not answered yet/);
    const actionId = first[0].actionId!;
    assert.equal((await S.you.readAction(actionId)).status, "needs_reconciliation");
    let world = await S.youWorld();
    assert.equal(quoteOf(world, S.org("halden")), undefined, "nothing canonical until the answer exists");
    assert.equal(world.facts.find((f) => f.subject === `action:${actionId}`)?.status, "attempted");
    assert.equal((await S.queriesTo(halden.agentId)).length, 1);

    // Asking again before the answer sends no second question.
    const again = await executeRoute(await S.executor(providers), route);
    assert.deepEqual([again[0].status, again[0].actionId], ["unknown", actionId]);
    assert.equal((await S.queriesTo(halden.agentId)).length, 1, "one inquiry per action, however many runs");

    // Halden's agent answers from its own session, under its own authority, for its principal.
    const entity = (await S.as(halden.agentId).readWorld(S.manifest.world)).find((e) => e.entity_id === halden.entityId)!;
    const replies = await respondToQueries(S.as(halden.agentId), entity, halden.claimEventId, S.manifest.world);
    assert.equal(replies.length, 1);

    // The next run finds the answer, settles the step, and the route continues to the acceptance.
    const second = await executeRoute(await S.executor(providers), route);
    assert.deepEqual(second.map((o) => [o.status, o.provider]), [["completed", "kernel.messaging.inquiry"], ["completed", "kernel.messaging.acceptance"]]);
    assert.equal(second[0].actionId, actionId, "the same action, settled");
    world = await S.youWorld();
    const quote = quoteOf(world, S.org("halden"))!;
    assert.deepEqual([quote.status, quote.value?.provider, quote.value?.reply, quote.value?.capacity_per_year], ["reconciled", "kernel.messaging.inquiry", `action:${replies[0]}`, 12000]);
    const reply = await S.as(halden.agentId).readAction(replies[0]);
    assert.deepEqual([reply.proposer_id, reply.on_behalf_of, reply.in_reply_to !== null], [halden.agentId, halden.ownerId, true], "the answer's provenance is the counterparty's");
    assert.equal(world.facts.find((f) => f.subject === S.org("halden") && f.predicate === "supplies:agreed")?.status, "reconciled");
    assert.equal((await S.horizon(providers)).satisfied?.status, "reconciled");
    assert.equal((await S.queriesTo(halden.agentId)).length, 1);
  });

  it("reaches an organization over HTTP at its own pace: the same route, hashed answers as evidence, one question per action", async () => {
    const S = await setting();
    const seen: { path: string; key: string | null; body: Record<string, unknown> }[] = [];
    const sentBodies: { path: string; raw: string }[] = [];
    const answered = new Set<string>();
    const published = Object.fromEntries(ORGS.map((o) => [o.key, o.attributes as Record<string, number>]));
    const server: Server = createServer(async (req, res) => {
      const body = JSON.parse(await text(req)) as Record<string, unknown>;
      const [, , key, kind] = req.url!.split("/");
      const idem = (req.headers["idempotency-key"] as string | undefined) ?? null;
      seen.push({ path: req.url!, key: idem, body });
      const send = (status: number, payload: Record<string, unknown>) => {
        const raw = JSON.stringify(payload);
        sentBodies.push({ path: req.url!, raw });
        res.writeHead(status, { "content-type": "application/json" }).end(raw);
      };
      if (kind === "inquiries") {
        if (key === "orrin") return send(410, { reason: "Orrin no longer takes inquiries by API" });
        // Halden queues the question the first time and has the answer ready the next time.
        if (!answered.has(idem!)) {
          answered.add(idem!);
          return send(202, { reference: `HLD-Q-${answered.size}`, status: "queued" });
        }
        const a = published[key];
        const quantity = typeof body.quantity === "number" ? body.quantity : null;
        return send(200, { ...a, can_fulfill: quantity === null || a.capacity_per_year >= quantity, reference: `HLD-Q-${answered.size}` });
      }
      if (kind === "acceptances") return send(201, { accepted: true, reference: "HLD-ACK-1" });
      send(404, {});
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as { port: number }).port;
    try {
      const http = new Providers([...httpCounterparty({ endpointFor: (ref) => (S.keyOf(ref) ? `http://127.0.0.1:${port}/orgs/${S.keyOf(ref)}` : null) }), verificationRequest(S.counterparts)]);
      // An endpoint that refuses fails the step: recorded, nothing canonical, no retry loop. (Before
      // any supplier is agreed: at 5,000 vehicles Orrin is a route.)
      const small = await S.horizon(http, S.goal(5000));
      const orrin = await recordRoute(S.you, small.routes.find((r) => r.orgRef === S.org("orrin"))!);
      const refused = await executeRoute(await S.executor(http), orrin);
      assert.deepEqual([refused[0].status, (await S.you.readAction(refused[0].actionId!)).status], ["failed", "failed"]);
      assert.match(refused[0].detail, /HTTP 410: Orrin no longer takes inquiries by API/);
      assert.equal(quoteOf(await S.youWorld(), S.org("orrin")), undefined);

      const viaKernel = await S.horizon(messagingProviders(S.counterparts));
      const viaHttp = await S.horizon(http);
      assert.equal(viaHttp.routes[0].id, viaKernel.routes[0].id, "routes name capabilities, not providers");
      const route = await recordRoute(S.you, viaHttp.routes[0]);

      const first = await executeRoute(await S.executor(http), route);
      assert.deepEqual(first.map((o) => [o.status, o.provider]), [["unknown", "http.counterparty.inquiry"]]);
      assert.match(first[0].detail, /will answer later/);
      const actionId = first[0].actionId!;
      assert.equal(quoteOf(await S.youWorld(), S.org("halden")), undefined);

      const second = await executeRoute(await S.executor(http), route);
      assert.deepEqual(second.map((o) => [o.status, o.provider]), [["completed", "http.counterparty.inquiry"], ["completed", "http.counterparty.acceptance"]]);
      const quote = quoteOf(await S.youWorld(), S.org("halden"))!;
      assert.deepEqual([quote.status, quote.value?.provider, quote.value?.reply, quote.value?.unit_price_usd], ["reconciled", "http.counterparty.inquiry", "HLD-Q-1", 18500]);

      // The endpoint saw one question (asked twice under the same key) and one acceptance; the
      // kernel's messaging was never used; the evidence is the hash of each answer as received.
      assert.deepEqual(
        seen.map((r) => r.path),
        ["/orgs/orrin/inquiries", "/orgs/halden/inquiries", "/orgs/halden/inquiries", "/orgs/halden/acceptances"],
      );
      assert.deepEqual(
        seen.slice(1).map((r) => r.key),
        [actionId, actionId, second[1].actionId],
        "the Idempotency-Key is the action id, the same on every run",
      );
      assert.equal((await S.queriesTo(S.manifest.orgs.halden.agentId)).length, 0);
      const hashes = async (id: string) => (await completionEvidence(S.k, id)).map((r) => [r.basis, r.content_hash]);
      const halden = sentBodies.filter((b) => b.path.startsWith("/orgs/halden")).map((b) => b.raw);
      assert.deepEqual(await hashes(actionId), [["artifact", `sha256:${await sha256Hex(halden[1])}`]]);
      assert.deepEqual(await hashes(second[1].actionId!), [["artifact", `sha256:${await sha256Hex(halden[2])}`]]);

    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("reaches endpoints only over TLS (or on this machine) and only from the organization's record", async () => {
    assert.equal(endpointAllowed("https://supplier.example/api"), null);
    assert.equal(endpointAllowed("http://127.0.0.1:8080/api"), null);
    assert.equal(endpointAllowed("http://localhost/api"), null);
    assert.match(endpointAllowed("http://supplier.example/api")!, /TLS/);
    assert.match(endpointAllowed("ftp://supplier.example")!, /TLS/);
    assert.match(endpointAllowed("not a url")!, /not a URL/);
    let fetched = 0;
    const ctx = (endpoint: unknown): ProviderContext =>
      ({
        actorId: "a",
        actionId: "x",
        step: { binding: { org: "entity:o", capability: "c" }, payload: { quantity: 1, endpoint: "http://attacker.example" } },
        world: { entities: new Map([["entity:o", { title: "O", attributes: endpoint === undefined ? {} : { endpoint } }]]) },
      }) as never;
    const provider = httpInquiry({ fetch: (async () => (fetched++, new Response("{}", { status: 200 }))) as typeof fetch });
    assert.match((await provider.perform(ctx(undefined))).detail, /publishes no endpoint/);
    assert.match((await provider.perform(ctx("http://supplier.example/api"))).detail, /TLS/);
    assert.equal(fetched, 0, "the payload's endpoint is never used");
  });

  it("waits for the verifier's own finding before a claim counts as verified", async () => {
    const S = await setting();
    const providers = messagingProviders(S.counterparts);
    const orrin = S.manifest.orgs.orrin;
    const goal = verifyGoal({ orgRef: S.org("orrin"), scope: S.manifest.world, title: "Orrin Assembly" });
    const route = await recordRoute(S.you, (await S.horizon(providers, goal)).routes[0]);
    const first = await executeRoute(await S.executor(providers), route);
    assert.deepEqual([first[0].status, first[0].provider], ["unknown", "kernel.verification.request"]);
    assert.match(first[0].detail, /has not attached its finding/);
    assert.equal((await S.youWorld()).facts.find((f) => f.subject === S.org("orrin") && f.predicate === "claims")?.status, "asserted");

    // Kestrel, from its own session, attaches what its audit found.
    await S.as(S.manifest.steward.verifierId).attachEvidence(orrin.claimEventId!, {
      basis: "externally_verified",
      content_hash: `sha256:${await sha256Hex("kestrel site report 2026-10-03")}`,
      description: "Kestrel verification service: line capacity of 6,000 vehicles a year confirmed on site",
    });
    const second = await executeRoute(await S.executor(providers), route);
    assert.deepEqual([second[0].status, second[0].actionId], ["completed", first[0].actionId]);
    assert.equal((await S.youWorld()).facts.find((f) => f.subject === S.org("orrin") && f.predicate === "claims")?.status, "verified");
    assert.equal((await S.horizon(providers, goal)).satisfied?.status, "verified");
  });
});

function text(req: IncomingMessage) {
  return new Promise<string>((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
  });
}
