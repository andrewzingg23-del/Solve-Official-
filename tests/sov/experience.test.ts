import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_SELECTION, SKINS, LOCAL_USER, INITIAL_WORLDS, INITIAL_CREATION,
  blueprintFor, validateBlueprint, validateSelection, validateProposal,
  initialPresentation, presentationReducer,
} from '../../lib/sov/experience';

const selection = { skin: 'atelier', layout: 'studio' } as const;
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));

test('every independent skin and layout has a valid, honest blueprint', () => {
  for (const skin of ['standard', 'atelier', 'backstage'] as const) {
    for (const layout of ['simple', 'studio'] as const) {
      const blueprint = blueprintFor({ skin, layout });
      assert.deepEqual(validateBlueprint(copy(blueprint)), blueprint);
      assert.equal(blueprint.version, 1);
      assert.equal(blueprint.id, 'sov.personal');
      assert.equal(blueprint.skin.id, skin);
      assert.equal(blueprint.layout.id, layout);
      assert.deepEqual(blueprint.capabilities, { local: 'available', ai: 'unavailable', external: 'unavailable', sync: 'unavailable' });
      assert.ok(blueprint.layout.regions.mobile.length > 0);
      assert.ok(blueprint.layout.regions.desktop.length > 0);
    }
  }
  assert.notDeepEqual(SKINS.atelier.tokens, SKINS.backstage.tokens);
});

test('selection validator accepts only own plain data fields and returns a detached copy', () => {
  assert.deepEqual(validateSelection(selection), selection);
  assert.notEqual(validateSelection(selection), selection);
  for (const value of [null, [], {}, 'standard', { skin: 'invalid', layout: 'simple' }, { ...selection, grants: [] }, Object.create(selection), Object.assign(Object.create(null), selection)]) {
    assert.equal(validateSelection(value), null);
  }
  const getter = Object.defineProperty({ layout: 'studio' }, 'skin', { enumerable: true, get() { throw new Error('must not invoke'); } });
  assert.equal(validateSelection(getter), null);
  assert.equal(validateSelection({ ...selection, [Symbol('secret')]: 'x' }), null);
  assert.equal(validateSelection(Object.defineProperty({ ...selection }, 'secret', { value: 'x' })), null);
});

test('blueprint rejects unauthorized data, unknown registrations, unsafe presentation and false integrations', () => {
  const valid = blueprintFor(selection);
  const invalidBlueprints: unknown[] = [
    { ...valid, permissions: ['admin'] }, { ...valid, user: LOCAL_USER },
    { ...valid, skin: { ...valid.skin, tokens: { ...valid.skin.tokens, accent: 'url(https://evil.invalid/track)' } } },
    { ...valid, skin: { ...valid.skin, background: 'https://evil.invalid/wallpaper' } },
    { ...valid, skin: { ...valid.skin, tokens: { ...valid.skin.tokens, secret: 'token' } } },
    { ...valid, skin: { ...valid.skin, tokens: { ...valid.skin.tokens, text: '#000' } } },
    { ...valid, capabilities: { ...valid.capabilities, ai: 'available' } },
    { ...valid, capabilities: { ...valid.capabilities, sync: 'connected' } },
    { ...valid, capabilities: { ...valid.capabilities, wallet: 'available' } },
    { ...valid, surfaces: [...valid.surfaces, { id: 'wallet' }] },
    { ...valid, interactions: [...valid.interactions, 'grant-access'] },
    { ...valid, version: 2 },
    { ...valid, layout: { ...valid.layout, regions: { ...valid.layout.regions, mobile: [...valid.layout.regions.mobile, 'secret'] } } },
    { ...valid, layout: { ...valid.layout, id: 'unknown' } },
  ];
  for (const invalid of invalidBlueprints) assert.equal(validateBlueprint(invalid), null);
  assert.equal(validateBlueprint(null), null);
  assert.equal(validateBlueprint(Object.create(valid)), null);
  const poisoned = copy(valid);
  Object.setPrototypeOf(poisoned.skin.tokens, { grants: 'admin' });
  assert.equal(validateBlueprint(poisoned), null);
  const hidden = copy(valid);
  Object.defineProperty(hidden.surfaces, 'secret', { value: 'x' });
  assert.equal(validateBlueprint(hidden), null);
  const getter = copy(valid);
  Object.defineProperty(getter.skin.tokens, 'accent', { enumerable: true, get() { throw new Error('must not invoke'); } });
  assert.equal(validateBlueprint(getter), null);
  assert.equal(validateBlueprint(new Proxy({}, { ownKeys() { throw new Error('hostile'); } })), null);
});

