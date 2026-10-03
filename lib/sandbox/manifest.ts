// The Arcadia sandbox manifest: provenance (which generator, seed, kernel and policies produced the
// snapshot, and the semantic digest it must reproduce), well-known ids, and the chain state observed
// at generation. Written by scripts/build-arcadia.ts next to the snapshot it describes. It describes
// canonical state; it never replaces it.
export type ArcadiaManifest = {
  // First 16 hex characters of the snapshot's SHA-256: names the browser's database.
  version: string;
  generatedAt: string;
  arcadia: {
    generator: string;
    seed: string;
    scenarios: string[];
    // SHA-256 of the generator's configuration and data.
    configuration: string;
    // SHA-256 of the ordered kernel migrations, and their names.
    kernel: string;
    migrations: string[];
    policies: string;
    // Semantic digest of the kernel state (lib/sandbox/digest.ts), with row counts.
    digest: string;
    tables: Record<string, number>;
    events: Record<string, number>;
    // Full SHA-256 of snapshot.tgz.
    snapshot: string;
  };
  metrics: { generationMs: number; snapshotBytes: number; dumpMs: number };
  // A steward-only entity You must never receive (authorization tests).
  privateEntityId: string;
  // SOV's operating collective, when the lost-payment-responses scenario ran.
  operations: { trustService: string; opsService: string; workerId: string; verifierId: string; tasks: string[]; proposalEventId: string | null } | null;
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
