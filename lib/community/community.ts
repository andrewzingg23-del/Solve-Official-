// A community: people, and the AIs working for them, who build together under the rules of the
// person who started it. It is a World with a front door. The World is where members build (rooms,
// pieces, proof, builds and bots are all the World's own machinery), and its profile is the one
// public thing about it, so anyone signed in can find it and ask to join. Nothing here needs a
// migration:
//   profile  an organization entity, visibility public, in the owner's own scope
//            actor:<owner>/community:<id>, so only the owner can write it (kernel_api.public_world)
//   members  World collaborators, let in by the owner (lib/world/collaboration.ts)
//   AIs      members' bots, let in by the owner when the member brings theirs (lib/bot/worlds.ts)
//   asking   kernel messages (message.send) from the asker's own scope to the owner's inbox
//   notes    kernel messages between members, from and to people already in the community
// A community's id is derived from its owner and a random nonce kept on the profile, so a profile
// proves whose community it is: nobody else can publish one for the same id.
import { createHash } from "node:crypto";
import { KernelError, type InboxMessage, type Kernel, type WorldEntity } from "@/lib/kernel/client";
import { cleanText } from "@/lib/bot/memory";
import { companionOf } from "@/lib/bot/store";
import { setBotAccess } from "@/lib/bot/worlds";
import { grantWorldAccess, readWorldMembers } from "@/lib/world/collaboration";
import { createCreativeWorld } from "@/lib/world/creative";
import { packsFrom, type PackId } from "./packs";

export const PROFILE = "community.profile";
export const JOIN = "community.join";
export const NOTE = "community.note";
export const COMMUNITY_LIMITS = { name: 80, about: 600, note: 500, perPerson: 20 } as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROFILE_SCOPE = /^actor:([0-9a-f-]{36})\/community:([0-9a-f-]{36})$/;
// An unanswered ask stands for this long; asking again inside it returns the same ask.
const ASK_STANDS_MS = 7 * 86_400_000;

export type Community = {
  communityId: string;
  // The World members build in.
  scope: string;
  ownerId: string;
  profileId: string;
  name: string;
  about: string;
  packs: PackId[];
  updatedAt: string;
};

export type Standing = "owner" | "member" | "guest";

export const communityScope = (communityId: string) => `world:${communityId}`;
// A person's own side of one community: the owner's profile lives here, and everyone's asks and
// notes are sent from here, under the authority every person holds over their own scope.
export const sideScope = (actorId: string, communityId: string) => `actor:${actorId}/community:${communityId}`;

export function communityIdFor(ownerId: string, nonce: string): string {
  const h = createHash("sha256").update(`solve:community:v1:${ownerId.toLowerCase()}:${nonce}`).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString("hex");
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
}

const iso = (v: unknown) => {
  const t = Date.parse(v instanceof Date ? v.toISOString() : String(v));
  return Number.isFinite(t) ? new Date(t).toISOString() : "";
};

// A public profile, if it is a real one: the right shape, in its owner's own scope, for the id its
// owner's nonce gives.
export function communityFromEntity(entity: Pick<WorldEntity, "entity_id" | "kind" | "scope" | "title" | "summary" | "attributes" | "updated_at">): Community | null {
  if (entity.kind !== "organization") return null;
  const match = PROFILE_SCOPE.exec(entity.scope.toLowerCase());
  const a = entity.attributes ?? {};
  if (!match || a.sov !== PROFILE || typeof a.nonce !== "string") return null;
  const [, ownerId, communityId] = match;
  if (!UUID.test(ownerId) || communityIdFor(ownerId, a.nonce) !== communityId) return null;
  return {
    communityId,
    scope: communityScope(communityId),
    ownerId,
    profileId: entity.entity_id,
    name: entity.title,
    about: entity.summary,
    packs: packsFrom(a.packs),
    updatedAt: iso(entity.updated_at),
  };
}

