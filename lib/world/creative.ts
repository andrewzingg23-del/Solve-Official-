import { KernelError, type Kernel, type WorldEntity } from "../kernel/client";

export type CreativePosition = { x: number; y: number };

export type CreativeWorld = {
  worldId: string;
  scope: string;
  entityId: string;
  title: string;
  summary: string;
  updatedAt: string;
};

export type CreativeArtifact = {
  entityId: string;
  title: string;
  body: string;
  position: CreativePosition;
  version: number;
  updatedAt: string;
};

export type CreateCreativeWorldInput = { worldId: string; title: string; goal?: string };
export const CREATIVE_RESOURCE_CATEGORIES = [
  { value: "time", label: "Time" },
  { value: "skill", label: "Skill" },
  { value: "idea", label: "Idea" },
  { value: "capital", label: "Capital" },
  { value: "labor", label: "Labor" },
  { value: "resource", label: "Tools, materials, or information" },
] as const;

export type CreativeResourceCategory = (typeof CREATIVE_RESOURCE_CATEGORIES)[number]["value"];
export type CreativeResourceEntryType = "offer" | "need";
export type CreativeResourceStatus = "open" | "withdrawn";

export type CreativeResourceEntry = {
  entityId: string;
  entryType: CreativeResourceEntryType;
  category: CreativeResourceCategory;
  title: string;
  description: string;
  timeWindow: string;
  sourceUrl: string;
  sourceStatus: "none" | "user_supplied_unverified";
  status: CreativeResourceStatus;
  reportedBy: string | null;
  reportedOnBehalfOf: string | null;
  updatedBy: string | null;
  updatedOnBehalfOf: string | null;
  version: number;
  updatedAt: string;
};

export type CreateCreativeResourceEntryInput = {
  scope: string;
  worldEntityId: string;
  requestId: string;
  entryType: CreativeResourceEntryType;
  category: CreativeResourceCategory;
  title: string;
  description: string;
  timeWindow?: string;
  sourceUrl?: string;
};

export type UpdateCreativeResourceEntryInput = {
  scope: string;
  entityId: string;
  requestId: string;
  title: string;
  description: string;
  timeWindow?: string;
  sourceUrl?: string;
  status: CreativeResourceStatus;
};

export function isCreativeResourceCategory(value: string): value is CreativeResourceCategory {
  return CREATIVE_RESOURCE_CATEGORIES.some((category) => category.value === value);
}

export function isCreativeResourceEntryType(value: string): value is CreativeResourceEntryType {
  return value === "offer" || value === "need";
}

export function isCreativeResourceStatus(value: string): value is CreativeResourceStatus {
  return value === "open" || value === "withdrawn";
}

export type CreateCreativeArtifactInput = {
  scope: string;
  worldEntityId: string;
  requestId: string;
  title: string;
  body: string;
  position: CreativePosition;
};
export type UpdateCreativeArtifactInput = {
  scope: string;
  entityId: string;
  requestId: string;
  title: string;
  body: string;
  position: CreativePosition;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_LENGTH = 7000;

const RESOURCE_CATEGORY_VALUES = CREATIVE_RESOURCE_CATEGORIES.map((category) => category.value);

function requireResourceCategory(value: string): CreativeResourceCategory {
  if (!RESOURCE_CATEGORY_VALUES.includes(value as CreativeResourceCategory)) {
    throw new KernelError("invalid", "Choose a supported resource category", "");
  }
  return value as CreativeResourceCategory;
}

function requireResourceType(value: string): CreativeResourceEntryType {
  if (value !== "offer" && value !== "need") throw new KernelError("invalid", "Choose an offer or a need", "");
  return value;
}

function requireResourceStatus(value: string): CreativeResourceStatus {
  if (value !== "open" && value !== "withdrawn") throw new KernelError("invalid", "Choose an open or withdrawn entry", "");
  return value;
}

function requireTimeWindow(value: string): string {
  const text = requireBody(value.trim());
  if (text.length > 300) throw new KernelError("invalid", "Time window must be 300 characters or less", "");
  return text;
}

function requireSourceUrl(value: string): string {
  const text = value.trim();
  if (!text) return "";
  if (text.length > 2048) throw new KernelError("invalid", "Source URL must be 2,048 characters or less", "");
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new KernelError("invalid", "Source must be a valid HTTP or HTTPS URL", "");
  }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) {
    throw new KernelError("invalid", "Source must be an HTTP or HTTPS URL without embedded credentials", "");
  }
  return url.toString();
}

