// The solar desk: how a homeowner's request reaches Zest Solar with no Aurora API key. The installer
// designs the roof in Aurora by hand, the way a team member can, and answers in solve.
//
// The request belongs to the homeowner. Their details are sealed (lib/bot/seal.ts) in their own
// scope, one scope per request, actor:<them>/solar:<community>/request:<id>; they let the desk's
// community owner read that one scope, and send the owner a message pointing at it. The owner
// answers with the Aurora proposal link and the design's numbers. The homeowner can erase the
// request whenever they like: its key is destroyed and the owner's access to it revoked, so the
// address and contact are gone for good while the history keeps that a request existed.
import file from "@/solve.communities.json";
import { KernelError, type Kernel } from "@/lib/kernel/client";
import { cleanText, requireSealing } from "@/lib/bot/memory";
import { seal, unseal } from "@/lib/bot/seal";
import { requireOwner, send, type Community } from "@/lib/community/community";
import { SOLAR_LIMITS } from "./estimate";
import { QUESTIONS, type Answers } from "./qualify";

export const DESIGN = "solar.design";
export const REQUESTED = "solar.design.requested";
export const DESK_LIMITS = { name: 120, address: 200, phone: 30, email: 120, note: 500, url: 500 } as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;

// Which community's desk the /solar door sends to: SOLAR_COMMUNITY where the app is deployed, else
// the one committed in solve.communities.json. Null until Zest Solar's community exists.
export function deskCommunityId(env: string | undefined = process.env.SOLAR_COMMUNITY): string | null {
  const id = (env || (file as { doors?: { solar?: string | null } }).doors?.solar || "").trim().toLowerCase();
  return UUID.test(id) ? id : null;
}

export const requestScope = (homeownerId: string, communityId: string, requestId: string) =>
  `actor:${homeownerId}/solar:${communityId}/request:${requestId}`;
const homeownerSide = (homeownerId: string, communityId: string) => `actor:${homeownerId}/solar:${communityId}`;

export type DesignDetails = {
  name: string;
  address: string;
  phone: string;
  email: string;
  monthlyBill: number;
  monthlyKwh: number | null;
  answers: Partial<Answers>;
};

export type DesignAnswer = {
  id: string;
  proposalUrl: string;
  systemKw: number | null;
  panels: number | null;
  annualKwh: number | null;
  price: number | null;
  note: string;
  at: string;
};

export type DesignRequest = {
  id: string;
  homeownerId: string;
  scope: string;
  eventId: string;
  at: string;
  // Null once the homeowner has erased it (or withdrawn the desk's access).
  details: DesignDetails | null;
  // The newest answer.
  answer: DesignAnswer | null;
};

export class DeskInputError extends Error {}

function answersFrom(raw: unknown): Partial<Answers> {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out: Partial<Answers> = {};
  for (const q of QUESTIONS) {
    const v = r[q.key];
    if (typeof v === "string" && q.options.some(([value]) => value === v)) (out as Record<string, string>)[q.key] = v;
  }
  return out;
}

export function detailsFrom(input: Record<string, unknown>): DesignDetails {
  const name = cleanText(input.name, DESK_LIMITS.name);
  const address = cleanText(input.address, DESK_LIMITS.address);
  const phone = cleanText(input.phone, DESK_LIMITS.phone);
  const email = cleanText(input.email, DESK_LIMITS.email);
  if (name.length < 2) throw new DeskInputError("your name");
  if (address.length < 8) throw new DeskInputError("your full address");
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new DeskInputError("your email");
  if (phone && phone.replace(/\D/g, "").length < 7) throw new DeskInputError("your phone");
  const bill = Number(input.monthlyBill);
  const kwh = Number(input.monthlyKwh);
  return {
    name,
    address,
    phone,
    email,
    monthlyBill: Number.isFinite(bill) ? Math.min(SOLAR_LIMITS.bill[1], Math.max(SOLAR_LIMITS.bill[0], Math.round(bill))) : 220,
    monthlyKwh: Number.isFinite(kwh) && kwh >= SOLAR_LIMITS.kwh[0] ? Math.min(SOLAR_LIMITS.kwh[1], Math.round(kwh)) : null,
    answers: answersFrom(input.answers),
  };
}

