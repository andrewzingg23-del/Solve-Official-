// The Outreach Room's first slice: an assistant drafts outreach to real businesses with the page
// where it found each. Only the person approves a message. On the Practice channel, approving
// records exactly what would be sent and nothing leaves solve. Every message carries who it is from
// and a way to say no.
import assert from "node:assert/strict";
import { it } from "node:test";
import { kernelClient, type Kernel } from "../../lib/kernel/client";
import { localSupabase } from "../../lib/kernel/local";
import { createConnector, type Session } from "../../lib/bot/connector";
import { approveConnection } from "../../lib/bot/memory";
import { approveAndSend, encodeOutreach, finalMessage, OPT_OUT, outcomesIn, parseOutreach, recordOutcome, SEND_CAPABILITY, sentIn } from "../../lib/bot/outreach";
import { saveBot } from "../../lib/bot/store";
import { waitingOn } from "../../lib/bot/waiting";
import { setBotAccess, WorldInputError } from "../../lib/bot/worlds";
import { createCreativeWorld } from "../../lib/world/creative";
import { createKernelDb, service, user } from "../kernel/harness";

const LEADS = [
  { name: "Inkwell Print Co.", why: "Prints posters and runs a maker night", source: "https://inkwell.example/about", contact: "contact form on their site", message: "Hi Inkwell team, I saw your maker night..." },
  { name: "Northside Fab Lab", why: "Community 3D printing", source: "https://northside.example", message: "Hello! Your open lab hours caught my eye..." },
];

