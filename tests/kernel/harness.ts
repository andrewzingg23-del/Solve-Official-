// Runs the real migrations in an in-memory Postgres (PGlite) and calls kernel_api the way
// PostgREST does: SET LOCAL ROLE plus request.jwt.claims for each request.
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Tests run from the repo root (npm test).
const migrationsDir = join(process.cwd(), "supabase/migrations");

export type Session =
  | { role: "authenticated"; sub: string; is_anonymous?: boolean }
  | { role: "service_role" }
  | { role: "anon" };

export type Row = Record<string, unknown>;

let template: Promise<PGlite> | undefined;

async function migrate() {
  const db = new PGlite();
  // Roles Supabase provides out of the box.
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;
  `);
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(migrationsDir, file), "utf8"));
  }
  return db;
}

// A fresh, fully migrated database per call, cloned from one migrated template.
export async function createKernelDb() {
  template ??= migrate();
  return new KernelDb((await (await template).clone()) as PGlite);
}

export class KernelDb {
  constructor(readonly db: PGlite) {}

  // Runs SQL as the database owner (no API role).
  async owner(sql: string, params: unknown[] = []): Promise<Row[]> {
    return (await this.db.query<Row>(sql, params)).rows;
  }

  // Runs SQL under an API role with the given JWT claims, inside one transaction.
  async as(session: Session, sql: string, params: unknown[] = []): Promise<Row[]> {
    return this.db.transaction(async (tx) => {
      await tx.exec(`set local role ${session.role}`);
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(session)]);
      return (await tx.query<Row>(sql, params)).rows;
    });
  }

  // Calls kernel_api.<fn> with named arguments, as PostgREST's rpc does.
  async rpc(session: Session, fn: string, args: Record<string, unknown> = {}): Promise<Row[]> {
    const names = Object.keys(args);
    const sql = `select * from kernel_api.${fn}(${names.map((n, i) => `${n} => $${i + 1}`).join(", ")})`;
    const values = names.map((n) => {
      const v = args[n];
      return v !== null && typeof v === "object" && !(v instanceof Date) ? JSON.stringify(v) : v;
    });
    return this.as(session, sql, values);
  }

  // Calls a kernel_api function that returns a single value.
  async value<T = string>(session: Session, fn: string, args: Record<string, unknown> = {}): Promise<T> {
    const [row] = await this.rpc(session, fn, args);
    return Object.values(row)[0] as T;
  }
}

export const user = (sub: string): Session => ({ role: "authenticated", sub });
export const service: Session = { role: "service_role" };
export const anon: Session = { role: "anon" };

// Matches a Postgres error by SQLSTATE for assert.rejects.
export const sqlstate = (code: string) => (error: unknown) => {
  if ((error as { code?: string }).code === code) return true;
  throw error;
};

export const sha = (n: number) => `sha256:${n.toString(16).padStart(64, "0")}`;
