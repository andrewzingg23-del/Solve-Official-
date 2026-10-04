// The bot's memory and connection records: input is cleaned before it is stored, forgetting hides a
// memory from every read, search finds by meaning-bearing words, and the latest decision about a
// connection is the one that counts.
import assert from "node:assert/strict";
import { it } from "node:test";
import { kernelClient } from "../../lib/kernel/client";
import { localSupabase } from "../../lib/kernel/local";
import {
  approveConnection,
  forgetMemory,
  MEMORY_LIMITS,
  normalizeMemoryInput,
  noteMemory,
  readConnections,
  readMemories,
  revokeConnection,
  searchMemories,
} from "../../lib/bot/memory";
import { saveBot } from "../../lib/bot/store";
import { createKernelDb, user } from "../kernel/harness";

it("cleans what it is asked to remember", () => {
  const n = normalizeMemoryInput({ text: `  hello\u0007 ${"x".repeat(3000)}`, source: { kind: "sorcery", title: "T", url: "ftp://example.com/a" } });
  assert.equal(n.text.length, MEMORY_LIMITS.text);
  assert.ok(n.text.startsWith("hello "), "control characters are removed");
  assert.deepEqual(n.source, { kind: "assistant", title: "T", url: null });
  assert.equal(normalizeMemoryInput({ text: "a", source: { kind: "web", url: "https://example.com/x?y=1" } }).source.url, "https://example.com/x?y=1");
});

it("hides forgotten memories, searches by words, and honors the latest connection decision", async () => {
  const db = await createKernelDb();
  const ana = kernelClient(localSupabase(db, user("auth:mem-ana")));
  const anaId = await ana.register("Ana");
  const bot = await saveBot(ana, { name: "Juno" }, "persona-request-9");
  const none = { client_id: null, client_name: null };

  const lisbon = await noteMemory(ana, anaId, { text: "Planning a trip to Lisbon in May.", source: { kind: "note", title: "Trips" } }, none, "m-1");
  await noteMemory(ana, anaId, { text: "Allergic to peanuts." }, none, "m-2");
  await noteMemory(ana, anaId, { text: "Lisbon hotel shortlist: Alfama, Baixa." }, none, "m-3");
  assert.deepEqual(searchMemories(await readMemories(ana, anaId), "lisbon trip").map((m) => m.text), ["Planning a trip to Lisbon in May.", "Lisbon hotel shortlist: Alfama, Baixa."]);

  await forgetMemory(ana, anaId, lisbon.id);
  await forgetMemory(ana, anaId, lisbon.id);
  const left = await readMemories(ana, anaId);
  assert.deepEqual(left.map((m) => m.text), ["Lisbon hotel shortlist: Alfama, Baixa.", "Allergic to peanuts."], "forgotten everywhere, newest first; forgetting twice is one record");

  const agent = bot.avatar!.agent_id;
  await approveConnection(ana, anaId, agent, { clientId: "client-a", clientName: "Claude", mode: "read" }, "c-1");
  await approveConnection(ana, anaId, agent, { clientId: "client-b", clientName: "ChatGPT", mode: "remember" }, "c-2");
  await approveConnection(ana, anaId, agent, { clientId: "client-a", clientName: "Claude", mode: "remember" }, "c-3");
  await revokeConnection(ana, anaId, "client-b", "c-4");
  const connections = await readConnections(ana, anaId);
  assert.deepEqual(connections.map((c) => [c.clientId, c.clientName, c.mode]), [["client-a", "Claude", "remember"]]);
  await approveConnection(ana, anaId, agent, { clientId: "client-b", clientName: "ChatGPT", mode: "read" }, "c-5");
  assert.equal((await readConnections(ana, anaId)).length, 2, "an assistant can be approved again after revocation");
});
