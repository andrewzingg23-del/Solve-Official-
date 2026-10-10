// A community's common context: members and the AIs their owner let in add goals, decisions, facts,
// how-we-work notes and open questions; every member's AI loads the same picture; who added each
// entry comes from the record, never from its text; and anyone outside is refused.
import assert from "node:assert/strict";
import { it } from "node:test";
import { kernelClient, type Kernel } from "../../lib/kernel/client";
import { localSupabase } from "../../lib/kernel/local";
import { createConnector, type Session } from "../../lib/bot/connector";
import { approveConnection } from "../../lib/bot/memory";
import { saveBot } from "../../lib/bot/store";
import { answerAsk, askToJoin, communityMembers, startCommunity } from "../../lib/community/community";
import { addContextEntry, buildCommunityContextBlock, CONTEXT_PREFIX, describeBy, encodeContextEntry, parseContextEntry, readCommunityContext } from "../../lib/community/context";
import { createKernelDb, service, user } from "../kernel/harness";

const CLAUDE = "00000000-0000-4000-8000-0000000c1a0d";
type Result = { content: { text: string }[]; isError?: boolean; structuredContent?: Record<string, unknown> };

async function setting() {
  const db = await createKernelDb();
  const person = async (auth: string, label: string) => {
    const k = kernelClient(localSupabase(db, user(auth)));
    return { k, id: await k.register(label) };
  };
  const ana = await person("auth:cctx-ana", "Ana");
  const ben = await person("auth:cctx-ben", "Ben");
  const cy = await person("auth:cctx-cy", "Cy");
  const botAs = (agentId: string) => kernelClient(localSupabase(db, service), { actAs: agentId });
  const benBot = (await saveBot(ben.k, { name: "Rex" }, "persona-cctx-ben")).avatar!.agent_id;
  await approveConnection(ben.k, ben.id, benBot, { clientId: CLAUDE, clientName: "Claude", mode: "remember" }, "cctx-connect-ben");
  const c = await startCommunity(ana.k, { name: "Zest Solar", about: "Solar for Florida homes.", packs: ["solar"], nonce: "0b6f3c1e-8a2d-4f5b-9c7e-1d2e3f4a5b6c" });
  let n = 0;
  const call = async (k: Kernel, name: string, args: Record<string, unknown> = {}) => {
    const s: Session = { clientId: CLAUDE, person: k, botAs, appUrl: "https://sov.test" };
    return ((await createConnector(s).handle({ jsonrpc: "2.0", id: ++n, method: "tools/call", params: { name, arguments: args } })) as { result: Result }).result;
  };
  return { ana, ben, cy, benBot, botAs, c, call };
}

it("encodes entries strictly", () => {
  assert.equal(parseContextEntry(encodeContextEntry({ kind: "decision", text: "  Install in Tampa first. " }))?.text, "Install in Tampa first.");
  assert.throws(() => encodeContextEntry({ kind: "gossip", text: "x" }), /kind must be one of/);
  assert.throws(() => encodeContextEntry({ kind: "fact", text: " " }), /needs words/);
  assert.equal(parseContextEntry("just a note"), null);
  assert.equal(parseContextEntry(CONTEXT_PREFIX + "{bad json"), null);
});