function requireWorldId(worldId: string): string {
  if (!UUID.test(worldId)) throw new KernelError("invalid", "World id must be a UUID", "");
  return worldId.toLowerCase();
}

function requireScope(scope: string): { worldId: string; scope: string } {
  const match = /^world:([0-9a-f-]{36})$/i.exec(scope);
  if (!match || !UUID.test(match[1])) throw new KernelError("invalid", "Expected a top-level World scope", "");
  const worldId = match[1].toLowerCase();
  return { worldId, scope: `world:${worldId}` };
}

function requireTitle(title: string): string {
  const value = title.trim();
  if (!value || value.length > 160) throw new KernelError("invalid", "Title must be between 1 and 160 characters", "");
  return value;
}

function requireBody(body: string): string {
  if (body.length > MAX_BODY_LENGTH) throw new KernelError("invalid", `Text must be ${MAX_BODY_LENGTH} characters or less`, "");
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(body)) {
    throw new KernelError("invalid", "Text contains unsupported control characters", "");
  }
  return body;
}

function requirePosition(position: CreativePosition): CreativePosition {
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y) || position.x < 0 || position.x > 100 || position.y < 0 || position.y > 100) {
    throw new KernelError("invalid", "Canvas position must be between 0 and 100", "");
  }
  return { x: Math.round(position.x), y: Math.round(position.y) };
}

function requestKey(prefix: string, requestId: string): string {
  const id = requestId.trim();
  if (!id || id.length > 100) throw new KernelError("invalid", "Request id must be between 1 and 100 characters", "");
  return `creative:${prefix}:${id}`;
}

function worldFromEntity(entity: WorldEntity): CreativeWorld | null {
  if (entity.kind !== "world" || typeof entity.attributes.worldId !== "string") return null;
  const worldId = entity.attributes.worldId;
  if (!UUID.test(worldId) || entity.scope !== `world:${worldId.toLowerCase()}`) return null;
  return {
    worldId: worldId.toLowerCase(),
    scope: entity.scope,
    entityId: entity.entity_id,
    title: entity.title,
    summary: entity.summary,
    updatedAt: entity.updated_at,
  };
}

function artifactFromEntity(entity: WorldEntity): CreativeArtifact | null {
  if (entity.kind !== "document" || entity.attributes.documentType !== "text") return null;
  const canvas = entity.attributes.canvas;
  if (!canvas || typeof canvas !== "object") return null;
  const { x, y } = canvas as Record<string, unknown>;
  if (typeof x !== "number" || typeof y !== "number") return null;
  return {
    entityId: entity.entity_id,
    title: entity.title,
    body: typeof entity.attributes.content === "string" ? entity.attributes.content : "",
    position: { x, y },
    version: entity.version,
    updatedAt: entity.updated_at,
  };
}

type CreativeResourceAttribution = {
  reportedBy: string | null;
  reportedOnBehalfOf: string | null;
  updatedBy: string | null;
  updatedOnBehalfOf: string | null;
};

function resourceFromEntity(
  entity: WorldEntity,
  attribution: CreativeResourceAttribution = {
    reportedBy: null,
    reportedOnBehalfOf: null,
    updatedBy: null,
    updatedOnBehalfOf: null,
  },
): CreativeResourceEntry | null {
  const attributes = entity.attributes;
  const entryType = attributes.resourceType;
  const category = attributes.resourceCategory;
  const status = attributes.status;
  if (
    (entity.kind !== "resource" && entity.kind !== "need") ||
    (entryType !== "offer" && entryType !== "need") ||
    (entryType === "offer" && entity.kind !== "resource") ||
    (entryType === "need" && entity.kind !== "need") ||
    typeof category !== "string" ||
    !isCreativeResourceCategory(category) ||
    (status !== "open" && status !== "withdrawn") ||
    attributes.worldId !== entity.scope.slice("world:".length)
  ) return null;

  let sourceUrl = "";
  if (typeof attributes.sourceUrl === "string" && attributes.sourceUrl) {
    try {
      sourceUrl = requireSourceUrl(attributes.sourceUrl);
    } catch {
      sourceUrl = "";
    }
  }
  return {
    entityId: entity.entity_id,
    entryType,
    category,
    title: entity.title,
    description: typeof attributes.description === "string" ? attributes.description : entity.summary,
    timeWindow: typeof attributes.timeWindow === "string" ? attributes.timeWindow : "",
    sourceUrl,
    sourceStatus: sourceUrl ? "user_supplied_unverified" : "none",
    status,
    ...attribution,
    version: entity.version,
    updatedAt: entity.updated_at,
  };
}

