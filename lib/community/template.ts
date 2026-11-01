// Composable Worlds (One Solve directive, 2026-11-01): a capability catalog, versioned World
// templates, and a deterministic composition planner. The user expresses an intention; the planner
// maps it to a validated plan of capabilities and Rooms, each with an HONEST readiness status. The
// AI may propose; this deterministic planner + the kernel's authority checks decide. No model JSON
// is the source of truth.
//
// A "capability" extends the existing Pack concept (lib/community/packs.ts) — a venture is a
// community with packs. This adds (a) capabilities beyond today's packs, marked by what actually
// exists, and (b) templates that assemble them. Pure and typed: no kernel, no DB, no secrets. The
// real install (writing the World via startCommunity + kernel ops) is a separate authorized step;
// this module only produces and validates the plan it would run.
import { PACKS, type Pack, type PackId } from "./packs";

/**
 * Honest state of a capability right now:
 * - ready: works with what's built today.
 * - setup_required: built, but needs a connected provider/channel or configuration first.
 * - development_required: not built yet (named here so the planner never pretends it exists).
 * - unavailable: cannot be offered (unknown, or can't be provided safely).
 */
export type CapabilityStatus = "ready" | "setup_required" | "development_required" | "unavailable";

export type CapabilityId = PackId | "membership" | "projects" | "map" | "events";

export type Capability = {
  id: CapabilityId;
  name: string;
  what: string;
  status: CapabilityStatus;
  /** Kernel grant kinds an installer must hold. Enforced by the kernel at install time, not here. */
  requiredPermissions: string[];
  dependencies: CapabilityId[];
  /** For setup_required/development_required: what's missing, in plain words. */
  needs?: string;
};

const fromPack = (p: Pack, status: CapabilityStatus, needs?: string): Capability => ({
  id: p.id,
  name: p.name,
  what: p.what,
  status,
  requiredPermissions: ["community.owner"],
  dependencies: ["membership"],
  ...(needs ? { needs } : {}),
});

export const CAPABILITIES: Record<CapabilityId, Capability> = {
  membership: {
    id: "membership",
    name: "Members",
    what: "People ask to join, hold roles (owner, member, guest) and their AIs come in under their own identity.",
    status: "ready",
    requiredPermissions: ["community.owner"],
    dependencies: [],
  },
  // Existing packs, with their real readiness (practice packs need a connected channel first).
  build: fromPack(PACKS.build, "ready"),
  solar: fromPack(PACKS.solar, "ready"),
  risk: fromPack(PACKS.risk, "ready"),
  dialer: fromPack(PACKS.dialer, "setup_required", "a connected phone / SMS channel (A2P 10DLC)"),
  trading: fromPack(PACKS.trading, "setup_required", "a connected market-data / exchange source"),
  // Composable-Worlds capabilities named by the directive but NOT built yet — marked honestly so the
  // planner proposes them as "to build", never as installed.
  projects: {
    id: "projects",
    name: "Projects",
    what: "Shared projects members create and track, each with a stable id other Rooms reference.",
    status: "development_required",
    requiredPermissions: ["community.member"],
    dependencies: ["membership"],
    needs: "the projects capability is not built yet",
  },
  map: {
    id: "map",
    name: "Map",
    what: "A map of approved project / place markers (not live member location).",
    status: "development_required",
    requiredPermissions: ["community.member"],
    dependencies: ["membership", "projects"],
    needs: "the map capability is not built yet",
  },
  events: {
    id: "events",
    name: "Events",
    what: "Gatherings tied to a project, shown in an Events Room.",
    status: "development_required",
    requiredPermissions: ["community.member"],
    dependencies: ["membership", "projects"],
    needs: "the events capability is not built yet",
  },
};

export const isCapabilityId = (v: unknown): v is CapabilityId => typeof v === "string" && v in CAPABILITIES;

export type RoomSpec = { type: string; title: string; capability: CapabilityId };

