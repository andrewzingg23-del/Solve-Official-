// Aurora Solar, where the installer designs the real system. Read and create only what the homeowner
// asked for: their request becomes a project in the installer's Aurora account (address, name,
// contact, with their consent), and their proposal page reads that project's design back.
//
// Aurora's API: every resource lives under /tenants/{tenant_id}, with a bearer token.
// - POST /tenants/{tenant_id}/projects  { project: { name, location: { property_address } } }
// - GET  /tenants/{tenant_id}/projects/{project_id}/designs
// - GET  /tenants/{tenant_id}/designs/{design_id}/summary  (system_size_stc, energy_production.annual)
// Set AURORA_API_KEY and AURORA_TENANT_ID where the app is deployed; AURORA_API_BASE picks the sandbox.
import { createHmac, timingSafeEqual } from "node:crypto";

export type Aurora = { base: string; tenant: string; token: string };
export type AuroraDesign = { designId: string; systemKw: number | null; annualKwh: number | null; panels: number | null };
export class AuroraError extends Error {
  constructor(readonly reason: "rejected" | "unavailable" | "not_found", message: string) {
    super(message);
  }
}

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export function auroraFromEnv(env: NodeJS.ProcessEnv = process.env): Aurora | null {
  const token = env.AURORA_API_KEY?.trim();
  const tenant = env.AURORA_TENANT_ID?.trim();
  if (!token || !tenant || !/^[A-Za-z0-9-]{4,80}$/.test(tenant)) return null;
  const base = (env.AURORA_API_BASE?.trim() || "https://api.aurorasolar.com").replace(/\/$/, "");
  if (!/^https:\/\/api(-sandbox)?\.aurorasolar\.com$/.test(base)) return null;
  return { base, tenant, token };
}

async function call(a: Aurora, path: string, init: RequestInit = {}, get: Fetch = fetch): Promise<unknown> {
  const res = await get(`${a.base}/tenants/${encodeURIComponent(a.tenant)}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${a.token}`, accept: "application/json", ...(init.body ? { "content-type": "application/json" } : {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 404) throw new AuroraError("not_found", "Aurora doesn't have that");
  if (res.status === 400 || res.status === 422) throw new AuroraError("rejected", `Aurora rejected the request (${res.status})`);
  if (!res.ok) throw new AuroraError("unavailable", `Aurora answered ${res.status}`);
  return res.json();
}

export type DesignRequest = { firstName: string; lastName: string; email: string; phone: string; address: string };

// Creates the homeowner's project. Contact fields are sent when Aurora takes them; if it rejects
// them, the project is made with the name and address alone, and the contact goes in the name.
export async function createProject(a: Aurora, r: DesignRequest, get: Fetch = fetch): Promise<string> {
  const name = `${r.firstName} ${r.lastName}`.trim();
  const full = {
    project: {
      name,
      location: { property_address: r.address },
      customer_first_name: r.firstName,
      customer_last_name: r.lastName,
      customer_email: r.email,
      customer_phone: r.phone,
    },
  };
  let json: unknown;
  try {
    json = await call(a, "/projects", { method: "POST", body: JSON.stringify(full) }, get);
  } catch (error) {
    if (!(error instanceof AuroraError) || error.reason !== "rejected") throw error;
    const minimal = { project: { name: `${name} · ${r.email} · ${r.phone}`.slice(0, 200), location: { property_address: r.address } } };
    json = await call(a, "/projects", { method: "POST", body: JSON.stringify(minimal) }, get);
  }
  const id = (json as { project?: { id?: unknown } })?.project?.id;
  if (typeof id !== "string" || !id) throw new AuroraError("unavailable", "Aurora didn't return a project id");
  return id;
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

// The project's latest design, with its size and production once Aurora has simulated it.
export async function latestDesign(a: Aurora, projectId: string, get: Fetch = fetch): Promise<AuroraDesign | null> {
  const list = (await call(a, `/projects/${encodeURIComponent(projectId)}/designs`, {}, get)) as { designs?: { id?: unknown }[] };
  const ids = (list?.designs ?? []).map((d) => d?.id).filter((id): id is string => typeof id === "string");
  const designId = ids.at(-1);
  if (!designId) return null;
  const summary = (await call(a, `/designs/${encodeURIComponent(designId)}/summary`, {}, get)) as { design?: Record<string, unknown> };
  const d = summary?.design ?? {};
  const stc = num(d.system_size_stc);
  const annual = num((d.energy_production as Record<string, unknown> | undefined)?.annual);
  const bom = Array.isArray(d.bill_of_materials) ? (d.bill_of_materials as Record<string, unknown>[]) : [];
  const modules = bom.filter((b) => String(b.component_type ?? "").toLowerCase().includes("module")).reduce((n, b) => n + (num(b.quantity) ?? 0), 0);
  return {
    designId,
    // Aurora reports sizes in watts; anything under 1,000 is taken as kilowatts already.
    systemKw: stc === null ? null : stc >= 1000 ? Math.round(stc / 10) / 100 : stc,
    annualKwh: annual === null ? null : Math.round(annual),
    panels: modules || null,
  };
}

// The homeowner's link to their proposal: the Aurora project and their bill, signed so it can't be
// edited or guessed. Nothing personal is in it.
export type ProposalLink = { projectId: string; monthlyBill: number; monthlyKwh: number | null };

const sign = (secret: string, payload: string) => createHmac("sha256", createHmac("sha256", secret).update("solve solar proposals v1").digest()).update(payload).digest("base64url").slice(0, 32);

export function proposalToken(secret: string, p: ProposalLink): string {
  const payload = Buffer.from(JSON.stringify([p.projectId, p.monthlyBill, p.monthlyKwh])).toString("base64url");
  return `${payload}.${sign(secret, payload)}`;
}

export function readProposalToken(secret: string, token: string): ProposalLink | null {
  const [payload, mac] = token.split(".");
  if (!payload || !mac) return null;
  const want = Buffer.from(sign(secret, payload));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const [projectId, monthlyBill, monthlyKwh] = JSON.parse(Buffer.from(payload, "base64url").toString()) as [unknown, unknown, unknown];
    if (typeof projectId !== "string" || typeof monthlyBill !== "number") return null;
    return { projectId, monthlyBill, monthlyKwh: typeof monthlyKwh === "number" ? monthlyKwh : null };
  } catch {
    return null;
  }
}
