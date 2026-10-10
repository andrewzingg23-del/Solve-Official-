import test from "node:test";
import assert from "node:assert/strict";
import { parseProjectDraft, validateProjectDraft, clearCreatedDraft, draftKey } from "../../lib/product/draft";

const id = "31a60816-1409-427f-8360-1466baf03bd6";
const draft = { id, title: "Zuber Pen", goal: "Design a prototype together." };

test("saved idea survives serialization and keeps its retry identity", () => {
  assert.deepEqual(parseProjectDraft(JSON.stringify(draft)), draft);
});

test("corrupted and oversized drafts cannot become project requests", () => {
  for (const raw of ["{", "null", "[]", JSON.stringify({ ...draft, id: "bad" }), JSON.stringify({ ...draft, title: "x".repeat(161) }), JSON.stringify({ ...draft, goal: "x".repeat(7001) })]) assert.equal(parseProjectDraft(raw), null);
  assert.equal(validateProjectDraft({ ...draft, goal: "hidden\u0000value" }).ok, false);
});

test("an unfinished local draft is readable but creating a project requires a title", () => {
  assert.deepEqual(parseProjectDraft(JSON.stringify({ ...draft, title: "" })), { ...draft, title: "" });
  assert.equal(validateProjectDraft({ ...draft, title: "  " }).ok, false);
  assert.deepEqual(validateProjectDraft({ ...draft, title: "  Zuber Pen  " }), { ok: true, draft });
});

test("drafts have separate account homes and a failed creation preserves the draft", () => {
  assert.notEqual(draftKey("ana"), draftKey("ben"));
  assert.notEqual(draftKey(null), draftKey("ana"));
  const storage = new Map([[draftKey("ana"), JSON.stringify(draft)]]);
  const store = { getItem: (key: string) => storage.get(key) ?? null, removeItem: (key: string) => { storage.delete(key); } };
  clearCreatedDraft(store, "ana", "different-world");
  assert.equal(storage.has(draftKey("ana")), true);
  clearCreatedDraft(store, "ana", id);
  assert.equal(storage.has(draftKey("ana")), false);
});

test("every permitted quoted, escaped and multiline idea survives storage", () => {
  for (const goal of ['"'.repeat(4100), '\\'.repeat(7000), ('A line\n\t').repeat(800)]) {
    const input = { ...draft, title: "Quoted idea", goal };
    assert.equal(validateProjectDraft(input).ok, true);
    assert.deepEqual(parseProjectDraft(JSON.stringify(input)), input);
  }
});
