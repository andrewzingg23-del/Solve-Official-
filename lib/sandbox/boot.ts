// Boots the Arcadia sandbox in the browser: the real kernel in PGlite, persisted to IndexedDB,
// first seeded from the Arcadia snapshot. Everything above this file talks to the kernel through
// kernel_api via the typed client, exactly as it would talk to the Supabase store.
import { kernelClient, type Kernel } from "../kernel/client";
import { KernelDb, localSupabase, service, user } from "../kernel/local";
import type { ArcadiaManifest } from "./manifest";
import { loadPGlite } from "./pglite";

export type Sandbox = {
  k: KernelDb;
  manifest: ArcadiaManifest;
  // You, signed in to your own sandbox.
  you: Kernel;
  // Any agent or service actor, as the sandbox runs every principal on this device.
  as(actorId: string): Kernel;
  restored: boolean;
};

const PREFIX = "sov-arcadia-";
const MARK = "sov-arcadia-ready";

async function deleteOldStores(current: string) {
  if (!("databases" in indexedDB)) return;
  for (const db of await indexedDB.databases()) {
    if (db.name && db.name.includes(PREFIX) && !db.name.includes(current)) indexedDB.deleteDatabase(db.name);
  }
}

function deleteStore(name: string) {
  return new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(`/pglite/${name}`);
    request.onsuccess = request.onerror = request.onblocked = () => resolve();
  });
}

export async function bootSandbox(onStage: (stage: string) => void = () => {}): Promise<Sandbox> {
  onStage("Reading Arcadia");
  const response = await fetch("/arcadia/manifest.json", { cache: "no-cache" });
  if (!response.ok) throw new Error(`Arcadia is not available (${response.status})`);
  const manifest = (await response.json()) as ArcadiaManifest;
  const name = `${PREFIX}${manifest.version}`;
  const PGlite = await loadPGlite();

  let restored = false;
  let marked = false;
  try {
    marked = localStorage.getItem(MARK) === manifest.version;
  } catch {
    marked = false;
  }

  let db: InstanceType<Awaited<ReturnType<typeof loadPGlite>>> | undefined;
  if (marked) {
    onStage("Restoring your sandbox");
    db = new PGlite(`idb://${name}`);
    const [row] = (await db.query<{ ok: boolean }>("select to_regnamespace('kernel_api') is not null as ok")).rows;
    if (row?.ok) {
      restored = true;
    } else {
      await db.close();
      await deleteStore(name);
      db = undefined;
    }
  }
  if (!db) {
    onStage("Downloading Arcadia");
    const snapshot = await fetch("/arcadia/snapshot.tgz");
    if (!snapshot.ok) throw new Error(`Arcadia snapshot unavailable (${snapshot.status})`);
    onStage("Starting the kernel");
    db = new PGlite(`idb://${name}`, { loadDataDir: await snapshot.blob() });
    await db.query("select 1");
    try {
      localStorage.setItem(MARK, manifest.version);
    } catch {
      // Private mode: the sandbox still works for this visit.
    }
    void deleteOldStores(manifest.version);
  }

  const k = new KernelDb(db);
  return {
    k,
    manifest,
    you: kernelClient(localSupabase(k, user(manifest.personas.you))),
    as: (actorId: string) => kernelClient(localSupabase(k, service), { actAs: actorId }),
    restored,
  };
}

// Discards local progress and starts again from the Arcadia snapshot.
export async function resetSandbox(manifest: ArcadiaManifest) {
  try {
    localStorage.removeItem(MARK);
  } catch {
    // ignore
  }
  await deleteStore(`${PREFIX}${manifest.version}`);
}
