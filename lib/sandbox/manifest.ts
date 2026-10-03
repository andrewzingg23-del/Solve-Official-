// The Arcadia sandbox manifest: well-known ids and the chain state observed at generation.
// Written by scripts/build-arcadia.ts next to the snapshot it describes.
export type ArcadiaManifest = {
  version: string;
  generatedAt: string;
  notice: string;
  personas: { you: string; bob: string; steward: string };
  world: string;
  you: { actorId: string; wallet: string; settlementWorld: string; settlementId: string; paymentId: string };
  bob: { actorId: string; wallet: string };
  steward: { actorId: string; verifierId: string };
  orgs: Record<string, { entityId: string; ownerId: string; agentId: string; claimEventId: string | null }>;
  capabilities: Record<string, string>;
  states: Record<string, { entityId: string; hubIds: string[] }>;
  chain: {
    cluster: string;
    note: string;
    symbols: Record<string, string>;
    balances: Record<string, Record<string, string>>;
  };
};
