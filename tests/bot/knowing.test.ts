// "What I already know about you" only says what it can stand behind: every line cites memories it
// was given, invented citations and malformed answers are dropped, nothing sensitive is asked
// for, and "Keep this" records whose words they were and which model said them.
import assert from "node:assert/strict";
import { it } from "node:test";
import type { Memory } from "../../lib/bot/memory";
import { brainsFrom, buildKnowingPrompt, keepInput, knowingMemories, parseKnowing } from "../../lib/bot/knowing";

const mem = (id: string, text: string, extra: Partial<Memory> = {}): Memory => ({
  id,
  text,
  source: { kind: "assistant", title: null, url: null },
  via: { client_id: null, client_name: null },
  by: "x",
  at: "2026-10-01T00:00:00Z",
  sealed: true,
  ...extra,
});

it("reads imported history and connected AIs first, and numbers what it shows the model", () => {
  const memories = [mem("t", "said in talk", { source: { kind: "person", title: "Talk", url: null } }), mem("c", "via claude", { via: { client_id: "1", client_name: "Claude" } }), mem("i", "imported", { source: { kind: "import", title: "ChatGPT", url: null } })];
  assert.deepEqual(knowingMemories(memories).map((m) => m.id), ["i", "c", "t"]);
  const { system, user, ids } = buildKnowingPrompt("Nova", knowingMemories(memories));
  assert.deepEqual([...ids.keys()], ["m1", "m2", "m3"]);
  assert.equal(ids.get("m1")?.id, "i");
  assert.match(user, /^<memories>\n\[m1\] imported \(Imported · ChatGPT\)/);
  assert.match(system, /must cite/);
  assert.match(system, /Never infer health, religion, politics, sexuality or money troubles/);
});

it("keeps only facts that cite real memories", () => {
  const { ids } = buildKnowingPrompt("Nova", [mem("a", "Zest Solar in Tampa"), mem("b", "Hates long meetings")]);
  const raw = "```json\n" + JSON.stringify({
    facts: [
      { text: "You're building Zest Solar in Tampa.", sources: ["m1", "m1"] },
      { text: "You keep meetings short.", sources: ["m2", "m9"] },
      { text: "You secretly want to move to Paris.", sources: ["m7"] },
      { text: "No sources at all.", sources: [] },
      { text: "x", sources: ["m1"] },
      "nonsense",
    ],
  }) + "\n```";
  const facts = parseKnowing(raw, ids);
  assert.deepEqual(facts.map((f) => f.text), ["You're building Zest Solar in Tampa.", "You keep meetings short."]);
  assert.deepEqual(facts[0].sources.map((s) => s.id), ["a"], "repeats collapse");
  assert.deepEqual(facts[1].sources.map((s) => s.id), ["b"], "invented citations drop");
  assert.equal(facts[0].sources[0].excerpt, "Zest Solar in Tampa");
  assert.deepEqual(parseKnowing("I can't do that.", ids), []);
  assert.deepEqual(parseKnowing('{"facts": "no"}', ids), []);
});

it("shows what feeds the avatar", () => {
  const brains = brainsFrom([
    mem("1", "a", { source: { kind: "import", title: "ChatGPT", url: null } }),
    mem("2", "b", { source: { kind: "import", title: "Other chat", url: null } }),
    mem("3", "c", { via: { client_id: "x", client_name: "Claude" } }),
  ]);
  assert.deepEqual(brains, [{ label: "Imported history", count: 2 }, { label: "Claude", count: 1 }]);
});

it("keeps a line from Talk as the person's words or the avatar's, with the model", () => {
  assert.deepEqual(keepInput({ text: "  Call the installer Monday.  ", from: "you" }), {
    text: "Call the installer Monday.",
    source: { kind: "person", title: "Talk" },
    via: { client_id: null, client_name: null },
  });
  assert.equal(keepInput({ text: "Try the south roof.", from: "bot", model: "Claude Haiku 4.5" })?.via.client_name, "Talk · Claude Haiku 4.5");
  assert.equal(keepInput({ text: "Try the south roof.", from: "bot" })?.via.client_name, "Talk · your avatar");
  assert.equal(keepInput({ text: "   " }), null);
  assert.equal(keepInput("text"), null);
});
