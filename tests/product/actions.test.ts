// Labelled Auth/Next adapters around the actual actions and real migrated SQL.
import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createKernelDb, user } from "../kernel/harness";
import { localSupabase } from "../../lib/kernel/local";
import { kernelClient, type Kernel } from "../../lib/kernel/client";
import { DEFAULT_PERSONA } from "../../lib/bot/persona";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { createCreativeWorld } from "../../lib/world/creative";
import { grantWorldAccess } from "../../lib/world/collaboration";
import { loadBot } from "../../lib/bot/store";

declare global { var __solveActionFixture: { user: { id: string; user_metadata: Record<string, unknown> } | null; kernel: Kernel }; }
let modules: Promise<Record<string, Record<string, (...args: unknown[]) => Promise<unknown>>>> | undefined;
async function actions() {
  return modules ??= (async () => {
    const dir = await mkdtemp(join(process.cwd(), ".browser-tests", "action-regressions-"));
    const entries = { profile: "app/account/profile-actions.ts", project: "app/product/project-actions.ts", bot: "app/bot/actions.ts", documents: "app/world/[worldId]/actions.ts", communities: "app/communities/actions.ts", community: "app/community/[communityId]/actions.ts", people: "app/world/[worldId]/access-panel.tsx" };
    const stubs: Record<string, string> = {
      "@/lib/supabase/server": 'export async function getUser(){return globalThis.__solveActionFixture.user;} export async function createClient(){return {auth:{updateUser:async()=>({error:null})}};}',
      "@/lib/kernel/server": 'export async function getKernel(){return globalThis.__solveActionFixture.kernel;}',
      "next/cache": 'export function revalidatePath(){}',
      "next/navigation": 'export function redirect(url){throw new Error("redirect:"+url);} export function notFound(){throw new Error("not-found");} export function useRouter(){return {refresh(){},push(){}};}',
      "next/headers": 'export async function headers(){return new Headers();}',
      "server-only": '',
    };
    await build({ entryPoints: entries, outdir: dir, bundle: true, platform: "node", format: "esm", packages: "external", plugins: [{ name: "labelled-action-adapters", setup(b) {
      b.onResolve({ filter: /.*/ }, args => args.path in stubs ? { path: args.path, namespace: "fixture" } : undefined);
      b.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ contents: stubs[args.path] }));
    } }] });
    const loaded: Record<string, Record<string, (...args: unknown[]) => Promise<unknown>>> = {};
    for (const name of Object.keys(entries)) loaded[name] = await import(pathToFileURL(join(dir, name + ".js")).href);
    await rm(dir, { recursive: true });
    return loaded;
  })();
}
async function accountFixture() {
  const db = await createKernelDb();
  const ana = kernelClient(localSupabase(db, user("auth:action-ana")));
  const ben = kernelClient(localSupabase(db, user("auth:action-ben")));
  const anaActor = await ana.register("Ana"); await ben.register("Ben");
  globalThis.__solveActionFixture = { user: { id: "auth:action-ben", user_metadata: {} }, kernel: ben };
  return { ana, ben, anaActor };
}

test("stale Profile tab cannot save its reviewed identity into another account", async () => {
  const { ben } = await accountFixture(), a = await actions();
  const result = await a.profile.saveProfileAction({ name: "Ana's draft", botName: "Mira", face: "host" }, "stale-profile-001", "auth:action-ana");
  assert.equal((result as { ok: boolean }).ok, false);
  assert.equal((await ben.whoami()).label, "Ben"); assert.equal((await loadBot(ben)).avatar, null);
});

test("stale project tab cannot create its idea under another account", async () => {
  const { ben } = await accountFixture(), a = await actions();
  const result = await a.project.createProject({ id: "cf616a60-a873-47c8-a5a3-25b2882b9e18", title: "Ana's idea", goal: "Keep it in Ana's account" }, "auth:action-ana");
  assert.equal((result as { ok: boolean }).ok, false);
  assert.equal((await ben.myGrants()).filter(g => g.scope.startsWith("world:")).length, 0);
});

