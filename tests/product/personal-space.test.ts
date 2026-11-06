import assert from "node:assert/strict";
import { test } from "node:test";
import { agentSpaceBrief, chosenFocus, composePersonalSpace, normalizeSpaceAnswers, spaceMood } from "../../lib/product/personal-space";

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

test("AI personalization is opt-in and excludes imported private text", () => {
  const p = { building: "Write songs", focus: "music", context: "A private phone number", people: "My daughter" };
  assert.equal(agentSpaceBrief(p), "");
  const brief = agentSpaceBrief({ ...p, aiContext: "yes" });
  assert.ok(brief.includes("Write songs"));
  assert.ok(brief.includes("Music & media"));
  assert.equal(brief.includes(p.context), false);
  assert.equal(brief.includes(p.people), false);
});

test("rejects unknown fields and focus values", () => {
  const clean = normalizeSpaceAnswers({ context: "x".repeat(9000), secret: "unwanted", focus: "music,banking,business" });
  assert.equal(clean.context.length, 3500);
  assert.equal("secret" in clean, false);
  assert.deepEqual(chosenFocus(clean), ["music", "business"]);
});

test("personal atmospheres change presentation, never private/public data", () => {
  assert.equal(spaceMood({ focus: "business,engineering" }), "builder");
  assert.equal(spaceMood({ focus: "gaming,music" }), "creator");
  assert.equal(spaceMood({ focus: "family,learning" }), "household");
  assert.equal(spaceMood({ focus: "" }), "neutral");
  const a = composePersonalSpace({ focus: "gaming", context: "private note A" });
  const b = composePersonalSpace({ focus: "family", context: "private note B" });
  assert.equal(JSON.stringify(a.publicPreview).includes("private note A"), false);
  assert.equal(JSON.stringify(b.publicPreview).includes("private note B"), false);
});