// Entity attributes are editable data. Attribution comes from the immutable event actor instead.
// The bounded history scan fails closed: entries outside the 10,000-event window have no editor
// and cannot be revised through this adapter until their provenance can be read.
async function resourceAttributionByEntity(
  kernel: Kernel,
  scope: string,
  entities: WorldEntity[],
): Promise<Map<string, CreativeResourceAttribution>> {
  const resourceEntities = entities.filter((entity) =>
    (entity.kind === "resource" || entity.kind === "need") &&
    entity.attributes.worldId === scope.slice("world:".length)
  );
  const found = new Map<string, {
    created: { actorId: string; onBehalfOf: string | null } | null;
    latestVersion: number;
    latestActor: { actorId: string; onBehalfOf: string | null } | null;
  }>();
  for (const entity of resourceEntities) {
    found.set(entity.entity_id, { created: null, latestVersion: 0, latestActor: null });
  }
  if (!found.size) return new Map();

  const wanted = new Set(found.keys());
  let afterSeq = 0;
  for (let page = 0; page < 20; page++) {
    const events = await kernel.readEvents(scope, { afterSeq, limit: 500 });
    for (const event of events) {
      if (event.type !== "kernel.entity.created" && event.type !== "kernel.entity.updated") continue;
      const payload = event.payload;
      const entityId = typeof payload.entity_id === "string"
        ? payload.entity_id
        : typeof (payload.request as Record<string, unknown> | undefined)?.entity_id === "string"
          ? String((payload.request as Record<string, unknown>).entity_id)
          : "";
      if (!wanted.has(entityId)) continue;
      const version = typeof payload.version === "number" ? payload.version : Number(payload.version);
      if (!Number.isSafeInteger(version) || version < 1) continue;
      const record = found.get(entityId)!;
      const actor = { actorId: event.actor_id, onBehalfOf: event.on_behalf_of };
      if (event.type === "kernel.entity.created" && version === 1 && !record.created) record.created = actor;
      if (version >= record.latestVersion) {
        record.latestVersion = version;
        record.latestActor = actor;
      }
    }
    if (events.length < 500) break;
    const last = events.at(-1);
    if (!last || last.seq <= afterSeq) break;
    afterSeq = last.seq;
  }

  const versions = new Map(resourceEntities.map((entity) => [entity.entity_id, entity.version]));
  return new Map([...found].map(([entityId, record]) => {
    const currentVersion = versions.get(entityId);
    const latest = currentVersion === record.latestVersion ? record.latestActor : null;
    return [entityId, {
      reportedBy: record.created?.actorId ?? null,
      reportedOnBehalfOf: record.created?.onBehalfOf ?? null,
      updatedBy: latest?.actorId ?? null,
      updatedOnBehalfOf: latest?.onBehalfOf ?? null,
    }];
  }));
}
async function callerOwnsScope(kernel: Kernel, actorId: string, scope: string): Promise<boolean> {
  const grants = await kernel.myGrants();
  if (!grants.some((grant) => grant.scope === scope && grant.capability === "*")) return false;
  const events = await kernel.readEvents(scope, { limit: 50 });
  const claim = events.find((event) => event.type === "kernel.scope.claimed");
  return claim?.actor_id === actorId;
}

async function assertWorldEntity(kernel: Kernel, scope: string, entityId: string): Promise<CreativeWorld> {
  const world = (await kernel.readWorld(scope))
    .map(worldFromEntity)
    .find((candidate) => candidate?.entityId === entityId);
  if (!world) throw new KernelError("not_found", "World not found in this scope", "");
  return world;
}

