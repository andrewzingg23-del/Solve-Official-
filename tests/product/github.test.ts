// GitHub through Solve: the person's own connection, sealed on the server; an AI uses it only if the
// person allowed that AI; lapsed access is renewed without asking; refusals are honest. Real kernel
// migrations (PGlite); GitHub is a fake, so every provider answer is chosen here.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { it } from "node:test";
import { kernelClient } from "../../lib/kernel/client";
import { localSupabase } from "../../lib/kernel/local";
import { createCreativeWorld } from "../../lib/world/creative";
import { setBotAccess } from "../../lib/bot/worlds";
import { runCapability } from "../../lib/product/run";
import { githubRepoAdapter, githubToken } from "../../lib/product/adapters/github";
import { PROVIDER_USE, providerScope, readProvider, unseal, writeProvider } from "../../lib/product/credentials";
import { app, createKernelDb, user } from "../kernel/harness";

process.env.SOLVE_PROVIDER_ENCRYPTION_KEY = "test-only-provider-key";
process.env.GITHUB_APP_CLIENT_ID = "Iv1.test";
process.env.GITHUB_APP_CLIENT_SECRET = "test-secret";

const REPO = { full_name: "zuber/pen-firmware", description: "Find-my-pen firmware", html_url: "https://github.com/zuber/pen-firmware", default_branch: "main", visibility: "private", pushed_at: "2026-11-09T10:00:00Z", stargazers_count: 3, open_issues_count: 2 };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });

/** A fake GitHub: answers with whatever this test needs, and remembers what it was asked. */
function fakeGithub(opts: { valid?: string; refreshTo?: string | null; repo?: number } = {}) {
  const calls: string[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith("/login/oauth/access_token")) {
      return opts.refreshTo ? json({ access_token: opts.refreshTo, expires_in: 28800, refresh_token: "rt-2", refresh_token_expires_in: 15897600 }) : json({ error: "bad_refresh_token" });
    }
    const auth = new Headers(init?.headers).get("authorization");
    if (auth !== `Bearer ${opts.valid ?? "at-1"}`) return json({ message: "Bad credentials" }, 401);
    if (url.endsWith("/readme")) return json({ content: Buffer.from("# Pen firmware\nRings your phone.").toString("base64") });
    return opts.repo === 404 ? json({ message: "Not Found" }, 404) : json(REPO);
  }) as typeof fetch;
  return { fetchImpl, calls };
}

async function setup(tokens = { accessToken: "at-1", expiresAt: new Date(Date.now() + 3600_000).toISOString(), refreshToken: "rt-1", refreshExpiresAt: null as string | null }) {
  const db = await createKernelDb();
  const sam = kernelClient(localSupabase(db, user("auth:gh-sam")));
  const samId = await sam.register("Sam");
  const pen = await createCreativeWorld(sam, { worldId: randomUUID(), title: "Zuber Pen" });
  await writeProvider(sam, samId, "github", null, { account: "sam-zuber", status: "connected", secret: tokens }, "connect-1");
  const agent = await sam.connectApp("tool-1", "Claude", "c-1");
  await setBotAccess(sam, { scope: pen.scope, botAgentId: agent, access: "add" }, "pen-add");
  const asApp = kernelClient(localSupabase(db, app("auth:gh-sam", "tool-1")));
  return { db, sam, samId, pen, agent, asApp };
}

it("the token is sealed in the person's own record: the kernel holds ciphertext, never the token", async () => {
  const { sam, samId } = await setup();
  const rec = (await sam.readWorld(providerScope(samId, "github")))[0];
  assert.ok(!JSON.stringify(rec.attributes).includes("at-1"), "no plaintext token in the kernel");
  const conn = await readProvider(sam, samId, "github");
  assert.equal(unseal<{ accessToken: string }>(conn!.sealed!).accessToken, "at-1", "only Solve's server key opens it");
});

it("the person reads their repository into a Space, verified against GitHub's answer", async () => {
  const { sam, samId, pen } = await setup();
  const gh = fakeGithub();
  const run = await runCapability(sam, githubRepoAdapter(() => githubToken(sam, samId, gh.fetchImpl), gh.fetchImpl), pen.worldId, { repo: "https://github.com/zuber/pen-firmware" }, "r-1");
  assert.ok(run.ok, JSON.stringify(run));
  const saved = (await sam.readWorld(pen.scope)).find(e => e.entity_id === (run.ok ? run.entityId : ""));
  assert.equal(saved?.title, "zuber/pen-firmware");
  assert.match(String((saved?.attributes.github as { readme: string }).readme), /Rings your phone/);
  const [task] = await sam.readTasks(pen.scope);
  assert.equal((task.result?.metering as { provider: string }).provider, "github");
});