it("checks drafts: a real source for every business, the sign-off and opt-out always added", () => {
  const body = encodeOutreach({ goal: "Find two print shops to pilot solve", from: "Andrew, founder of solve", leads: LEADS });
  const o = parseOutreach(body)!;
  assert.equal(o.leads.length, 2);
  assert.equal(finalMessage(o, o.leads[0]), `${LEADS[0].message}\n\nAndrew, founder of solve\n${OPT_OUT}`);
  assert.throws(() => encodeOutreach({ goal: "x", from: "A", leads: [{ ...LEADS[0], source: "" }] }), /public page where it was found/);
  assert.throws(() => encodeOutreach({ goal: "x", from: "A", leads: [{ ...LEADS[0], source: "javascript:alert(1)" }] }), /https:\/\/ or http:\/\//);
  assert.throws(() => encodeOutreach({ goal: "x", from: "", leads: LEADS }), /who the messages are from/);
  assert.throws(() => encodeOutreach({ goal: "x", from: "A", leads: Array.from({ length: 21 }, () => LEADS[0]) }), /at most 20/);
  assert.equal(parseOutreach("SOV_OUTREACH_V1\n" + JSON.stringify({ goal: "x", from: "A", leads: [{ ...LEADS[0], source: "javascript:x" }] })), null, "a hand-edited piece is checked again");
});

it("lets the bot draft, and only the person approve; Practice sends nothing outside solve", async () => {
  const db = await createKernelDb();
  const ana = kernelClient(localSupabase(db, user("auth:outreach-ana")));
  const ben = kernelClient(localSupabase(db, user("auth:outreach-ben")));
  const anaId = await ana.register("Ana");
  const benId = await ben.register("Ben");
  const anaBot = (await saveBot(ana, { name: "Nova" }, "persona-outreach-ana")).avatar!.agent_id;
  const botAs = (agentId: string) => kernelClient(localSupabase(db, service), { actAs: agentId });
  const clientId = "00000000-0000-4000-8000-0000000c1a12";
  await approveConnection(ana, anaId, anaBot, { clientId, clientName: "Claude", mode: "remember" }, "outreach-connect");
  const call = async (person: Kernel, name: string, args: Record<string, unknown>) => {
    const s: Session = { clientId, person, botAs, appUrl: "https://sov.test" };
    return ((await createConnector(s).handle({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } })) as { result: { content: { text: string }[]; structuredContent?: Record<string, unknown> } }).result;
  };
  const world = await createCreativeWorld(ana, { worldId: "9c1d2c3b-4a59-4687-9a0b-1c2d3e4f5ab0", title: "Pilot users" });
  await setBotAccess(ana, { scope: world.scope, botAgentId: anaBot, access: "add" }, "in");
  await ana.issueGrant({ grantee: benId, capability: "kernel.read", scope: world.scope });

  const bad = await call(ana, "propose_outreach", { world_id: world.worldId, goal: "Pilots", from: "Andrew", leads: [{ name: "Made Up Ltd", message: "Hi", source: "" }] });
  assert.match(bad.content[0].text, /^Nothing was written: "Made Up Ltd" needs the public page where it was found/);
  const drafted = await call(ana, "propose_outreach", { world_id: world.worldId, goal: "Find two print shops to pilot solve", from: "Andrew, founder of solve", leads: LEADS });
  assert.match(drafted.content[0].text, /^Drafted 2 messages for "Find two print shops to pilot solve"\. Nothing is sent: the person approves each one here/);
  const pieceId = (drafted.structuredContent as { artifact_id: string }).artifact_id;

  const worlds = [{ worldId: world.worldId, title: world.title, scope: world.scope }];
  assert.deepEqual((await waitingOn(ana, worlds, anaId)).map((w) => [w.kind, w.kind === "approve" ? w.pending : 0]), [["approve", 2]]);
  assert.deepEqual(await waitingOn(ben, worlds, benId), [], "a member who can only read is not asked to approve");

  const bot = botAs(anaBot);
  await assert.rejects(approveAndSend(bot, { worldId: world.worldId, pieceId, lead: 0 }), (e: Error) => e.name === "forbidden", "the bot cannot approve its own drafts");
  await assert.rejects(approveAndSend(ben, { worldId: world.worldId, pieceId, lead: 0 }), (e: Error) => e.name === "forbidden");
  await assert.rejects(approveAndSend(ana, { worldId: world.worldId, pieceId, lead: 7 }), WorldInputError);

  const sent = await approveAndSend(ana, { worldId: world.worldId, pieceId, lead: 0 });
  assert.deepEqual([sent.lead, sent.channel, sent.by], [0, "practice", anaId]);
  const again = await approveAndSend(ana, { worldId: world.worldId, pieceId, lead: 0 });
  assert.equal(again.taskId, sent.taskId, "approving twice is one approval");
  const task = (await ana.readTasks(world.scope)).find((t) => t.task_id === sent.taskId)!;
  assert.deepEqual([task.status, task.required_capability, task.created_by], ["completed", SEND_CAPABILITY, anaId]);
  assert.deepEqual([task.result?.channel, task.result?.sent_outside_solve], ["practice", false]);
  assert.match(String(task.result?.message), /If this isn't useful, reply "no"/);
  assert.equal((await sentIn(ben, world.scope)).get(pieceId)?.size, 1, "a member who can read sees what was approved");

  assert.deepEqual((await waitingOn(ana, worlds, anaId)).map((w) => [w.kind, w.kind === "approve" ? w.pending : 0]), [["approve", 1]]);
  const read = await call(ana, "read_world", { world_id: world.worldId });
  assert.match(read.content[0].text, /outreach for: Find two print shops to pilot solve: 2 drafted messages \(0\. Inkwell Print Co\.; 1\. Northside Fab Lab\), 1 approved by the person and recorded in Practice \(not sent outside solve\)/);
  const revise = await call(ana, "propose_outreach", { world_id: world.worldId, goal: "Other", from: "Andrew", leads: LEADS, artifact_id: pieceId });
  assert.match(revise.content[0].text, /already approved, so the outreach stays as it was/);
});

it("shows each message as it would go out, labeled Practice, with approve only where it's still waiting", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { OutreachCard } = await import("../../app/outreach-card");
  const outreach = parseOutreach(encodeOutreach({ goal: "Find two print shops to pilot solve", from: "Andrew, founder of solve", leads: LEADS }))!;
  const html = renderToStaticMarkup(OutreachCard({ pieceId: "p", outreach, sent: new Map([[0, { taskId: "t", lead: 0, channel: "practice" as const, at: "2026-10-05T05:00:00Z", by: "a" }]]), approve: async () => {} }));
  assert.match(html, /Outreach · 1 of 2 approved/);
  assert.match(html, /Practice/);
  assert.match(html, /found on inkwell\.example/);
  assert.match(html, /Andrew, founder of solve\nIf this isn&#x27;t useful, reply &quot;no&quot;/);
  assert.match(html, /Approved · recorded in Practice, not sent · Oct 5/);
  assert.equal(html.match(/Approve this message/g)?.length, 1);
  assert.doesNotMatch(html, /bg-accent/, "a draft or a Practice send never carries the point");
});

it("records what happened on the person's word, and never contacts a business that said no again", async () => {
  const db = await createKernelDb();
  const ana = kernelClient(localSupabase(db, user("auth:outcome-ana")));
  const ben = kernelClient(localSupabase(db, user("auth:outcome-ben")));
  const anaId = await ana.register("Ana");
  const benId = await ben.register("Ben");
  const anaBot = (await saveBot(ana, { name: "Nova" }, "persona-outcome-ana")).avatar!.agent_id;
  const botAs = (agentId: string) => kernelClient(localSupabase(db, service), { actAs: agentId });
  const clientId = "00000000-0000-4000-8000-0000000c1a13";
  await approveConnection(ana, anaId, anaBot, { clientId, clientName: "Claude", mode: "remember" }, "outcome-connect");
  const call = async (name: string, args: Record<string, unknown>) => {
    const s: Session = { clientId, person: ana, botAs, appUrl: "https://sov.test" };
    return ((await createConnector(s).handle({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } })) as { result: { content: { text: string }[]; isError?: boolean; structuredContent?: Record<string, unknown> } }).result;
  };
  const world = await createCreativeWorld(ana, { worldId: "9c1d2c3b-4a59-4687-9a0b-1c2d3e4f5ac0", title: "Pilot users" });
  await setBotAccess(ana, { scope: world.scope, botAgentId: anaBot, access: "add" }, "in");
  await ana.issueGrant({ grantee: benId, capability: "kernel.read", scope: world.scope });
  const pieceId = ((await call("propose_outreach", { world_id: world.worldId, goal: "Pilots", from: "Andrew, founder of solve", leads: LEADS })).structuredContent as { artifact_id: string }).artifact_id;
  const at = { worldId: world.worldId, pieceId, ownerId: anaId };

  await assert.rejects(recordOutcome(ana, { ...at, lead: 0, outcome: "replied" }, "r0"), /hasn't been approved/);
  await approveAndSend(ana, { worldId: world.worldId, pieceId, lead: 0 });
  await assert.rejects(recordOutcome(ana, { ...at, lead: 0, outcome: "loved it" }, "r1"), /must be one of/);
  const replied = await recordOutcome(ana, { ...at, lead: 0, outcome: "replied", note: "Interested, wants a call" }, "r2");
  assert.deepEqual([replied.outcome, replied.basis, replied.note, replied.by], ["replied", "self_reported", "Interested, wants a call", anaId]);
  assert.equal((await recordOutcome(ana, { ...at, lead: 0, outcome: "replied", note: "Interested, wants a call" }, "r2")).number, replied.number, "a retried record is one record");
  await assert.rejects(recordOutcome(ben, { ...at, lead: 0, outcome: "won" }, "r3"), (e: Error) => e.name === "forbidden", "a member who can only read records nothing");

  const byBot = await call("record_outcome", { world_id: world.worldId, artifact_id: pieceId, lead: 0, outcome: "meeting", note: "Thursday at 10" });
  assert.match(byBot.content[0].text, /^Recorded: Meeting booked, on the person's word\./);
  assert.equal((byBot.structuredContent as { verified: boolean }).verified, false);
  assert.deepEqual((await outcomesIn(ben, world.scope)).get(pieceId)?.get(0)?.map((o) => o.outcome), ["replied", "meeting"], "a member who can read sees what happened");

  await approveAndSend(ana, { worldId: world.worldId, pieceId, lead: 1 });
  await recordOutcome(ana, { ...at, lead: 1, outcome: "said_no" }, "r4");
  const redraft = await call("propose_outreach", { world_id: world.worldId, goal: "Pilots again", from: "Andrew", leads: [{ ...LEADS[1], message: "Second try" }] });
  assert.match(redraft.content[0].text, /Northside Fab Lab said no before, so they can't be drafted again/);
  const sameSite = encodeOutreach({ goal: "x", from: "Andrew", leads: [{ name: "Northside Lab (new name)", source: "https://www.northside.example/contact", message: "Hi" }] });
  const sneaky = (await ana.readTasks(world.scope)).length;
  const other = await call("add_to_world", { world_id: world.worldId, title: "Hand-made outreach", body: sameSite });
  const otherId = (other.structuredContent as { artifact_id: string }).artifact_id;
  await assert.rejects(approveAndSend(ana, { worldId: world.worldId, pieceId: otherId, lead: 0 }), /said no, so solve won't send to them again/, "the same site under a new name is still a no");
  assert.equal((await ana.readTasks(world.scope)).length, sneaky, "nothing was recorded for it");

  const read = await call("read_world", { world_id: world.worldId });
  assert.match(read.content[0].text, /outcomes on the person's word: Inkwell Print Co\.: meeting; Northside Fab Lab: said_no/);
});

it("shows outcomes on the card, and offers no more recording after a no", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { OutreachCard } = await import("../../app/outreach-card");
  const outreach = parseOutreach(encodeOutreach({ goal: "Pilots", from: "Andrew", leads: LEADS }))!;
  const sentAt = (lead: number) => ({ taskId: `t${lead}`, lead, channel: "practice" as const, at: "2026-10-05T05:00:00Z", by: "a" });
  const outcome = (o: "replied" | "said_no", note = "") => ({ outcome: o, note, at: "2026-10-05T06:00:00Z", basis: "self_reported" as const, by: "a", number: 7 });
  const html = renderToStaticMarkup(OutreachCard({
    pieceId: "p", outreach,
    sent: new Map([[0, sentAt(0)], [1, sentAt(1)]]),
    outcomes: new Map([[0, [outcome("replied", "Wants a call")]], [1, [outcome("said_no")]]]),
    approve: async () => {}, record: async () => {},
  }));
  assert.match(html, /Outreach · 2 of 2 approved · 1 replied · 1 said no/);
  assert.match(html, /Replied · on your word · Oct 5.*Wants a call/);
  assert.match(html, /Said no · on your word · Oct 5.*won&#x27;t be contacted again from this World/);
  assert.equal(html.match(/>Record</g)?.length, 1, "no more recording for a business that said no");
});

