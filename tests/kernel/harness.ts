// Runs the real migrations in an embedded Postgres (PGlite) and calls kernel_api the way
// PostgREST does. The runtime is pluggable: Node by default, the browser via setKernelRuntime.
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { KernelDb, migrate, type PGliteLike } from "../../lib/kernel/local";

export { anon, KernelDb, service, user, type Row, type Session } from "../../lib/kernel/local";

export type KernelRuntime = { create(): Promise<PGliteLike>; migrations(): Promise<string[]> };

// Tests run from the repo root (npm test).
const nodeRuntime: KernelRuntime = {
  create: async () => new PGlite() as unknown as PGliteLike,
  migrations: async () => {
    const dir = join(process.cwd(), "supabase/migrations");
    // The embedded kernel has no Supabase-managed auth.users or API roles.
    // Keep its migration list aligned with the browser's offline kernel assets.
    const scope = JSON.parse(readFileSync(join(process.cwd(), "supabase/migration-scope.json"), "utf8")) as { supabaseOnly: string[] };
    const supabaseOnly = new Set(scope.supabaseOnly);
    return readdirSync(dir)
      .filter((f) => f.endsWith(".sql") && !supabaseOnly.has(f))
      .sort()
      .map((f) => readFileSync(join(dir, f), "utf8"));
  },
};

// A real Postgres server instead of PGlite (`npm run test:postgres`): same migrations, same tests.
const postgresUrl = typeof process !== "undefined" ? process.env.SOV_KERNEL_POSTGRES_URL : undefined;
const postgresRuntime: KernelRuntime | null = postgresUrl
  ? {
      create: async () => (await import("../support/postgres")).PostgresDb.create(postgresUrl),
      migrations: nodeRuntime.migrations,
    }
  : null;

let runtime = postgresRuntime ?? nodeRuntime;
let template: Promise<PGliteLike> | undefined;

export function setKernelRuntime(next: KernelRuntime) {
  runtime = next;
  template = undefined;
}

// A fresh, fully migrated database per call, cloned from one migrated template.
export async function createKernelDb() {
  template ??= (async () => {
    const db = await runtime.create();
    await migrate(db, await runtime.migrations());
    return db;
  })();
  const base = await template;
  if (!base.clone) throw new Error("this PGlite build cannot clone");
  return new KernelDb(await base.clone());
}

// Matches a Postgres error by SQLSTATE for assert.rejects.
export const sqlstate = (code: string) => (error: unknown) => {
  if ((error as { code?: string }).code === code) return true;
  throw error;
};

export const sha = (n: number) => `sha256:${n.toString(16).padStart(64, "0")}`;
