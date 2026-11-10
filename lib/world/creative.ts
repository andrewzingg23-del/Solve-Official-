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
  via: string | null; // the assistant the latest revision came through, when a bot made it
  visibility: WorldEntity["visibility"];
};

export type CreateCreativeWorldInput = { worldId: string; title: string; goal?: string };
// The assistant (Claude, ChatGPT, Codex…) a person's bot was working through when it made a revision.
export type ArtifactVia = { clientId: string | null; clientName: string | null };

export type CreateCreativeArtifactInput = {
  scope: string;
  worldEntityId: string;
  requestId: string;
  title: string;
  body: string;
  position: CreativePosition;
  via?: ArtifactVia;
};
export type UpdateCreativeArtifactInput = {
  scope: string;
  entityId: string;
  requestId: string;
  expectedVersion?: number;
  title: string;
  body: string;
  position: CreativePosition;
  via?: ArtifactVia;
};

function viaAttributes(via?: ArtifactVia) {
  const clientName = via?.clientName?.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 80) || null;
  const clientId = via?.clientId?.trim().slice(0, 200) || null;
  return clientName || clientId ? { via: { client_id: clientId, client_name: clientName } } : {};
}

export function viaOf(attributes: Record<string, unknown> | null | undefined): string | null {
  const via = attributes?.via;
  if (!via || typeof via !== "object") return null;
  const name = (via as Record<string, unknown>).client_name;
  return typeof name === "string" && name.trim() ? name.trim().slice(0, 80) : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_LENGTH = 7000;

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
    via: viaOf(entity.attributes),
    visibility: entity.visibility,
  };
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
  return { world, artifacts, entities };
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
    attributes: { documentType: "text", worldId, content: body, canvas: position, ...viaAttributes(input.via) },
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
  return kernel.updateDocument({
    entityId: input.entityId,
    expectedVersion: input.expectedVersion ?? existing.version,
    scope,
    title,
    summary: body.trim().slice(0, 240),
    attributes: { documentType: "text", worldId, content: body, canvas: position, ...viaAttributes(input.via) },
    idempotencyKey: requestKey(`artifact-update:${input.entityId}`, input.requestId),
  });
}
