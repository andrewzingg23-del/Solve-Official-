// The Outreach Room, first slice (docs/plans/2026-10-05-business-leverage-outreach.md §3). A
// person's assistant finds businesses that fit a goal, citing the public page where it found each
// one, and drafts a personal message for each. Sovereign keeps the drafts in a World. The person
// approves each message. For now approval sends through the Practice channel: it records what would
// be sent, and nothing leaves solve. A real channel (email, then Meta inside its rules) plugs into
// the same approval later.
//
// Every message gets the sender's name and an opt-out line added, so a draft can't leave either out.
// Approving needs `outreach.send`, which the World's owner holds and a bot let in to add does not.
import { createHash } from "node:crypto";
import type { EvidenceBasis, Kernel, Task } from "@/lib/kernel/client";
import { loadCreativeWorld } from "@/lib/world/creative";
import { cleanText } from "./memory";
import { history } from "./proof";
import { WORLD_LIMITS, WorldInputError } from "./worlds";

export const OUTREACH_LIMITS = { goal: 300, from: 120, leads: 20, name: 120, why: 300, contact: 200, message: 1200, source: 2000 } as const;
export const SEND_CAPABILITY = "outreach.send";
export const OPT_OUT = 'If this isn\'t useful, reply "no" and you won\'t hear from us again.';
export const CHANNELS = ["practice"] as const;
export type Channel = (typeof CHANNELS)[number];

export type Lead = { name: string; why: string; source: string; contact?: string; message: string };
export type Outreach = { goal: string; from: string; leads: Lead[] };
export type Sent = { taskId: string; lead: number; channel: Channel; at: string; by: string };

const PREFIX = "SOV_OUTREACH_V1\n";

