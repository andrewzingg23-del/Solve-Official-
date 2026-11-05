/** Presentation is intentionally separate from identity, content and authority. */
export type SkinId = 'standard' | 'atelier' | 'backstage' | 'creative';
export type LayoutId = 'simple' | 'studio' | 'focused' | 'canvas';
export type Selection = { skin: SkinId; layout: LayoutId };
export const DEFAULT_SELECTION: Selection = { skin: 'standard', layout: 'simple' };

type SkinTokens = {
  background: string; panel: string; text: string; muted: string;
  accent: string; accentText: string; line: string; font: string;
};
export type Skin = { label: string; description: string; tokens: SkinTokens; background?: string };
export const SKINS: Record<SkinId, Skin> = {
  standard: {
    label: 'Standard', description: 'A quiet, clear space for everyday possibility.',
    tokens: { background: '#f7f8fa', panel: 'rgba(255,255,255,.82)', text: '#25272c', muted: '#696d75', accent: '#405eab', accentText: '#fff', line: 'rgba(43,47,58,.12)', font: 'Arial, Helvetica, sans-serif' },
  },
  atelier: {
    label: 'Atelier', description: 'Warm architecture, thoughtful details, room to think.', background: '/sov/atelier.webp',
    tokens: { background: '#b5a18c', panel: 'rgba(249,244,237,.87)', text: '#302d2c', muted: '#625950', accent: '#8b552c', accentText: '#fff', line: 'rgba(91,68,45,.17)', font: 'Georgia, Times New Roman, serif' },
  },
  creative: {
    label: 'Creative', description: 'Flowing light and color for your personal space.', background: '/sov/creative-flow.webp',
    tokens: { background: '#34254e', panel: '#403450', text: '#faf5ff', muted: '#d8cde7', accent: '#d9bfff', accentText: '#261132', line: '#8b73a5', font: 'Arial, Helvetica, sans-serif' },
  },
  backstage: {
    label: 'Backstage', description: 'An expressive studio for ideas with their own rhythm.', background: '/sov/backstage.webp',
    tokens: { background: '#151022', panel: 'rgba(24,20,38,.91)', text: '#f4f0fb', muted: '#c0b6d1', accent: '#aa75f5', accentText: '#241234', line: 'rgba(211,186,255,.21)', font: 'Arial, Helvetica, sans-serif' },
  },
};

export type SurfaceId = 'home' | 'identity' | 'worlds' | 'creation' | 'connections' | 'resources' | 'personalize';
export type InteractionId = 'navigate' | 'edit-creation' | 'preview' | 'apply' | 'cancel' | 'undo' | 'reset';
export type ExperienceBlueprint = {
  version: 1;
  id: 'sov.personal';
  skin: Skin & { id: SkinId };
  layout: { id: LayoutId; regions: { desktop: SurfaceId[]; mobile: SurfaceId[] } };
  surfaces: { id: SurfaceId; label: string }[];
  interactions: InteractionId[];
  capabilities: { local: 'available'; ai: 'unavailable'; external: 'unavailable'; sync: 'unavailable' };
};

export function blueprintFor(selection: Selection): ExperienceBlueprint {
  const skin = SKINS[selection.skin];
  return {
    version: 1, id: 'sov.personal',
    skin: { id: selection.skin, ...skin, tokens: { ...skin.tokens } },
    layout: {
      id: selection.layout,
      regions: {
        desktop: selection.layout === 'studio'
          ? ['identity', 'creation', 'worlds', 'resources', 'connections', 'personalize']
          : ['identity', 'home', 'worlds', 'creation', 'connections', 'resources', 'personalize'],
        mobile: ['home', 'creation', 'worlds', 'identity', 'connections', 'resources', 'personalize'],
      },
    },
    surfaces: [
      { id: 'home', label: 'Home' }, { id: 'identity', label: 'Your identity' },
      { id: 'worlds', label: 'Worlds' }, { id: 'creation', label: 'Creation' },
      { id: 'connections', label: 'Connections' }, { id: 'resources', label: 'Resources' },
      { id: 'personalize', label: 'Make it yours' },
    ],
    interactions: ['navigate', 'edit-creation', 'preview', 'apply', 'cancel', 'undo', 'reset'],
    capabilities: { local: 'available', ai: 'unavailable', external: 'unavailable', sync: 'unavailable' },
  };
}

// Accept JSON-like own data only: accessors, inherited properties, symbols and
// non-enumerable/custom array fields must never cross this boundary.
function dataRecord(input: unknown, keys: readonly string[]): input is Record<string, unknown> {
  if (!input || typeof input !== 'object' || Object.getPrototypeOf(input) !== Object.prototype) return false;
  const own = Reflect.ownKeys(input);
  return own.length === keys.length && own.every(key => typeof key === 'string' && keys.includes(key)
    && Object.getOwnPropertyDescriptor(input, key)?.enumerable === true
    && 'value' in Object.getOwnPropertyDescriptor(input, key)!);
}

export function validateSelection(input: unknown): Selection | null {
  try {
    if (!dataRecord(input, ['skin', 'layout'])) return null;
    if (input.skin !== 'standard' && input.skin !== 'atelier' && input.skin !== 'backstage' && input.skin !== 'creative') return null;
    if (input.layout !== 'simple' && input.layout !== 'studio' && input.layout !== 'focused' && input.layout !== 'canvas') return null;
    return { skin: input.skin, layout: input.layout };
  } catch { return null; }
}