export type WorldTemplate = {
  id: string;
  version: string;
  name: string;
  description: string;
  capabilities: CapabilityId[];
  rooms: RoomSpec[];
};

/** The first template. Membership + projects + map + events (the directive's Phase 2 set). */
export const COMMUNITY_WORLD_TEMPLATE: WorldTemplate = {
  id: "community",
  version: "1.0.0",
  name: "Community",
  description: "A community where members discover nearby projects, see them on a map and organize events.",
  capabilities: ["membership", "projects", "map", "events"],
  rooms: [
    { type: "community", title: "Community", capability: "membership" },
    { type: "projects", title: "Projects", capability: "projects" },
    { type: "map", title: "Map", capability: "map" },
    { type: "events", title: "Events", capability: "events" },
  ],
};

export const TEMPLATES: Record<string, WorldTemplate> = { community: COMMUNITY_WORLD_TEMPLATE };

export type PlannedCapability = {
  id: CapabilityId;
  name: string;
  status: CapabilityStatus;
  /** Dependencies not satisfied by the plan's own capability set. */
  missingDependencies: CapabilityId[];
  needs?: string;
};

export type CompositionPlan = {
  templateId: string;
  version: string;
  worldName: string;
  capabilities: PlannedCapability[];
  rooms: RoomSpec[];
  /** ready: everything works now · partial: some needs setup · needs_development: something isn't built. */
  overall: "ready" | "partial" | "needs_development";
  /** Capabilities that can be installed today (ready/setup_required with deps met). */
  installableNow: CapabilityId[];
  notes: string[];
};

/** A deterministic plan for a template: validates dependencies and reports honest readiness. */
export function planFromTemplate(templateId: string, worldName: string): CompositionPlan | null {
  const template = TEMPLATES[templateId];
  if (!template) return null;
  const inSet = new Set(template.capabilities);
  const planned: PlannedCapability[] = template.capabilities.map((id) => {
    const cap = CAPABILITIES[id];
    const missingDependencies = cap.dependencies.filter((d) => !inSet.has(d));
    return { id: cap.id, name: cap.name, status: cap.status, missingDependencies, ...(cap.needs ? { needs: cap.needs } : {}) };
  });

  const notes: string[] = [];
  for (const p of planned) {
    if (p.missingDependencies.length) notes.push(`${p.name} depends on ${p.missingDependencies.join(", ")}, which the template doesn't include.`);
    if (p.status === "development_required") notes.push(`${p.name}: ${p.needs ?? "not built yet"} — proposed to build, not installed.`);
    if (p.status === "setup_required") notes.push(`${p.name}: needs ${p.needs ?? "configuration"} before it works.`);
  }

  const installableNow = planned
    .filter((p) => (p.status === "ready" || p.status === "setup_required") && p.missingDependencies.length === 0)
    .map((p) => p.id);

  const overall: CompositionPlan["overall"] = planned.some((p) => p.status === "development_required" || p.status === "unavailable")
    ? "needs_development"
    : planned.some((p) => p.status === "setup_required")
      ? "partial"
      : "ready";

  return {
    templateId: template.id,
    version: template.version,
    worldName,
    capabilities: planned,
    rooms: template.rooms,
    overall,
    installableNow,
    notes,
  };
}

/**
 * Light, deterministic intent → template match. The AI can call this to propose a template; it never
 * invents capabilities. Returns null when nothing matches (then the AI asks, not guesses).
 */
export function templateForIntent(intent: string): WorldTemplate | null {
  const t = intent.toLowerCase();
  if (/communit|members?|neighbou?r|club|group|local|together/.test(t)) return COMMUNITY_WORLD_TEMPLATE;
  if (/project|map|event|meetup|gathering/.test(t)) return COMMUNITY_WORLD_TEMPLATE;
  return null;
}

/** Plan straight from a stated intention, or null if no template fits. */
export function planFromIntent(intent: string, worldName: string): CompositionPlan | null {
  const template = templateForIntent(intent);
  return template ? planFromTemplate(template.id, worldName) : null;
}
