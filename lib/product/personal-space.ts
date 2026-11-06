// Personal composition is a presentation layer, never an authorization layer.
// The fields are intentionally small and predictable; imported text is private.
export const FOCUS_AREAS = [
  { id: "music", label: "Music & media", description: "Create, publish and collaborate", href: "/studio" },
  { id: "family", label: "Family & life", description: "Private people and shared plans", href: "/communities" },
  { id: "engineering", label: "Engineering & making", description: "Build and develop projects", href: "/projects" },
  { id: "gaming", label: "Games & community", description: "Play, create and connect", href: "/communities" },
  { id: "business", label: "Business & work", description: "Coordinate your projects", href: "/projects" },
  { id: "creative", label: "Art & design", description: "Make and share creations", href: "/studio" },
  { id: "learning", label: "Learning & research", description: "Collect and build knowledge", href: "/projects" },
  { id: "other", label: "Something else", description: "Make your own experience", href: "/worlds/new" },
] as const;

export type FocusId = (typeof FOCUS_AREAS)[number]["id"];
export type SpaceAnswers = Record<string, string>;
const ALLOWED_KEYS = ["name", "building", "people", "privacy", "focus", "context", "bio"] as const;

export function normalizeSpaceAnswers(input: unknown): SpaceAnswers {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const source = input as Record<string, unknown>;
  const clean: SpaceAnswers = {};
  for (const key of ALLOWED_KEYS) {
    const raw = source[key];
    if (typeof raw !== "string") continue;
    const length = key === "context" ? 3500 : key === "building" ? 500 : 250;
    const value = raw.trim().slice(0, length);
    if (value) clean[key] = value;
  }
  return clean;
}

export function chosenFocus(answers: SpaceAnswers): FocusId[] {
  const valid = new Set<string>(FOCUS_AREAS.map(item => item.id));
  return [...new Set((answers.focus || "").split(",").map(item => item.trim()).filter(item => valid.has(item)))] as FocusId[];
}

export function composePersonalSpace(input: unknown) {
  const answers = normalizeSpaceAnswers(input);
  const focus = chosenFocus(answers);
  const modules = focus.length
    ? FOCUS_AREAS.filter(item => focus.includes(item.id))
    : FOCUS_AREAS.filter(item => ["creative", "business", "family"].includes(item.id));
  const name = answers.name || "";
  const hasContext = Boolean(name || answers.building || answers.people || focus.length || answers.context);
  return {
    name,
    hasContext,
    greeting: name ? "Your Space, " + name : "Your Space",
    goal: answers.building || "",
    people: answers.people || "",
    privacy: answers.privacy || "Private by default. Share only what you choose.",
    modules,
    // A profile preview is NOT a publication. No private imported context escapes here.
    publicPreview: { name: name || "Your name", bio: answers.bio || "", interests: modules.map(item => item.label) },
  };
}
