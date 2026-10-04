// What the master bot remembers, and which assistants may speak as it. Both live as kernel events in
// the owner's scope, beside the persona:
//   actor:<owner>/bot:memory  bot.memory.noted (by the bot or the owner), bot.memory.forgotten (owner)
//   actor:<owner>/bot:links   bot.connection.approved / bot.connection.revoked (owner only)
// A memory's words are sealed (lib/bot/seal.ts) under a key of its own in the kernel's key store
// (kernel v5), so forgetting destroys the key and erases them for good; history keeps only that a
// memory existed, its kind of source and who added it. Memories recorded before sealing keep plain
// payloads and can only be hidden.
import type { Kernel, KernelEvent } from "@/lib/kernel/client";
import { isSealed, seal, unseal } from "./seal";

export const MEMORY_NOTED = "bot.memory.noted";
export const MEMORY_FORGOTTEN = "bot.memory.forgotten";
export const KEY_DESTROYED = "kernel.key.destroyed";
export const CONNECTION_APPROVED = "bot.connection.approved";
export const CONNECTION_REVOKED = "bot.connection.revoked";
export const memoryScope = (ownerId: string) => `actor:${ownerId}/bot:memory`;
export const linksScope = (ownerId: string) => `actor:${ownerId}/bot:links`;
// What the owner delegates to the bot so connected assistants can add memories, and nothing more.
export const MEMORY_CAPABILITY = "bot.memory.*";

// scanEvents bounds a full read (search, fetch) of one person's memory history.
export const MEMORY_LIMITS = { text: 2000, title: 120, url: 500, perClientPerHour: 30, read: 200, scanEvents: 10_000 } as const;
export const SOURCE_KINDS = ["person", "assistant", "document", "email", "web", "note"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];
// The same words from the same assistant within this window are one memory (a retried call).
const SAME_MEMORY_MS = 3_600_000;
const PAGE = 500;

export type Via = { client_id: string | null; client_name: string | null };
export type Memory = {
  id: string;
  text: string;
  source: { kind: SourceKind; title: string | null; url: string | null };
  via: Via;
  by: string;
  at: string;
  // Sealed memories are erased when forgotten; older plain ones can only be hidden.
  sealed: boolean;
};

// Control characters, and the invisible ones used to smuggle instructions past a reader: zero-width
// and direction marks, bidi embeddings and isolates, word joiners, the BOM and Unicode tag
// characters. The zero-width joiner stays, because emoji sequences need it.
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const INVISIBLE = /[\u200b\u200c\u200e\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]|[\u{e0000}-\u{e007f}]/gu;
export const cleanText = (v: unknown, max: number) => (typeof v === "string" ? v.replace(CONTROL, "").replace(INVISIBLE, "").trim().slice(0, max) : "");
const clean = cleanText;