export async function createCreativeWorld(kernel: Kernel, input: CreateCreativeWorldInput): Promise<CreativeWorld> {
  const worldId = requireWorldId(input.worldId);
  const scope = `world:${worldId}`;
  const title = requireTitle(input.title);
  const goal = requireBody(input.goal?.trim() ?? "");
  const actor = await kernel.whoami();

  if (!(await callerOwnsScope(kernel, actor.actor_id, scope))) {
    try {
      await kernel.claimScope(scope);
    } catch (error) {
      // Two retries from the same owner can race after the scope claim commits. Continue only if
      // the resulting claim is theirs; an existing World owned by someone else stays private.
      if (!(error instanceof KernelError) || error.name !== "conflict" || !(await callerOwnsScope(kernel, actor.actor_id, scope))) {
        throw error;
      }
    }
  }

  if (!(await callerOwnsScope(kernel, actor.actor_id, scope))) {
    throw new KernelError("forbidden", "This World scope belongs to another person", "");
  }

  const entityId = await kernel.upsertEntity({
    kind: "world",
    scope,
    title,
    summary: goal ? goal.slice(0, 2_000) : "A private World. Start with a blank canvas and shape it as you go.",
    attributes: { worldId, createdBy: actor.actor_id, canvasVersion: 1 },
    visibility: "members",
    idempotencyKey: `creative:world:${worldId}`,
  });
  await kernel.relate({
    kind: "owns",
    fromRef: `actor:${actor.actor_id}`,
    toRef: `entity:${entityId}`,
    scope,
    attributes: { basis: "scope_claim" },
    idempotencyKey: `creative:owner:${worldId}`,
  });

  if (goal) {
    await createCreativeArtifact(kernel, {
      scope,
      worldEntityId: entityId,
      requestId: `goal:${worldId}`,
      title: "Goal",
      body: goal,
      position: { x: 50, y: 25 },
    });
  }

  const [entity] = (await kernel.readWorld(scope)).filter((row) => row.entity_id === entityId);
  const world = entity && worldFromEntity(entity);
  if (!world) throw new KernelError("unavailable", "World was created but could not be read back", "");
  return world;
}

