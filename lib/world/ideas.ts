import { KernelError, type Kernel, type WorldEntity, type WorldRelation } from "../kernel/client";

export const IDEA_RELATION_KINDS = [
  "idea_derived_from",
  "idea_supports",
  "idea_contradicts",
  "idea_supersedes",
  "idea_implemented_by",
  "idea_tested_by",
  "idea_evidenced_by",
  "idea_blocked_by",
] as const;
export type IdeaRelationKind = (typeof IDEA_RELATION_KINDS)[number];

export const IDEA_STATUSES = [
  "captured",
  "explored",
  "proposed",
  "approved_for_experiment",
  "building",
  "observed",
  "retained",
  "rejected",
  "blocked",
] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number];

export type IdeaRecord = {
  id: string;
  scope: string;
  title: string;
  description: string;
  status: IdeaStatus;
  assumptions: string[];
  openQuestions: string[];
  version: number;
  updatedAt: string;
};

export type IdeaLink = {
  id: string;
  kind: IdeaRelationKind;
  fromId: string;
  toId: string;
  scope: string;
  createdAt: string;
};

export type IdeaGraph = { ideas: IdeaRecord[]; links: IdeaLink[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NEXT: Record<IdeaStatus, readonly IdeaStatus[]> = {
  captured: ["explored", "proposed", "rejected", "blocked"],
  explored: ["proposed", "rejected", "blocked"],
  proposed: ["approved_for_experiment", "rejected", "blocked"],
  approved_for_experiment: ["building", "rejected", "blocked"],
  building: ["observed", "rejected", "blocked"],
  observed: ["retained", "rejected", "blocked"],
  retained: [],
  rejected: ["explored"],
  blocked: ["explored", "proposed", "approved_for_experiment", "rejected"],
};

function requireScope(scope: string): string {
  const match = /^world:([0-9a-f-]{36})$/i.exec(scope);
  if (!match || !UUID.test(match[1])) throw new KernelError("invalid", "Expected a top-level World scope", "");
  return `world:${match[1].toLowerCase()}`;
}

function requestKey(requestId: string, action: string): string {
  const id = requestId.trim();
  if (!id || id.length > 100) throw new KernelError("invalid", "Request id must be between 1 and 100 characters", "");
  return `idea:${action}:${id}`;
}

function cleanList(values: string[] | undefined, field: string): string[] {
  const items = values ?? [];
  if (!Array.isArray(items) || items.length > 20) throw new KernelError("invalid", `${field} must have at most 20 items`, "");
  return items.map((item) => {
    if (typeof item !== "string" || !item.trim() || item.trim().length > 500) {
      throw new KernelError("invalid", `${field} items must be between 1 and 500 characters`, "");
    }
    return item.trim();
  });
}

function asIdea(entity: WorldEntity): IdeaRecord | null {
  const a = entity.attributes;
  if (entity.kind !== "document" || a.documentType !== "idea" || a.schemaVersion !== 1) return null;
  if (!IDEA_STATUSES.includes(a.status as IdeaStatus)) return null;
  return {
    id: entity.entity_id,
    scope: entity.scope,
    title: entity.title,
    description: typeof a.description === "string" ? a.description : "",
    status: a.status as IdeaStatus,
    assumptions: Array.isArray(a.assumptions) ? a.assumptions.filter((x): x is string => typeof x === "string") : [],
    openQuestions: Array.isArray(a.openQuestions) ? a.openQuestions.filter((x): x is string => typeof x === "string") : [],
    version: entity.version,
    updatedAt: entity.updated_at,
  };
}

function asIdeaLink(relation: WorldRelation): IdeaLink | null {
  if (!IDEA_RELATION_KINDS.includes(relation.kind as IdeaRelationKind)) return null;
  const from = /^entity:([0-9a-f-]{36})$/i.exec(relation.from_ref);
  const to = /^entity:([0-9a-f-]{36})$/i.exec(relation.to_ref);
  if (!from || !to || !UUID.test(from[1]) || !UUID.test(to[1])) return null;
  return {
    id: relation.relation_id,
    kind: relation.kind as IdeaRelationKind,
    fromId: from[1].toLowerCase(),
    toId: to[1].toLowerCase(),
    scope: relation.scope,
    createdAt: relation.created_at,
  };
}

function relationMap(graph: IdeaGraph, kind: IdeaRelationKind, fromId: string, toId: string) {
  return graph.links.some((link) => link.kind === kind && link.fromId === fromId && link.toId === toId);
}

export async function readIdeaGraph(kernel: Kernel, rawScope: string): Promise<IdeaGraph> {
  const scope = requireScope(rawScope);
  const [entities, relations] = await Promise.all([kernel.readWorld(scope), kernel.readRelations(scope)]);
  const ideas = entities.map(asIdea).filter((idea): idea is IdeaRecord => idea !== null);
  const ids = new Set(ideas.map((idea) => idea.id));
  const links = relations
    .map(asIdeaLink)
    .filter((link): link is IdeaLink => link !== null && link.scope === scope && ids.has(link.fromId) && ids.has(link.toId));
  return { ideas, links };
}

export async function createIdea(kernel: Kernel, input: {
  scope: string;
  requestId: string;
  title: string;
  description: string;
  assumptions?: string[];
  openQuestions?: string[];
}): Promise<string> {
  const scope = requireScope(input.scope);
  const title = input.title.trim();
  if (!title || title.length > 160) throw new KernelError("invalid", "Title must be between 1 and 160 characters", "");
  if (input.description.length > 7000) throw new KernelError("invalid", "Description must be 7000 characters or less", "");
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(input.description)) {
    throw new KernelError("invalid", "Description contains unsupported control characters", "");
  }
  const worldId = scope.slice("world:".length).toLowerCase();
  const worldExists = (await kernel.readWorld(scope)).some((entity) =>
    entity.kind === "world" && entity.attributes.worldId === worldId && entity.scope === scope
  );
  if (!worldExists) throw new KernelError("not_found", "World not found in this scope", "");
  const actor = await kernel.whoami();
  const id = await kernel.upsertEntity({
    kind: "document",
    scope,
    title,
    summary: input.description.trim().slice(0, 240),
    attributes: {
      documentType: "idea",
      schemaVersion: 1,
      description: input.description,
      status: "captured",
      assumptions: cleanList(input.assumptions, "Assumptions"),
      openQuestions: cleanList(input.openQuestions, "Open questions"),
      createdBy: actor.actor_id,
    },
    visibility: "members",
    idempotencyKey: requestKey(input.requestId, "create"),
  });
  return id;
}

export async function relateIdeas(kernel: Kernel, input: {
  scope: string;
  fromId: string;
  toId: string;
  kind: IdeaRelationKind;
  requestId: string;
}): Promise<string> {
  const scope = requireScope(input.scope);
  if (!IDEA_RELATION_KINDS.includes(input.kind)) throw new KernelError("invalid", "Unsupported Idea Graph relation", "");
  if (!UUID.test(input.fromId) || !UUID.test(input.toId) || input.fromId === input.toId) {
    throw new KernelError("invalid", "A relation needs two different idea records", "");
  }
  const graph = await readIdeaGraph(kernel, scope);
  if (!graph.ideas.some((idea) => idea.id === input.fromId) || !graph.ideas.some((idea) => idea.id === input.toId)) {
    throw new KernelError("not_found", "Both ideas must exist in this World", "");
  }
  if (relationMap(graph, input.kind, input.fromId, input.toId)) {
    // Replaying a relation with a new request id would create a duplicate. Return its canonical id.
    return graph.links.find((link) => link.kind === input.kind && link.fromId === input.fromId && link.toId === input.toId)!.id;
  }
  if (input.kind === "idea_derived_from") {
    const parentByChild = new Map(graph.links.filter((link) => link.kind === "idea_derived_from").map((link) => [link.fromId, link.toId]));
    let cursor: string | undefined = input.toId;
    while (cursor) {
      if (cursor === input.fromId) throw new KernelError("invalid", "Derived-from links cannot form a cycle", "");
      cursor = parentByChild.get(cursor);
    }
  }
  return kernel.relate({
    kind: input.kind,
    fromRef: `entity:${input.fromId}`,
    toRef: `entity:${input.toId}`,
    scope,
    attributes: { schemaVersion: 1 },
    idempotencyKey: requestKey(input.requestId, "relate"),
  });
}

export async function updateIdeaStatus(kernel: Kernel, input: {
  scope: string;
  ideaId: string;
  status: IdeaStatus;
  requestId: string;
  reason?: string;
}): Promise<void> {
  const scope = requireScope(input.scope);
  if (!UUID.test(input.ideaId) || !IDEA_STATUSES.includes(input.status)) throw new KernelError("invalid", "Invalid idea or status", "");
  const graph = await readIdeaGraph(kernel, scope);
  const idea = graph.ideas.find((candidate) => candidate.id === input.ideaId);
  if (!idea) throw new KernelError("not_found", "Idea not found in this World", "");
  if (idea.status === input.status) return;
  if (!NEXT[idea.status].includes(input.status)) {
    throw new KernelError("invalid", `Cannot move an idea from ${idea.status} to ${input.status}`, "");
  }
  const reason = (input.reason ?? "").trim();
  if (reason.length > 1000) throw new KernelError("invalid", "Status reason must be 1000 characters or less", "");
  if (["rejected", "blocked"].includes(input.status) && !reason) {
    throw new KernelError("invalid", "Rejected or blocked ideas need a recorded reason", "");
  }
  const entity: WorldEntity | undefined = (await kernel.readWorld(scope)).find((row) => row.entity_id === input.ideaId);
  if (!entity || entity.kind !== "document" || entity.attributes.documentType !== "idea") {
    throw new KernelError("not_found", "Idea not found in this World", "");
  }
  await kernel.upsertEntity({
    entityId: input.ideaId,
    kind: "document",
    scope,
    title: entity.title,
    summary: entity.summary,
    attributes: { ...entity.attributes, status: input.status, statusReason: reason },
    visibility: entity.visibility ?? "members",
    importance: entity.importance,
    idempotencyKey: requestKey(input.requestId, `status:${input.ideaId}`),
  });
}