// Only http(s) links are kept; anything else is dropped rather than stored.
function safeUrl(v: unknown): string | null {
  const s = clean(v, MEMORY_LIMITS.url);
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function normalizeMemoryInput(input: { text?: unknown; source?: unknown }) {
  const text = clean(input.text, MEMORY_LIMITS.text);
  const s = input.source && typeof input.source === "object" ? (input.source as Record<string, unknown>) : {};
  const kind = (SOURCE_KINDS as readonly string[]).includes(String(s.kind)) ? (s.kind as SourceKind) : "assistant";
  return { text, source: { kind, title: clean(s.title, MEMORY_LIMITS.title) || null, url: safeUrl(s.url) } };
}

const record = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

function toMemory(e: KernelEvent, words: Record<string, unknown>, sealed: boolean): Memory | null {
  const p = record(e.payload);
  const { text, source } = normalizeMemoryInput({ text: words.text, source: { kind: record(p.source).kind, title: words.title, url: words.url } });
  if (!text) return null;
  const via = record(p.via);
  return {
    id: e.id,
    text,
    source,
    via: { client_id: typeof via.client_id === "string" ? via.client_id : null, client_name: typeof via.client_name === "string" ? via.client_name : null },
    by: e.actor_id,
    at: e.occurred_at,
    sealed,
  };
}

// Opens the memories among these events that are still readable: not forgotten, and for sealed ones,
// with a key the reader may unseal. Order is kept.
async function openMemories(kernel: Kernel, events: KernelEvent[]): Promise<Memory[]> {
  const gone = new Set<string>();
  for (const e of events) {
    if (e.type === MEMORY_FORGOTTEN) gone.add(String(record(e.payload).memory));
    if (e.type === KEY_DESTROYED) gone.add(String(record(e.payload).event_id));
  }
  const noted = events.filter((e) => e.type === MEMORY_NOTED && !gone.has(e.id));
  const sealedIds = noted.filter((e) => isSealed(record(e.payload).sealed)).map((e) => e.id);
  const keys = new Map<string, string>();
  for (let i = 0; i < sealedIds.length; i += 1000) {
    for (const row of await kernel.unsealKeys(sealedIds.slice(i, i + 1000))) keys.set(row.event_id, row.key);
  }
  const opened = await Promise.all(
    noted.map(async (e) => {
      const p = record(e.payload);
      if (!isSealed(p.sealed)) return toMemory(e, { text: p.text, title: record(p.source).title, url: record(p.source).url }, false);
      const key = keys.get(e.id);
      return key ? toMemory(e, record(await unseal(p.sealed, key)), true) : null;
    }),
  );
  return opened.filter((m): m is Memory => m !== null);
}

// The most recent memories, newest first. Readable by the owner and by the bot itself.
export async function readMemories(kernel: Kernel, ownerId: string, limit: number = MEMORY_LIMITS.read): Promise<Memory[]> {
  const events = await kernel.readEvents(memoryScope(ownerId), { newestFirst: true, limit: Math.min(PAGE, limit * 3 + 10) });
  return (await openMemories(kernel, events)).slice(0, limit);
}

// Every memory, newest first, for search and fetch. `complete` is false when the history is longer
// than MEMORY_LIMITS.scanEvents and only its oldest part was read.
export async function readAllMemories(kernel: Kernel, ownerId: string, { maxEvents = MEMORY_LIMITS.scanEvents as number, page: size = PAGE } = {}) {
  const events: KernelEvent[] = [];
  let complete = false;
  while (events.length < maxEvents) {
    const page = await kernel.readEvents(memoryScope(ownerId), { afterSeq: events.at(-1)?.seq ?? 0, limit: size });
    events.push(...page);
    if (page.length < size) {
      complete = true;
      break;
    }
  }
  return { memories: (await openMemories(kernel, events)).reverse(), complete };
}

const sameSource = (a: Memory["source"], b: Memory["source"]) => a.kind === b.kind && a.title === b.title && a.url === b.url;

// Records a memory, sealed. `via` comes from the verified connection, never from the model's
// arguments. The same words from the same assistant within the hour return the existing memory.
// A write that fails between recording and sealing leaves an unreadable event, and a retry writes
// the memory again.
export async function noteMemory(
  kernel: Kernel,
  ownerId: string,
  input: { text?: unknown; source?: unknown },
  via: Via,
  { recent, now = new Date() }: { recent?: Memory[]; now?: Date } = {},
): Promise<{ id: string; text: string; duplicate: boolean }> {
  const { text, source } = normalizeMemoryInput(input);
  if (!text) throw new MemoryInputError("a memory needs text");
  const same = (recent ?? (await readMemories(kernel, ownerId, 50))).find(
    (m) => m.text === text && m.via.client_id === via.client_id && sameSource(m.source, source) && now.getTime() - Date.parse(m.at) < SAME_MEMORY_MS,
  );
  if (same) return { id: same.id, text, duplicate: true };
  const { sealed, key } = await seal({ text, title: source.title, url: source.url });
  const id = await kernel.recordEvent({ type: MEMORY_NOTED, scope: memoryScope(ownerId), payload: { sealed, source: { kind: source.kind }, via } });
  await kernel.sealKey(id, key);
  return { id, text, duplicate: false };
}

// Forgetting destroys the memory's key, so its words are gone for good, and records that it was
// forgotten so every view drops it (older plain memories are hidden this way). Both are idempotent.
export async function forgetMemory(kernel: Kernel, ownerId: string, memoryId: string) {
  await kernel.destroyKey(memoryId, "forgotten by its owner");
  return kernel.recordEvent({
    type: MEMORY_FORGOTTEN,
    scope: memoryScope(ownerId),
    payload: { memory: memoryId },
    idempotencyKey: `bot-forget:${memoryId}`,
  });
}

export class MemoryInputError extends Error {}

// Plain term match over text, title and source: enough to find "what did I say about Lisbon".
export function searchMemories(memories: Memory[], query: string, limit = 10): Memory[] {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
  if (terms.length === 0) return memories.slice(0, limit);
  return memories
    .map((m) => {
      const hay = `${m.text} ${m.source.title ?? ""} ${m.source.kind}`.toLowerCase();
      return { m, score: terms.reduce((n, t) => n + (hay.includes(t) ? 1 : 0), 0) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || (a.m.at < b.m.at ? 1 : -1))
    .slice(0, limit)
    .map((x) => x.m);
}

export type ConnectionMode = "read" | "remember";
export type Connection = { clientId: string; clientName: string; mode: ConnectionMode; since: string };

// The owner's current connections: the latest approval per client, unless revoked after it.
export async function readConnections(kernel: Kernel, ownerId: string): Promise<Connection[]> {
  const events = await kernel.readEvents(linksScope(ownerId), { newestFirst: true, limit: 500 });
  const seen = new Map<string, Connection | null>();
  for (const e of events) {
    const p = e.payload as Record<string, unknown>;
    const clientId = typeof p.client_id === "string" ? p.client_id : null;
    if (!clientId || seen.has(clientId)) continue;
    if (e.type === CONNECTION_REVOKED) seen.set(clientId, null);
    else if (e.type === CONNECTION_APPROVED)
      seen.set(clientId, {
        clientId,
        clientName: clean(p.client_name, 80) || "An assistant",
        mode: p.mode === "remember" ? "remember" : "read",
        since: e.occurred_at,
      });
  }
  return [...seen.values()].filter((c): c is Connection => Boolean(c));
}

// The owner approves an assistant to speak as their bot. Allowing it to remember also delegates
// `bot.memory.*` on the memory scope to the bot (once); reading needs nothing new, because a bot can
// already observe its owner's scope.
export async function approveConnection(
  kernel: Kernel,
  ownerId: string,
  botAgentId: string,
  input: { clientId: string; clientName: string; mode: ConnectionMode },
  requestId: string,
) {
  if (input.mode === "remember") {
    await kernel.issueGrant({ grantee: botAgentId, capability: MEMORY_CAPABILITY, scope: memoryScope(ownerId), idempotencyKey: `bot-memory-grant:${botAgentId}` });
  }
  return kernel.recordEvent({
    type: CONNECTION_APPROVED,
    scope: linksScope(ownerId),
    payload: { client_id: input.clientId, client_name: clean(input.clientName, 80) || "An assistant", mode: input.mode },
    idempotencyKey: `bot-connect:${requestId}`.slice(0, 200),
  });
}

export async function revokeConnection(kernel: Kernel, ownerId: string, clientId: string, requestId: string) {
  return kernel.recordEvent({
    type: CONNECTION_REVOKED,
    scope: linksScope(ownerId),
    payload: { client_id: clientId },
    idempotencyKey: `bot-disconnect:${requestId}`.slice(0, 200),
  });
}