function exactData(actual: unknown, expected: unknown): boolean {
  if (typeof expected !== 'object' || expected === null) return actual === expected;
  if (typeof actual !== 'object' || actual === null) return false;
  if (Object.getPrototypeOf(actual) !== Object.getPrototypeOf(expected)) return false;
  const expectedKeys = Reflect.ownKeys(expected);
  const actualKeys = Reflect.ownKeys(actual);
  if (actualKeys.length !== expectedKeys.length) return false;
  return actualKeys.every(key => {
    if (!expectedKeys.includes(key)) return false;
    const actualProperty = Object.getOwnPropertyDescriptor(actual, key)!;
    const expectedProperty = Object.getOwnPropertyDescriptor(expected, key)!;
    return 'value' in actualProperty && actualProperty.enumerable === expectedProperty.enumerable
      && exactData(actualProperty.value, expectedProperty.value);
  });
}

/** Only registered presentation presets are accepted; no arbitrary CSS or authority. */
export function validateBlueprint(input: unknown): ExperienceBlueprint | null {
  try {
    if (!dataRecord(input, ['version', 'id', 'skin', 'layout', 'surfaces', 'interactions', 'capabilities'])) return null;
    const skinDescriptor = Object.getOwnPropertyDescriptor(input, 'skin')!;
    const layoutDescriptor = Object.getOwnPropertyDescriptor(input, 'layout')!;
    const skin = skinDescriptor.value;
    const layout = layoutDescriptor.value;
    if (!skin || !layout || typeof skin !== 'object' || typeof layout !== 'object') return null;
    const skinId = Object.getOwnPropertyDescriptor(skin, 'id');
    const layoutId = Object.getOwnPropertyDescriptor(layout, 'id');
    if (!skinId || !layoutId || !('value' in skinId) || !('value' in layoutId)) return null;
    const selection = validateSelection({ skin: skinId.value, layout: layoutId.value });
    if (!selection) return null;
    const canonical = blueprintFor(selection);
    return exactData(input, canonical) ? canonical : null;
  } catch { return null; }
}

export type ExperienceProposal = { id: string; source: 'personal-ai'; baseVersion: 1; changes: Selection; reason: string };
export function validateProposal(input: unknown): ExperienceProposal | null {
  try {
    if (!dataRecord(input, ['id', 'source', 'baseVersion', 'changes', 'reason'])) return null;
    const changes = validateSelection(input.changes);
    if (!changes || input.source !== 'personal-ai' || input.baseVersion !== 1) return null;
    if (typeof input.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(input.id)) return null;
    if (typeof input.reason !== 'string' || !input.reason.trim() || input.reason.length > 1000) return null;
    return { id: input.id, source: 'personal-ai', baseVersion: 1, changes, reason: input.reason };
  } catch { return null; }
}

export type PresentationState = { applied: Selection; draft: Selection; previous: Selection | null };
export type PresentationAction = { type: 'preview'; selection: Selection }
  | { type: 'restore'; selection: Selection; previous: Selection | null }
  | { type: 'apply' | 'cancel' | 'undo' | 'reset' };
export function initialPresentation(selection: Selection = DEFAULT_SELECTION): PresentationState {
  return { applied: { ...selection }, draft: { ...selection }, previous: null };
}
const sameSelection = (a: Selection, b: Selection) => a.skin === b.skin && a.layout === b.layout;
export function presentationReducer(state: PresentationState, action: PresentationAction): PresentationState {
  switch (action.type) {
    case 'restore': return { ...initialPresentation(action.selection), previous: action.previous ? { ...action.previous } : null };
    case 'preview': return { ...state, draft: { ...action.selection } };
    case 'cancel': return { ...state, draft: { ...state.applied } };
    case 'apply': return sameSelection(state.applied, state.draft) ? state
      : { applied: { ...state.draft }, draft: { ...state.draft }, previous: { ...state.applied } };
    case 'undo': return state.previous ? initialPresentation(state.previous) : state;
    case 'reset': return sameSelection(state.applied, DEFAULT_SELECTION)
      ? { ...state, draft: { ...DEFAULT_SELECTION } }
      : { applied: { ...DEFAULT_SELECTION }, draft: { ...DEFAULT_SELECTION }, previous: { ...state.applied } };
  }
}

export type LocalUser = { id: string; displayName: string; initials: string };
export type World = { id: string; title: string; description: string };
export type Creation = { id: string; worldId: string; title: string; body: string; updatedAt: string };
export const LOCAL_USER: LocalUser = { id: 'local-user', displayName: 'Alex Morgan', initials: 'AM' };
export const INITIAL_WORLDS: World[] = [{ id: 'personal', title: 'My Space', description: 'Your personal space for ideas, plans and things you want to make.' }];
export const INITIAL_CREATION: Creation = {
  id: 'first-note', worldId: 'personal', title: 'A little room for possibility',
  body: 'A space for what comes next.\n\nWhat would I like to make?\n\nWhat matters most this week?\n\nOne small next step:\n\nUse this note to collect a thought, sketch a plan, or begin something of your own.',
  updatedAt: '2026-11-04T00:00:00.000Z',
};
