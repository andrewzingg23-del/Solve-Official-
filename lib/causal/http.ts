// Counterparties reached over HTTP: an organization that is not on SOLVE answers from its own
// endpoint. The endpoint comes from the organization's record as the acting principal may read it
// (or a resolver the deployment configures), never from the action's payload, so nobody can route
// an inquiry to an endpoint of their choosing by planning. The answer as received is hashed and
// becomes the evidence; its terms become the result the kernel's declared consequence records.
// `perform` is idempotent per action: the same Idempotency-Key is sent on every run, so an endpoint
// that queued the question (202) is asked again for the answer, never asked a second question.
import { sha256Hex } from "../money/settlement";
import type { Provider, ProviderContext } from "./providers";
import type { ProviderResponse } from "./types";
import type { WorldState } from "./world";

export type HttpCounterpartyOptions = {
  // The organization's endpoint. Default: the `endpoint` attribute of its World Graph entity.
  endpointFor?(orgRef: string, world: WorldState): string | null;
  fetch?: typeof fetch;
  headers?: Record<string, string>;
  timeoutMs?: number;
};

const LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\])$/;

// Only TLS, except on this machine (tests, a local supplier simulator).
export function endpointAllowed(endpoint: string): string | null {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return "the endpoint is not a URL";
  }
  if (url.protocol === "https:") return null;
  if (url.protocol === "http:" && LOOPBACK.test(url.hostname)) return null;
  return "the endpoint is not reached over TLS";
}

type Exchange =
  | { kind: "answered"; status: number; body: Record<string, unknown>; raw: string }
  | { kind: "queued"; status: number; body: Record<string, unknown> }
  | { kind: "refused"; status: number; body: Record<string, unknown> }
  | { kind: "unreached"; reason: string };

async function exchange(options: HttpCounterpartyOptions, url: string, actionId: string, payload: Record<string, unknown>): Promise<Exchange> {
  const doFetch = options.fetch ?? globalThis.fetch;
  let response: Response;
  try {
    response = await doFetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", "idempotency-key": actionId, ...(options.headers ?? {}) },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
    });
  } catch (error) {
    // The question may or may not have arrived: unknown, never failed.
    return { kind: "unreached", reason: error instanceof Error ? error.message : String(error) };
  }
  const raw = await response.text();
  let body: Record<string, unknown> = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) body = parsed as Record<string, unknown>;
  } catch {
    body = {};
  }
  if (response.status === 200 || response.status === 201) return { kind: "answered", status: response.status, body, raw };
  if (response.status === 202) return { kind: "queued", status: response.status, body };
  if (response.status >= 400 && response.status < 500) return { kind: "refused", status: response.status, body };
  return { kind: "unreached", reason: `HTTP ${response.status}` };
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const text = (v: unknown) => (typeof v === "string" && v.length ? v.slice(0, 200) : null);

function resolveEndpoint(options: HttpCounterpartyOptions, org: string, world: WorldState) {
  const fromRecord = world.entities.get(org)?.attributes.endpoint;
  const endpoint = options.endpointFor ? options.endpointFor(org, world) : typeof fromRecord === "string" ? fromRecord : null;
  if (!endpoint) return { endpoint: null, problem: "the organization publishes no endpoint" };
  const problem = endpointAllowed(endpoint);
  return { endpoint: problem ? null : endpoint.replace(/\/+$/, ""), problem };
}

const notReached = (provider: string, title: string, reason: string, endpoint: string): ProviderResponse => ({
  provider,
  status: "unknown",
  result: { endpoint },
  evidence: [],
  detail: `${title}'s endpoint gave no answer (${reason})`,
});

async function received(endpoint: string, actionId: string, status: number, raw: string, what: string) {
  return {
    basis: "artifact" as const,
    content_hash: `sha256:${await sha256Hex(raw)}` as const,
    description: `${what} received from ${endpoint} (HTTP ${status}) for action ${actionId}; the hash is of the body as received`.slice(0, 500),
  };
}

