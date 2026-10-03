// ARCADIA — the internal SOV test civilization. One coherent synthetic universe used by tests,
// the browser sandbox and demonstrations. Every entity is fictional and labelled as such; every
// record is created through the real kernel, chain and router code paths.
//
// The visitor plays "You": a person whose verified work released DEV-SOLVE from the Earn Vault
// and who paid Bob $10 through the payment router. The market holds fictional suppliers at real
// cities, each with an owner and an organization agent, with capability claims in three proof
// states (externally verified, self-reported, challenged), and two Network States.
//
// Reproducible: the seed fixes every key and id the generator creates, so the same seed, generator
// version and kernel give the same semantic digest (lib/sandbox/digest.ts). Kernel row ids still
// come from Postgres per generation: they are minted by the built-in gen_random_uuid, which
// Postgres dispatches by OID straight to its C implementation (redefining it in pg_catalog changes
// nothing), kernel functions pin search_path = '', and the applied migrations that mint them cannot
// be edited. So across generations the same thing is identified by its `arcadia_key` and its digest
// label; within a generation its id is one and the same in the kernel, the snapshot, the browser and
// every renderer. The snapshot is the kernel's own database, never a second model.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { walletBalance } from "../../lib/chain/solve";
import type { ArcadiaManifest } from "../../lib/sandbox/manifest";
import { kernelClient } from "../../lib/kernel/client";
import { localSupabase, service, user } from "../../lib/kernel/local";
import { sendPayment, type PaymentRail } from "../../lib/money/payment";
import { settle, type SettlementRail } from "../../lib/money/settlement";
import { installCollective, superviseReconciliation } from "../../lib/ops/collective";
import { installCreation, leaseEngineering, openEngineeringTask, promoteAndObserve, runBuilder, runCi, runReviewer } from "../../lib/ops/creation";
import { learnFromReconciliations } from "../../lib/ops/learning";
import { kernelDigest } from "../../lib/sandbox/digest";
import { createKernelDb, sha } from "../kernel/harness";
import { newSigner, seedKeys } from "./keys";
import { directoryWorkspace } from "./workspace";
import { moneyKernel } from "./money-fixture";
import { ARC, paymentMarket, USD } from "./payment-fixture";
import { preparedSettlement, type ProofEnvironment } from "./proof-of-life";

export const ARCADIA_WORLD = "world:arcadia";

// Bump when the generator's output changes meaning (new actors, entities, scenarios, data).
//   arcadia/1  first civilization: You, Bob, eight suppliers, two Network States
//   arcadia/2  seeded keys, natural keys, a private entity, provenance and digest in the manifest
//   arcadia/3  scenarios; "lost-payment-responses" runs SOV's operating collective on its rail
//   arcadia/4  "creation-loop" builds, tests, reviews, promotes and observes the Class A proposal
//   arcadia/5  members may share their read of the market with their own agents
//   arcadia/6  members may request verification of a claim; Kestrel reads the market it verifies
//   arcadia/7  organization owners hold wallets and payment profiles, so they can be paid
export const ARCADIA_GENERATOR = "arcadia/7";
export const ARCADIA_SEED = "arcadia-genesis-1";

// Scenarios layer behaviour onto the base civilization (failures, fraud, disputes, governance).
// None is enabled by default; each is named in the manifest so a snapshot says what it contains.
//   lost-payment-responses  two of You's payments lose their chain reply; SOV's collective detects,
//                           works, verifies and closes them, then records what it learned.
//   creation-loop           (after lost-payment-responses) the Class A proposal is built by an
//                           engineering agent, tested by CI against Arcadia itself, reviewed by
//                           another party, promoted to a generation-time workspace and observed.
export type ArcadiaScenario = "lost-payment-responses" | "creation-loop";
export const ARCADIA_DEFAULT_SCENARIOS: ArcadiaScenario[] = ["lost-payment-responses", "creation-loop"];
export type ArcadiaConfig = { seed: string; scenarios: ArcadiaScenario[] };

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

