// Communities end to end on the embedded kernel: anyone signed in can start one and anyone signed in
// can find it; a person asks to join and only the owner lets them in; a member's AI comes in with
// them and works under its own identity; members see each other and leave each other notes; and a
// profile cannot be forged for someone else's community.
import assert from "node:assert/strict";
import { it } from "node:test";
import { kernelClient, KernelError, type Kernel } from "../../lib/kernel/client";
import { localSupabase } from "../../lib/kernel/local";
import { saveBot } from "../../lib/bot/store";
import { addToWorld, botGrantsIn } from "../../lib/bot/worlds";
import {
  aiSendsNotes,
  answerAsk,
  letAiSendNotes,
  askToJoin,
  communityFromEntity,
  communityIdFor,
  communityMembers,
  joinRequests,
  listCommunities,
  myAsks,
  notesForMe,
  readCommunity,
  sendNote,
  sideScope,
  standingIn,
  startCommunity,
  updateCommunity,
} from "../../lib/community/community";
import { createKernelDb, service, user } from "../kernel/harness";

const NONCE = "0b6f3c1e-8a2d-4f5b-9c7e-1d2e3f4a5b6c";

async function setting() {
  const db = await createKernelDb();
  const person = async (auth: string, label: string) => {
    const k = kernelClient(localSupabase(db, user(auth)));
    const id = await k.register(label);
    return { k, id };
  };
  const ana = await person("auth:community-ana", "Ana");
  const ben = await person("auth:community-ben", "Ben");
  const cy = await person("auth:community-cy", "Cy");
  const botAs = (agentId: string) => kernelClient(localSupabase(db, service), { actAs: agentId });
  return { db, ana, ben, cy, botAs };
}

const rejects = (p: Promise<unknown>, pattern?: RegExp) =>
  assert.rejects(p, (e: unknown) => (pattern ? pattern.test(String((e as Error).message)) : true));

it("starts a community anyone signed in can find, with its World private to members", async () => {
  const { ana, ben } = await setting();
  const c = await startCommunity(ana.k, { name: "Zest Solar", about: "Solar for Florida homes.", packs: ["solar", "dialer", "nope"], nonce: NONCE });
  assert.equal(c.communityId, communityIdFor(ana.id, NONCE));
  assert.equal(c.ownerId, ana.id);
  assert.deepEqual(c.packs, ["solar", "dialer"], "unknown packs are dropped");
  assert.equal((await startCommunity(ana.k, { name: "Zest Solar", nonce: NONCE })).profileId, c.profileId, "a retry is the same community");

  const found = await listCommunities(ben.k);
  assert.deepEqual(found.map((x) => x.name), ["Zest Solar"]);
  assert.equal((await readCommunity(ben.k, c.communityId))?.about, "Solar for Florida homes.");
  assert.equal((await standingIn(ben.k, c)).standing, "guest");
  await rejects(ben.k.readWorld(c.scope), /kernel\.read|not authorized|grant/i);

  await updateCommunity(ana.k, c, { packs: ["build"] });
  assert.deepEqual((await readCommunity(ben.k, c.communityId))?.packs, ["build"]);
  await rejects(updateCommunity(ben.k, c, { about: "mine now" }), /Only the person who started/);
});

it("refuses a profile published for someone else's community", async () => {
  const { ana, ben } = await setting();
  const c = await startCommunity(ana.k, { name: "Zest Solar", nonce: NONCE });
  // Ben publishes a look-alike profile pointing at Ana's community id, in his own scope.
  await ben.k.upsertEntity({
    kind: "organization",
    scope: sideScope(ben.id, c.communityId),
    title: "Zest Solar (official)",
    attributes: { sov: "community.profile", nonce: NONCE, packs: ["solar"] },
    visibility: "public",
  });
  const all = await listCommunities(ben.k);
  assert.deepEqual(all.map((x) => [x.name, x.ownerId]), [["Zest Solar", ana.id]], "only the real owner's profile counts");
  assert.equal(communityFromEntity({ entity_id: "x", kind: "organization", scope: sideScope(ben.id, c.communityId), title: "t", summary: "", attributes: { sov: "community.profile", nonce: NONCE }, updated_at: "" }), null);
  // And he cannot write into Ana's scope to fake hers.
  await rejects(ben.k.upsertEntity({ kind: "organization", scope: sideScope(ana.id, c.communityId), title: "x", visibility: "public" }));
});

