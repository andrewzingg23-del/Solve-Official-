import test from "node:test";
import assert from "node:assert/strict";
import { sameDisplayedAccount, ACCOUNT_CHANGED } from "../../lib/product/account-guard";
import { clearCreatedDraft, draftKey, parseProjectDraft, validateProjectDraft } from "../../lib/product/draft";

const ownerA = "user-alice";
const ownerB = "user-bob";
const idA = "31a60816-1409-427f-8360-1466baf03bd6";
const idB = "dca0dca0-1111-4111-8111-111111111111";
const a = { id: idA, title: "Alice's project", goal: "Build together" };
const b = { id: idB, title: "Bob's project", goal: "Keep separate" };

test("project creation requires the same authenticated actor that the page displayed", () => {
  assert.equal(sameDisplayedAccount(ownerA, ownerA), true);
  for (const expected of [ownerB, "", null, undefined, {}, 0]) {
    assert.equal(sameDisplayedAccount(expected, ownerA), false);
  }
  for (const current of [ownerB, null, undefined]) {
    assert.equal(sameDisplayedAccount(ownerA, current), false);
  }
  assert.match(ACCOUNT_CHANGED, /draft is still here/i);
});

test("successful creation clears only the matching account's matching project draft", () => {
  const data = new Map<string, string>([
    [draftKey(ownerA), JSON.stringify(a)],
    [draftKey(ownerB), JSON.stringify(b)],
    [draftKey(null), JSON.stringify(a)],
  ]);
  const removed: string[] = [];
  const storage = {
    getItem(key: string) { return data.get(key) ?? null; },
    removeItem(key: string) { removed.push(key); data.delete(key); },
  };

  clearCreatedDraft(storage, ownerA, idB);
  assert.deepEqual(removed, [], "another project ID must not clear this draft");

  clearCreatedDraft(storage, ownerA, idA);
  assert.deepEqual(removed, [draftKey(ownerA)]);
  assert.equal(data.has(draftKey(ownerB)), true, "other account must be untouched");
  assert.equal(data.has(draftKey(null)), true, "guest draft must be untouched");

  clearCreatedDraft(storage, ownerB, idA);
  assert.equal(data.has(draftKey(ownerB)), true);
  clearCreatedDraft(storage, ownerB, idB);
  assert.equal(data.has(draftKey(ownerB)), false);
});

test("malformed local storage is not cleared by a coincidental creation ID", () => {
  const key = draftKey(ownerA);
  const data = new Map([[key, '{"id":"not-a-uuid","title":"bad"}']]);
  let removes = 0;
  const storage = {
    getItem(k: string) { return data.get(k) ?? null; },
    removeItem(k: string) { removes++; data.delete(k); },
  };
  assert.equal(parseProjectDraft(data.get(key)!), null);
  clearCreatedDraft(storage, ownerA, idA);
  assert.equal(removes, 0);
  assert.equal(data.has(key), true);
});

test("draft validation rejects malformed IDs and control characters before saving", () => {
  for (const invalid of [
    { ...a, id: "not-a-uuid" },
    { ...a, title: "Unsafe\u0000name" },
    { ...a, goal: "Bad\u007fgoal" },
    { ...a, title: "  " },
  ]) {
    assert.equal(validateProjectDraft(invalid).ok, false);
  }
  assert.deepEqual(validateProjectDraft({ ...a, title: "  Alice's project  " }), { ok: true, draft: a });
});
