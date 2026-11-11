// Server only: imported from server actions, route handlers and the connector, never a client component.

// A person's connection to an outside provider (GitHub first), kept the way everything else is: an
// ordinary versioned kernel record in their own scope, `actor:<person>/provider:<name>`. The
// provider's tokens are sealed with AES-256-GCM under a key only Solve's server holds
// (SOLVE_PROVIDER_ENCRYPTION_KEY), so the kernel stores ciphertext and no AI, browser or other actor
// can read the token itself — even an app the person lets use the provider only ever reaches it
// through Solve's server, which decrypts it for that one call.
//
// Who may use it is the kernel's ordinary grants on that scope: the person holds everything; an app
// they allow ("Let Claude use your GitHub") gets read + write on that scope only, the write being
// what lets it save a renewed (rotated) token after an automatic refresh. It can never read the
// plaintext; at worst it could spoil the record, and the person would reconnect.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { KernelError, type Kernel } from "@/lib/kernel/client";

const MARK = "solve.provider";
export const providerScope = (personId: string, provider: string) => `actor:${personId}/provider:${provider}`;
export const PROVIDER_USE = ["kernel.read", "world.private.read", "world.entity.write"] as const; // on that one record only

function key(): Buffer {
  const secret = process.env.SOLVE_PROVIDER_ENCRYPTION_KEY?.trim();
  if (!secret) throw new Error("This deployment can't keep provider connections: no provider encryption key is set.");
  return createHash("sha256").update(secret).digest(); // 32 bytes, whatever form the secret takes
}

export type Sealed = { v: 1; iv: string; tag: string; data: string };
export function seal(value: unknown): Sealed {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([c.update(JSON.stringify(value), "utf8"), c.final()]);
  return { v: 1, iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64"), data: data.toString("base64") };
}
export function unseal<T>(sealed: Sealed): T {
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(sealed.iv, "base64"));
  d.setAuthTag(Buffer.from(sealed.tag, "base64"));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(sealed.data, "base64")), d.final()]).toString("utf8")) as T;
}

export type ProviderConnection = {
  entityId: string;
  provider: string;
  account: string;                       // e.g. the GitHub login, as GitHub reported it
  status: "connected" | "reconnect" | "disconnected";
  sealed: Sealed | null;
  updatedAt: string;
};

export async function readProvider(kernel: Kernel, personId: string, provider: string): Promise<ProviderConnection | null> {
  // A kernel refusal (an app the person didn't allow) is thrown, not mistaken for "not connected".
  const rows = await kernel.readWorld(providerScope(personId, provider)).catch(e => {
    if (e instanceof KernelError && e.name === "forbidden") throw e;
    return [];
  });
  const record = rows.find(e => e.attributes?.sov === MARK && e.attributes?.provider === provider);
  if (!record) return null;
  const a = record.attributes as Record<string, unknown>;
  return { entityId: record.entity_id, provider, account: String(a.account ?? ""), status: (a.status as ProviderConnection["status"]) ?? "disconnected",
    sealed: (a.sealed as Sealed | null) ?? null, updatedAt: record.updated_at };
}

export async function writeProvider(kernel: Kernel, personId: string, provider: string, current: ProviderConnection | null,
  next: { account: string; status: ProviderConnection["status"]; secret: unknown | null }, requestId: string): Promise<string> {
  return kernel.upsertEntity({
    entityId: current?.entityId ?? undefined,
    kind: "resource",
    scope: providerScope(personId, provider),
    title: `${provider} connection`,
    attributes: { sov: MARK, provider, account: next.account, status: next.status, sealed: next.secret === null ? null : seal(next.secret) },
    visibility: "private",
    idempotencyKey: requestId,
  });
}