it("lets a person in only when the owner says so, with their AI, and tells them", async () => {
  const { ana, ben, cy, botAs } = await setting();
  const c = await startCommunity(ana.k, { name: "Builders", nonce: NONCE });
  const benBot = (await saveBot(ben.k, { name: "Rex" }, "persona-community-ben")).avatar!.agent_id;

  const asked = await askToJoin(ben.k, c, { note: "I build CAD parts.", bringBot: true, requestId: "ask-ben-0001" });
  assert.equal(asked.again, false);
  assert.equal((await askToJoin(ben.k, c, { note: "again", requestId: "ask-ben-0002" })).id, asked.id, "an open ask is not sent twice");
  await rejects(askToJoin(ana.k, c, { requestId: "ask-ana-0001" }), /started this community/);

  // Only the owner sees and answers asks.
  await rejects(joinRequests(ben.k, c));
  const open = await joinRequests(ana.k, c);
  assert.equal(open.length, 1);
  assert.equal(open[0].name, "Ben");
  assert.equal(open[0].note, "I build CAD parts.");
  assert.equal(open[0].bot?.agentId, benBot);
  await rejects(answerAsk(cy.k, c, { askId: asked.id, answer: "in" }), /Only the person who started/);

  await answerAsk(ana.k, c, { askId: asked.id, answer: "in" });
  assert.equal((await standingIn(ben.k, c)).standing, "member");
  assert.equal((await joinRequests(ana.k, c)).length, 0, "answered asks leave the list");
  assert.deepEqual((await myAsks(ben.k, c)).map((a) => a.answer), ["in"]);

  // Ben builds in the World, and his AI adds to it as itself, for him.
  const world = (await ben.k.readWorld(c.scope)).find((e) => e.kind === "world")!;
  assert.ok(world, "a member can read the community's World");
  assert.deepEqual((await botGrantsIn(ana.k, c.scope, benBot)).map((g) => g.capability).sort(), ["kernel.evidence.attach", "kernel.read", "world.entity.write"]);
  const added = await addToWorld(botAs(benBot), { worldId: c.communityId, title: "Bracket v2", body: "Printed and fitted.", via: { clientId: "client-1", clientName: "Claude" } }, "bot-add-1");
  assert.equal(added.revised, false);

  const { people } = await communityMembers(ben.k, c);
  assert.deepEqual(people.map((p) => [p.name, p.role, p.ais.map((a) => a.name)]), [["Ana", "owner", []], ["Ben", "member", ["Rex"]]]);
  await rejects(communityMembers(cy.k, c), /kernel\.read|not authorized|grant/i);
});

it("tells a declined person, and keeps them out", async () => {
  const { ana, cy } = await setting();
  const c = await startCommunity(ana.k, { name: "Builders", nonce: NONCE });
  const asked = await askToJoin(cy.k, c, { requestId: "ask-cy-00001" });
  await answerAsk(ana.k, c, { askId: asked.id, answer: "declined" });
  assert.deepEqual((await myAsks(cy.k, c)).map((a) => a.answer), ["declined"]);
  assert.equal((await standingIn(cy.k, c)).standing, "guest");
  // Declined, they may ask again later; that is a new ask.
  assert.equal((await askToJoin(cy.k, c, { requestId: "ask-cy-00002" })).again, false);
});

it("carries notes between members only", async () => {
  const { ana, ben, cy } = await setting();
  const c = await startCommunity(ana.k, { name: "Builders", nonce: NONCE });
  const asked = await askToJoin(ben.k, c, { requestId: "ask-ben-0001" });
  await answerAsk(ana.k, c, { askId: asked.id, answer: "in" });

  const sent = await sendNote(ben.k, c, { to: ana.id, text: "Can you look at my bracket?", requestId: "note-ben-0001" });
  await sendNote(ana.k, c, { to: ben.id, text: "Yes, tonight.", requestId: "note-ana-0001", inReplyTo: sent });
  assert.deepEqual((await notesForMe(ana.k, c)).map((n) => [n.from, n.text]), [["Ben", "Can you look at my bracket?"]]);
  const reply = (await notesForMe(ben.k, c))[0];
  assert.equal(reply.text, "Yes, tonight.");
  assert.equal(reply.inReplyTo, sent);

  // Someone outside can neither send nor be sent a note.
  await rejects(sendNote(cy.k, c, { to: ana.id, text: "hi", requestId: "note-cy-00001" }));
  await rejects(sendNote(ben.k, c, { to: cy.id, text: "hi", requestId: "note-ben-0002" }), /between people in this community/);
  // A message sent around the community straight through the kernel is not shown as a note.
  await cy.k.proposeAction({ kind: "message.send", capability: "message.send", scope: sideScope(cy.id, c.communityId), targetRef: `actor:${ana.id}`, payload: { type: "INFORMATION_REQUEST", purpose: "community.note", community: c.communityId, text: "spam" }, idempotencyKey: "spam-1" })
    .then((id) => cy.k.enactAction(id));
  assert.equal((await notesForMe(ana.k, c)).length, 1);
});

