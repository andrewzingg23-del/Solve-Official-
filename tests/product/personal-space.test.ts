import assert from "node:assert/strict";
import { test } from "node:test";
import { chosenFocus, composePersonalSpace, normalizeSpaceAnswers } from "../../lib/product/personal-space";

test("no invented activity or data in a new Space", () => {
  const result = composePersonalSpace({});
  assert.equal(result.hasContext, false);
  assert.equal(result.modules.length, 0);
  assert.equal(result.name, "");
  assert.equal(result.goal, "");
  assert.equal(result.publicPreview.bio, "");
});

test("one composition engine supports different people", () => {
  const musician = composePersonalSpace({ name: "Avery", focus: "music,creative", building: "Release an EP" });
  const parent = composePersonalSpace({ name: "Maya", focus: "family,business", building: "Coordinate family and work" });
  const engineer = composePersonalSpace({ name: "Kenji", focus: "engineering,learning", building: "Prototype a robot" });
  assert.deepEqual(musician.modules.map(item => item.id), ["music", "creative"]);
  assert.deepEqual(parent.modules.map(item => item.id), ["family", "business"]);
  assert.deepEqual(engineer.modules.map(item => item.id), ["engineering", "learning"]);
  assert.notDeepEqual(musician.modules, parent.modules);
});

test("imported private information never becomes published profile content", () => {
  const source = {
    name: "Avery",
    context: "Personal phone number and private conversations",
    privacy: "Keep everything private",
    focus: "music",
    bio: "Musician and designer",
  };
  const result = composePersonalSpace(source);
  assert.equal(result.publicPreview.bio, "Musician and designer");
  assert.equal(JSON.stringify(result.publicPreview).includes(source.context), false);
  assert.equal(JSON.stringify(result.publicPreview).includes(source.privacy), false);
});

test("rejects unknown fields and focus values", () => {
  const clean = normalizeSpaceAnswers({ context: "x".repeat(9000), secret: "unwanted", focus: "music,banking,business" });
  assert.equal(clean.context.length, 3500);
  assert.equal("secret" in clean, false);
  assert.deepEqual(chosenFocus(clean), ["music", "business"]);
});