export async function listCommunities(kernel: Kernel): Promise<Community[]> {
  const byId = new Map<string, Community>();
  for (const entity of await kernel.publicWorld()) {
    const community = communityFromEntity(entity);
    if (community && !byId.has(community.communityId)) byId.set(community.communityId, community);
  }
  return [...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function readCommunity(kernel: Kernel, communityId: string): Promise<Community | null> {
  if (!UUID.test(communityId)) return null;
  const id = communityId.toLowerCase();
  return (await listCommunities(kernel)).find((c) => c.communityId === id) ?? null;
}

export class CommunityInputError extends Error {}

function requireRequestId(requestId: string) {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(requestId)) throw new CommunityInputError("a request id is required");
  return requestId;
}

// Starts a community as the signed-in person: its World (theirs, private to members) and its public
// profile. Retrying with the same nonce returns the same community.
export async function startCommunity(
  kernel: Kernel,
  input: { name: unknown; about?: unknown; packs?: unknown; nonce: string },
): Promise<Community> {
  const name = cleanText(input.name, COMMUNITY_LIMITS.name);
  const about = cleanText(input.about, COMMUNITY_LIMITS.about);
  if (!name) throw new CommunityInputError("a community needs a name");
  if (!UUID.test(input.nonce)) throw new CommunityInputError("a community needs a nonce");
  const me = await kernel.whoami();
  if (me.kind !== "human") throw new KernelError("forbidden", "Only a person can start a community", "");
  const communityId = communityIdFor(me.actor_id, input.nonce);
  const mine = (await listCommunities(kernel)).filter((c) => c.ownerId === me.actor_id);
  const existing = mine.find((c) => c.communityId === communityId);
  if (existing) return existing;
  if (mine.length >= COMMUNITY_LIMITS.perPerson) throw new CommunityInputError(`one person can start up to ${COMMUNITY_LIMITS.perPerson} communities`);

  await createCreativeWorld(kernel, { worldId: communityId, title: name, goal: about });
  const packs = packsFrom(input.packs);
  await kernel.upsertEntity({
    kind: "organization",
    scope: sideScope(me.actor_id, communityId),
    title: name,
    summary: about,
    attributes: { sov: PROFILE, nonce: input.nonce, packs, join: "ask" },
    visibility: "public",
    idempotencyKey: `community:profile:${communityId}`,
  });
  const started = await readCommunity(kernel, communityId);
  if (!started) throw new KernelError("unavailable", "The community was started but its profile could not be read back", "");
  return started;
}

// The owner changes what the profile says and which packs the community runs.
export async function updateCommunity(kernel: Kernel, community: Community, input: { about?: unknown; packs?: unknown }) {
  await requireOwner(kernel, community);
  const entity = (await kernel.publicWorld()).find((e) => e.entity_id === community.profileId);
  if (!entity) throw new KernelError("not_found", "Community profile not found", "");
  await kernel.upsertEntity({
    entityId: community.profileId,
    kind: "organization",
    scope: sideScope(community.ownerId, community.communityId),
    title: community.name,
    summary: input.about === undefined ? community.about : cleanText(input.about, COMMUNITY_LIMITS.about),
    attributes: { ...entity.attributes, packs: input.packs === undefined ? community.packs : packsFrom(input.packs) },
    visibility: "public",
  });
}

export async function standingIn(kernel: Kernel, community: Community): Promise<{ me: string; standing: Standing }> {
  const [me, grants] = await Promise.all([kernel.whoami(), kernel.myGrants()]);
  if (me.actor_id === community.ownerId) return { me: me.actor_id, standing: "owner" };
  const member = grants.some((g) => g.scope === community.scope && (g.capability === "kernel.read" || g.capability === "*"));
  return { me: me.actor_id, standing: member ? "member" : "guest" };
}

// Only the community's owner, and only if they really own its World (the profile's owner and the
// World's scope claim agree).
export async function requireOwner(kernel: Kernel, community: Community) {
  const me = await kernel.whoami();
  if (me.actor_id !== community.ownerId) throw new KernelError("forbidden", "Only the person who started this community can do that", "");
  const { ownerActorId } = await readWorldMembers(kernel, community.scope);
  if (ownerActorId !== community.ownerId) throw new KernelError("forbidden", "This profile does not belong to the World's owner", "");
  return me.actor_id;
}

// A message is an action: proposed under the sender's own authority, then enacted (delivered).
export async function send(kernel: Kernel, input: { scope: string; to: string; payload: Record<string, unknown>; inReplyTo?: string; key: string }) {
  const id = await kernel.proposeAction({
    kind: "message.send",
    capability: "message.send",
    scope: input.scope,
    targetRef: `actor:${input.to}`,
    payload: input.payload,
    inReplyTo: input.inReplyTo,
    idempotencyKey: input.key,
  });
  const sent = await kernel.readAction(id);
  if (sent.status === "rejected") throw new KernelError("forbidden", sent.reasons.join("; ") || "The message was refused", "");
  if (sent.status !== "completed") await kernel.enactAction(id);
  return id;
}

const about = (m: Pick<InboxMessage, "payload">, purpose: string, communityId: string) =>
  m.payload.purpose === purpose && m.payload.community === communityId;

export type MyAsk = { id: string; at: string; bot: string | null; answer: "in" | "declined" | null; answeredAt: string | null };

// The person's own asks to join (or to bring their AI in), newest first, with the owner's answers.
export async function myAsks(kernel: Kernel, community: Community): Promise<MyAsk[]> {
  const me = await kernel.whoami();
  const [sent, inbox] = await Promise.all([kernel.readActions(sideScope(me.actor_id, community.communityId), 200), kernel.inbox()]);
  const answers = new Map(
    inbox
      .filter((m) => m.sender_id === community.ownerId && m.in_reply_to && about(m, JOIN, community.communityId))
      .map((m) => [m.in_reply_to!, m]),
  );
  return sent
    .filter((a) => a.kind === "message.send" && a.status === "completed" && about(a, JOIN, community.communityId))
    .map((a) => {
      const reply = answers.get(a.action_id);
      return {
        id: a.action_id,
        at: a.created_at,
        bot: typeof a.payload.bot === "string" ? a.payload.bot : null,
        answer: reply ? (reply.message_type === "DECLINE" ? "declined" : "in") : null,
        answeredAt: reply?.delivered_at ?? null,
      };
    });
}

// Asks the owner to be let in, or, for someone already in, to let their AI in. An unanswered ask
// from the last week is returned instead of sending another.
export async function askToJoin(
  kernel: Kernel,
  community: Community,
  input: { note?: unknown; bringBot?: boolean; requestId: string },
  now = new Date(),
): Promise<{ id: string; again: boolean }> {
  const requestId = requireRequestId(input.requestId);
  const { me, standing } = await standingIn(kernel, community);
  if (standing === "owner") throw new CommunityInputError("you started this community");
  const bot = input.bringBot ? companionOf(await kernel.myAvatars())?.agent_id ?? null : null;
  if (standing === "member" && !bot) throw new CommunityInputError("you're already in");
  const open = (await myAsks(kernel, community)).find((a) => !a.answer && now.getTime() - Date.parse(a.at) < ASK_STANDS_MS);
  if (open) return { id: open.id, again: true };
  const id = await send(kernel, {
    scope: sideScope(me, community.communityId),
    to: community.ownerId,
    payload: { type: "INFORMATION_REQUEST", purpose: JOIN, community: community.communityId, note: cleanText(input.note, COMMUNITY_LIMITS.note), bot },
    key: `community:ask:${requestId}`,
  });
  return { id, again: false };
}

export type JoinRequest = {
  id: string;
  personId: string;
  name: string;
  note: string;
  bot: { agentId: string; name: string } | null;
  at: string;
  member: boolean;
};

// The owner's open asks: the newest unanswered one from each person.
export async function joinRequests(kernel: Kernel, community: Community): Promise<JoinRequest[]> {
  await requireOwner(kernel, community);
  const [inbox, answered, roster] = await Promise.all([
    kernel.inbox(),
    kernel.readActions(community.scope, 500),
    readWorldMembers(kernel, community.scope),
  ]);
  const done = new Set(answered.filter((a) => a.kind === "message.send" && a.in_reply_to && about(a, JOIN, community.communityId)).map((a) => a.in_reply_to));
  const newest = new Map<string, InboxMessage>();
  for (const m of inbox) {
    if (m.sender_kind !== "human" || !about(m, JOIN, community.communityId) || done.has(m.action_id)) continue;
    const seen = newest.get(m.sender_id);
    if (!seen || seen.delivered_at < m.delivered_at) newest.set(m.sender_id, m);
  }
  const asks = [...newest.values()];
  const botIds = asks.map((m) => m.payload.bot).filter((b): b is string => typeof b === "string" && UUID.test(b));
  const ids = [...new Set([...asks.map((m) => m.sender_id), ...botIds])];
  const actors = new Map((ids.length ? await kernel.readActors(ids) : []).map((a) => [a.actor_id, a]));
  const members = new Set(roster.members.map((m) => m.actorId));
  return asks
    .map((m) => {
      const bot = typeof m.payload.bot === "string" ? actors.get(m.payload.bot) : undefined;
      return {
        id: m.action_id,
        personId: m.sender_id,
        name: actors.get(m.sender_id)?.label || m.sender_id.slice(0, 8),
        note: typeof m.payload.note === "string" ? m.payload.note : "",
        // Only the asker's own bot can come in with them.
        bot: bot && bot.kind === "agent" && bot.accountable_party === m.sender_id ? { agentId: bot.actor_id, name: bot.label || "Their AI" } : null,
        at: m.delivered_at,
        member: members.has(m.sender_id),
      };
    })
    .sort((a, b) => b.at.localeCompare(a.at));
}

// The owner answers an ask. Letting someone in makes them a member who can build (editor), and lets
// their AI in to add when they brought it; either way the asker gets the answer as a message.
export async function answerAsk(kernel: Kernel, community: Community, input: { askId: string; answer: "in" | "declined" }) {
  await requireOwner(kernel, community);
  if (input.answer !== "in" && input.answer !== "declined") throw new CommunityInputError("answer in or declined");
  const ask = (await joinRequests(kernel, community)).find((r) => r.id === input.askId);
  if (!ask) throw new KernelError("not_found", "That ask is not open", "");
  if (input.answer === "in") {
    if (!ask.member) {
      await grantWorldAccess(kernel, { scope: community.scope, granteeActorId: ask.personId, role: "editor", requestId: `join-${ask.id}` });
    }
    if (ask.bot) await setBotAccess(kernel, { scope: community.scope, botAgentId: ask.bot.agentId, access: "add" }, `join-${ask.id}`);
  }
  await send(kernel, {
    scope: community.scope,
    to: ask.personId,
    inReplyTo: ask.id,
    payload: { type: input.answer === "in" ? "INFORMATION_RESPONSE" : "DECLINE", purpose: JOIN, community: community.communityId, answer: input.answer },
    key: `community:answer:${ask.id}`,
  });
  return ask;
}

export type Member = {
  actorId: string;
  name: string;
  role: "owner" | "member" | "viewer";
  ais: { agentId: string; name: string }[];
};

// Who is in the community, for anyone in it: people with the AIs they brought, and any AI the owner
// let in for someone outside it.
export async function communityMembers(kernel: Kernel, community: Community): Promise<{ people: Member[]; guests: { agentId: string; name: string }[] }> {
  const roster = await readWorldMembers(kernel, community.scope);
  if (roster.ownerActorId !== community.ownerId) throw new KernelError("forbidden", "This profile does not belong to the World's owner", "");
  const ids = [roster.ownerActorId, ...roster.members.map((m) => m.actorId)];
  const actors = await kernel.readActors([...new Set(ids)]);
  const role = new Map(roster.members.map((m) => [m.actorId, m.role === "editor" ? "member" as const : "viewer" as const]));
  const people: Member[] = actors
    .filter((a) => a.kind === "human")
    .map((a) => ({ actorId: a.actor_id, name: a.label || a.actor_id.slice(0, 8), role: a.actor_id === roster.ownerActorId ? "owner" as const : role.get(a.actor_id) ?? "viewer", ais: [] }));
  const byPerson = new Map(people.map((p) => [p.actorId, p]));
  const guests: { agentId: string; name: string }[] = [];
  for (const a of actors.filter((x) => x.kind === "agent")) {
    const ai = { agentId: a.actor_id, name: a.label || "AI" };
    const person = a.accountable_party ? byPerson.get(a.accountable_party) : undefined;
    if (person) person.ais.push(ai);
    else guests.push(ai);
  }
  const order = { owner: 0, member: 1, viewer: 2 };
  people.sort((a, b) => order[a.role] - order[b.role] || a.name.localeCompare(b.name));
  return { people, guests };
}

export type Note = { id: string; fromId: string; from: string; text: string; at: string; inReplyTo: string | null };

// A note from one member to another. Both must be in the community; the note is a kernel message,
// so it is on the record with who sent it.
export async function sendNote(kernel: Kernel, community: Community, input: { to: string; text: unknown; requestId: string; inReplyTo?: string }) {
  const requestId = requireRequestId(input.requestId);
  const me = (await kernel.whoami()).actor_id;
  const roster = await readWorldMembers(kernel, community.scope);
  const inIt = (id: string) => id === roster.ownerActorId || roster.members.some((m) => m.actorId === id);
  const to = input.to.trim().toLowerCase();
  if (!UUID.test(to) || !inIt(to) || !inIt(me)) throw new KernelError("forbidden", "Notes go between people in this community", "");
  if (to === me) throw new CommunityInputError("that's you");
  const text = cleanText(input.text, COMMUNITY_LIMITS.note);
  if (!text) throw new CommunityInputError("a note needs words");
  return send(kernel, {
    scope: sideScope(me, community.communityId),
    to,
    inReplyTo: input.inReplyTo,
    payload: { type: "INFORMATION_REQUEST", purpose: NOTE, community: community.communityId, text },
    key: `community:note:${requestId}`,
  });
}

// Notes to the signed-in person from people in this community, newest first.
export async function notesForMe(kernel: Kernel, community: Community, limit = 50): Promise<Note[]> {
  const [inbox, roster] = await Promise.all([kernel.inbox(), readWorldMembers(kernel, community.scope)]);
  const inIt = new Set([roster.ownerActorId, ...roster.members.map((m) => m.actorId)]);
  const notes = inbox.filter((m) => about(m, NOTE, community.communityId) && inIt.has(m.sender_id)).slice(-limit).reverse();
  const ids = [...new Set(notes.map((m) => m.sender_id))];
  const names = new Map((ids.length ? await kernel.readActors(ids) : []).map((a) => [a.actor_id, a.label || a.actor_id.slice(0, 8)]));
  return notes.map((m) => ({
    id: m.action_id,
    fromId: m.sender_id,
    from: names.get(m.sender_id) ?? m.sender_id.slice(0, 8),
    text: typeof m.payload.text === "string" ? m.payload.text : "",
    at: m.delivered_at,
    inReplyTo: m.in_reply_to,
  }));
}
