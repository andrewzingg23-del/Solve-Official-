// The kernel on an embedded Postgres (PGlite): tests in Node, the sandbox in the browser.
// Calls go through kernel_api exactly as PostgREST makes them: SET LOCAL ROLE plus
// request.jwt.claims per request. Nothing here bypasses the kernel's own rules.
import type { SupabaseClient } from "@supabase/supabase-js";

// The slice of PGlite this module needs. Any PGlite build (bundled, unbundled, worker) fits.
export interface PGliteLike {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<unknown>;
  transaction<T>(fn: (tx: PGliteLike) => Promise<T>): Promise<T>;
  clone?(): Promise<PGliteLike>;
}

export type Session =
  | { role: "authenticated"; sub: string; is_anonymous?: boolean; client_id?: string; session_id?: string }
  | { role: "service_role" }
  | { role: "anon" };

export type Row = Record<string, unknown>;

export const user = (sub: string): Session => ({ role: "authenticated", sub });
/** A token Supabase issued to an OAuth client (a connected app) on this person's behalf. */
export const app = (sub: string, clientId: string, sessionId?: string): Session =>
  ({ role: "authenticated", sub, client_id: clientId, ...(sessionId ? { session_id: sessionId } : {}) });
export const service: Session = { role: "service_role" };
export const anon: Session = { role: "anon" };

// Creates the roles Supabase provides (unless the server already has them, as a real Postgres
// shared between databases does), then applies the migrations in order.
export async function migrate(db: PGliteLike, migrations: string[]) {
  await db.exec(`
    do $$
    begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
    end
    $$;
  `);
  for (const sql of migrations) await db.exec(sql);
}

export class KernelDb {
  constructor(readonly db: PGliteLike) {}

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

  private argTypes = new Map<string, Map<string, string>>();

  // Input argument types of kernel_api.<fn>, so arrays encode the way PostgREST would.
  private async typesOf(fn: string) {
    let types = this.argTypes.get(fn);
    if (!types) {
      const rows = await this.owner(
        `select unnest(p.proargnames[1:p.pronargs]) as name, unnest(p.proargtypes::regtype[]::text[]) as type
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'kernel_api' and p.proname = $1`,
        [fn],
      );
      types = new Map(rows.map((r) => [r.name as string, r.type as string]));
      this.argTypes.set(fn, types);
    }
    return types;
  }

  // Calls kernel_api.<fn> with named arguments, as PostgREST's rpc does.
  async rpc(session: Session, fn: string, args: Record<string, unknown> = {}): Promise<Row[]> {
    if (!/^[a-z_]+$/.test(fn)) throw new Error(`invalid function name ${fn}`);
    const types = await this.typesOf(fn);
    const names = Object.keys(args);
    for (const n of names) if (!/^p_[a-z_]+$/.test(n)) throw new Error(`invalid argument name ${n}`);
    const sql = `select * from kernel_api.${fn}(${names.map((n, i) => `${n} => $${i + 1}`).join(", ")})`;
    const values = names.map((n) => {
      const v = args[n];
      if (Array.isArray(v) && types.get(n)?.endsWith("[]")) return v;
      return v !== null && typeof v === "object" && !(v instanceof Date) ? JSON.stringify(v) : v;
    });
    return this.as(session, sql, values);
  }

  private setReturning = new Map<string, boolean>();

  // Whether kernel_api.<fn> returns rows (PostgREST returns an array) or a scalar.
  async returnsSet(fn: string) {
    let value = this.setReturning.get(fn);
    if (value === undefined) {
      const [row] = await this.owner(
        `select p.proretset from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'kernel_api' and p.proname = $1`,
        [fn],
      );
      value = Boolean(row?.proretset);
      this.setReturning.set(fn, value);
    }
    return value;
  }

  // Calls a kernel_api function that returns a single value.
  async value<T = string>(session: Session, fn: string, args: Record<string, unknown> = {}): Promise<T> {
    const [row] = await this.rpc(session, fn, args);
    return Object.values(row)[0] as T;
  }
}

// A SupabaseClient stand-in that sends kernel_api RPCs to the local kernel the way PostgREST
// would: scalar functions return the value, set-returning functions return rows, and SQLSTATEs
// come back as { error: { code, message } }. Lets the real typed client run unchanged.
export function localSupabase(k: KernelDb, session: Session): SupabaseClient {
  const client = {
    schema(name: string) {
      if (name !== "kernel_api") throw new Error(`unexpected schema ${name}`);
      return {
        async rpc(fn: string, args: Record<string, unknown>) {
          try {
            const rows = await k.rpc(session, fn, args);
            const data = (await k.returnsSet(fn)) ? rows : rows[0] ? Object.values(rows[0])[0] : null;
            return { data, error: null };
          } catch (error) {
            const { code, message } = error as { code?: string; message: string };
            return { data: null, error: { code, message } };
          }
        },
      };
    },
  };
  return client as unknown as SupabaseClient;
}
