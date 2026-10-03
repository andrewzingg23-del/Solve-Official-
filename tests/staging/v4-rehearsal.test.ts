// Staging rehearsal of kernel v4, for the founder's review before the store is touched. Runs only
// on a Supabase-shaped Postgres (`npm run test:postgres -- tests/staging/v4-rehearsal.test.ts`):
// the production major version, the non-superuser `postgres` role running the migrations, and
// API roles reached through `authenticator` the way the Data API connects.
//
// 1. A copy of the live kernel: the three applied migrations, proven identical to the live store
//    by fingerprints read from it (function bodies and options, columns, constraints).
// 2. v4 applied the way the store would apply it: one transaction, as `postgres`.
// 3. Sign-in, permissions and history checked through `authenticator`.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import pg from "pg";
import { KernelDb, migrate, type Session } from "../../lib/kernel/local";
import { PostgresDb } from "../support/postgres";

const url = process.env.SOV_KERNEL_POSTGRES_URL;

// Read from the live project (dupgybzkkbddsbaykrae) on 2026-10-03, read-only, before any change.
const LIVE = {
  kernel: { functions: 36, fingerprint: "d3c6c3f15ce80f94cd1d8a9041dad7fd" },
  kernel_api: { functions: 37, fingerprint: "524e8470c17f655dca97aa4884fb6cc4" },
  columns: "8bff7f8aeaaf3326037615000726a3cf",
  constraints: "ca3e3bbfecb8e5d66249920aa2b3b34d",
  events: 1,
  actors: 1,
};

const FUNCTIONS = `select n.nspname as schema, count(*)::int as functions,
  md5(string_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' || p.prosecdef::text || coalesce(array_to_string(p.proconfig, ','), '') || p.prosrc, '|' order by p.proname, pg_get_function_identity_arguments(p.oid))) as fingerprint
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('kernel', 'kernel_api') group by n.nspname order by n.nspname`;
const COLUMNS = `select md5(string_agg(c.relname || ':' || (select string_agg(a.attname || ' ' || format_type(a.atttypid, a.atttypmod) || case when a.attnotnull then ' not null' else '' end, ',' order by a.attnum) from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped), '|' order by c.relname)) as h, count(*)::int as tables
  from pg_class c where c.relnamespace = 'kernel'::regnamespace and c.relkind = 'r'`;
const CONSTRAINTS = `select md5(string_agg(conrelid::regclass::text || ':' || conname || ':' || pg_get_constraintdef(oid), '|' order by conrelid::regclass::text, conname)) as h
  from pg_constraint where connamespace = 'kernel'::regnamespace and contype <> 'n'`;

const migrations = () => {
  const dir = join(process.cwd(), "supabase/migrations");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => ({ name: f, sql: readFileSync(join(dir, f), "utf8") }));
};

// A session through `authenticator`, as PostgREST makes it: SET LOCAL ROLE plus the JWT claims.
async function viaApi(dbName: string, session: Session, sql: string, params: unknown[] = []) {
  const u = new URL(url!);
  u.username = "authenticator";
  u.pathname = `/${dbName}`;
  const client = new pg.Client({ connectionString: u.toString() });
  await client.connect();
  try {
    await client.query("begin");
    await client.query(`set local role ${session.role}`);
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(session)]);
    const rows = (await client.query(sql, params)).rows;
    await client.query("commit");
    return rows;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

const code = (c: string) => (error: unknown) => (error as { code?: string }).code === c;

