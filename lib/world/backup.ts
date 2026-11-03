import { KernelError, type Kernel } from "../kernel/client";
import { createCreativeWorld, loadCreativeWorld, type CreativeWorld } from "./creative";

export const PROJECT_BACKUP_MAX_BYTES = 1_000_000;
const REFERENCE_BANNER = "Imported reference — unverified source content; not a new decision or executable plan.\n\n";
const MAX_TOTAL_TEXT = 200_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type ProjectBackup = {
  format: "solve-project-backup";
  version: 1;
  project: { title: string; goal: string };
  documents: Array<{ title: string; body: string; visibility: "members" | "private" }>;
  messages?: Array<{ label: string; text: string; kind: "message" | "decision" | "ai_draft"; truncated: boolean }>;
};
const invalid = (message: string): never => { throw new KernelError("invalid", message, ""); };
function record(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid("The backup has an invalid record.");
  if (Object.keys(value).some(key => !keys.includes(key))) return invalid("The backup contains unsupported fields. Credentials, access grants and identity records cannot be imported.");
  return value as Record<string, unknown>;
}
function text(value: unknown, limit: number, required = false): string {
  if (typeof value !== "string" || value.length > limit || (required && !value.trim()) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(value)) return invalid(`Backup text must be ${limit} characters or less and contain no unsupported control characters.`);
  return value;
}

// Only a small, explicitly selected content schema can cross the import boundary.
// Never spread uploaded objects into kernel records or accept scopes/actors/IDs.
export function parseProjectBackup(raw: string): ProjectBackup {
  if (new TextEncoder().encode(raw).byteLength > PROJECT_BACKUP_MAX_BYTES) return invalid("Choose a backup smaller than 1 MB.");
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return invalid("Choose a valid SOLVE JSON backup."); }
  const root = record(value, ["format", "version", "project", "documents", "messages"]);
  if (root.format !== "solve-project-backup" || root.version !== 1) return invalid("This is not a supported SOLVE project backup.");
  const project = record(root.project, ["title", "goal"]);
  if (!Array.isArray(root.documents) || root.documents.length > 50) return invalid("A backup can contain up to 50 text documents.");
  const documents = root.documents.map(value => {
    const doc = record(value, ["title", "body", "visibility"]);
    if (doc.visibility !== "private" && doc.visibility !== "members") return invalid("Choose private or members visibility for each document.");
    const body = text(doc.body, 7200);
    if (!body.startsWith(REFERENCE_BANNER) && body.length + REFERENCE_BANNER.length > 7200) return invalid("Document text is too long for a reference copy.");
    return { title: text(doc.title, 160, true), body, visibility: doc.visibility as "members" | "private" };
  });
  let messages: ProjectBackup["messages"];
  if (root.messages !== undefined) {
    if (!Array.isArray(root.messages) || root.messages.length > 20 || documents.length + root.messages.length > 50) return invalid("A backup can contain up to 50 documents and conversation references in total.");
    messages = root.messages.map(value => {
      const message = record(value, ["label", "text", "kind", "truncated"]);
      if (!["message", "decision", "ai_draft"].includes(String(message.kind)) || typeof message.truncated !== "boolean") return invalid("Invalid conversation reference.");
      return { label: text(message.label, 80, true), text: text(message.text, 1000), kind: message.kind as "message" | "decision" | "ai_draft", truncated: message.truncated };
    });
  }
  const backup: ProjectBackup = { format: "solve-project-backup", version: 1, project: { title: text(project.title, 160, true), goal: text(project.goal, 2000) }, documents, ...(messages ? { messages } : {}) };
  const total = backup.project.title.length + backup.project.goal.length + documents.reduce((sum, doc) => sum + doc.title.length + doc.body.length, 0) + (messages ?? []).reduce((sum, message) => sum + message.text.length + message.label.length, 0);
  if (total > MAX_TOTAL_TEXT) return invalid("This backup exceeds the total text limit. Keep it below 200,000 characters.");
  return backup;
}

export async function exportProjectBackup(kernel: Kernel, worldId: string, includeMessages = false): Promise<ProjectBackup> {
  await kernel.whoami();
  // readWorld applies caller grants, including private-read authority, in kernel_api.
  const { world, artifacts } = await loadCreativeWorld(kernel, worldId);
  const messages = includeMessages ? await kernel.readRoomMessages(worldId, { limit: 20 }) : [];
  return parseProjectBackup(JSON.stringify({ format: "solve-project-backup", version: 1,
    project: { title: world.title, goal: world.summary },
    documents: artifacts.map(doc => ({ title: doc.title, body: doc.body, visibility: doc.visibility === "private" ? "private" : "members" })),
    ...(includeMessages ? { messages: messages.map(message => ({ label: message.actor_label.slice(0, 80), text: message.text.slice(0, 1000), kind: message.kind, truncated: message.text.length > 1000 })) } : {}),
  }));
}