test("stale persona editor cannot overwrite the current account's AI", async () => {
  const { ben, anaActor } = await accountFixture(), a = await actions();
  const result = await a.bot.saveBotAction("stale-persona-001", { ...DEFAULT_PERSONA, name: "Ana's AI" }, anaActor);
  assert.equal((result as { ok: boolean }).ok, false); assert.equal((await loadBot(ben)).avatar, null);
});

test("knowledge returns a recoverable failure instead of a reset-worthy success", async () => {
  await accountFixture(); const a = await actions();
  globalThis.__solveActionFixture.user = null;
  const form = new FormData(); form.set("text", "A note that must stay in the form");
  const result = await a.bot.addMemoryAction(form);
  assert.equal((result as { ok?: boolean } | undefined)?.ok, false);
});

test("database failures return form errors for documents, communities and notes", async () => {
  await accountFixture(); const a = await actions();
  globalThis.__solveActionFixture.kernel = new Proxy(globalThis.__solveActionFixture.kernel, { get(target, key) { if (key === "then") return undefined; if (key === "whoami") return () => target.whoami(); return async () => { throw new Error("Labelled database outage"); }; } });
  const actorId = (await globalThis.__solveActionFixture.kernel.whoami()).actor_id;
  for (const [fn, prefix, entries] of [
    [a.documents.createArtifactAction, ["cf616a60-a873-47c8-a5a3-25b2882b9e18"], { title: "Keep document", body: "Unsaved words", x: "20", y: "20" }],
    [a.communities.startCommunityAction, [], { name: "Keep community", about: "Unsaved goal", nonce: "retained-community-001", expectedUserId: "auth:action-ben" }],
    [a.community.sendNoteAction, ["cf616a60-a873-47c8-a5a3-25b2882b9e18"], { text: "Keep note", to: actorId }],
    [a.community.askToJoinAction, ["cf616a60-a873-47c8-a5a3-25b2882b9e18"], { note: "Keep introduction" }],
  ] as const) {
    const form = new FormData(); form.set("expectedActorId", actorId); form.set("requestId", "retained-form-001");
    for (const [name, value] of Object.entries(entries)) form.set(name, value);
    const result = await fn(...prefix, form);
    assert.equal((result as { ok?: boolean } | undefined)?.ok, false);
  }
});


test("members can reach People without owner management controls", async () => {
  const { ana, ben } = await accountFixture(), a = await actions();
  const world = await createCreativeWorld(ana, { worldId: "9631a1a7-9485-4df2-b772-654aa1520c27", title: "Members' project" });
  await grantWorldAccess(ana, { scope: world.scope, granteeActorId: (await ben.whoami()).actor_id, role: "viewer", requestId: "people-member-001" });
  const view = await a.people.WorldAccessPanel({ worldId: world.worldId, scope: world.scope, saved: false });
  const html = renderToStaticMarkup(view as ReactNode);
  assert.match(html, /id="people-heading"/); assert.match(html, /Ana/); assert.match(html, /Ben/);
  assert.doesNotMatch(html, /Grant access|Remove|Create invite/);
});


test("the displayed current account can save profile, persona and project", async () => {
  const { ben } = await accountFixture(), a = await actions();
  const actor = (await ben.whoami()).actor_id;
  const profile = await a.profile.saveProfileAction({ name: "Benjamin", botName: "Mira", face: "host" }, "current-profile-001", "auth:action-ben");
  assert.equal((profile as { ok: boolean }).ok, true);
  const persona = await a.bot.saveBotAction("current-persona-001", { ...DEFAULT_PERSONA, name: "Juno" }, actor);
  assert.equal((persona as { ok: boolean }).ok, true); assert.equal((await loadBot(ben)).persona.name, "Juno");
  const project = await a.project.createProject({ id: "73fc282f-63ac-4c5e-8d63-949d3a778b93", title: "Ben's idea", goal: "A real saved project" }, "auth:action-ben");
  assert.equal((project as { ok: boolean }).ok, true);
});