// The kernel's schema and rules, as the ordered migration files.
export function kernelVersion() {
  const dir = join(process.cwd(), "supabase/migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  return { digest: sha256(files.map((f) => `${f}\n${readFileSync(join(dir, f), "utf8")}`).join("\n")), migrations: files };
}

export const PERSONAS = {
  you: "sandbox:you",
  bob: "sandbox:bob",
  steward: "auth-founder",
} as const;

type Org = {
  key: string;
  title: string;
  summary: string;
  city: string;
  latitude: number;
  longitude: number;
  capabilities: string[];
  attributes: Record<string, unknown>;
  claim?: { statement: string; proof: "verified" | "self_reported" | "challenged"; challenge?: string };
};

export const CAPABILITIES: Record<string, string> = {
  contract_manufacturing: "Contract manufacturing",
  vehicle_engineering: "Vehicle engineering",
  vehicle_design: "Vehicle design",
  certification: "Certification and homologation",
  battery_supply: "Battery packs",
  chassis_supply: "Chassis and castings",
  distribution: "Distribution",
};

export const ORGS: Org[] = [
  {
    key: "halden",
    title: "Halden Works",
    summary: "Contract vehicle manufacturer. Fictional Arcadia company.",
    city: "Graz",
    latitude: 47.0707,
    longitude: 15.4395,
    capabilities: ["contract_manufacturing"],
    attributes: { capacity_per_year: 12000, lead_time_days: 210, unit_price_usd: 18500, minimum_order: 2000 },
    claim: { statement: "Line capacity of 12,000 vehicles a year, IATF 16949 certified", proof: "verified" },
  },
  {
    key: "orrin",
    title: "Orrin Assembly",
    summary: "Low-volume vehicle assembly. Fictional Arcadia company.",
    city: "Valencia",
    latitude: 39.4699,
    longitude: -0.3763,
    capabilities: ["contract_manufacturing"],
    attributes: { capacity_per_year: 6000, lead_time_days: 150, unit_price_usd: 16900, minimum_order: 500 },
    claim: { statement: "Line capacity of 6,000 vehicles a year", proof: "self_reported" },
  },
  {
    key: "cobalt",
    title: "Cobalt Ridge Motors",
    summary: "Vehicle assembly. Fictional Arcadia company.",
    city: "Bratislava",
    latitude: 48.1486,
    longitude: 17.1077,
    capabilities: ["contract_manufacturing"],
    attributes: { capacity_per_year: 50000, lead_time_days: 90, unit_price_usd: 14200, minimum_order: 1000 },
    claim: {
      statement: "Line capacity of 50,000 vehicles a year",
      proof: "challenged",
      challenge: "Site audit found one line rated near 4,000 vehicles a year",
    },
  },
  {
    key: "vireo",
    title: "Vireo Design Studio",
    summary: "Vehicle design and engineering. Fictional Arcadia company.",
    city: "Turin",
    latitude: 45.0703,
    longitude: 7.6869,
    capabilities: ["vehicle_design", "vehicle_engineering"],
    attributes: { engineers: 140, programs_delivered: 9, lead_time_days: 300 },
    claim: { statement: "Delivered nine vehicle programs from concept to production intent", proof: "verified" },
  },
  {
    key: "kestrel",
    title: "Kestrel Homologation Lab",
    summary: "Vehicle certification and homologation testing. Fictional Arcadia company.",
    city: "Munich",
    latitude: 48.1351,
    longitude: 11.582,
    capabilities: ["certification"],
    attributes: { accredited: true, typical_program_days: 240 },
  },
  {
    key: "northgate",
    title: "Northgate Cells",
    summary: "Battery packs for vehicles. Fictional Arcadia company.",
    city: "Gothenburg",
    latitude: 57.7089,
    longitude: 11.9746,
    capabilities: ["battery_supply"],
    attributes: { pack_kwh: [60, 82], capacity_packs_per_year: 30000 },
  },
  {
    key: "ferro",
    title: "Ferro Castings",
    summary: "Chassis structures and castings. Fictional Arcadia company.",
    city: "Brescia",
    latitude: 45.5416,
    longitude: 10.2118,
    capabilities: ["chassis_supply"],
    attributes: { lead_time_days: 120 },
  },
  {
    key: "sable",
    title: "Sable Logistics",
    summary: "Vehicle distribution and logistics. Fictional Arcadia company.",
    city: "Rotterdam",
    latitude: 51.9244,
    longitude: 4.4777,
    capabilities: ["distribution"],
    attributes: { markets: ["EU", "UK"], vehicles_per_month: 4000 },
  },
];

export const STATES = [
  {
    key: "meridian",
    title: "Meridian",
    summary: "A digital-first Network State of independent operators. Fictional.",
    attributes: { type: "network_state", currency: null, members: 1240 },
    hubs: [
      { city: "Lisbon", latitude: 38.7223, longitude: -9.1393 },
      { city: "Tallinn", latitude: 59.437, longitude: 24.7536 },
      { city: "Singapore", latitude: 1.3521, longitude: 103.8198 },
      { city: "Austin", latitude: 30.2672, longitude: -97.7431 },
    ],
  },
  {
    key: "tessellate",
    title: "Tessellate",
    summary: "A Network State of builders with its own test currency, ARC. Fictional.",
    attributes: { type: "network_state", currency: "ARC", members: 860 },
    hubs: [
      { city: "Berlin", latitude: 52.52, longitude: 13.405 },
      { city: "Nairobi", latitude: -1.2921, longitude: 36.8219 },
      { city: "Bengaluru", latitude: 12.9716, longitude: 77.5946 },
      { city: "Mexico City", latitude: 19.4326, longitude: -99.1332 },
    ],
  },
];

export type { ArcadiaManifest };

export async function buildArcadia(config: Partial<ArcadiaConfig> = {}) {
  const resolved: ArcadiaConfig = { seed: config.seed ?? ARCADIA_SEED, scenarios: config.scenarios ?? ARCADIA_DEFAULT_SCENARIOS };
  const started = Date.now();
  seedKeys(resolved.seed);
  try {
    return await generate(resolved, started);
  } finally {
    seedKeys(null);
  }
}

async function generate(config: ArcadiaConfig, started: number) {
  const market = await paymentMarket();
  const chain = market.chain;
  const k = await createKernelDb();
  const client = (sub: string) => kernelClient(localSupabase(k, user(sub)));
  const asAgent = (actorId: string) => kernelClient(localSupabase(k, service), { actAs: actorId });

  const steward = client(PERSONAS.steward);
  const stewardId = await steward.register("Arcadia Steward");
  const money = await moneyKernel(k, {
    chain: "litesvm",
    mintAddress: chain.manifest.mint,
    settlementAuthority: chain.manifest.settlementAuthority,
    observedEarn: BigInt(chain.manifest.vaults.earn.allocation),
  });

  // You: verified work releases DEV-SOLVE from the Earn Vault (the monetary proof-of-life).
  const you = client(PERSONAS.you);
  const youId = await you.register("You");
  const settlementRail: SettlementRail = {
    kernel: kernelClient(localSupabase(k, service), { actAs: money.settlementService }),
    gateway: chain.gateway,
    manifest: chain.manifest,
    sponsor: chain.sponsor,
    settlementAuthority: chain.settlementAuthority,
  };
  const env = { k, money, chain, rail: settlementRail, verifier: asAgent(money.verifier) } as unknown as ProofEnvironment;
  const prepared = await preparedSettlement(env, you, youId);
  const released = await settle(settlementRail, prepared.settlementId);
  if (released.status !== "confirmed") throw new Error(`Arcadia settlement did not confirm: ${released.status}`);

  // You pay Bob $10 through the router.
  await steward.defineAsset({ code: "DEV_USDC", issuerScope: "system/chain:litesvm", decimals: 6, label: "DEV-USDC (test, no value)" });
  await steward.defineAsset({ code: "ARC", issuerScope: "system/chain:litesvm", decimals: 6, label: "ARC, Tessellate test currency (no value)" });
  for (const asset of Object.values(market.assets)) await steward.registerChainAsset("litesvm", asset.code, asset.mint);
  const paymentService = await steward.createServiceActor("payment service");
  await steward.issueGrant({ grantee: paymentService, capability: "kernel.payment.record", scope: "system/chain:litesvm" });
  const paymentRail: PaymentRail = { kernel: asAgent(paymentService), gateway: chain.gateway };

  const bob = client(PERSONAS.bob);
  const bobId = await bob.register("Bob");
  const bobWallet = await newSigner();
  await bob.linkWallet("litesvm", bobWallet.address);
  await bob.setPaymentProfile({ chain: "litesvm", receiveAddress: bobWallet.address, acceptAssets: ["DEV_USDC"] });
  await market.fund(prepared.wallet.address, "ARC", ARC(1_000));
  const paymentId = await you.createPaymentIntent({
    recipientId: bobId,
    chain: "litesvm",
    asset: "DEV_USDC",
    amount: USD(10),
    maxSlippageBps: 50,
    memo: "Send Bob $10",
  });
  const paid = await sendPayment({ payerKernel: you, rail: paymentRail, router: market.router, payer: prepared.wallet, sponsor: chain.sponsor, paymentId });
  if (paid.status !== "confirmed") throw new Error(`Arcadia payment did not confirm: ${paid.status}`);

  // The Arcadia market: a public World of fictional suppliers and Network States.
  await steward.claimScope(ARCADIA_WORLD);
  const verifierId = await steward.createServiceActor("Kestrel verification service");
  await steward.issueGrant({ grantee: verifierId, capability: "kernel.evidence.attach", scope: ARCADIA_WORLD });
  await steward.issueGrant({ grantee: verifierId, capability: "claim.challenge", scope: ARCADIA_WORLD });
  await steward.issueGrant({ grantee: verifierId, capability: "world.relation.write", scope: ARCADIA_WORLD });
  await steward.issueGrant({ grantee: verifierId, capability: "kernel.read", scope: ARCADIA_WORLD });

  const capabilities: Record<string, string> = {};
  for (const [key, title] of Object.entries(CAPABILITIES)) {
    capabilities[key] = await steward.upsertEntity({
      kind: "capability",
      scope: ARCADIA_WORLD,
      title,
      summary: "A capability offered in the Arcadia market.",
      attributes: { key, arcadia_key: `capability:${key}` },
      visibility: "public",
      importance: 40,
    });
  }

  const orgs: ArcadiaManifest["orgs"] = {};
  for (const org of ORGS) {
    const owner = client(`sandbox:owner-${org.key}`);
    const ownerId = await owner.register(`${org.title} (owner)`);
    const ownerWallet = await newSigner();
    await owner.linkWallet("litesvm", ownerWallet.address);
    await owner.setPaymentProfile({ chain: "litesvm", receiveAddress: ownerWallet.address, acceptAssets: ["DEV_USDC"] });
    const agentId = await owner.spawnAgent({ label: `${org.title} agent`, role: "organization_agent" });
    for (const capability of ["message.send", "claim.capability"]) {
      await steward.issueGrant({ grantee: agentId, capability, scope: ARCADIA_WORLD });
    }
    const entityId = await steward.upsertEntity({
      kind: "organization",
      scope: ARCADIA_WORLD,
      title: org.title,
      summary: org.summary,
      attributes: { ...org.attributes, city: org.city, capabilities: org.capabilities, synthetic: true, arcadia_key: `org:${org.key}` },
      latitude: org.latitude,
      longitude: org.longitude,
      locationTruth: "declared",
      visibility: "public",
      importance: 60,
    });
    await steward.relate({ kind: "controls", fromRef: `actor:${ownerId}`, toRef: `entity:${entityId}`, scope: ARCADIA_WORLD });
    await steward.relate({ kind: "represents", fromRef: `actor:${agentId}`, toRef: `entity:${entityId}`, scope: ARCADIA_WORLD });
    for (const c of org.capabilities) {
      await steward.relate({ kind: "offers", fromRef: `entity:${entityId}`, toRef: `entity:${capabilities[c]}`, scope: ARCADIA_WORLD });
    }

    let claimEventId: string | null = null;
    if (org.claim) {
      claimEventId = await asAgent(agentId).recordEvent({
        type: "claim.capability",
        scope: ARCADIA_WORLD,
        payload: { organization: `entity:${entityId}`, statement: org.claim.statement, attributes: org.attributes },
        evidence: [{ basis: "self_reported", content_hash: sha(1000 + ORGS.indexOf(org)) as `sha256:${string}`, description: `${org.title} statement` }],
      });
      if (org.claim.proof === "verified") {
        await asAgent(verifierId).attachEvidence(claimEventId, {
          basis: "externally_verified",
          content_hash: sha(2000 + ORGS.indexOf(org)) as `sha256:${string}`,
          description: `Kestrel verification service: ${org.claim.statement.toLowerCase()} confirmed on site`,
        });
      }
      if (org.claim.proof === "challenged") {
        const challenge = await asAgent(verifierId).recordEvent({
          type: "claim.challenge",
          scope: ARCADIA_WORLD,
          payload: { claim_event_id: claimEventId, finding: org.claim.challenge },
          evidence: [{ basis: "artifact", content_hash: sha(3000 + ORGS.indexOf(org)) as `sha256:${string}`, description: "site audit report" }],
        });
        await asAgent(verifierId).relate({ kind: "challenges", fromRef: `event:${challenge}`, toRef: `event:${claimEventId}`, scope: ARCADIA_WORLD });
      }
    }
    orgs[org.key] = { entityId, ownerId, agentId, claimEventId };
  }

  const states: ArcadiaManifest["states"] = {};
  for (const state of STATES) {
    const entityId = await steward.upsertEntity({
      kind: "world",
      scope: ARCADIA_WORLD,
      title: state.title,
      summary: state.summary,
      attributes: { ...state.attributes, arcadia_key: `state:${state.key}` },
      visibility: "public",
      importance: 70,
    });
    const hubIds: string[] = [];
    for (const hub of state.hubs) {
      const hubId = await steward.upsertEntity({
        kind: "place",
        scope: ARCADIA_WORLD,
        title: `${state.title} hub — ${hub.city}`,
        summary: `A ${state.title} member hub. Fictional.`,
        attributes: { state: state.key, city: hub.city, arcadia_key: `hub:${state.key}:${hub.city.toLowerCase().replace(/\s+/g, "-")}` },
        latitude: hub.latitude,
        longitude: hub.longitude,
        locationTruth: "declared",
        visibility: "public",
        importance: 30,
      });
      await steward.relate({ kind: "member_of", fromRef: `entity:${hubId}`, toRef: `entity:${entityId}`, scope: ARCADIA_WORLD });
      hubIds.push(hubId);
    }
    states[state.key] = { entityId, hubIds };
  }
  // Tessellate's builders work with Vireo; Halden ships through Sable.
  await steward.relate({ kind: "member_of", fromRef: `actor:${orgs.vireo.ownerId}`, toRef: `entity:${states.tessellate.entityId}`, scope: ARCADIA_WORLD });
  await steward.relate({ kind: "supplies", fromRef: `entity:${orgs.sable.entityId}`, toRef: `entity:${orgs.halden.entityId}`, scope: ARCADIA_WORLD });

  // Scenario: SOV operating SOV on the payment rail.
  let operations: ArcadiaManifest["operations"] = null;
  if (config.scenarios.includes("lost-payment-responses")) {
    const collective = await installCollective(steward, { paymentService, chain: "litesvm", as: asAgent });
    for (let i = 1; i <= 2; i++) {
      const id = await you.createPaymentIntent({
        recipientId: bobId,
        chain: "litesvm",
        asset: "DEV_USDC",
        amount: USD(1),
        maxSlippageBps: 50,
        memo: `Coffee with Bob ${i}`,
        idempotencyKey: `arcadia-lost-${i}`,
      });
      const lost = await sendPayment({
        payerKernel: you,
        rail: paymentRail,
        router: market.router,
        payer: prepared.wallet,
        sponsor: chain.sponsor,
        paymentId: id,
        beforeSubmit: async () => {
          chain.gateway.loseNextResponse = true;
        },
      });
      if (lost.status !== "needs_reconciliation") throw new Error(`scenario expected an unknown outcome, got ${lost.status}`);
    }
    const supervised = await superviseReconciliation({ rail: paymentRail, chain: "litesvm", collective, as: asAgent, staleAfterMs: 0 });
    if (supervised.length !== 2 || !supervised.every((t) => t.closed)) throw new Error(`scenario did not close its tasks: ${JSON.stringify(supervised)}`);
    const learned = await learnFromReconciliations(asAgent(collective.opsService), { railScope: "system/chain:litesvm" });
    operations = { ...collective, tasks: supervised.map((t) => t.taskId), proposalEventId: learned?.proposalEventId ?? null, engineeringTask: null };

    if (config.scenarios.includes("creation-loop") && learned) {
      const creation = await installCreation(steward, { opsService: collective.opsService, trustService: collective.trustService, as: asAgent, read: ["system/chain:litesvm"] });
      const ops = asAgent(collective.opsService);
      const taskId = await openEngineeringTask(ops, learned.proposalEventId);
      await leaseEngineering(ops, asAgent(collective.trustService), { taskId, builderId: creation.builderId, reviewerId: creation.reviewerId, rail: "system/chain:litesvm" });
      const workspace = directoryWorkspace("arcadia-build-");
      const target = directoryWorkspace("arcadia-target-");
      const builder = asAgent(creation.builderId);
      const reviewer = asAgent(creation.reviewerId);
      await runBuilder(builder, { taskId, workspace });
      // Arcadia is the simulation: CI runs the change against the civilization being generated.
      const ci = await runCi(asAgent(creation.ciService), { taskId, workspace, simulate: async () => steward });
      if (!ci.passed) throw new Error(`creation-loop CI failed: ${ci.problems.join("; ")}`);
      const approval = await runReviewer(reviewer, { taskId, workspace, target });
      if (!approval.approved) throw new Error(`creation-loop review refused: ${approval.reasons.join("; ")}`);
      await promoteAndObserve(builder, { taskId, workspace, target, live: builder });
      const closing = await runReviewer(reviewer, { taskId, workspace, target });
      if (!closing.closed) throw new Error(`creation-loop did not close: ${closing.reasons.join("; ")}`);
      operations.engineeringTask = taskId;
    }
  }

  // Something You must never see: a private record in the same World. It tests that what reaches
  // the browser's view is authorized, not merely hidden.
  const privateEntityId = await steward.upsertEntity({
    kind: "document",
    scope: ARCADIA_WORLD,
    title: "Halden Works second line (confidential)",
    summary: "Steward-only planning note. Fictional.",
    attributes: { organization: `entity:${orgs.halden.entityId}`, arcadia_key: "private:halden-second-line" },
    latitude: 47.0707,
    longitude: 15.4395,
    locationTruth: "declared",
    visibility: "private",
    importance: 80,
  });

  // You can read the public market as a member, and share that read with your own agents.
  await steward.issueGrant({ grantee: youId, capability: "kernel.read", scope: ARCADIA_WORLD });
  await steward.issueGrant({ grantee: youId, capability: "kernel.grant.issue", scope: ARCADIA_WORLD });
  await steward.issueGrant({ grantee: youId, capability: "verification.request", scope: ARCADIA_WORLD });

  const balances: Record<string, Record<string, string>> = {};
  for (const [who, owner] of [["you", prepared.wallet.address], ["bob", bobWallet.address]] as const) {
    balances[who] = {};
    for (const asset of Object.values(market.assets)) balances[who][asset.code] = (await walletBalance(chain.gateway, owner, asset.mint)).toString();
  }

  const integrity = await kernelClient(localSupabase(k, service)).verifyChain();
  if (!integrity.ok) throw new Error(`Arcadia history broken: ${integrity.problem}`);
  const semantic = await kernelDigest((sql) => k.owner(sql));
  const kernel = kernelVersion();
  const policies = await k.owner("select capability, scope, requirement, version from kernel.action_policies order by scope, capability, version");

  const manifest: ArcadiaManifest = {
    version: "",
    generatedAt: new Date().toISOString(),
    arcadia: {
      generator: ARCADIA_GENERATOR,
      seed: config.seed,
      scenarios: config.scenarios,
      configuration: sha256(JSON.stringify({ config, ORGS, STATES, CAPABILITIES })),
      kernel: kernel.digest,
      migrations: kernel.migrations,
      policies: sha256(JSON.stringify(policies)),
      digest: semantic.digest,
      tables: semantic.tables,
      events: semantic.events,
      snapshot: "",
    },
    metrics: { generationMs: Date.now() - started, snapshotBytes: 0, dumpMs: 0 },
    privateEntityId,
    operations,
    notice: "Arcadia is a synthetic test civilization. Every company, person, State and amount is fictional; assets are test assets with no value.",
    personas: PERSONAS,
    world: ARCADIA_WORLD,
    you: {
      actorId: youId,
      wallet: prepared.wallet.address,
      settlementWorld: prepared.world,
      settlementId: prepared.settlementId,
      paymentId,
    },
    bob: { actorId: bobId, wallet: bobWallet.address },
    steward: { actorId: stewardId, verifierId },
    orgs,
    capabilities,
    states,
    chain: {
      cluster: chain.gateway.cluster,
      note: "Chain state observed on the local LiteSVM chain when this sandbox was generated. That chain is not live in your browser; its receipts are in the kernel.",
      symbols: Object.fromEntries(Object.values(market.assets).map((a) => [a.code, a.symbol])),
      balances,
    },
  };
  // For Node callers: the chain-side means to pay as You (a browser sandbox has no chain).
  const treasury = { payerKernel: you, rail: paymentRail, router: market.router, payer: prepared.wallet, sponsor: chain.sponsor };
  return { k, manifest, integrity, treasury, market };
}
