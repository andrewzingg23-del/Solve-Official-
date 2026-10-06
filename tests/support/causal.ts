// A causal-loop setting on Arcadia for tests: You with a venture World, the market's organizations,
// counterparts, goals and executors, parameterized by the provider set under test.
import { computeHorizon } from "../../lib/causal/horizon";
import type { Executor } from "../../lib/causal/pipeline";
import type { Providers } from "../../lib/causal/providers";
import { supplyGoal } from "../../lib/causal/transitions";
import type { Goal } from "../../lib/causal/types";
import { loadWorld, type WorldState } from "../../lib/causal/world";
import { kernelClient } from "../../lib/kernel/client";
import { localSupabase, service, user } from "../../lib/kernel/local";
import { WorldEngine } from "../../lib/world/engine";
import { buildArcadia } from "./arcadia";

export const quoteOf = (world: WorldState, org: string) => world.facts.find((f) => f.subject === org && f.predicate === "offers:quoted");

export async function setting() {
  const { k, manifest } = await buildArcadia();
  const you = kernelClient(localSupabase(k, user(manifest.personas.you)));
  const as = (id: string) => kernelClient(localSupabase(k, service), { actAs: id });
  const engine = new WorldEngine({ manifest, you, as });
  const model = await engine.load();
  const { scope } = await engine.buildVenture("my insurance agency with the least upfront capital", true, model);
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