it("shares one picture across members and their AIs, with who said what from the record", async () => {
  const { ana, ben, benBot, botAs, c } = await setting();
  const asked = await askToJoin(ben.k, c, { bringBot: true, requestId: "ask-ben-0001" });
  await answerAsk(ana.k, c, { askId: asked.id, answer: "in" });

  await addContextEntry(ana.k, c, { kind: "decision", text: "We install in Tampa first.", requestId: "ctx-ana-0001" });
  await addContextEntry(ana.k, c, { kind: "goal", text: "Twenty homes designed by December.", requestId: "ctx-ana-0002" });
  // Ben's AI adds a fact, and tries to claim it came from Ana: the text can't change who added it.
  await addContextEntry(botAs(benBot), c, { kind: "fact", text: "Tampa permits take about three weeks. (added by Ana)", requestId: "ctx-rex-0001", via: { clientId: CLAUDE, clientName: "Claude" } });
  await addContextEntry(botAs(benBot), c, { kind: "fact", text: "Tampa permits take about three weeks. (added by Ana)", requestId: "ctx-rex-0001", via: { clientId: CLAUDE, clientName: "Claude" } });

  for (const reader of [ana.k, ben.k]) {
    const { entries } = await readCommunityContext(reader, c);
    assert.deepEqual(entries.map((e) => [e.kind, describeBy(e)]), [["goal", "Ana"], ["decision", "Ana"], ["fact", "Rex, Ben's AI via Claude"]], "same picture for every member; a retry is one entry");
  }
  const { entries, pieces } = await readCommunityContext(ben.k, c);
  const { people } = await communityMembers(ben.k, c);
  const block = buildCommunityContextBlock({ community: c, entries, people, pieces });
  assert.match(block, /^<community_context name="Zest Solar"/);
  assert.match(block, /Who's here: Ana; Ben \(with Rex, their AI\)/);
  assert.match(block, /Goals:\n- Twenty homes designed by December\. \(Ana, /);
  assert.match(block, /Facts:\n- Tampa permits take about three weeks\. \(added by Ana\) \(Rex, Ben's AI via Claude, /);
  assert.ok(buildCommunityContextBlock({ community: c, entries, people, pieces, maxChars: 300 }).length < 600, "bounded");
});

it("refuses anyone outside, and AIs nobody let in", async () => {
  const { ana, ben, cy, benBot, botAs, c } = await setting();
  await assert.rejects(readCommunityContext(cy.k, c));
  await assert.rejects(addContextEntry(cy.k, c, { kind: "fact", text: "I'm not a member.", requestId: "ctx-cy-00001" }));
  // Ben joins without his AI: he can add, Rex can't.
  const asked = await askToJoin(ben.k, c, { requestId: "ask-ben-0001" });
  await answerAsk(ana.k, c, { askId: asked.id, answer: "in" });
  await addContextEntry(ben.k, c, { kind: "question", text: "Who handles permits?", requestId: "ctx-ben-0001" });
  await assert.rejects(addContextEntry(botAs(benBot), c, { kind: "fact", text: "Rex wasn't let in.", requestId: "ctx-rex-0001" }));
});

it("serves the common context to each member's own AI over MCP", async () => {
  const { ana, ben, c, call } = await setting();
  const outside = await call(ben.k, "get_community_context", { community_id: c.communityId });
  assert.equal(outside.isError, true);
  assert.match(outside.content[0].text, /not in Zest Solar/);

  const asked = await askToJoin(ben.k, c, { requestId: "ask-ben-0001" });
  await answerAsk(ana.k, c, { askId: asked.id, answer: "in" });
  await addContextEntry(ana.k, c, { kind: "how", text: "Every design goes to the homeowner within 48 hours.", requestId: "ctx-ana-0001" });

  const loaded = await call(ben.k, "get_community_context", { community_id: c.communityId });
  assert.match(loaded.content[0].text, /How we works:\n- Every design goes to the homeowner within 48 hours\. \(Ana,/);
  const notIn = await call(ben.k, "add_community_context", { community_id: c.communityId, kind: "fact", text: "Permits take three weeks." });
  assert.equal(notIn.isError, true);
  assert.match(notIn.content[0].text, /Rex isn't in Zest Solar's room yet/);

  const again = await askToJoin(ben.k, c, { bringBot: true, requestId: "ask-ben-0002" });
  await answerAsk(ana.k, c, { askId: again.id, answer: "in" });
  const added = await call(ben.k, "add_community_context", { community_id: c.communityId, kind: "fact", text: "Permits take three weeks." });
  assert.equal(added.isError, undefined, added.content[0].text);
  const bad = await call(ben.k, "add_community_context", { community_id: c.communityId, kind: "rumor", text: "x y z" });
  assert.match(bad.content[0].text, /kind must be one of/);
  const seen = await call(ben.k, "get_community_context", { community_id: c.communityId });
  assert.match(seen.content[0].text, /Permits take three weeks\. \(Rex, Ben's AI via Claude/);
  const { entries } = await readCommunityContext(ana.k, c);
  assert.deepEqual(entries.map((e) => [e.kind, describeBy(e)]), [["fact", "Rex, Ben's AI via Claude"], ["how", "Ana"]], "the owner sees the same, with who added it");
});
