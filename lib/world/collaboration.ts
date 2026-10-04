import { KernelError, type Kernel, type KernelEvent } from "../kernel/client";

export type WorldAccessRole = "viewer" | "editor";
export type WorldCollaborator = {
  actorId: string;
  role: WorldAccessRole;
  capabilities: string[];
  grantIds: string[];
  grants: Array<{ id: string; capability: string }>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MANAGED_CAPABILITIES = ["kernel.read", "world.entity.write"] as const;

function worldScope(value: string): string {
  const match = /^world:([0-9a-f-]{36})$/i.exec(value);
  if (!match || !UUID.test(match[1])) throw new KernelError("invalid", "Expected a World scope", "");
  return "world:" + match[1].toLowerCase();
}

function requestKey(requestId: string, suffix: string): string {
  const id = requestId.trim();
  if (!id || id.length > 80) throw new KernelError("invalid", "Request id must be between 1 and 80 characters", "");
  return "creative:access:" + id + ":" + suffix;
}

async function requireWorldOwner(kernel: Kernel, scope: string): Promise<string> {
  const [actor, grants, events] = await Promise.all([
    kernel.whoami(),
    kernel.myGrants(),
    kernel.readEvents(scope, { limit: 1 }),
  ]);
  const hasOwnerGrant = grants.some((grant) => grant.scope === scope && grant.capability === "*");
  const claim = events.find((event) => event.type === "kernel.scope.claimed");
  if (!hasOwnerGrant || claim?.actor_id !== actor.actor_id) {
    throw new KernelError("forbidden", "Only the World owner can manage collaborator access", "");
  }
  const worldId = scope.slice("world:".length);
  const exists = (await kernel.readWorld(scope)).some((entity) =>
    entity.kind === "world" && entity.attributes.worldId === worldId
  );
  if (!exists) throw new KernelError("not_found", "World not found", "");
  return actor.actor_id;
}

function grantFields(event: KernelEvent) {
  if (event.type !== "kernel.grant.issued") return null;
  const payload = event.payload;
  const id = payload.grant_id;
  const actorId = payload.grantee_id;
  const capability = payload.capability;
  const scope = payload.scope;
  if (typeof id !== "string" || typeof actorId !== "string" ||
      typeof capability !== "string" || typeof scope !== "string") return null;
  return { id, actorId, capability, scope };
}

async function activeCollaborators(kernel: Kernel, scope: string, ownerActorId: string): Promise<WorldCollaborator[]> {
  const grants = new Map<string, { actorId: string; capability: string }>();
  let afterSeq = 0;
  for (;;) {
    const page = await kernel.readEvents(scope, { afterSeq, limit: 500 });
    if (page.length === 0) break;
    for (const event of page) {
      if (event.actor_id === ownerActorId) {
        const issued = grantFields(event);
        if (issued && issued.scope === scope && MANAGED_CAPABILITIES.includes(issued.capability as (typeof MANAGED_CAPABILITIES)[number])) {
          grants.set(issued.id, { actorId: issued.actorId, capability: issued.capability });
        }
      }
      if (event.type === "kernel.grant.revoked" && typeof event.payload.grant_id === "string") {
        grants.delete(event.payload.grant_id);
      }
    }
    const lastSeq = page[page.length - 1].seq;
    if (lastSeq <= afterSeq) throw new KernelError("unavailable", "World history could not be read in order", "");
    afterSeq = lastSeq;
    if (page.length < 500) break;
  }

  const byActor = new Map<string, WorldCollaborator>();
  for (const [grantId, grant] of grants) {
    if (grant.actorId === ownerActorId) continue;
    const collaborator = byActor.get(grant.actorId) ?? {
      actorId: grant.actorId,
      role: "viewer" as WorldAccessRole,
      capabilities: [],
      grantIds: [],
      grants: [],
    };
    collaborator.capabilities.push(grant.capability);
    collaborator.grantIds.push(grantId);
    collaborator.grants.push({ id: grantId, capability: grant.capability });
    if (grant.capability === "world.entity.write") collaborator.role = "editor";
    byActor.set(grant.actorId, collaborator);
  }
  return [...byActor.values()]
    .map((collaborator) => ({
      ...collaborator,
      capabilities: [...new Set(collaborator.capabilities)].sort(),
      grantIds: collaborator.grantIds.sort(),
      grants: collaborator.grants.sort((a, b) => a.capability.localeCompare(b.capability) || a.id.localeCompare(b.id)),
    }))
    .sort((a, b) => a.actorId.localeCompare(b.actorId));
}

export async function listWorldCollaborators(kernel: Kernel, rawScope: string): Promise<WorldCollaborator[]> {
  const scope = worldScope(rawScope);
  const ownerActorId = await requireWorldOwner(kernel, scope);
  return activeCollaborators(kernel, scope, ownerActorId);
}

export async function grantWorldAccess(kernel: Kernel, input: {
  scope: string;
  granteeActorId: string;
  role: WorldAccessRole;
  requestId: string;
}): Promise<WorldCollaborator> {
  const scope = worldScope(input.scope);
  const granteeActorId = input.granteeActorId.trim().toLowerCase();
  if (!UUID.test(granteeActorId)) throw new KernelError("invalid", "Enter a valid SOV ID", "");
  if (input.role !== "viewer" && input.role !== "editor") throw new KernelError("invalid", "Choose a valid access role", "");
  const ownerActorId = await requireWorldOwner(kernel, scope);
  if (granteeActorId === ownerActorId) throw new KernelError("invalid", "The World owner already has full access", "");

  const existing = (await activeCollaborators(kernel, scope, ownerActorId)).find((entry) => entry.actorId === granteeActorId);
  if (existing) {
    if (existing.role !== input.role) {
      throw new KernelError("conflict", "Remove the current access before changing this person's role", "");
    }
    const required = input.role === "editor" ? ["kernel.read", "world.entity.write"] : ["kernel.read"];
    if (required.every((capability) => existing.capabilities.includes(capability))) return existing;
  }

  const required = input.role === "editor" ? ["kernel.read", "world.entity.write"] : ["kernel.read"];
  const issued: string[] = [];
  try {
    for (const capability of required) {
      if (existing?.capabilities.includes(capability)) continue;
      const grantId = await kernel.issueGrant({
        grantee: granteeActorId,
        capability,
        scope,
        idempotencyKey: requestKey(input.requestId, capability.replaceAll(".", "-")),
      });
      issued.push(grantId);
    }
  } catch (error) {
    let rollbackFailed = false;
    for (const grantId of issued.reverse()) {
      try {
        await kernel.revokeGrant(grantId, "Incomplete World access grant", requestKey(input.requestId, "rollback-" + grantId));
      } catch {
        rollbackFailed = true;
      }
    }
    if (rollbackFailed) throw new KernelError("unavailable", "Access setup was incomplete; review this person's access in the World panel", "");
    throw error;
  }

  const collaborators = await activeCollaborators(kernel, scope, ownerActorId);
  const result = collaborators.find((entry) => entry.actorId === granteeActorId);
  if (!result) throw new KernelError("unavailable", "The access grant could not be read back", "");
  return result;
}

export async function revokeWorldAccess(kernel: Kernel, input: {
  scope: string;
  granteeActorId: string;
  requestId: string;
}): Promise<void> {
  const scope = worldScope(input.scope);
  const granteeActorId = input.granteeActorId.trim().toLowerCase();
  if (!UUID.test(granteeActorId)) throw new KernelError("invalid", "Enter a valid SOV ID", "");
  const ownerActorId = await requireWorldOwner(kernel, scope);
  const collaborator = (await activeCollaborators(kernel, scope, ownerActorId))
    .find((entry) => entry.actorId === granteeActorId);
  if (!collaborator) throw new KernelError("not_found", "Active collaborator not found", "");

  const ordered = [
    ...collaborator.grants.filter((grant) => grant.capability === "world.entity.write"),
    ...collaborator.grants.filter((grant) => grant.capability === "kernel.read"),
  ];
  for (const grant of ordered) {
    await kernel.revokeGrant(
      grant.id,
      "World owner removed collaborator access",
      requestKey(input.requestId, "revoke-" + grant.id),
    );
  }
}