describe("kernel v4 staging rehearsal", { skip: url ? false : "needs a Supabase-shaped Postgres (npm run test:postgres)" }, () => {
  it("applies v4 to an exact copy of the live kernel, and sign-in, permissions and history hold through the API roles", async () => {
    const all = migrations();
    const applied = all.slice(0, 3);
    const v4 = all[3];
    assert.deepEqual(applied.map((m) => m.name), ["20261003064603_memory_kernel.sql", "20261003072025_monetary_proof_of_life.sql", "20261003080203_payment_router.sql"]);
    assert.equal(v4.name, "20261003110000_actions_and_world.sql");

    const db = await PostgresDb.create(url!);
    const k = new KernelDb(db);
    const [server] = await k.owner("select current_setting('server_version') as v, current_user as u, (select rolsuper from pg_roles where rolname = current_user) as su");
    assert.match(String(server.v), /^17\./, "the store's major version");
    assert.deepEqual([server.u, server.su], ["postgres", false], "migrations run as the non-superuser postgres role, as on the store");

    // 1. The live kernel, reproduced and proven identical.
    await migrate(db, applied.map((m) => m.sql));
    assert.deepEqual(await k.owner(FUNCTIONS), [
      { schema: "kernel", ...LIVE.kernel },
      { schema: "kernel_api", ...LIVE.kernel_api },
    ]);
    assert.equal((await k.owner(COLUMNS))[0].h, LIVE.columns);
    assert.equal((await k.owner(CONSTRAINTS))[0].h, LIVE.constraints);
    const [counts] = await k.owner("select (select count(*) from kernel.events)::int as events, (select count(*) from kernel.actors)::int as actors");
    assert.deepEqual(counts, { events: LIVE.events, actors: LIVE.actors });
    const [genesis] = await k.owner("select id, hash from kernel.events order by seq limit 1");

    // 2. v4, as one transaction, as postgres.
    const started = Date.now();
    await db.transaction(async (tx) => tx.exec(v4.sql));
    const seconds = (Date.now() - started) / 1000;
    const after = { functions: await k.owner(FUNCTIONS), columns: (await k.owner(COLUMNS))[0], constraints: (await k.owner(CONSTRAINTS))[0].h };
    console.log(`v4 applied in ${seconds.toFixed(2)}s; post-v4 fingerprints: ${JSON.stringify(after)}`);
    assert.ok(seconds < 60, "well inside the store's statement limits");

    // History survives: the genesis event is untouched and the chain verifies across the boundary.
    assert.deepEqual((await k.owner("select id, hash from kernel.events order by seq limit 1"))[0], genesis);
    const service: Session = { role: "service_role" };
    assert.deepEqual((await viaApi(db.name, service, "select * from kernel_api.verify_chain()"))[0].ok, true);

    // 3. Sign-in: a signed-in person becomes one canonical actor, once.
    const founder: Session = { role: "authenticated", sub: "00000000-0000-4000-8000-000000000001" } as Session;
    const [registered] = await viaApi(db.name, founder, "select kernel_api.register('Founder') as id");
    const [again] = await viaApi(db.name, founder, "select kernel_api.register('Founder') as id");
    assert.equal(again.id, registered.id, "signing in again finds the same actor");
    const [me] = await viaApi(db.name, founder, "select * from kernel_api.whoami()");
    assert.deepEqual([me.actor_id, me.kind, me.label], [registered.id, "human", "Founder"]);
    await assert.rejects(viaApi(db.name, { role: "authenticated", sub: "x", is_anonymous: true } as Session, "select kernel_api.register()"), code("KA001"), "anonymous sessions cannot register");
    await assert.rejects(viaApi(db.name, { role: "authenticated", sub: "00000000-0000-4000-8000-000000000009" } as Session, "select * from kernel_api.whoami()"), code("KA001"), "an unregistered user is nobody yet");

    // Permissions: anon calls nothing; users reach only kernel_api, as themselves; the service key
    // must name a non-human actor; only the service may verify the chain.
    await assert.rejects(viaApi(db.name, { role: "anon" }, "select * from kernel_api.whoami()"), code("42501"));
    await assert.rejects(viaApi(db.name, founder, "select count(*) from kernel.events"), code("42501"));
    await assert.rejects(viaApi(db.name, founder, "select * from kernel_api.verify_chain()"), code("42501"));
    await assert.rejects(viaApi(db.name, service, "select * from kernel_api.whoami()"), code("KA003"));
    await assert.rejects(viaApi(db.name, service, "select * from kernel_api.whoami($1)", [registered.id]), code("KA002"), "the service key cannot act as a human");
    const [grants] = await k.owner(
      `select has_schema_privilege('authenticated', 'kernel', 'USAGE') as user_kernel, has_schema_privilege('anon', 'kernel_api', 'USAGE') as anon_api,
              (select count(*)::int from information_schema.role_table_grants where table_schema = 'kernel' and grantee in ('anon', 'authenticated', 'service_role')) as table_grants`,
    );
    assert.deepEqual(grants, { user_kernel: false, anon_api: false, table_grants: 0 });

    // A first useful write through v4 as the signed-in person: an AI companion with no authority
    // of its own beyond observing its owner's scope.
    const [agent] = await viaApi(db.name, founder, "select kernel_api.create_avatar(p_avatar_type => 'ai_companion', p_name => 'Nova', p_relationship => 'assist') as id");
    assert.ok(agent.id);
    const [mine] = await viaApi(db.name, founder, "select * from kernel_api.my_avatars()");
    const agentGrants = await viaApi(db.name, service, "select capability, scope from kernel_api.my_grants($1)", [mine.agent_id]);
    assert.deepEqual(agentGrants.map((g) => `${g.capability} ${g.scope}`), [`kernel.read actor:${registered.id}`], "a new companion may only observe its owner's own scope");
    assert.deepEqual((await viaApi(db.name, service, "select * from kernel_api.verify_chain()"))[0].ok, true);
  });
});
