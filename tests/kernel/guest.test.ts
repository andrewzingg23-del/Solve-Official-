import assert from 'node:assert/strict';
import { it } from 'node:test';
import { createKernelDb, sqlstate, anon, user } from './harness';

it('gives anonymous Auth users stable isolated actors without opening unauthenticated access', async () => {
  const k = await createKernelDb();
  const guestA = { role: 'authenticated' as const, sub: 'guest-a', is_anonymous: true };
  const guestB = { role: 'authenticated' as const, sub: 'guest-b', is_anonymous: true };
  const a = await k.value(guestA, 'register');
  const b = await k.value(guestB, 'register');
  const member = await k.value(user('existing-account'), 'register');
  assert.notEqual(a, b);
  assert.notEqual(a, member);
  assert.equal(await k.value(guestA, 'register'), a);
  assert.equal((await k.rpc(guestA, 'whoami'))[0].actor_id, a);
  await k.rpc(guestA, 'record_event', { p_type: 'guest.note', p_scope: `actor:${a}`, p_payload: { text: 'private' } });
  for (const other of [guestB, user('existing-account')]) {
    await assert.rejects(k.rpc(other, 'read_events', { p_scope: `actor:${a}` }));
    await assert.rejects(k.rpc(other, 'record_event', { p_type: 'guest.note', p_scope: `actor:${a}` }));
    await assert.rejects(k.rpc(other, 'whoami', { p_as_actor: a }), sqlstate('KA002'));
  }
  await assert.rejects(k.rpc(anon, 'register'), sqlstate('42501'));
  await assert.rejects(k.as(guestA, 'select * from kernel.events'), sqlstate('42501'));
  assert.equal(await k.value(user('existing-account'), 'register'), member);
});

it('lets guests create and reload projects and communities with private project contents', async () => {
  const { kernelClient } = await import('../../lib/kernel/client');
  const { localSupabase } = await import('../../lib/kernel/local');
  const { createCreativeWorld } = await import('../../lib/world/creative');
  const { startCommunity } = await import('../../lib/community/community');
  const db = await createKernelDb();
  const session = { role: 'authenticated' as const, sub: 'guest-builder', is_anonymous: true };
  const first = kernelClient(localSupabase(db, session));
  await first.register();
  const world = await createCreativeWorld(first, { worldId: 'b53d4b8c-6cff-43f8-a29e-1f9207f84e50', title: 'Guest project', goal: 'Build inside SOLVE' });
  const community = await startCommunity(first, { name: 'Guest builders', about: 'Build together', packs: [], nonce: '0aed60fe-8fb5-42ef-b42f-8fb2ca5d147e' });
  assert.ok(community.communityId);
  const reloaded = kernelClient(localSupabase(db, session));
  assert.ok((await reloaded.readWorld(world.scope)).length);
  const other = kernelClient(localSupabase(db, { role: 'authenticated', sub: 'other-guest', is_anonymous: true }));
  await other.register();
  await assert.rejects(other.readWorld(world.scope));
});
