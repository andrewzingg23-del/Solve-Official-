/**
 * Provider-independent context envelope for onboarding and future AI sessions.
 *
 * Canonical facts belong to SOLVE's identity/passport/kernel. This module only
 * selects and bounds approved context for one invocation; it never reads other
 * accounts or sends data. Callers must resolve ownership/grants before calling.
 */
export type ContextScope = "profile" | "preferences" | "goals" | "projects" | "world" | "memory" | "connections";
export type ContextProvenance = { source: string; sourceId?: string; observedAt?: string };
export type ContextEntry = {
  id: string;
  scope: ContextScope;
  text: string;
  provenance: ContextProvenance;
  updatedAt: string;
  verified?: boolean;
};
export type ContextGrant = {
  /** Stable ID for the destination provider/agent */
  recipient: string;
  scopes: ContextScope[];
  /** Explicit consent at this exact request or unexpired delegated grant */
  approved: boolean;
};
export type PortableContext = {
  schema: "solve.context.v1";
  createdAt: string;
  recipient: string;
  entries: ContextEntry[];
  omitted: number;
};
const SCOPES: ContextScope[] = ["profile", "preferences", "goals", "projects", "world", "memory", "connections"];
const MAX_ENTRIES = 32;
const MAX_TEXT = 1800;
const MAX_TOTAL = 12000;
const NAME = /^[a-z0-9][a-z0-9_.:-]{0,99}$/i;

const safe = (s: string, limit: number) => s.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, limit);

/**
 * A grant is a selection policy, not proof of authorization. The server must
 * enforce actual owner consent, World memberships and active grants first.
 * Without explicit approval NO context is exposed.
 */
export function buildPortableContext(
  entries: ContextEntry[],
  grant: ContextGrant,
  createdAt: string = new Date().toISOString(),
): PortableContext {
  if (!grant.approved || !NAME.test(grant.recipient)) throw new Error("context_not_approved");
  const scopes = new Set(grant.scopes.filter(scope => SCOPES.includes(scope)));
  const eligible = entries.filter(e => e && scopes.has(e.scope) && !!e.id && !!e.text?.trim() &&
    !!e.provenance?.source && !Number.isNaN(Date.parse(e.updatedAt)));
  const selected: ContextEntry[] = [];
  let total = 0;
  for (const entry of eligible.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))) {
    const text = safe(entry.text, MAX_TEXT);
    if (!text || selected.length >= MAX_ENTRIES || total + text.length > MAX_TOTAL) break;
    selected.push({
      id: safe(entry.id, 100), scope: entry.scope, text,
      provenance: {
        source: safe(entry.provenance.source, 100),
        ...(entry.provenance.sourceId ? { sourceId: safe(entry.provenance.sourceId, 150) } : {}),
        ...(entry.provenance.observedAt ? { observedAt: entry.provenance.observedAt } : {}),
      },
      updatedAt: entry.updatedAt,
      verified: entry.verified === true,
    });
    total += text.length;
  }
  return { schema: "solve.context.v1", createdAt, recipient: grant.recipient,
    entries: selected, omitted: eligible.length - selected.length };
}

/** No personal data is implied to be shared by simply connecting an AI. */
export const ONBOARDING_CONTEXT_SCOPES: readonly ContextScope[] = SCOPES;
