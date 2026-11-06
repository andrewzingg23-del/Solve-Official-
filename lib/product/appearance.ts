// A restricted presentation contract. No generated CSS, scripts, HTML, URLs or permissions.
// Language understanding proposes a change; the person explicitly accepts it.
export const SPACE_TONES = ["graphite", "ocean", "mint", "sunset", "violet"] as const;
export const SPACE_DENSITIES = ["comfortable", "compact", "airy"] as const;
export const SPACE_SHAPES = ["soft", "square"] as const;
export const SPACE_PRIORITIES = ["balanced", "projects", "community", "creations"] as const;

export type SpaceAppearance = {
  tone: (typeof SPACE_TONES)[number];
  density: (typeof SPACE_DENSITIES)[number];
  shape: (typeof SPACE_SHAPES)[number];
  priority: (typeof SPACE_PRIORITIES)[number];
};

export const DEFAULT_APPEARANCE: SpaceAppearance = {
  tone: "graphite",
  density: "comfortable",
  shape: "soft",
  priority: "balanced",
};

export function normalizeAppearance(value: unknown): SpaceAppearance {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...DEFAULT_APPEARANCE };
  const source = value as Record<string, unknown>;
  return {
    tone: SPACE_TONES.includes(source.tone as SpaceAppearance["tone"]) ? source.tone as SpaceAppearance["tone"] : "graphite",
    density: SPACE_DENSITIES.includes(source.density as SpaceAppearance["density"]) ? source.density as SpaceAppearance["density"] : "comfortable",
    shape: SPACE_SHAPES.includes(source.shape as SpaceAppearance["shape"]) ? source.shape as SpaceAppearance["shape"] : "soft",
    priority: SPACE_PRIORITIES.includes(source.priority as SpaceAppearance["priority"]) ? source.priority as SpaceAppearance["priority"] : "balanced",
  };
}

export type AppearanceProposal = { next: SpaceAppearance; changes: string[]; response: string; supported: boolean };

// Deliberately bounded natural-language interpreter for the first working release.
// Future model output must pass through normalizeAppearance and this human approval flow.
export function proposeAppearance(message: unknown, current: unknown): AppearanceProposal {
  const from = normalizeAppearance(current);
  const next = { ...from };
  if (typeof message !== "string" || message.length > 700 || !message.trim()) {
    return { next, changes: [], supported: false, response: "Describe a look, spacing, or what you want to see first." };
  }
  const text = message.toLowerCase();
  if (/\b(reset|default|original|start over)\b/.test(text)) {
    const reset = { ...DEFAULT_APPEARANCE };
    const changes = (Object.keys(reset) as Array<keyof SpaceAppearance>).filter(key => reset[key] !== from[key]);
    return { next: reset, changes, supported: true, response: changes.length ? "I can restore SOLVE's original look. Preview it before applying." : "You're already using the original look." };
  }
  // Specific colors override broad style terms.
  if (/\b(mint|sage|emerald|green)\b/.test(text)) next.tone = "mint";
  else if (/\b(violet|purple|lilac|lavender)\b/.test(text)) next.tone = "violet";
  else if (/\b(warm|sunset|amber|orange|coral|golden)\b/.test(text)) next.tone = "sunset";
  else if (/\b(blue|ocean|navy|steel|cool)\b/.test(text)) next.tone = "ocean";
  else if (/\b(graphite|black|monochrome|noir|neutral|dark)\b/.test(text)) next.tone = "graphite";

  if (/\b(tight|tighter|compact|denser|dense|condensed|less spacing|more on screen)\b/.test(text)) next.density = "compact";
  else if (/\b(airy|spacious|roomy|breathing room|more spacing|spread out)\b/.test(text)) next.density = "airy";
  if (/\b(square|sharp|angular|hard edge|hard corners)\b/.test(text)) next.shape = "square";
  else if (/\b(round|rounded|soft corner|softer corner)\b/.test(text)) next.shape = "soft";
  if (/\b(projects? first|focus on projects|prioriti[sz]e projects)\b/.test(text)) next.priority = "projects";
  else if (/\b(community first|friends first|people first|focus on community|prioriti[sz]e community)\b/.test(text)) next.priority = "community";
  else if (/\b(creations? first|creative first|focus on creations?|prioriti[sz]e creations?)\b/.test(text)) next.priority = "creations";
  else if (/\b(balanced|equal emphasis|reset layout)\b/.test(text)) next.priority = "balanced";

  if (/\b(skate|skater|skateboard|punk|zine|magazine)\b/.test(text)) {
    if (!/\b(mint|sage|green|violet|purple|warm|sunset|orange|blue|navy)\b/.test(text)) next.tone = "graphite";
    if (!/\b(airy|spacious|roomy)\b/.test(text)) next.density = "compact";
    if (!/\b(round|rounded)\b/.test(text)) next.shape = "square";
    if (!/\b(projects? first|community first|friends first)\b/.test(text)) next.priority = "creations";
  }
  if (/\b(minimal|minimalist|quiet|calm)\b/.test(text)) {
    if (!/\b(mint|sage|violet|purple|warm|sunset|orange|blue|navy)\b/.test(text)) next.tone = "graphite";
    if (!/\b(tight|tighter|compact)\b/.test(text)) next.density = "airy";
  }

  const labels: Record<keyof SpaceAppearance, string> = {
    tone: "color mood", density: "spacing", shape: "card shape", priority: "content emphasis",
  };
  const changes = (Object.keys(next) as Array<keyof SpaceAppearance>)
    .filter(key => next[key] !== from[key]).map(key => labels[key]);
  if (!changes.length) {
    const understood = /\b(blue|ocean|navy|mint|warm|sunset|violet|graphite|dark|compact|airy|square|rounded|skate|minimal|projects|community|creations)\b/.test(text);
    return { next, changes, supported: understood, response: understood ? "That already matches your current look. Try another direction." : "I can change your color mood, spacing, card shape, and which part of Space gets visual emphasis. More complex rearrangement is coming later." };
  }
  return {
    next, changes, supported: true,
    response: "I can update the " + changes.join(", ") + ". Here's a live preview; nothing is saved until you approve it.",
  };
}