const num = (v: unknown, min: number, max: number, digits = 0) => {
  const n = Number(v);
  if (v === null || v === undefined || v === "" || !Number.isFinite(n) || n < min || n > max) return null;
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};

function proposalUrl(v: unknown): string {
  const s = cleanText(v, DESK_LIMITS.url);
  try {
    const u = new URL(s);
    if (u.protocol === "https:") return u.toString();
  } catch {}
  throw new DeskInputError("the proposal link (https)");
}

function answerFrom(id: string, at: string, p: Record<string, unknown>): DesignAnswer | null {
  if (typeof p.proposal_url !== "string") return null;
  try {
    if (new URL(p.proposal_url).protocol !== "https:") return null;
  } catch {
    return null;
  }
  return {
    id,
    at,
    proposalUrl: p.proposal_url,
    systemKw: num(p.system_kw, 0.5, 200, 2),
    panels: num(p.panels, 1, 500),
    annualKwh: num(p.annual_kwh, 100, 500_000),
    price: num(p.price, 0, 2_000_000),
    note: typeof p.note === "string" ? p.note : "",
  };
}

// The homeowner asks for their design. Retrying with the same request id is the same request.
export async function requestDesign(
  kernel: Kernel,
  community: Community,
  input: Record<string, unknown> & { consent?: unknown },
  requestId: string,
): Promise<{ id: string; scope: string }> {
  if (!REQUEST_ID.test(requestId)) throw new DeskInputError("a request id");
  if (!community.packs.includes("solar")) throw new KernelError("forbidden", "This community does not run a solar desk", "");
  if (input.consent !== true) throw new DeskInputError("your consent");
  const details = detailsFrom(input);
  const me = await kernel.whoami();
  if (me.kind !== "human") throw new KernelError("forbidden", "A homeowner asks for their own design", "");
  if (me.actor_id === community.ownerId) throw new DeskInputError("a homeowner other than the desk's owner");
  const scope = requestScope(me.actor_id, community.communityId, requestId);

  let eventId = (await kernel.readEvents(scope, { limit: 50 })).find((e) => e.type === REQUESTED)?.id;
  if (!eventId) {
    await requireSealing(kernel);
    const { sealed, key } = await seal(details);
    eventId = await kernel.recordEvent({ type: REQUESTED, scope, payload: { sealed, community: community.communityId } });
    await kernel.sealKey(eventId, key);
  }
  await kernel.issueGrant({ grantee: community.ownerId, capability: "kernel.read", scope, idempotencyKey: `solar:desk:${requestId}` });
  const id = await send(kernel, {
    scope,
    to: community.ownerId,
    payload: { type: "INFORMATION_REQUEST", purpose: DESIGN, community: community.communityId, request: scope, event: eventId },
    key: `solar:ask:${requestId}`,
  });
  return { id, scope };
}

async function openDetails(kernel: Kernel, scope: string, eventId: string): Promise<DesignDetails | null> {
  try {
    const event = (await kernel.readEvents(scope, { limit: 50 })).find((e) => e.id === eventId && e.type === REQUESTED);
    if (!event) return null;
    const [row] = await kernel.unsealKeys([eventId]);
    if (!row) return null;
    const opened = await unseal((event.payload as { sealed?: unknown }).sealed, row.key);
    return opened && typeof opened === "object" ? detailsFrom(opened as Record<string, unknown>) : null;
  } catch (error) {
    if (error instanceof KernelError && error.name === "forbidden") return null;
    throw error;
  }
}