export function httpInquiry(options: HttpCounterpartyOptions = {}, id = "http.counterparty.inquiry"): Provider {
  return {
    id,
    capability: "counterparty.inquiry",
    async perform({ actorId, actionId, step, world }: ProviderContext) {
      const org = step.binding.org;
      const title = world.entities.get(org)?.title ?? org;
      const { endpoint, problem } = resolveEndpoint(options, org, world);
      if (!endpoint) return { provider: this.id, status: "failed", result: {}, evidence: [], detail: `${title}: ${problem}` };
      const url = `${endpoint}/inquiries`;
      const quantity = typeof step.payload.quantity === "number" ? step.payload.quantity : null;
      const sent = await exchange(options, url, actionId, { action: actionId, from: actorId, organization: org, capability: step.binding.capability, quantity });
      if (sent.kind === "unreached") return notReached(this.id, title, sent.reason, url);
      if (sent.kind === "queued") return { provider: this.id, status: "unknown", result: { endpoint: url, reference: text(sent.body.reference) }, evidence: [], detail: `${title} acknowledged the inquiry and will answer later` };
      if (sent.kind === "refused") return { provider: this.id, status: "failed", result: { endpoint: url }, evidence: [], detail: `${title}'s endpoint refused the inquiry (HTTP ${sent.status}${text(sent.body.reason) ? `: ${text(sent.body.reason)}` : ""})` };
      const b = sent.body;
      if (typeof b.can_fulfill !== "boolean") return { provider: this.id, status: "failed", result: { endpoint: url }, evidence: [], detail: `${title}'s answer did not say whether it can fulfill the quantity` };
      return {
        provider: this.id,
        status: "succeeded",
        result: {
          capacity_per_year: num(b.capacity_per_year),
          lead_time_days: num(b.lead_time_days),
          unit_price_usd: num(b.unit_price_usd),
          minimum_order: num(b.minimum_order),
          can_fulfill: b.can_fulfill,
          reply: text(b.reference) ?? `${url}#${actionId}`,
          provider: this.id,
        },
        evidence: [await received(url, actionId, sent.status, sent.raw, `${title}'s answer`)],
        detail: `${title} answered over HTTP`,
      };
    },
  };
}

export function httpAcceptance(options: HttpCounterpartyOptions = {}, id = "http.counterparty.acceptance"): Provider {
  return {
    id,
    capability: "counterparty.acceptance",
    async perform({ actorId, actionId, step, world }: ProviderContext) {
      const org = step.binding.org;
      const title = world.entities.get(org)?.title ?? org;
      const { endpoint, problem } = resolveEndpoint(options, org, world);
      if (!endpoint) return { provider: this.id, status: "failed", result: {}, evidence: [], detail: `${title}: ${problem}` };
      const url = `${endpoint}/acceptances`;
      const sent = await exchange(options, url, actionId, { action: actionId, from: actorId, organization: org, terms: step.payload.terms ?? {} });
      if (sent.kind === "unreached") return notReached(this.id, title, sent.reason, url);
      if (sent.kind === "queued") return { provider: this.id, status: "unknown", result: { endpoint: url, reference: text(sent.body.reference) }, evidence: [], detail: `${title} acknowledged the acceptance and will confirm later` };
      if (sent.kind === "refused" || sent.body.accepted === false) {
        const status = sent.kind === "refused" ? sent.status : 200;
        return { provider: this.id, status: "failed", result: { endpoint: url }, evidence: [], detail: `${title} declined (HTTP ${status}${text(sent.body.reason) ? `: ${text(sent.body.reason)}` : ""})` };
      }
      return {
        provider: this.id,
        status: "succeeded",
        result: { delivered: text(sent.body.reference) ?? `${url}#${actionId}`, provider: this.id },
        evidence: [await received(url, actionId, sent.status, sent.raw, `${title}'s confirmation of the acceptance`)],
        detail: `${title} confirmed the acceptance over HTTP`,
      };
    },
  };
}

export const httpCounterparty = (options: HttpCounterpartyOptions = {}) => [httpInquiry(options), httpAcceptance(options)];
