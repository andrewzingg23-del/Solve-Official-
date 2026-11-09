import { chosenFocus, normalizeSpaceAnswers, type FocusId } from "./personal-space";

// A person's selected focus composes the cockpit; it does not change their rights.
// All destinations are real SOLVE routes, never a simulated integration.
export type CockpitMode = "operator" | "creator" | "household" | "maker" | "open";
export type CockpitAction = { id: string; label: string; detail: string; href: string };
export type CockpitLayout = {
  mode: CockpitMode;
  title: string;
  subtitle: string;
  focusLabel: string;
  priority: "balanced" | "projects" | "community" | "creations";
  actions: readonly CockpitAction[];
  suggestedApps: readonly string[];
};

const actions = {
  newWorld: { id: "newWorld", label: "Create", detail: "Start a World", href: "/worlds/new" },
  projects: { id: "projects", label: "Build", detail: "Your real projects", href: "/projects" },
  people: { id: "people", label: "Collaborate", detail: "People and communities", href: "/communities" },
  agent: { id: "agent", label: "Ask your AI", detail: "Think and make", href: "/bot" },
  studio: { id: "studio", label: "My creations", detail: "Saved projects", href: "/projects" },
  control: { id: "control", label: "Control", detail: "Manage access", href: "/control" },
  profile: { id: "profile", label: "SOV ID", detail: "Review your identity", href: "/account" },
  apps: { id: "apps", label: "Add tools", detail: "Browse supported apps", href: "/apps" },
} as const satisfies Record<string, CockpitAction>;

const layouts: Record<CockpitMode, CockpitLayout> = {
  operator: {
    mode: "operator", title: "Your operating Space",
    subtitle: "Build projects, coordinate people, and bring useful tools into one place.",
    focusLabel: "Work & operations", priority: "projects",
    actions: [actions.newWorld, actions.projects, actions.people, actions.control],
    suggestedApps: ["github", "notion", "slack", "stripe"],
  },
  creator: {
    mode: "creator", title: "Your creative Space",
    subtitle: "Make things, explore communities, and show the parts of your world you choose.",
    focusLabel: "Your creative world", priority: "creations",
    actions: [actions.studio, actions.newWorld, actions.people, actions.profile],
    suggestedApps: ["discord", "spotify", "youtube", "figma"],
  },
  household: {
    mode: "household", title: "Your household Space",
    subtitle: "Keep private life organized and decide what to share with people you trust.",
    focusLabel: "Family & life", priority: "community",
    actions: [actions.newWorld, actions.projects, actions.people, actions.control],
    suggestedApps: ["drive", "microsoft", "zoom", "spotify"],
  },
  maker: {
    mode: "maker", title: "Your maker Space",
    subtitle: "Turn ideas into designs and projects without losing their history.",
    focusLabel: "Build & engineering", priority: "projects",
    actions: [actions.newWorld, actions.projects, actions.agent, actions.apps],
    suggestedApps: ["github", "figma", "notion", "drive"],
  },
  open: {
    mode: "open", title: "Your Space",
    subtitle: "Start wherever you want. Your Space changes with the things you make.",
    focusLabel: "Start anywhere", priority: "balanced",
    actions: [actions.newWorld, actions.projects, actions.people, actions.agent],
    suggestedApps: [],
  },
};

function modeForFocus(focus: FocusId): CockpitMode {
  if (focus === "family") return "household";
  if (focus === "gaming" || focus === "music" || focus === "creative") return "creator";
  if (focus === "engineering" || focus === "learning") return "maker";
  if (focus === "business") return "operator";
  return "open";
}

/** The first selected focus chooses the landing arrangement; it is editable. */
export function composeCockpit(input: unknown): CockpitLayout {
  const focuses = chosenFocus(normalizeSpaceAnswers(input));
  return layouts[modeForFocus(focuses[0] ?? "other")];
}

/** Convenience for a preview; only catalog IDs, never a grant or token. */
export function recommendedAppIds(layout: CockpitLayout, selected: readonly string[]): string[] {
  const picked = new Set(selected);
  return layout.suggestedApps.filter(id => !picked.has(id));
}
