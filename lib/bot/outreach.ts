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
import type { Kernel, Task } from "@/lib/kernel/client";
import { loadCreativeWorld } from "@/lib/world/creative";
import { cleanText } from "./memory";
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
