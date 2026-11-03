// Real action + migrated kernel. Only framework/Auth and provider transport are fixtures.
import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdir, mkdtemp } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createKernelDb, user } from "../kernel/harness";
import { localSupabase } from "../../lib/kernel/local";
import { kernelClient, KernelError, type Kernel } from "../../lib/kernel/client";
import { createCreativeWorld, createCreativeArtifact, updateCreativeArtifact, loadCreativeWorld } from "../../lib/world/creative";
import { grantWorldAccess } from "../../lib/world/collaboration";

declare global { var __draftFixture: { kernel: Kernel; user: { id: string } | null }; }
export const html = '<!DOCTYPE html><html><head><title>Cafe</title></head><body><h1>Cafe</h1><p>Fresh coffee and warm pastries by the beach. Come in every morning for breakfast and a quiet place to relax.</p></body></html>';
let action: (world: string, form: FormData) => Promise<{ ok: boolean; error?: string }>;
async function loadAction() {
  if (action) return action;
  await mkdir('.browser-tests', { recursive: true });
  const dir = await mkdtemp('.browser-tests/draft-action-');
  const stubs: Record<string, string> = {
    '@/lib/kernel/server': 'export async function getKernel(){return globalThis.__draftFixture.kernel}',
    '@/lib/supabase/server': 'export async function getUser(){return globalThis.__draftFixture.user}',
    'next/cache': 'export function revalidatePath(){}',
    'server-only': '',
  };
  await build({ entryPoints: ['app/world/[worldId]/draft-actions.ts'], outfile: `${dir}/action.mjs`, bundle: true, platform: 'node', format: 'esm', packages: 'external', plugins: [{ name: 'fixture-adapters', setup(b) {
    b.onResolve({ filter: /kernel\/client$/ }, () => ({ path: pathToFileURL(`${process.cwd()}/lib/kernel/client.ts`).href, external: true }));
    b.onResolve({ filter: /.*/ }, a => a.path in stubs ? { path: a.path, namespace: 'fixture' } : undefined);
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ contents: stubs[a.path] }));
  } }] });
  action = (await import(pathToFileURL(`${process.cwd()}/${dir}/action.mjs`).href)).generateFirstDraftAction;
  return action;
}
test('draft action enforces grants before inference and reconciles only confirmed saves', async t => {
  const db = await createKernelDb();
  const owner = kernelClient(localSupabase(db, user('auth:draft-owner')));
  const viewer = kernelClient(localSupabase(db, user('auth:draft-viewer')));
  await owner.register('Owner'); const viewerId = await viewer.register('Viewer');
  let world = await createCreativeWorld(owner, { worldId: '00000000-0000-4000-8000-000000000aa1', title: 'Cafe', goal: 'Make a coffee shop website' });
  await grantWorldAccess(owner, { scope: world.scope, granteeActorId: viewerId, role: 'viewer', requestId: 'viewer-001' });
  const run = await loadAction();
  const oldKey = process.env.OPENROUTER_API_KEY, oldModel = process.env.OPENROUTER_MODEL_SMART, original = globalThis.fetch;
  process.env.OPENROUTER_API_KEY = 'fixture-not-a-secret'; process.env.OPENROUTER_MODEL_SMART = 'fixture-only:free';
  let calls = 0;
  globalThis.fetch = (async () => { calls++; return Response.json({ choices: [{ message: { content: html }, finish_reason: 'stop' }], usage: { prompt_tokens: 20, completion_tokens: 100 } }); }) as typeof fetch;
  const form = new FormData(); form.set('goal', 'Make a coffee shop website');
  try {
    await t.test('viewer is refused before provider transport', async () => {
      globalThis.__draftFixture = { kernel: viewer, user: { id: 'auth:draft-viewer' } }; form.set('expectedActorId', viewerId);
      const result = await run(world.worldId, form);
      assert.equal(result.ok, false); assert.equal(calls, 0, 'read permission cannot spend generation resources');
    });
    globalThis.__draftFixture = { kernel: owner, user: { id: 'auth:draft-owner' } }; form.set('expectedActorId', (await owner.whoami()).actor_id);
    world = await createCreativeWorld(owner, { worldId: '00000000-0000-4000-8000-000000000aa2', title: 'Cafe', goal: 'Make a coffee shop website' });
    await t.test('goal bound is enforced server-side before inference', async () => {
      const count = calls; form.set('goal', 'x'.repeat(7001));
      assert.equal((await run(world.worldId, form)).ok, false); assert.equal(calls, count);
      form.set('goal', 'Make a coffee shop website');
    });
    world = await createCreativeWorld(owner, { worldId: '00000000-0000-4000-8000-000000000aa3', title: 'Cafe', goal: 'Make a coffee shop website' });
    await t.test('unrelated kernel conflict is not reported as a saved draft', async () => {
      // Conflict in authorization/read cannot prove artifact creation happened.
      globalThis.__draftFixture.kernel = new Proxy(owner, { get(target, key) {
        if (key === 'readWorld') return async () => { throw new KernelError('conflict', 'Fixture conflict', ''); };
        return Reflect.get(target, key);
      } });
      assert.equal((await run(world.worldId, form)).ok, false);
      globalThis.__draftFixture.kernel = owner;
    });
    await t.test('complete source persists; retry opens it without another provider call', async () => {
      assert.equal((await run(world.worldId, form)).ok, true);
      const stored = (await loadCreativeWorld(owner, world.worldId)).artifacts.filter(a => a.body === html);
      assert.equal(stored.length, 1); assert.equal(stored[0].version, 1);
      const count = calls;
      delete process.env.OPENROUTER_API_KEY;
      assert.equal((await run(world.worldId, form)).ok, true, 'saved output remains usable without provider credentials');
      assert.equal(calls, count);
    });
    process.env.OPENROUTER_API_KEY = 'fixture-not-a-secret';
    await t.test('a write conflict with no saved output does not claim success', async () => {
      const empty = await createCreativeWorld(owner, { worldId: '00000000-0000-4000-8000-000000000aa4', title: 'Cafe' });
      globalThis.__draftFixture.kernel = new Proxy(owner, { get(target, key) {
        if (key === 'upsertEntity') return async () => { throw new KernelError('conflict', 'Fixture write conflict', ''); };
        return Reflect.get(target, key);
      } });
      assert.equal((await run(empty.worldId, form)).ok, false);
      globalThis.__draftFixture.kernel = owner;
    });
    await t.test('a concurrent save is opened only after its saved source is confirmed', async () => {
      const empty = await createCreativeWorld(owner, { worldId: '00000000-0000-4000-8000-000000000aa5', title: 'Cafe' });
      globalThis.__draftFixture.kernel = new Proxy(owner, { get(target, key) {
        if (key === 'upsertEntity') return async () => {
          await createCreativeArtifact(owner, { scope: empty.scope, worldEntityId: empty.entityId, requestId: `first-draft:${empty.worldId}`, title: 'Cafe — first draft', body: html, documentType: 'website', position: { x: 50, y: 30 } });
          throw new KernelError('conflict', 'Concurrent save', '');
        };
        return Reflect.get(target, key);
      } });
      assert.equal((await run(empty.worldId, form)).ok, true);
      assert.equal((await loadCreativeWorld(owner, empty.worldId)).artifacts.length, 1);
      globalThis.__draftFixture.kernel = owner;
    });
    await t.test('account changes cannot trigger inference or report an existing output as saved', async () => {
      const count = calls;
      form.set('expectedActorId', viewerId);
      const result = await run(world.worldId, form);
      assert.equal(result.ok, false); assert.match(result.error || '', /sign-in changed/i);
      assert.equal(calls, count);
      form.set('expectedActorId', (await owner.whoami()).actor_id);
    });
    await t.test('governed write policy blocks inference even with an active owner grant', async () => {
      const governed = await createCreativeWorld(owner, { worldId: '00000000-0000-4000-8000-000000000aa7', title: 'Governed' });
      await owner.setActionPolicy({ scope: governed.scope, capability: 'world.entity.write', requirement: 'deny' });
      const count = calls;
      assert.equal((await run(governed.worldId, form)).ok, false);
      assert.equal(calls, count);
    });
    await t.test('an authorized editor can create a first draft', async () => {
      const editor = kernelClient(localSupabase(db, user('auth:draft-editor')));
      const editorId = await editor.register('Editor');
      const shared = await createCreativeWorld(owner, { worldId: '00000000-0000-4000-8000-000000000aa8', title: 'Shared cafe' });
      await grantWorldAccess(owner, { scope: shared.scope, granteeActorId: editorId, role: 'editor', requestId: 'editor-001' });
      globalThis.__draftFixture = { kernel: editor, user: { id: 'auth:draft-editor' } };
      form.set('expectedActorId', editorId);
      assert.equal((await run(shared.worldId, form)).ok, true);
      assert.equal((await loadCreativeWorld(owner, shared.worldId)).artifacts.length, 1);
      globalThis.__draftFixture = { kernel: owner, user: { id: 'auth:draft-owner' } };
      form.set('expectedActorId', (await owner.whoami()).actor_id);
    });
    await t.test('a maximum-length project title still yields a saveable draft title', async () => {
      const long = await createCreativeWorld(owner, { worldId: '00000000-0000-4000-8000-000000000aa6', title: 'x'.repeat(160) });
      assert.equal((await run(long.worldId, form)).ok, true);
      assert.equal((await loadCreativeWorld(owner, long.worldId)).artifacts.length, 1);
    });
    await t.test('storage rejects excessive JSON escaping as a recoverable validation error', async () => {
      await assert.rejects(createCreativeArtifact(owner, { scope: world.scope, worldEntityId: world.entityId, requestId: 'quoted-html', title: 'Quoted page', body: html.replace('</body>', '<style>/*' + '"'.repeat(9000) + '*/</style></body>'), documentType: 'website', position: { x: 1, y: 1 } }),
        e => e instanceof KernelError && e.name === 'invalid' && /formatting|large/i.test(e.message));
    });
    await t.test('an oversized revision preserves the prior saved version', async () => {
      const saved = (await loadCreativeWorld(owner, world.worldId)).artifacts.find(a => a.body === html)!;
      await assert.rejects(updateCreativeArtifact(owner, { scope: world.scope, entityId: saved.entityId, requestId: 'quoted-revision', expectedVersion: saved.version, title: saved.title, body: html.replace('</body>', '<style>/*' + '"'.repeat(9000) + '*/</style></body>'), position: saved.position }),
        e => e instanceof KernelError && e.name === 'invalid' && /formatting|large/i.test(e.message));
      const reopened = (await loadCreativeWorld(owner, world.worldId)).artifacts.find(a => a.entityId === saved.entityId)!;
      assert.equal(reopened.version, 1); assert.equal(reopened.body, html);
    });
  } finally {
    globalThis.fetch = original;
    if (oldKey === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = oldKey;
    if (oldModel === undefined) delete process.env.OPENROUTER_MODEL_SMART; else process.env.OPENROUTER_MODEL_SMART = oldModel;
  }
});