it("an AI the person didn't allow is refused plainly, and GitHub is never called", async () => {
  const { pen, asApp, samId } = await setup();
  const gh = fakeGithub();
  const run = await runCapability(asApp, githubRepoAdapter(() => githubToken(asApp, samId, gh.fetchImpl), gh.fetchImpl), pen.worldId, { repo: "zuber/pen-firmware" }, "a-1");
  assert.equal(run.ok, false);
  assert.match(run.ok ? "" : run.error, /isn't allowed to use your GitHub/);
  assert.equal(gh.calls.length, 0);
});

it("an AI the person allowed reads it as itself, with the person's token it never sees", async () => {
  const { sam, samId, pen, agent, asApp } = await setup();
  await setBotAccess(sam, { scope: providerScope(samId, "github"), botAgentId: agent, access: "add", capabilities: PROVIDER_USE }, "use");
  const gh = fakeGithub();
  const run = await runCapability(asApp, githubRepoAdapter(() => githubToken(asApp, samId, gh.fetchImpl), gh.fetchImpl), pen.worldId, { repo: "zuber/pen-firmware" }, "a-2");
  assert.ok(run.ok, JSON.stringify(run));
  const made = (await sam.readEvents(pen.scope, { limit: 500 })).find(e => e.type === "kernel.entity.created" && (e.payload as { entity_id?: string }).entity_id === (run.ok ? run.entityId : ""));
  assert.equal(made?.actor_id, agent);
  // Withdrawn: the next read is refused.
  await setBotAccess(sam, { scope: providerScope(samId, "github"), botAgentId: agent, access: "none" }, "unuse");
  const again = await runCapability(asApp, githubRepoAdapter(() => githubToken(asApp, samId, gh.fetchImpl), gh.fetchImpl), pen.worldId, { repo: "zuber/pen-firmware" }, "a-3");
  assert.equal(again.ok, false);
});

it("lapsed access is renewed without asking, and the renewed token is sealed back", async () => {
  const { sam, samId, pen } = await setup({ accessToken: "at-old", expiresAt: new Date(Date.now() - 1000).toISOString(), refreshToken: "rt-1", refreshExpiresAt: null });
  const gh = fakeGithub({ valid: "at-new", refreshTo: "at-new" });
  const run = await runCapability(sam, githubRepoAdapter(() => githubToken(sam, samId, gh.fetchImpl), gh.fetchImpl), pen.worldId, { repo: "zuber/pen-firmware" }, "lapsed");
  assert.ok(run.ok, JSON.stringify(run));
  assert.ok(gh.calls.some(u => u.endsWith("/login/oauth/access_token")), "GitHub's refresh was used");
  assert.equal(unseal<{ accessToken: string }>((await readProvider(sam, samId, "github"))!.sealed!).accessToken, "at-new");
});

it("when GitHub refuses to renew, the connection says Reconnect and the task says why", async () => {
  const { sam, samId, pen } = await setup({ accessToken: "at-old", expiresAt: new Date(Date.now() - 1000).toISOString(), refreshToken: "rt-dead", refreshExpiresAt: null });
  const gh = fakeGithub({ refreshTo: null });
  const run = await runCapability(sam, githubRepoAdapter(() => githubToken(sam, samId, gh.fetchImpl), gh.fetchImpl), pen.worldId, { repo: "zuber/pen-firmware" }, "dead");
  assert.equal(run.ok, false);
  assert.match(run.ok ? "" : run.error, /Reconnect/);
  assert.equal((await readProvider(sam, samId, "github"))!.status, "reconnect");
});

it("a repository GitHub won't show is reported honestly, not invented", async () => {
  const { sam, samId, pen } = await setup();
  const gh = fakeGithub({ repo: 404 });
  const run = await runCapability(sam, githubRepoAdapter(() => githubToken(sam, samId, gh.fetchImpl), gh.fetchImpl), pen.worldId, { repo: "zuber/secret" }, "404");
  assert.equal(run.ok, false);
  assert.match(run.ok ? "" : run.error, /won't show zuber\/secret/);
});

it("disconnected, nothing can use it", async () => {
  const { sam, samId, pen } = await setup();
  const conn = await readProvider(sam, samId, "github");
  await writeProvider(sam, samId, "github", conn, { account: "sam-zuber", status: "disconnected", secret: null }, "off");
  const gh = fakeGithub();
  const run = await runCapability(sam, githubRepoAdapter(() => githubToken(sam, samId, gh.fetchImpl), gh.fetchImpl), pen.worldId, { repo: "zuber/pen-firmware" }, "off-1");
  assert.equal(run.ok, false);
  assert.match(run.ok ? "" : run.error, /isn't connected/);
});
