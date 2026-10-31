// The person's link from solve to their SOV Passport, kept on the kernel record like a memory:
// the tokens are sealed (own random key in the kernel's key store), so unlinking destroys the
// key and the tokens are gone for good, while history keeps that a link existed. Each refresh
// rotates the tokens, so each one is saved as a new sealed link and the previous key destroyed.
import type { Kernel, KernelEvent } from "@/lib/kernel/client";
import { memoryScope, requireSealing } from "@/lib/bot/memory";
import { isSealed, seal, unseal } from "@/lib/bot/seal";
import { callTool, PassportError, passportUrl, refreshTokens, type PassportTokens, type ToolResult } from "./client";

export const PASSPORT_LINKED = "passport.linked";
export const PASSPORT_UNLINKED = "passport.unlinked";
const REFRESH_EARLY_MS = 60_000;

type Link = { eventId: string; tokens: PassportTokens };

const record = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

async function latest(kernel: Kernel, ownerId: string): Promise<KernelEvent | null> {
  const events = await kernel.readEvents(memoryScope(ownerId), { newestFirst: true, limit: 200 });
  return events.find((e) => e.type === PASSPORT_LINKED || e.type === PASSPORT_UNLINKED) ?? null;
}

/** The current link, or null when the person never linked, unlinked, or its key is gone. */
export async function readLink(kernel: Kernel, ownerId: string): Promise<Link | null> {
  const e = await latest(kernel, ownerId);
  if (!e || e.type !== PASSPORT_LINKED) return null;
  const sealed = record(e.payload).sealed;
  if (!isSealed(sealed)) return null;
  const key = (await kernel.unsealKeys([e.id])).find((k) => k.event_id === e.id)?.key;
  if (!key) return null;
  const t = record(await unseal(sealed, key));
  if (typeof t.clientId !== "string" || typeof t.accessToken !== "string" || typeof t.refreshToken !== "string" || typeof t.expiresAt !== "number") return null;
  return { eventId: e.id, tokens: { clientId: t.clientId, accessToken: t.accessToken, refreshToken: t.refreshToken, expiresAt: t.expiresAt } };
}

export async function saveLink(kernel: Kernel, ownerId: string, tokens: PassportTokens, previous?: string): Promise<string> {
  await requireSealing(kernel);
  const { sealed, key } = await seal(tokens);
  const id = await kernel.recordEvent({
    type: PASSPORT_LINKED,
    scope: memoryScope(ownerId),
    payload: { sealed, passport: passportUrl(), client_id: tokens.clientId },
  });
  await kernel.sealKey(id, key);
  if (previous) await kernel.destroyKey(previous, "passport tokens rotated").catch(() => null);
  return id;
}

/** Forgets the tokens for good. The person can still disconnect solve on the passport itself. */
export async function unlink(kernel: Kernel, ownerId: string): Promise<void> {
  const link = await readLink(kernel, ownerId);
  if (link) await kernel.destroyKey(link.eventId, "passport unlinked by its owner");
  await kernel.recordEvent({ type: PASSPORT_UNLINKED, scope: memoryScope(ownerId), payload: {} });
}

type Deps = { refresh?: typeof refreshTokens; call?: typeof callTool; now?: () => number };

/**
 * Calls passport tools with a fresh access token: refreshes when it is about to expire, and once
 * more if the passport says it already did. Returns null when there is no link. A link the
 * passport no longer honors (revoked there) throws PassportError("reconnect").
 */
export async function withPassport<T>(
  kernel: Kernel,
  ownerId: string,
  work: (call: (name: string, args?: Record<string, unknown>) => Promise<ToolResult>) => Promise<T>,
  { refresh = refreshTokens, call = callTool, now = Date.now }: Deps = {},
): Promise<T | null> {
  let link = await readLink(kernel, ownerId);
  if (!link) return null;
  const renew = async () => {
    const tokens = await refresh(link!.tokens);
    const eventId = await saveLink(kernel, ownerId, tokens, link!.eventId);
    link = { eventId, tokens };
  };
  if (link.tokens.expiresAt - now() < REFRESH_EARLY_MS) await renew();
  let retried = false;
  const tool = async (name: string, args: Record<string, unknown> = {}): Promise<ToolResult> => {
    try {
      return await call(link!.tokens.accessToken, name, args);
    } catch (error) {
      if (error instanceof PassportError && error.code === "reconnect" && !retried) {
        retried = true;
        await renew();
        return call(link!.tokens.accessToken, name, args);
      }
      throw error;
    }
  };
  return work(tool);
}
