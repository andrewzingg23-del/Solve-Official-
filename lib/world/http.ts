import { KernelError, type Kernel, type KernelErrorName } from "../kernel/client";
import { createCreativeArtifact, loadCreativeWorld, updateCreativeArtifact } from "./creative";
import { parseRoomTurn, readRoomConversation, submitRoomTurn, type RoomCompletion } from "./room";

export const privateJson = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
const WORLD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function jsonBody(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new KernelError("invalid", "Send a JSON request", "KA003");
  let size = 0; const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 40000) { await reader.cancel(); throw new KernelError("invalid", "Request is too large", "KA003"); }
      chunks.push(value);
    }
    const all = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder().decode(all));
  } catch (error) {
    if (error instanceof KernelError) throw error;
    throw new KernelError("invalid", "Send valid JSON", "KA003");
  } finally { reader.releaseLock(); }
}

function failure(error: unknown): Response {
  if (error instanceof KernelError) {
    const statuses: Partial<Record<KernelErrorName, number>> = { unauthenticated: 401, forbidden: 403, invalid: 422, conflict: 409, not_found: 404 };
    const status = statuses[error.name] ?? 503;
    return privateJson({ error: status === 503 ? "The shared store is unavailable. Try again." : error.message }, status);
  }
  return privateJson({ error: "The shared store is unavailable. Try again." }, 503);
}

export async function handleRoomConversation(kernel: Kernel, worldId: string, request: Request, complete?: RoomCompletion): Promise<Response> {
  if (!WORLD_ID.test(worldId)) return privateJson({ error: "Invalid World ID" }, 422);
  try {
    if (request.method === "GET") {
      const raw = new URL(request.url).searchParams.get("beforeSeq");
      const beforeSeq = raw === null ? undefined : Number(raw);
      if (beforeSeq !== undefined && (!/^\d+$/.test(raw!) || !Number.isSafeInteger(beforeSeq) || beforeSeq < 1))
        return privateJson({ error: "Invalid conversation cursor" }, 422);
      return privateJson(await readRoomConversation(kernel, worldId, beforeSeq));
    }
    const turn = parseRoomTurn(worldId, await jsonBody(request));
    if (!turn) return privateJson({ error: "Write up to 8,000 characters and choose a room action." }, 422);
    return privateJson(await submitRoomTurn(kernel, turn, complete));
  } catch (error) { return failure(error); }
}

export async function handleRoomArtifact(kernel: Kernel, worldId: string, request: Request): Promise<Response> {
  if (!WORLD_ID.test(worldId)) return privateJson({ error: "Invalid World ID" }, 422);
  let entityId: string | undefined;
  try {
    const raw = await jsonBody(request);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return privateJson({ error: "Invalid document" }, 422);
    const b = raw as Record<string, unknown>;
    if (typeof b.requestId !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(b.requestId) || typeof b.title !== "string" ||
        typeof b.body !== "string" || !b.position || typeof b.position !== "object") return privateJson({ error: "Invalid document" }, 422);
    const p = b.position as Record<string, unknown>;
    if (typeof p.x !== "number" || typeof p.y !== "number") return privateJson({ error: "Invalid position" }, 422);
    const shared = { scope: `world:${worldId}`, requestId: b.requestId, title: b.title, body: b.body, position: { x: p.x, y: p.y } };
    if (request.method === "PATCH") {
      if (typeof b.entityId !== "string" || !WORLD_ID.test(b.entityId) || typeof b.expectedVersion !== "number" || !Number.isSafeInteger(b.expectedVersion) || b.expectedVersion < 1)
        return privateJson({ error: "A document and displayed version are required" }, 422);
      entityId = b.entityId;
      await updateCreativeArtifact(kernel, { ...shared, entityId, expectedVersion: b.expectedVersion });
    } else {
      const { world } = await loadCreativeWorld(kernel, worldId);
      entityId = await createCreativeArtifact(kernel, { ...shared, worldEntityId: world.entityId });
    }
    return privateJson({ entityId });
  } catch (error) {
    if (entityId && error instanceof KernelError && error.name === "conflict") {
      try {
        const latest = (await loadCreativeWorld(kernel, worldId)).artifacts.find(a => a.entityId === entityId);
        return privateJson({ error: "This document changed. Your draft is still here. Compare the saved revision.", latest }, 409);
      } catch (accessError) { return failure(accessError); }
    }
    return failure(error);
  }
}