function webLink(value: unknown, what: string): string {
  if (typeof value !== "string" || !value.trim()) throw new WorldInputError(`${what} needs the public page where it was found`);
  if (value.length > OUTREACH_LIMITS.source) throw new WorldInputError(`${what}'s source link is too long`);
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new WorldInputError(`${what}'s source is not a web address`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new WorldInputError(`${what}'s source must start with https:// or http://`);
  return url.toString();
}

function readOutreach(input: { goal: unknown; from: unknown; leads: unknown }): Outreach {
  const goal = cleanText(input.goal, OUTREACH_LIMITS.goal);
  const from = cleanText(input.from, OUTREACH_LIMITS.from);
  if (!goal) throw new WorldInputError("say what the outreach is for");
  if (!from) throw new WorldInputError("say who the messages are from, as the person wants to be named");
  if (!Array.isArray(input.leads) || input.leads.length < 1) throw new WorldInputError("add at least one business");
  if (input.leads.length > OUTREACH_LIMITS.leads) throw new WorldInputError(`at most ${OUTREACH_LIMITS.leads} businesses at a time`);
  const leads = input.leads.map((raw, i): Lead => {
    const l = (raw ?? {}) as Record<string, unknown>;
    const name = cleanText(l.name, OUTREACH_LIMITS.name);
    const what = name ? `"${name}"` : `business ${i + 1}`;
    if (!name) throw new WorldInputError(`business ${i + 1} needs a name`);
    const message = cleanText(l.message, OUTREACH_LIMITS.message);
    if (!message) throw new WorldInputError(`${what} needs a message`);
    const contact = cleanText(l.contact, OUTREACH_LIMITS.contact);
    return { name, why: cleanText(l.why, OUTREACH_LIMITS.why), source: webLink(l.source, what), ...(contact ? { contact } : {}), message };
  });
  return { goal, from, leads };
}

export function encodeOutreach(input: { goal: unknown; from: unknown; leads: unknown }): string {
  const body = PREFIX + JSON.stringify(readOutreach(input));
  if (body.length > WORLD_LIMITS.body) throw new WorldInputError("the drafts are too long for one piece; shorten the messages or send fewer at a time");
  return body;
}

// Reads drafts back from a piece, checking them again: a piece's text can be edited by hand.
export function parseOutreach(body: string): Outreach | null {
  if (!body.startsWith(PREFIX)) return null;
  try {
    return readOutreach(JSON.parse(body.slice(PREFIX.length)));
  } catch {
    return null;
  }
}

// The message exactly as it would go out: the draft, who it is from, and the way to say no.
export const finalMessage = (o: Outreach, lead: Lead) => `${lead.message}\n\n${o.from}\n${OPT_OUT}`;

const inputOf = (t: Task) => t.inputs as { outreach_piece?: unknown; lead?: unknown; channel?: unknown };

// What was approved and sent, per outreach piece and lead, from the kernel's tasks.
export async function sentIn(kernel: Kernel, scope: string): Promise<Map<string, Map<number, Sent>>> {
  const out = new Map<string, Map<number, Sent>>();
  for (const t of await kernel.readTasks(scope)) {
    const i = inputOf(t);
    if (t.required_capability !== SEND_CAPABILITY || t.status !== "completed" || typeof i.outreach_piece !== "string" || !Number.isInteger(i.lead)) continue;
    const byLead = out.get(i.outreach_piece) ?? new Map<number, Sent>();
    byLead.set(i.lead as number, { taskId: t.task_id, lead: i.lead as number, channel: "practice", at: new Date(t.updated_at).toISOString(), by: t.created_by });
    out.set(i.outreach_piece, byLead);
  }
  return out;
}

// The person approves one message. On the Practice channel the kernel records exactly what would be
// sent and that it was not sent outside solve. Approving the same message again changes nothing.
export async function approveAndSend(person: Kernel, input: { worldId: string; pieceId: string; lead: number }): Promise<Sent> {
  const { world, artifacts } = await loadCreativeWorld(person, input.worldId);
  const piece = artifacts.find((a) => a.entityId === input.pieceId);
  const outreach = piece ? parseOutreach(piece.body) : null;
  if (!piece || !outreach) throw new WorldInputError("no such outreach in this World");
  const lead = outreach.leads[input.lead];
  if (!Number.isInteger(input.lead) || !lead) throw new WorldInputError("no such business in this outreach");
  const done = (await sentIn(person, world.scope)).get(piece.entityId)?.get(input.lead);
  if (done) return done;
  if (saidNo(lead, await saidNoIn(person, input.worldId))) throw new WorldInputError(`${lead.name} said no, so solve won't send to them again`);

  const message = finalMessage(outreach, lead);
  const taskId = await person.createTask({
    scope: world.scope,
    title: `Message to ${lead.name}`,
    requiredCapability: SEND_CAPABILITY,
    objective: outreach.goal,
    causeRef: `entity:${piece.entityId}`,
    inputs: { outreach_piece: piece.entityId, lead: input.lead, channel: "practice", source: lead.source },
    idempotencyKey: `outreach:${piece.entityId}:${input.lead}`,
  });
  const result = { channel: "practice", sent_outside_solve: false, message_sha256: createHash("sha256").update(message).digest("hex"), message };
  const status = (await person.readTasks(world.scope)).find((t) => t.task_id === taskId)?.status;
  const path: Task["status"][] =
    status === "created" ? ["ready", "claimed", "in_progress", "completed"]
    : status === "ready" ? ["claimed", "in_progress", "completed"]
    : status === "claimed" ? ["in_progress", "completed"]
    : status === "in_progress" ? ["completed"]
    : [];
  for (const s of path) {
    await person.transitionTask({ taskId, status: s, detail: s === "completed" ? "Approved. Practice: recorded, not sent outside solve" : s === "ready" ? "Approved" : "", ...(s === "completed" ? { result } : {}) });
  }
  return (await sentIn(person, world.scope)).get(piece.entityId)!.get(input.lead)!;
}

// What happened after a message was approved: the consequence, on the record. A person (or their
// assistant, on what the person said or showed) records a reply, a meeting, a win or a no as
// evidence on the approval. The kernel sets the basis: the person's own word is self_reported, and
// nothing here is ever verified. "Said no" is enforced: solve won't approve another message to that
// business in this World.
export const OUTCOMES = ["replied", "meeting", "won", "said_no"] as const;
export type OutcomeKind = (typeof OUTCOMES)[number];
export const OUTCOME_LABEL: Record<OutcomeKind, string> = { replied: "Replied", meeting: "Meeting booked", won: "Won", said_no: "Said no" };
// What a win was worth, as the person said (minor units, so no rounding drift). On their word until a
// payment settles through solve and is observed, which is what can later make it verified income.
export type Value = { minor: number; currency: string };
export type LeadOutcome = { outcome: OutcomeKind; note: string; at: string; basis: EvidenceBasis; by: string; number: number; value?: Value };
export const VALUE_LIMIT = 100_000_000_00; // 100 million in major units

function readValue(amount: unknown, currency: unknown): Value | undefined {
  if (amount === undefined || amount === null || amount === "") return undefined;
  const n = typeof amount === "number" ? amount : Number(String(amount).replace(/[,\s]/g, ""));
  if (!Number.isFinite(n) || n <= 0) throw new WorldInputError("the value must be a positive amount");
  const minor = Math.round(n * 100);
  if (minor > VALUE_LIMIT) throw new WorldInputError("that value is too large to record");
  const code = typeof currency === "string" && currency.trim() ? currency.trim().toUpperCase() : "USD";
  if (!/^[A-Z]{3}$/.test(code)) throw new WorldInputError("the currency must be a three-letter code, like USD or CAD");
  return { minor, currency: code };
}

export const formatValue = (v: Value) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: v.currency, maximumFractionDigits: v.minor % 100 ? 2 : 0 }).format(v.minor / 100);

const OUTCOME_MEDIA = "application/vnd.sov.outreach-outcome";
const describeOutcome = (o: OutcomeKind, note: string, value?: Value) =>
  `outcome:${o}${value ? `\nvalue:${value.minor} ${value.currency}` : ""}${note ? `\n${note}` : ""}`;

// The approval's completion event for each outreach task in a scope.
async function completions(kernel: Kernel, scope: string): Promise<Map<string, string>> {
  const out = new Map<string, string>(); // task id -> completion event id
  for await (const e of history(kernel, scope)) {
    const p = e.payload as { task_id?: unknown };
    if (e.type === "kernel.task.completed" && typeof p.task_id === "string") out.set(p.task_id, e.id);
  }
  return out;
}

