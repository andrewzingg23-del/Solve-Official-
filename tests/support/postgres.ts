// The kernel on a real Postgres server, for parity with the store: Supabase runs Postgres 17 with
// a non-superuser `postgres` role owning the kernel, while the default test runtime (PGlite) is
// Postgres 18 running as superuser. `npm run test:postgres` starts such a server and points the
// harness here; every kernel and loop test then runs unchanged against it, with real concurrent
// connections instead of PGlite's single one.
import pg from "pg";
import type { PGliteLike } from "../../lib/kernel/local";

// Match PGlite's parsing: int8 as a JS number (kernel counts and sequences fit).
pg.types.setTypeParser(20, (v) => Number(v));

const prefix = `k${process.pid}_`;
let seq = 0;

const withDatabase = (url: string, name: string) => {
  const u = new URL(url);
  u.pathname = `/${name}`;
  return u.toString();
};

async function admin(url: string, sql: string) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

type Queryable = { query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }> };

const wrap = (q: Queryable): PGliteLike => ({
  query: async <T>(sql: string, params?: unknown[]) => ({ rows: (await q.query(sql, params)).rows as T[] }),
  exec: async (sql: string) => {
    await q.query(sql);
  },
  transaction: () => {
    throw new Error("nested transactions are not used by the kernel harness");
  },
});

export class PostgresDb implements PGliteLike {
  private readonly pool: pg.Pool;
  private ended = false;

  constructor(
    private readonly url: string,
    readonly name: string,
  ) {
    this.pool = new pg.Pool({ connectionString: withDatabase(url, name), max: 6, idleTimeoutMillis: 1_000 });
  }

  static async create(url: string) {
    const name = `${prefix}${seq++}`;
    await admin(url, `create database ${name}`);
    return new PostgresDb(url, name);
  }

  async query<T = Record<string, unknown>>(sql: string, params?: unknown[]) {
    return { rows: (await this.pool.query(sql, params)).rows as T[] };
  }

  async exec(sql: string) {
    // A multi-statement simple query runs as one implicit transaction, as a migration does.
    await this.pool.query(sql);
  }

  async transaction<T>(fn: (tx: PGliteLike) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const result = await fn(wrap(client));
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  // A copy of this database (CREATE DATABASE … TEMPLATE needs the template to have no sessions).
  async clone(): Promise<PGliteLike> {
    if (!this.ended) {
      this.ended = true;
      await this.pool.end();
    }
    const name = `${prefix}${seq++}`;
    await admin(this.url, `create database ${name} template ${this.name}`);
    return new PostgresDb(this.url, name);
  }
}
