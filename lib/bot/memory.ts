// What the master bot remembers, and which assistants may speak as it. Both live as kernel events in
// the owner's scope, beside the persona:
//   actor:<owner>/bot:memory  bot.memory.noted (by the bot or the owner), bot.memory.forgotten (owner)
//   actor:<owner>/bot:links   bot.connection.approved / bot.connection.revoked (owner only)
// The kernel is append-only: forgetting hides a memory from every view and tool; it cannot erase it.
import type { Kernel, KernelEvent } from "@/lib/kernel/client";

export const MEMORY_NOTED = "bot.memory.noted";
export const MEMORY_FORGOTTEN = "bot.memory.forgotten";
export const CONNECTION_APPROVED = "bot.connection.approved";
export const CONNECTION_REVOKED = "bot.connection.revoked";
export const memoryScope = (ownerId: string) => `actor:${ownerId}/bot:memory`;
export const linksScope = (ownerId: string) => `actor:${ownerId}/bot:links`;
// What the owner delegates to the bot so connected assistants can add memories, and nothing more.
export const MEMORY_CAPABILITY = "bot.memory.*";

export const MEMORY_LIMITS = { text: 2000, title: 120, url: 500, perClientPerHour: 30, read: 200 } as const;
export const SOURCE_KINDS = ["person", "assistant", "document", "email", "web", "note"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export type Via = { client_id: string | null; client_name: string | null };
export type Memory = {
  id: string;
  text: string;
  source: { kind: SourceKind; title: string | null; url: string | null };
  via: Via;
  by: string;
  at: string;
};

const clean = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, max) : "";

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

function toMemory(e: KernelEvent): Memory | null {
  if (e.type !== MEMORY_NOTED) return null;
  const p = e.payload as Record<string, unknown>;
  const { text, source } = normalizeMemoryInput({ text: p.text, source: p.source });
  if (!text) return null;
  const via = (p.via && typeof p.via === "object" ? p.via : {}) as Record<string, unknown>;
  return {
    id: e.id,
    text,
    source,
    via: { client_id: typeof via.client_id === "string" ? via.client_id : null, client_name: typeof via.client_name === "string" ? via.client_name : null },
    by: e.actor_id,
    at: e.occurred_at,
  };
}

// Newest first, without forgotten ones. Readable by the owner and by the bot itself.
export async function readMemories(kernel: Kernel, ownerId: string, limit: number = MEMORY_LIMITS.read): Promise<Memory[]> {
  const events = await kernel.readEvents(memoryScope(ownerId), { newestFirst: true, limit: Math.min(500, limit * 2) });
  const forgotten = new Set(events.filter((e) => e.type === MEMORY_FORGOTTEN).map((e) => String((e.payload as { memory?: unknown }).memory)));
  return events.map(toMemory).filter((m): m is Memory => Boolean(m) && !forgotten.has(m!.id)).slice(0, limit);
}

// Records a memory. `via` comes from the verified connection, never from the model's arguments.
export async function noteMemory(
  kernel: Kernel,
  ownerId: string,
  input: { text?: unknown; source?: unknown },
  via: Via,
  requestId: string,
): Promise<{ id: string; text: string }> {
  const { text, source } = normalizeMemoryInput(input);
  if (!text) throw new MemoryInputError("a memory needs text");
  const id = await kernel.recordEvent({
    type: MEMORY_NOTED,
    scope: memoryScope(ownerId),
    payload: { text, source, via },
    idempotencyKey: `bot-memory:${requestId}`.slice(0, 200),
  });
  return { id, text };
}

export async function forgetMemory(kernel: Kernel, ownerId: string, memoryId: string) {
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