// The desk's open and answered requests, for the community's owner, newest first.
export async function deskRequests(kernel: Kernel, community: Community): Promise<DesignRequest[]> {
  await requireOwner(kernel, community);
  const [inbox, sent] = await Promise.all([kernel.inbox(), kernel.readActions(community.scope, 500)]);
  const answers = new Map<string, DesignAnswer>();
  for (const a of [...sent].reverse()) {
    if (a.kind !== "message.send" || a.status !== "completed" || !a.in_reply_to || a.payload.purpose !== DESIGN) continue;
    const answer = answerFrom(a.action_id, a.created_at, a.payload);
    if (answer) answers.set(a.in_reply_to, answer);
  }
  const asks = inbox.filter((m) => {
    const p = m.payload;
    return m.sender_kind === "human" && p.purpose === DESIGN && p.community === community.communityId &&
      typeof p.request === "string" && p.request.startsWith(homeownerSide(m.sender_id, community.communityId) + "/request:") &&
      typeof p.event === "string";
  });
  const out = await Promise.all(asks.map(async (m) => ({
    id: m.action_id,
    homeownerId: m.sender_id,
    scope: m.payload.request as string,
    eventId: m.payload.event as string,
    at: m.delivered_at,
    details: await openDetails(kernel, m.payload.request as string, m.payload.event as string),
    answer: answers.get(m.action_id) ?? null,
  })));
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

// The owner answers with the design they made in Aurora. Answering again sends a revised design.
export async function answerDesign(
  kernel: Kernel,
  community: Community,
  input: { askId: string; proposalUrl: unknown; systemKw?: unknown; panels?: unknown; annualKwh?: unknown; price?: unknown; note?: unknown },
  requestId: string,
): Promise<string> {
  if (!REQUEST_ID.test(requestId)) throw new DeskInputError("a request id");
  const ask = (await deskRequests(kernel, community)).find((r) => r.id === input.askId);
  if (!ask) throw new KernelError("not_found", "That request is not at this desk", "");
  if (!ask.details) throw new DeskInputError("a request the homeowner has not erased");
  return send(kernel, {
    scope: community.scope,
    to: ask.homeownerId,
    inReplyTo: ask.id,
    payload: {
      type: "INFORMATION_RESPONSE",
      purpose: DESIGN,
      community: community.communityId,
      proposal_url: proposalUrl(input.proposalUrl),
      system_kw: num(input.systemKw, 0.5, 200, 2),
      panels: num(input.panels, 1, 500),
      annual_kwh: num(input.annualKwh, 100, 500_000),
      price: num(input.price, 0, 2_000_000),
      note: cleanText(input.note, DESK_LIMITS.note),
    },
    key: `solar:answer:${requestId}`,
  });
}

// The homeowner's own requests at this desk, newest first, with the newest answer to each.
export async function myDesigns(kernel: Kernel, community: Community): Promise<DesignRequest[]> {
  const me = (await kernel.whoami()).actor_id;
  const [sent, inbox] = await Promise.all([kernel.readActions(homeownerSide(me, community.communityId), 200), kernel.inbox()]);
  const answers = new Map<string, DesignAnswer>();
  for (const m of inbox) {
    if (m.sender_id !== community.ownerId || !m.in_reply_to || m.payload.purpose !== DESIGN || m.payload.community !== community.communityId) continue;
    const answer = answerFrom(m.action_id, m.delivered_at, m.payload);
    if (answer) answers.set(m.in_reply_to, answer);
  }
  const asks = sent.filter((a) => a.kind === "message.send" && a.status === "completed" && a.payload.purpose === DESIGN && typeof a.payload.request === "string" && typeof a.payload.event === "string");
  const out = await Promise.all(asks.map(async (a) => ({
    id: a.action_id,
    homeownerId: me,
    scope: a.payload.request as string,
    eventId: a.payload.event as string,
    at: a.created_at,
    details: await openDetails(kernel, a.payload.request as string, a.payload.event as string),
    answer: answers.get(a.action_id) ?? null,
  })));
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

// The homeowner erases a request: its key is destroyed, so the details are unreadable for good, and
// the desk's access to it is revoked. Both are idempotent.
export async function eraseDesign(kernel: Kernel, community: Community, askId: string) {
  const mine = (await myDesigns(kernel, community)).find((r) => r.id === askId);
  if (!mine) throw new KernelError("not_found", "That request is not yours", "");
  const events = await kernel.readEvents(mine.scope, { limit: 200 });
  if (!events.some((e) => e.type === "kernel.key.destroyed" && e.payload.event_id === mine.eventId)) {
    await kernel.destroyKey(mine.eventId, "erased by the homeowner");
  }
  const revoked = new Set(events.filter((e) => e.type === "kernel.grant.revoked").map((e) => String(e.payload.grant_id)));
  for (const e of events) {
    const p = e.payload;
    if (e.type === "kernel.grant.issued" && p.grantee_id === community.ownerId && typeof p.grant_id === "string" && !revoked.has(p.grant_id)) {
      await kernel.revokeGrant(p.grant_id, "the homeowner erased their request", `solar:erase:${p.grant_id}`);
    }
  }
}