export async function listCreativeWorlds(kernel: Kernel): Promise<CreativeWorld[]> {
  await kernel.whoami();
  const grants = await kernel.myGrants();
  const scopes = [...new Set(grants
    .filter((grant) => grant.capability === "*" || grant.capability === "kernel.read")
    .map((grant) => grant.scope)
    .filter((scope) => /^world:[0-9a-f-]{36}$/i.test(scope) && UUID.test(scope.slice("world:".length))))];

  const worlds = await Promise.all(scopes.map(async (scope) => {
    try {
      return (await kernel.readWorld(scope)).map(worldFromEntity).filter((world): world is CreativeWorld => world !== null);
    } catch (error) {
      // A grant can be revoked between listing grants and reading the World.
      if (error instanceof KernelError && error.name === "forbidden") return [];
      throw error;
    }
  }));
  return worlds.flat().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function loadCreativeWorld(kernel: Kernel, rawWorldId: string) {
  const worldId = requireWorldId(rawWorldId);
  const scope = `world:${worldId}`;
  const entities = await kernel.readWorld(scope);
  const world = entities.map(worldFromEntity).find((candidate) => candidate?.worldId === worldId);
  if (!world) throw new KernelError("not_found", "World not found", "");
  const artifacts = entities.map(artifactFromEntity).filter((artifact): artifact is CreativeArtifact => artifact !== null);
  const attribution = await resourceAttributionByEntity(kernel, scope, entities);
  const resources = entities
    .map((entity) => resourceFromEntity(entity, attribution.get(entity.entity_id)))
    .filter((entry): entry is CreativeResourceEntry => entry !== null);
  return { world, artifacts, resources };
}

export async function createCreativeArtifact(kernel: Kernel, input: CreateCreativeArtifactInput): Promise<string> {
  const { worldId, scope } = requireScope(input.scope);
  await assertWorldEntity(kernel, scope, input.worldEntityId);
  const title = requireTitle(input.title);
  const body = requireBody(input.body);
  const position = requirePosition(input.position);
  const entityId = await kernel.upsertEntity({
    kind: "document",
    scope,
    title,
    summary: body.trim().slice(0, 240),
    attributes: { documentType: "text", worldId, content: body, canvas: position },
    visibility: "members",
    idempotencyKey: requestKey("artifact-create", input.requestId),
  });
  return entityId;
}

export async function updateCreativeArtifact(kernel: Kernel, input: UpdateCreativeArtifactInput): Promise<string> {
  const { worldId, scope } = requireScope(input.scope);
  const existing = (await kernel.readWorld(scope)).find((entity) => entity.entity_id === input.entityId);
  if (!existing || existing.kind !== "document" || existing.attributes.documentType !== "text" || existing.attributes.worldId !== worldId) {
    throw new KernelError("not_found", "Text artifact not found in this World", "");
  }
  const title = requireTitle(input.title);
  const body = requireBody(input.body);
  const position = requirePosition(input.position);
  return kernel.upsertEntity({
    entityId: input.entityId,
    kind: "document",
    scope,
    title,
    summary: body.trim().slice(0, 240),
    attributes: { documentType: "text", worldId, content: body, canvas: position },
    visibility: "members",
    idempotencyKey: requestKey(`artifact-update:${input.entityId}`, input.requestId),
  });
}
export async function createCreativeResourceEntry(kernel: Kernel, input: CreateCreativeResourceEntryInput): Promise<string> {
  const { worldId, scope } = requireScope(input.scope);
  const world = await assertWorldEntity(kernel, scope, input.worldEntityId);
  const entryType = requireResourceType(input.entryType);
  const category = requireResourceCategory(input.category);
  const title = requireTitle(input.title);
  const description = requireBody(input.description);
  const timeWindow = requireTimeWindow(input.timeWindow ?? "");
  const sourceUrl = requireSourceUrl(input.sourceUrl ?? "");
  const kind = entryType === "offer" ? "resource" : "need";
  const entityId = await kernel.upsertEntity({
    kind,
    scope,
    title,
    summary: description.trim().slice(0, 240),
    attributes: {
      worldId,
      resourceType: entryType,
      resourceCategory: category,
      description,
      timeWindow,
      sourceUrl,
      sourceStatus: sourceUrl ? "user_supplied_unverified" : "none",
      status: "open",
      basis: "self_reported",
    },
    visibility: "members",
    idempotencyKey: requestKey(`resource-create:${entryType}`, input.requestId),
  });
  // Resource entries live in the same private scope as the World. A separate relation would
  // require world.relation.write, which an Add-only collaborator does not receive.
  if (world.scope !== scope) throw new KernelError("not_found", "World not found in this scope", "");
  return entityId;
}

export async function updateCreativeResourceEntry(kernel: Kernel, input: UpdateCreativeResourceEntryInput): Promise<string> {
  const { worldId, scope } = requireScope(input.scope);
  const existing = (await kernel.readWorld(scope)).find((entity) => entity.entity_id === input.entityId);
  if (
    !existing ||
    (existing.kind !== "resource" && existing.kind !== "need") ||
    existing.attributes.worldId !== worldId ||
    !resourceFromEntity(existing)
  ) throw new KernelError("not_found", "Resource entry not found in this World", "");
  const actor = await kernel.whoami();
  const attribution = await resourceAttributionByEntity(kernel, scope, [existing]).then((map) => map.get(existing.entity_id));
  if (attribution?.reportedBy !== actor.actor_id) {
    throw new KernelError("forbidden", "Only the person who reported this entry can revise or withdraw it", "");
  }
  const title = requireTitle(input.title);
  const description = requireBody(input.description);
  const timeWindow = requireTimeWindow(input.timeWindow ?? "");
  const sourceUrl = requireSourceUrl(input.sourceUrl ?? "");
  const status = requireResourceStatus(input.status);
  return kernel.upsertEntity({
    entityId: existing.entity_id,
    kind: existing.kind,
    scope,
    title,
    summary: description.trim().slice(0, 240),
    attributes: {
      ...existing.attributes,
      description,
      timeWindow,
      sourceUrl,
      sourceStatus: sourceUrl ? "user_supplied_unverified" : "none",
      status,
    },
    visibility: "members",
    idempotencyKey: requestKey(`resource-update:${input.entityId}`, input.requestId),
  });
}

