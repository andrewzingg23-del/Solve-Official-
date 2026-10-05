// A member's own AI in a community, through the connector: it sees the communities its person is in
// and who is there, never a homeowner's contact details, and sends a note for its person only where
// they switched that on, always as itself.
import assert from "node:assert/strict";
import { it } from "node:test";
import { kernelClient, type Kernel } from "../../lib/kernel/client";
import { localSupabase } from "../../lib/kernel/local";
import { createConnector, type Session } from "../../lib/bot/connector";
import { approveConnection } from "../../lib/bot/memory";
import { saveBot } from "../../lib/bot/store";
import { answerAsk, askToJoin, letAiSendNotes, notesForMe, startCommunity } from "../../lib/community/community";
import { requestDesign } from "../../lib/solar/desk";
import { createKernelDb, service, user } from "../kernel/harness";

const CLAUDE = "00000000-0000-4000-8000-0000000c1a0d";
type Result = { content: { text: string }[]; isError?: boolean; structuredContent?: Record<string, unknown> };

async function setting() {
  const db = await createKernelDb();
  const person = async (auth: string, label: string) => {
    const k = kernelClient(localSupabase(db, user(auth)));
    return { k, id: await k.register(label) };
  };
  const ana = await person("auth:cc-ana", "Ana");
  const ben = await person("auth:cc-ben", "Ben");
  const dana = await person("auth:cc-dana", "Dana");
  const botAs = (agentId: string) => kernelClient(localSupabase(db, service), { actAs: agentId });
  const benBot = (await saveBot(ben.k, { name: "Rex" }, "persona-cc-ben")).avatar!.agent_id;
  await approveConnection(ben.k, ben.id, benBot, { clientId: CLAUDE, clientName: "Claude", mode: "remember" }, "cc-connect-ben");
  let n = 0;
  const call = async (k: Kernel, name: string, args: Record<string, unknown> = {}) => {
    const s: Session = { clientId: CLAUDE, person: k, botAs, appUrl: "https://sov.test" };
    return ((await createConnector(s).handle({ jsonrpc: "2.0", id: ++n, method: "tools/call", params: { name, arguments: args } })) as { result: Result }).result;
  };
  return { ana, ben, dana, benBot, call };
}

it("reads the person's communities and sends notes for them only where allowed", async () => {
  const { ana, ben, dana, call } = await setting();
  const c = await startCommunity(ana.k, { name: "Zest Solar", about: "Solar for Florida homes.", packs: ["solar"], nonce: "0b6f3c1e-8a2d-4f5b-9c7e-1d2e3f4a5b6c" });

  const before = await call(ben.k, "list_communities");
  assert.match(before.content[0].text, /in no communities yet[\s\S]*could ask to join[\s\S]*Zest Solar/);
  const outside = await call(ben.k, "read_community", { community_id: c.communityId });
  assert.equal(outside.isError, true);
  assert.match(outside.content[0].text, /not in Zest Solar.*ask to join/);

  const asked = await askToJoin(ben.k, c, { bringBot: true, requestId: "ask-ben-0001" });
  await answerAsk(ana.k, c, { askId: asked.id, answer: "in" });
  await requestDesign(dana.k, c, { name: "Dana Reyes", address: "120 Palm Way, Tampa, FL 33602", phone: "813 555 0142", monthlyBill: 240, consent: true }, "req-dana-0001");

  const read = await call(ben.k, "read_community", { community_id: c.communityId });
  assert.equal(read.isError, undefined);
  assert.match(read.content[0].text, /Who is in:[\s\S]*Ana \(started it\)[\s\S]*Ben \(builds\), with Rex, their AI/);
  assert.match(read.content[0].text, /Rex may not send notes/);
  assert.doesNotMatch(read.content[0].text, /Palm Way|555/, "a member never sees a homeowner's details");

  const refused = await call(ben.k, "send_note", { community_id: c.communityId, to: ana.id, text: "Bracket is ready." });
  assert.equal(refused.isError, true);
  assert.match(refused.content[0].text, /has not let Rex send notes in Zest Solar.*Nothing was sent/);

  await letAiSendNotes(ben.k, c, { on: true, requestId: "ai-ben-00001" });
  const sent = await call(ben.k, "send_note", { community_id: c.communityId, to: ana.id, text: "Bracket is ready." });
  assert.equal(sent.isError, undefined, sent.content[0].text);
  const again = await call(ben.k, "send_note", { community_id: c.communityId, to: ana.id, text: "Bracket is ready." });
  assert.equal(again.structuredContent?.note_id, sent.structuredContent?.note_id, "a retried call is one note");
  const notes = await notesForMe(ana.k, c);
  assert.deepEqual(notes.map((x) => [x.from, x.via, x.text]), [["Ben", "Rex", "Bracket is ready."]]);
});

it("tells the owner's AI what waits without handing over a homeowner's details", async () => {
  const { ana, dana, call } = await setting();
  const anaBot = (await saveBot(ana.k, { name: "Nova" }, "persona-cc-ana")).avatar!.agent_id;
  await approveConnection(ana.k, ana.id, anaBot, { clientId: CLAUDE, clientName: "Claude", mode: "read" }, "cc-connect-ana");
  const c = await startCommunity(ana.k, { name: "Zest Solar", packs: ["solar"], nonce: "0b6f3c1e-8a2d-4f5b-9c7e-1d2e3f4a5b6c" });
  await requestDesign(dana.k, c, { name: "Dana Reyes", address: "120 Palm Way, Tampa, FL 33602", phone: "813 555 0142", monthlyBill: 240, consent: true }, "req-dana-0001");
  await askToJoin(dana.k, c, { note: "I want to sell solar too.", requestId: "ask-dana-0001" });

  const listed = await call(ana.k, "list_communities");
  assert.match(listed.content[0].text, /Zest Solar \(the person started it; 1 asking to join, 1 requests waiting\)/);
  const read = await call(ana.k, "read_community", { community_id: c.communityId });
  assert.match(read.content[0].text, /Asking to join:[\s\S]*Dana: I want to sell solar too\./);
  assert.match(read.content[0].text, /Solar desk: 1 waiting on a design, 0 answered/);
  assert.doesNotMatch(read.content[0].text, /Palm Way|555|Reyes/);
  const readOnly = await call(ana.k, "send_note", { community_id: c.communityId, to: dana.id, text: "hi" });
  assert.match(readOnly.content[0].text, /read only/);
});