it("is refused to agents, which act inside granted scopes", async () => {
  const { ben, botAs } = await setting();
  const benBot = (await saveBot(ben.k, { name: "Rex" }, "persona-community-ben")).avatar!.agent_id;
  const bot: Kernel = botAs(benBot);
  await assert.rejects(startCommunity(bot, { name: "Bot club", nonce: NONCE }), (e: unknown) => e instanceof KernelError);
});

it("lets a person's AI send notes for them only after they say so, and shows it was their AI", async () => {
  const { ana, ben, botAs } = await setting();
  const c = await startCommunity(ana.k, { name: "Builders", nonce: NONCE });
  const benBot = (await saveBot(ben.k, { name: "Rex" }, "persona-community-ben")).avatar!.agent_id;
  const asked = await askToJoin(ben.k, c, { bringBot: true, requestId: "ask-ben-0001" });
  await answerAsk(ana.k, c, { askId: asked.id, answer: "in" });
  const rex = botAs(benBot);

  await rejects(sendNote(rex, c, { to: ana.id, text: "Ben's bracket is ready.", requestId: "note-rex-0001" }), /grant|not authorized|denied|refused|message\.send/i);
  assert.equal(await aiSendsNotes(ben.k, c), null);
  await rejects(letAiSendNotes(ana.k, { ...c }, { on: true, requestId: "ai-ana-00001" }), /set up your bot/);

  await letAiSendNotes(ben.k, c, { on: true, requestId: "ai-ben-00001" });
  assert.ok((await aiSendsNotes(ben.k, c))?.until, "allowed, with an end date");
  await sendNote(rex, c, { to: ana.id, text: "Ben's bracket is ready.", requestId: "note-rex-0002" });
  const [note] = await notesForMe(ana.k, c);
  assert.deepEqual([note.from, note.fromId, note.via, note.text], ["Ben", ben.id, "Rex", "Ben's bracket is ready."]);

  // The AI can't reach someone outside, or pass itself off as anyone else's.
  await rejects(sendNote(rex, c, { to: benBot, text: "hi", requestId: "note-rex-0003" }), /between people/);

  await letAiSendNotes(ben.k, c, { on: false, requestId: "ai-ben-00002" });
  assert.equal(await aiSendsNotes(ben.k, c), null);
  await rejects(sendNote(rex, c, { to: ana.id, text: "again", requestId: "note-rex-0004" }));
});



it("only the owner can reversibly unlist a community without changing access or deleting work", async () => {
  const { ana, ben } = await setting();
  const c = await startCommunity(ana.k, { name: "Verification fixture", nonce: NONCE });
  const grants = await ana.k.myGrants();
  await assert.rejects(updateCommunity(ben.k, c, { directoryListed: false }), /Only the person who started/);
  await updateCommunity(ana.k, c, { directoryListed: false });
  assert.equal((await listCommunities(ben.k)).length, 0);
  const unlisted = await readCommunity(ana.k, c.communityId);
  assert.equal(unlisted?.directoryListed, false);
  assert.equal((await readCommunity(ben.k, c.communityId))?.name, c.name, "unlisting is discovery control, not a claim of privacy");
  assert.equal((await startCommunity(ana.k, { name: c.name, nonce: NONCE })).profileId, c.profileId, "retry cannot recreate an unlisted profile");
  assert.deepEqual(await ana.k.myGrants(), grants);
  await updateCommunity(ana.k, unlisted!, { directoryListed: true });
  assert.equal((await listCommunities(ben.k)).length, 1);
});