// Outcomes recorded per outreach piece and lead, oldest first.
export async function outcomesIn(kernel: Kernel, scope: string): Promise<Map<string, Map<number, LeadOutcome[]>>> {
  const sent = await sentIn(kernel, scope);
  const byTask = new Map<string, { piece: string; lead: number }>();
  for (const [piece, leads] of sent) for (const [lead, s] of leads) byTask.set(s.taskId, { piece, lead });
  const completionOf = new Map<string, { piece: string; lead: number }>();
  const out = new Map<string, Map<number, LeadOutcome[]>>();
  for await (const e of history(kernel, scope)) {
    const p = e.payload as Record<string, unknown>;
    if (e.type === "kernel.task.completed" && typeof p.task_id === "string" && byTask.has(p.task_id)) completionOf.set(e.id, byTask.get(p.task_id)!);
    if (e.type !== "kernel.evidence.attached" || typeof p.event_id !== "string" || !Array.isArray(p.items)) continue;
    const at = completionOf.get(p.event_id);
    if (!at) continue;
    for (const item of p.items as Record<string, unknown>[]) {
      if (item.media_type !== OUTCOME_MEDIA) continue;
      const [head, ...lines] = String(item.description ?? "").split("\n");
      const valueLine = /^value:(\d+) ([A-Z]{3})$/.exec(lines[0] ?? "");
      const rest = valueLine ? lines.slice(1) : lines;
      const value = valueLine ? { minor: Number(valueLine[1]), currency: valueLine[2] } : undefined;
      const outcome = head.replace(/^outcome:/, "") as OutcomeKind;
      if (!OUTCOMES.includes(outcome)) continue;
      const byLead = out.get(at.piece) ?? new Map<number, LeadOutcome[]>();
      byLead.set(at.lead, [...(byLead.get(at.lead) ?? []), { outcome, note: rest.join("\n"), at: new Date(e.occurred_at).toISOString(), basis: item.basis as EvidenceBasis, by: e.on_behalf_of ?? e.actor_id, number: e.seq, ...(value ? { value } : {}) }]);
      out.set(at.piece, byLead);
    }
  }
  return out;
}

const hostOf = (link: string) => {
  try {
    return new URL(link).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
};
const nameKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// The businesses in a World that said no, by name and by the site they were found on.
export async function saidNoIn(kernel: Kernel, worldId: string): Promise<{ names: Set<string>; hosts: Set<string> }> {
  const { world, artifacts } = await loadCreativeWorld(kernel, worldId);
  const outcomes = await outcomesIn(kernel, world.scope);
  const names = new Set<string>();
  const hosts = new Set<string>();
  for (const a of artifacts) {
    const o = parseOutreach(a.body);
    const byLead = outcomes.get(a.entityId);
    if (!o || !byLead) continue;
    for (const [i, list] of byLead) {
      if (!list.some((x) => x.outcome === "said_no") || !o.leads[i]) continue;
      names.add(nameKey(o.leads[i].name));
      if (hostOf(o.leads[i].source)) hosts.add(hostOf(o.leads[i].source));
    }
  }
  return { names, hosts };
}

export const saidNo = (lead: Pick<Lead, "name" | "source">, no: { names: Set<string>; hosts: Set<string> }) =>
  no.names.has(nameKey(lead.name)) || (hostOf(lead.source) !== "" && no.hosts.has(hostOf(lead.source)));

// Records what happened with one approved message. A retried call with the same request id records once.
export async function recordOutcome(
  kernel: Kernel,
  input: { worldId: string; pieceId: string; lead: number; outcome: unknown; note?: unknown; amount?: unknown; currency?: unknown; ownerId: string },
  requestId: string,
): Promise<LeadOutcome> {
  const outcome = input.outcome as OutcomeKind;
  if (!OUTCOMES.includes(outcome)) throw new WorldInputError(`the outcome must be one of: ${OUTCOMES.join(", ")}`);
  const note = cleanText(input.note, 300);
  const value = readValue(input.amount, input.currency);
  if (value && outcome !== "won") throw new WorldInputError("only a win carries a value");
  const { world } = await loadCreativeWorld(kernel, input.worldId);
  const sent = (await sentIn(kernel, world.scope)).get(input.pieceId)?.get(input.lead);
  if (!sent) throw new WorldInputError("that message hasn't been approved, so nothing happened with it yet");
  const eventId = (await completions(kernel, world.scope)).get(sent.taskId);
  if (!eventId) throw new WorldInputError("that approval has no record to attach to");
  const basis: EvidenceBasis = "self_reported";
  const description = describeOutcome(outcome, note, value);
  await kernel.attachEvidence(
    eventId,
    { basis, content_hash: `sha256:${createHash("sha256").update(description).digest("hex")}`, media_type: OUTCOME_MEDIA, description },
    `outcome:${requestId}`.slice(0, 200),
  );
  const list = (await outcomesIn(kernel, world.scope)).get(input.pieceId)?.get(input.lead) ?? [];
  return list.at(-1)!;
}

