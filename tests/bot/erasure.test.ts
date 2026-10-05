// Kernel v5, erasable content, through the bot's memory: history holds a memory's sealed words but
// never its key; only someone who may read the event may unseal it; erasing destroys the key for
// good and is itself recorded; nobody can seal another person's event, re-seal an erased one or
// reach the key store directly; and a full read pages through every memory.
import assert from "node:assert/strict";
import { it } from "node:test";
import { KernelError, kernelClient } from "../../lib/kernel/client";
import { localSupabase } from "../../lib/kernel/local";
import {
  approveConnection,
  forgetMemory,
  KEY_DESTROYED,
  MEMORY_FORGOTTEN,
  MEMORY_NOTED,
  memoryScope,
  noteMemory,
  readAllMemories,
  readMemories,
} from "../../lib/bot/memory";
import { saveBot } from "../../lib/bot/store";
import { anon, createKernelDb, service, sqlstate, user } from "../kernel/harness";

const none = { client_id: null, client_name: null };
const refused = (name: string) => (error: unknown) => {
  if (error instanceof KernelError && error.name === name) return true;
  throw error;
};

async function setting() {
  const db = await createKernelDb();
  const ana = kernelClient(localSupabase(db, user("auth:erase-ana")));
  const ben = kernelClient(localSupabase(db, user("auth:erase-ben")));
  const anaId = await ana.register("Ana");
  await ben.register("Ben");
  const bot = await saveBot(ana, { name: "Juno" }, "persona-erase-1");
  return { db, ana, ben, anaId, bot };
}

it("seals each memory, and erasing it destroys its words for good", async () => {
  const { db, ana, anaId } = await setting();
  const m = await noteMemory(ana, anaId, { text: "My sister Ines lives in Porto.", source: { kind: "note", title: "Family", url: "https://example.com/family" } }, none);

  const [event] = await ana.readEvents(memoryScope(anaId), { newestFirst: true, limit: 1 });
  assert.equal(event.id, m.id);
  assert.deepEqual(Object.keys(event.payload).sort(), ["sealed", "source", "via"]);
  const [raw] = await db.owner("select payload::text as p from kernel.events where id = $1", [m.id]);
  assert.doesNotMatch(String(raw.p), /Ines|Porto|Family|example\.com/, "history holds no words, title or link");
  const [memory] = await readMemories(ana, anaId);
  assert.deepEqual([memory.text, memory.source, memory.sealed], ["My sister Ines lives in Porto.", { kind: "note", title: "Family", url: "https://example.com/family" }, true]);
  const [{ key }] = await ana.unsealKeys([m.id]);

  await forgetMemory(ana, anaId, m.id);
  await forgetMemory(ana, anaId, m.id);
  assert.deepEqual(await readMemories(ana, anaId), []);
  assert.deepEqual(await ana.unsealKeys([m.id]), []);
  const [stored] = await db.owner("select count(*)::int as n from kernel_keys.event_keys where event_id = $1", [m.id]);
  assert.equal(stored.n, 0, "the key is deleted, not hidden");
  const types = (await ana.readEvents(memoryScope(anaId))).map((e) => e.type);
  assert.deepEqual(types, [MEMORY_NOTED, KEY_DESTROYED, MEMORY_FORGOTTEN], "erasing twice is one record of each");
  await assert.rejects(ana.sealKey(m.id, key), refused("conflict"), "an erased memory can never be sealed again");
});

it("lets only the recorder seal, only readers unseal, and only the owner erase", async () => {
  const { db, ana, ben, anaId, bot } = await setting();
  const agent = bot.avatar!.agent_id;
  const asBot = kernelClient(localSupabase(db, service), { actAs: agent });
  await approveConnection(ana, anaId, agent, { clientId: "client-c", clientName: "Claude", mode: "remember" }, "erase-connect-1");
  const viaClaude = { client_id: "client-c", client_name: "Claude" };

  const byBot = await noteMemory(asBot, anaId, { text: "Ana is training for a half marathon." }, viaClaude);
  const [first] = await readMemories(ana, anaId);
  assert.deepEqual([first.text, first.by, first.sealed], ["Ana is training for a half marathon.", agent, true], "the owner reads what the bot sealed");
  assert.equal((await noteMemory(asBot, anaId, { text: "Ana is training for a half marathon." }, viaClaude)).duplicate, true, "a retried call is the same memory");
  assert.equal((await readMemories(asBot, anaId)).length, 1, "the bot reads its owner's memories too");

  const [{ key }] = await ana.unsealKeys([byBot.id]);
  await asBot.sealKey(byBot.id, key);
  const other = "A".repeat(43) + "=";
  await assert.rejects(asBot.sealKey(byBot.id, other), refused("conflict"), "an event has one key");
  await assert.rejects(ana.sealKey(byBot.id, key), refused("forbidden"), "only the actor who recorded an event seals it");
  await assert.rejects(ben.sealKey(byBot.id, key), refused("forbidden"));
  await assert.rejects(asBot.sealKey(byBot.id, "not-a-key"), refused("invalid"));
  await assert.rejects(ana.unsealKeys(Array.from({ length: 1001 }, () => byBot.id)), refused("invalid"));

  assert.deepEqual(await ben.unsealKeys([byBot.id]), [], "someone who cannot read the event gets no key");
  await assert.rejects(ben.destroyKey(byBot.id), refused("forbidden"));
  await assert.rejects(asBot.destroyKey(byBot.id), refused("forbidden"), "a bot cannot erase its owner's memories");
  await forgetMemory(ana, anaId, byBot.id);
  assert.deepEqual(await readMemories(ana, anaId), []);

  for (const session of [anon, user("auth:erase-ana"), service]) {
    await assert.rejects(db.as(session, "select * from kernel_keys.event_keys"), sqlstate("42501"));
    await assert.rejects(db.as(session, "delete from kernel_keys.destroyed_keys"), sqlstate("42501"));
  }
  await assert.rejects(db.rpc(anon, "unseal_keys", { p_event_ids: [byBot.id] }), sqlstate("42501"));
});

it("reads every memory page by page, and says when a history is too long to read whole", async () => {
  const { ana, anaId } = await setting();
  for (const text of ["one", "two", "three", "four", "five"]) await noteMemory(ana, anaId, { text }, none);
  const all = await readAllMemories(ana, anaId, { page: 2 });
  assert.equal(all.complete, true);
  assert.deepEqual(all.memories.map((m) => m.text), ["five", "four", "three", "two", "one"]);
  const capped = await readAllMemories(ana, anaId, { page: 2, maxEvents: 4 });
  assert.equal(capped.complete, false);
  assert.equal(capped.memories.length, 4);
});