test('AI proposals allow presentation changes only and never claim authority', () => {
  const proposal = { id: 'proposal-1', source: 'personal-ai', baseVersion: 1, changes: selection, reason: 'Make room for a focused writing session.' } as const;
  assert.deepEqual(validateProposal(proposal), proposal);
  assert.notEqual(validateProposal(proposal)?.changes, proposal.changes);
  for (const invalid of [
    { ...proposal, grants: ['admin'] }, { ...proposal, source: 'system' },
    { ...proposal, baseVersion: 2 }, { ...proposal, changes: { ...selection, secrets: {} } },
    { ...proposal, id: '' }, { ...proposal, reason: '' }, { ...proposal, reason: 'a'.repeat(1001) },
    Object.create(proposal),
  ]) assert.equal(validateProposal(invalid), null);
});

test('preview, cancel, apply, undo and reset change presentation without content', () => {
  const contentBefore = JSON.stringify({ LOCAL_USER, INITIAL_WORLDS, INITIAL_CREATION });
  const initial = initialPresentation(DEFAULT_SELECTION);
  const preview = presentationReducer(initial, { type: 'preview', selection });
  assert.deepEqual(preview.applied, DEFAULT_SELECTION);
  assert.deepEqual(preview.draft, selection);
  assert.deepEqual(presentationReducer(preview, { type: 'cancel' }), initial);
  const applied = presentationReducer(preview, { type: 'apply' });
  assert.deepEqual(applied.applied, selection);
  assert.deepEqual(applied.previous, DEFAULT_SELECTION);
  assert.deepEqual(presentationReducer(applied, { type: 'undo' }), initial);
  const reset = presentationReducer(initialPresentation(selection), { type: 'reset' });
  assert.deepEqual(reset.applied, DEFAULT_SELECTION);
  assert.deepEqual(presentationReducer(reset, { type: 'undo' }).applied, selection);
  assert.deepEqual(presentationReducer(initial, { type: 'undo' }), initial);
  assert.equal(JSON.stringify({ LOCAL_USER, INITIAL_WORLDS, INITIAL_CREATION }), contentBefore);
});

test('shared seeds provide one editable creation belonging to an existing World', () => {
  assert.ok(INITIAL_WORLDS.some(world => world.id === INITIAL_CREATION.worldId));
  assert.equal(INITIAL_CREATION.title, 'A little room for possibility');
  assert.ok(INITIAL_CREATION.body.length > 50);
  assert.ok(LOCAL_USER.id);
});

test('restoring saved presentation preserves a detached single-step undo after refresh', () => {
  const saved = { skin: 'backstage', layout: 'studio' } as const;
  const previous = { skin: 'atelier', layout: 'simple' } as const;
  const restored = presentationReducer(initialPresentation(), { type: 'restore', selection: saved, previous });
  assert.deepEqual(restored, { applied: saved, draft: saved, previous });
  assert.notEqual(restored.applied, saved);
  assert.notEqual(restored.draft, saved);
  assert.notEqual(restored.previous, previous);
  assert.deepEqual(presentationReducer(restored, { type: 'undo' }), initialPresentation(previous));
  const noUndo = presentationReducer(restored, { type: 'restore', selection: saved, previous: null });
  assert.deepEqual(noUndo, initialPresentation(saved));
});

test('blueprint tokens describe the actual rendered skin palettes', () => {
  assert.equal(SKINS.standard.tokens.accent, '#405eab');
  assert.equal(SKINS.atelier.tokens.panel, 'rgba(249,244,237,.87)');
  assert.equal(SKINS.backstage.tokens.text, '#f4f0fb');
});

test('approved Home theme and layout controls are registered, independently composable presentations', () => {
  for (const skin of ['standard', 'backstage', 'atelier', 'creative'] as const) {
    for (const layout of ['simple', 'focused', 'studio', 'canvas'] as const) {
      assert.deepEqual(validateSelection({ skin, layout }), { skin, layout });
    }
  }
});