export async function restoreProjectBackup(kernel: Kernel, input: { backup: ProjectBackup; requestId: string; expectedActorId: string }): Promise<CreativeWorld> {
  const backup = parseProjectBackup(JSON.stringify(input.backup));
  if (!UUID.test(input.requestId)) return invalid("Choose a new restore request.");
  const actor = await kernel.whoami();
  if (actor.actor_id !== input.expectedActorId || actor.kind !== "human") throw new KernelError("forbidden", "Your account identity changed. Reload before restoring this backup.", "");
  const worldId = input.requestId.toLowerCase();
  const scope = `world:${worldId}`;
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(new TextEncoder().encode(JSON.stringify(backup))).buffer);
  const fingerprint = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  const grants = await kernel.myGrants();
  if (!grants.some(grant => grant.scope === scope && grant.capability === "*")) {
    try { await kernel.claimScope(scope); }
    catch (error) {
      if (!(error instanceof KernelError) || error.name !== "conflict") throw error;
    }
  }
  const claim = (await kernel.readEvents(scope, { limit: 50 })).find(event => event.type === "kernel.scope.claimed");
  if (claim?.actor_id !== actor.actor_id) throw new KernelError("forbidden", "This restore request belongs to another account. Choose a new file to start a fresh copy.", "");
  const existing = await kernel.readWorld(scope);
  const manifest = existing.find(entity => entity.attributes.backupManifest === true);
  if ((manifest && (manifest.attributes.fingerprint !== fingerprint || manifest.attributes.restoredBy !== actor.actor_id)) || (!manifest && existing.length)) {
    throw new KernelError("conflict", "This request is already bound to different content or an existing project. Choose the file again to start a new copy.", "");
  }
  // The manifest is committed before any content. Its idempotency key binds all
  // partial retries to this exact content and actor, including concurrent calls.
  await kernel.upsertEntity({ scope, kind: "document", title: "Backup restore manifest", summary: "Content-only restore; no identity or access recovery.",
    attributes: { backupManifest: true, fingerprint, restoredBy: actor.actor_id, referenceOnly: true }, visibility: "private", idempotencyKey: `backup:manifest:${worldId}` });
  const savedManifest = (await kernel.readWorld(scope)).find(entity => entity.attributes.backupManifest === true);
  if (savedManifest?.attributes.fingerprint !== fingerprint || savedManifest.attributes.restoredBy !== actor.actor_id) throw new KernelError("conflict", "This restore request is bound to different content. Choose the file again.", "");
  const world = await createCreativeWorld(kernel, { worldId, title: `${backup.project.title.slice(0, 144)} (restored copy)` });
  await kernel.upsertEntity({ entityId: world.entityId, scope, kind: "world", title: world.title, summary: backup.project.goal.slice(0, 2000),
    attributes: { worldId, createdBy: actor.actor_id, canvasVersion: 1, restoredContent: true }, visibility: "members", idempotencyKey: `backup:goal:${worldId}` });
  const references = [
    ...backup.documents.map(doc => ({ title: doc.title, body: doc.body, visibility: doc.visibility })),
    ...(backup.messages ?? []).map((message, index) => ({ title: `Conversation ${index + 1} (${message.kind})`, body: `Imported conversation reference. The original author label is unverified: ${message.label}. This is not a newly recorded decision or message.${message.truncated ? " The exported text was shortened." : ""}\n\n${message.text}`, visibility: "private" as const })),
  ];
  for (const [index, doc] of references.entries()) {
    await kernel.upsertEntity({ scope, kind: "document", title: `Reference · ${doc.title}`.slice(0, 160), summary: "Imported source reference; content copied into this project by its current owner.",
      attributes: { worldId, documentType: "text", content: doc.body.startsWith(REFERENCE_BANNER) ? doc.body : REFERENCE_BANNER + doc.body, canvas: { x: 20 + index % 4 * 20, y: 20 + Math.floor(index / 4) % 4 * 20 }, importedReference: true, referenceOnly: true, originalTitle: doc.title },
      visibility: doc.visibility, idempotencyKey: `backup:document:${worldId}:${index}` });
  }
  return { ...world, summary: backup.project.goal.slice(0, 2000) };
}
