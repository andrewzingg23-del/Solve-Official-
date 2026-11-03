import test from 'node:test';
import assert from 'node:assert/strict';
import { createKernelDb, user } from '../kernel/harness';
import { kernelClient } from '../../lib/kernel/client';
import { localSupabase } from '../../lib/kernel/local';
import { saveProvider, readProvider, disconnectProvider, providerScope, connectionStatus } from '../../lib/ai/provider';

test('personal provider is encrypted, isolated, revocable and never falls back to deployment credentials', async () => {
  process.env.SOLVE_PROVIDER_ENCRYPTION_KEY = 'test-only-encryption-secret-32-characters';
  process.env.OPENROUTER_API_KEY = 'deployment-key-must-not-be-used';
  const db = await createKernelDb();
  const a = kernelClient(localSupabase(db,user('provider-a'))), b = kernelClient(localSupabase(db,user('provider-b')));
  const aid = await a.register('A'); await b.register('B');
  assert.equal(await readProvider(a), null);
  assert.equal((await connectionStatus(a)).active, false);
  await saveProvider(a,{apiKey:'private-fixture-key',model:'fixture/model'});
  assert.equal((await readProvider(a))?.apiKey,'private-fixture-key');
  assert.equal(await readProvider(b),null);
  const events = await a.readEvents(providerScope(aid),{limit:100});
  assert.equal(JSON.stringify(events).includes('private-fixture-key'),false);
  const keys = await a.unsealKeys(events.map(e=>e.id));
  assert.ok(keys.length);
  // Even someone with event + kernel sealing key cannot get credentials without server encryption.
  const { unseal } = await import('../../lib/bot/seal');
  const opened = await unseal(events[0].payload.sealed,keys[0].key);
  assert.equal(JSON.stringify(opened).includes('private-fixture-key'),false);
  assert.equal((await connectionStatus(a)).active,true);
  await disconnectProvider(a);
  assert.equal(await readProvider(a),null);
  assert.equal((await connectionStatus(a)).active,false);
  assert.equal((await a.unsealKeys(keys.map(k=>k.event_id))).length,0);
});
