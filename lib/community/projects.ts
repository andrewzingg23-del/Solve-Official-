// Shared projects inside a community World (Composable Worlds, Phase 2/3). A project is a kernel
// `resource` entity in the community's World scope, marked `sov: community.project`. It reuses the
// existing entity model — no new kind, no migration. Because a WorldEntity carries location fields,
// a project with an approved place IS the map marker: one canonical project, shown in the Projects
// Room and on the Map. Cross-Room links (project ↔ event) use kernel `relate()` in a later slice.
//
// Authority stays the kernel's: writes go to the community World scope, so the kernel requires the
// caller to hold the grant for it (owners do; members where the community granted them Add).
import type { Kernel, WorldEntity } from "@/lib/kernel/client";
import { communityScope, CommunityInputError, type Community } from "./community";

export const PROJECT = "community.project";
export const PROJECT_LIMITS = { name: 120, description: 600, placeLabel: 120 } as const;

export type ProjectPlace = { label: string; latitude: number; longitude: number };
export type Project = {
  projectId: string;
  communityId: string;
  name: string;
  description: string;
  createdBy: string;
  place: ProjectPlace | null;
  at: string;
};

const clean = (v: unknown, max: number): string =>
  typeof v === "string" && v.trim().length > 0 && v.length <= max ? v.trim() : "";

const iso = (v: unknown): string => {
  const t = Date.parse(v instanceof Date ? v.toISOString() : String(v));
  return Number.isFinite(t) ? new Date(t).toISOString() : "";
};

/** A valid place needs a label and real coordinates. Returns null for anything else. */
export function cleanPlace(input: unknown): ProjectPlace | null {
  if (!input || typeof input !== "object") return null;
  const p = input as Record<string, unknown>;
  const label = clean(p.label, PROJECT_LIMITS.placeLabel);
  const latitude = Number(p.latitude);
  const longitude = Number(p.longitude);
  if (!label) return null;
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  return { label, latitude, longitude };
}

/** Reads a community project out of a World entity, or null when the entity isn't one. */
export function projectFromEntity(communityId: string, e: Pick<WorldEntity, "entity_id" | "kind" | "title" | "summary" | "attributes" | "latitude" | "longitude" | "updated_at">): Project | null {
  if (e.kind !== "resource") return null;
  const a = e.attributes ?? {};
  if (a.sov !== PROJECT) return null;
  const lat = e.latitude == null ? NaN : Number(e.latitude);
  const lng = e.longitude == null ? NaN : Number(e.longitude);
  const place: ProjectPlace | null =
    Number.isFinite(lat) && Number.isFinite(lng)
      ? { label: clean(a.place_label, PROJECT_LIMITS.placeLabel) || e.title, latitude: lat, longitude: lng }
      : null;
  return {
    projectId: e.entity_id,
    communityId,
    name: e.title,
    description: e.summary ?? "",
    createdBy: typeof a.created_by === "string" ? a.created_by : "",
    place,
    at: iso(e.updated_at),
  };
}

/**
 * Adds a project to a community. Idempotent per `requestId` (a retry returns the same project).
 * The caller must be in the community (owner or member); the kernel enforces the World-write grant.
 */
export async function createProject(
  kernel: Kernel,
  community: Community,
  input: { name: unknown; description?: unknown; place?: unknown; requestId: string },
): Promise<Project> {
  const name = clean(input.name, PROJECT_LIMITS.name);
  if (!name) throw new CommunityInputError("a project needs a name");
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(input.requestId)) throw new CommunityInputError("a request id is required");
  const description = clean(input.description, PROJECT_LIMITS.description);
  const place = cleanPlace(input.place);
  const me = await kernel.whoami();

  const entityId = await kernel.upsertEntity({
    kind: "resource",
    scope: communityScope(community.communityId),
    title: name,
    summary: description,
    attributes: { sov: PROJECT, created_by: me.actor_id, ...(place ? { place_label: place.label } : {}) },
    ...(place ? { latitude: place.latitude, longitude: place.longitude, locationTruth: "declared" as const } : {}),
    visibility: "members",
    idempotencyKey: `community:project:${community.communityId}:${input.requestId}`,
  });

  const project = (await listProjects(kernel, community)).find((p) => p.projectId === entityId);
  if (!project) throw new CommunityInputError("the project was created but could not be read back");
  return project;
}

/** Every project in the community, newest first. */
export async function listProjects(kernel: Kernel, community: Community): Promise<Project[]> {
  const entities = await kernel.readWorld(communityScope(community.communityId));
  return entities
    .map((e) => projectFromEntity(community.communityId, e))
    .filter((p): p is Project => p !== null)
    .sort((a, b) => b.at.localeCompare(a.at));
}

/** The map view: the same canonical projects, limited to those with an approved place. */
export async function projectsOnMap(kernel: Kernel, community: Community): Promise<Project[]> {
  return (await listProjects(kernel, community)).filter((p) => p.place !== null);
}
