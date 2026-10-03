// Runs the kernel and loop tests against a real Postgres server shaped like Supabase's: the
// production major version, a non-superuser `postgres` role that owns the kernel and runs the
// migrations, and the API roles (anon, authenticated, service_role) reached through a
// non-inheriting `authenticator`. PGlite (the default runtime) is a newer major running as
// superuser, so this lane is the parity check before a migration goes to the store.
//
//   SOV_PG_BIN=/path/to/postgres/17/bin npm run test:postgres [-- test files…]
//
// Without SOV_PG_BIN it looks for the binaries of @embedded-postgres/linux-x64 if installed.
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, chownSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import pg from "pg";

function binDir() {
  if (process.env.SOV_PG_BIN) return process.env.SOV_PG_BIN;
  try {
    const pkg = createRequire(import.meta.url).resolve("@embedded-postgres/linux-x64/package.json");
    return join(dirname(pkg), "native/bin");
  } catch {
    console.error("No Postgres binaries: set SOV_PG_BIN to a Postgres bin directory (the store runs 17).");
    process.exit(2);
  }
}

const bin = binDir();
const tool = (name) => join(bin, name);
if (!existsSync(tool("postgres"))) {
  console.error(`no postgres binary in ${bin}`);
  process.exit(2);
}
const version = spawnSync(tool("postgres"), ["--version"], { encoding: "utf8" }).stdout.trim();
const dir = mkdtempSync(join(tmpdir(), "sov-pg-"));
// Postgres refuses to run as root: as root, run the server as an unprivileged OS user.
const osUser = process.getuid?.() === 0 ? (process.env.SOV_PG_OS_USER ?? "postgres") : null;
if (osUser) {
  const id = (flag) => Number(spawnSync("id", [flag, osUser], { encoding: "utf8" }).stdout.trim());
  chownSync(dir, id("-u"), id("-g"));
  chmodSync(dir, 0o700);
}
const asServer = (cmd, args) => (osUser ? ["runuser", ["-u", osUser, "--", cmd, ...args]] : [cmd, args]);
const data = join(dir, "data");
const port = 54_000 + Math.floor(Math.random() * 1_000);
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")}\n${r.stderr || r.stdout}`);
  return r.stdout;
};

run(...asServer(tool("initdb"), ["-D", data, "-U", "supabase_admin", "-A", "trust", "--no-sync", "-E", "UTF8", "--locale=C"]));
const server = spawn(
  ...asServer(tool("postgres"), ["-D", data, "-k", dir, "-p", String(port), "-c", "listen_addresses=", "-c", "fsync=off", "-c", "synchronous_commit=off", "-c", "full_page_writes=off", "-c", "max_connections=600"]),
  { stdio: ["ignore", "ignore", "pipe"] },
);
let serverLog = "";
server.stderr.on("data", (d) => (serverLog += d));

const adminUrl = `postgres://supabase_admin@localhost:${port}/postgres?host=${encodeURIComponent(dir)}`;
async function sql(text) {
  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();
  try {
    await client.query(text);
  } finally {
    await client.end();
  }
}
for (let i = 0; ; i++) {
  try {
    await sql("select 1");
    break;
  } catch {
    if (i > 100) throw new Error(`postgres did not start\n${serverLog}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

// The roles as the store has them (checked against the live project's pg_roles).
await sql(`
  create role postgres login nosuperuser createrole createdb bypassrls inherit;
  create role anon nologin inherit;
  create role authenticated nologin inherit;
  create role service_role nologin inherit bypassrls;
  create role authenticator login noinherit;
  grant anon, authenticated, service_role to authenticator;
  grant anon, authenticated, service_role to postgres;
  alter database postgres owner to postgres;
`);

const files = process.argv.slice(2);
console.log(`postgres: ${version}, migrations as non-superuser postgres, API roles through authenticator`);
const tests = spawn(process.execPath, ["--import", "tsx", "--test", "--test-force-exit", "--test-concurrency=4", ...(files.length ? files : ["tests/**/*.test.ts"])], {
  stdio: "inherit",
  env: { ...process.env, SOV_KERNEL_POSTGRES_URL: `postgres://postgres@localhost:${port}/postgres?host=${encodeURIComponent(dir)}` },
});
const code = await new Promise((resolve) => tests.on("exit", resolve));

// Signals to runuser do not reach the server: stop it with pg_ctl as the same OS user.
run(...asServer(tool("pg_ctl"), ["-D", data, "stop", "-m", "fast", "-w"]));
await new Promise((r) => (server.exitCode !== null ? r() : server.on("exit", r)));
rmSync(dir, { recursive: true, force: true });
process.exit(code ?? 1);
