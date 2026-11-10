// The guaranteed six-part record. These tests hold the two rules that make it trustworthy:
// a thing's fields come from its own type declaration, and the words claimed / witnessed /
// verified / disputed are never upgraded by presentation.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import {
  SIX_PARTS, fieldsFromType, proofOf, proofWording, actsFrom, actWording, collapseActs, identityEventWording, nameFor, provenanceLine,
} from "../../lib/product/thing";

// ---------------------------------------------------------------------------------------------
// FIXTURES. These are design fixtures, explicitly labelled as such. No fixture below is or
// becomes a real user record; they exist to prove one component serves unrelated domains.
const TREE_REMOVAL_TYPE_FIXTURE = {
  address: { type: "text" as const, required: true },
  crew_size: { type: "number" as const },
  stump_ground: { type: "boolean" as const },
  photos: { type: "list" as const },
};
const TREE_REMOVAL_DATA_FIXTURE = {
  address: "4100 Palm",
  crew_size: 3,
  stump_ground: true,
  photos: ["before.jpg", "after.jpg"],
};
const APPLICATION_TYPE_FIXTURE = {
  applicant: { type: "text" as const, required: true },
  coverage_amount: { type: "number" as const, required: true },
  medical_exam_done: { type: "boolean" as const },
  submitted_on: { type: "date" as const },
};
const APPLICATION_DATA_FIXTURE = {
  applicant: "A person",
  coverage_amount: 250000,
  // medical_exam_done and submitted_on are deliberately absent.
};
// ---------------------------------------------------------------------------------------------

it("the six parts are fixed, ordered, and complete", () => {
  assert.deepEqual([...SIX_PARTS], [
    "what it is", "whose it is", "what happened", "what's proven", "what's next", "who can reach it",
  ]);
});

it("renders two unrelated domains from their own type declarations, with no domain knowledge", () => {
  const removal = fieldsFromType(TREE_REMOVAL_TYPE_FIXTURE, TREE_REMOVAL_DATA_FIXTURE);
  const application = fieldsFromType(APPLICATION_TYPE_FIXTURE, APPLICATION_DATA_FIXTURE);

  // Each speaks its own vocabulary, in the order its type declared.
  assert.deepEqual(removal.map(f => f.name), ["address", "crew_size", "stump_ground", "photos"]);
  assert.deepEqual(application.map(f => f.name),
    ["applicant", "coverage_amount", "medical_exam_done", "submitted_on"]);

  // Labels are readable without anyone writing them.
  assert.equal(removal.find(f => f.name === "stump_ground")?.label, "Stump ground");
  assert.equal(application.find(f => f.name === "coverage_amount")?.label, "Coverage amount");

  // Kinds come from the declaration, not from guessing at the value.
  assert.equal(removal.find(f => f.name === "crew_size")?.kind, "number");
  assert.equal(application.find(f => f.name === "submitted_on")?.kind, "date");

  // And the renderer itself knows nothing about either trade.
  const source = readFileSync("lib/product/thing.ts", "utf8");
  for (const word of ["tree", "removal", "stump", "insurance", "applicant", "coverage", "policy"]) {
    assert.ok(!new RegExp(word, "i").test(source), `the renderer must not know the word "${word}"`);
  }
});

it("shows a declared field that the record lacks as absent, rather than omitting or inventing it", () => {
  const application = fieldsFromType(APPLICATION_TYPE_FIXTURE, APPLICATION_DATA_FIXTURE);
  const missing = application.find(f => f.name === "medical_exam_done");
  assert.ok(missing, "a declared field is never dropped because the data is missing");
  assert.equal(missing.present, false);
  assert.equal(missing.value, null, "nothing is filled in on the person's behalf");
  assert.equal(application.find(f => f.name === "applicant")?.present, true);
});

it("keeps data the type no longer declares instead of hiding it", () => {
  const fields = fieldsFromType({ a: { type: "text" } }, { a: "kept", b: "also kept" });
  assert.deepEqual(fields.map(f => f.name), ["a", "b"], "a record may outlive a change to its type");
  assert.equal(fields[1].required, false);
});

it("an empty type and an empty record produce an honest empty list, not an error", () => {
  assert.deepEqual(fieldsFromType(null, null), []);
  assert.deepEqual(fieldsFromType({}, {}), []);
});

it("a dispute outranks every other kind of evidence", () => {
  const proof = proofOf(
    [{ basis: "witnessed", description: "someone said yes" }, { basis: "artifact" }],
    [{ state: "confirmed" }, { state: "disputed" }],
  );
  assert.equal(proof.status, "disputed", "an unresolved disagreement is the most important fact");
  assert.equal(proof.disputes, 1);
  assert.match(proofWording(proof), /Disputed/);
});

it("only someone other than the owner can lift a record above a claim", () => {
  assert.equal(proofOf([{ basis: "self_reported" }]).status, "claimed");
  assert.equal(proofOf([{ basis: "artifact" }]).status, "claimed");
  assert.equal(proofOf([], [{ state: "awaiting" }]).status, "none",
    "asking is not the same as being answered");
  assert.equal(proofOf([], [{ state: "confirmed" }]).status, "witnessed");
  assert.equal(proofOf([{ basis: "witnessed" }]).status, "witnessed");
  assert.equal(proofOf([{ basis: "externally_verified" }]).status, "verified");
  assert.equal(proofOf([]).status, "none");
});

it("says plainly when nothing proves a thing, and never implies more than it holds", () => {
  assert.match(proofWording(proofOf([])), /Nothing proves this yet/);
  assert.match(proofWording(proofOf([{ basis: "self_reported" }])), /not yet confirmed/);
  assert.ok(!/verified/i.test(proofWording(proofOf([{ basis: "self_reported" }]))),
    "a claim is never described with the word verified");
  assert.match(proofWording(proofOf([{ basis: "witnessed" }])), /other than its owner/);
});

it("an act says who acted and under what authority, and admits when it does not know", () => {
  const acts = actsFrom([
    { occurred_at: "2026-11-09T10:00:00Z", type: "world.entity.recorded", actor_id: "a1", grant_id: null, on_behalf_of: null },
    { occurred_at: "2026-11-09T11:00:00Z", type: "kernel.confirmation.answered", actor_id: "a2", grant_id: "g1", on_behalf_of: "a1" },
  ], { a1: "Ana", a2: "Dana" });

  assert.equal(acts[0].actorLabel, "Ana");
  assert.equal(acts[0].authority, "own");
  assert.equal(acts[1].authority, "granted");
  assert.equal(acts[1].onBehalfOf, "Ana");

  assert.equal(provenanceLine(acts[0]), "Ana · on their own authority · 2026-11-09");
  assert.equal(provenanceLine(acts[1]), "Dana, for Ana · under a grant · 2026-11-09");

  // An actor nobody can name is "Someone", never a raw identifier.
  const unknown = actsFrom([{ occurred_at: "", type: "x", actor_id: "zz", grant_id: null, on_behalf_of: null }]);
  assert.equal(unknown[0].actorLabel, "Someone");
  assert.ok(!provenanceLine(unknown[0]).includes("zz"), "an internal id is not shown to a person");

  // The proof status rides along on the same line when there is one.
  assert.match(provenanceLine(acts[0], proofOf([{ basis: "witnessed" }])), /other than its owner/);
});

it("says what happened in words a person has, never a dotted event type", () => {
  assert.equal(actWording("kernel.confirmation.answered"), "Answered");
  assert.equal(actWording("world.entity.recorded"), "Recorded");
  assert.equal(actWording("kernel.grant.revoked"), "Took access back");
  // An event type nobody has mapped yet degrades to plain English rather than leaking a path.
  assert.equal(actWording("kernel.something.brand_new"), "Brand new");
  assert.ok(!actWording("kernel.something.brand_new").includes("."), "no dotted path reaches a person");
  assert.equal(actWording(""), "Something happened");
});

it("names every actor truthfully: the viewer is You, the system is SOLVE, the unnamed are Someone", () => {
  // Regression from the 2026-11-09 staging acceptance run: an ordinary visitor's label is empty,
  // and the kernel's own service actor is labelled "kernel".
  const names = { labels: { me: "", sys: "kernel", ana: "Ana", nobody: "   " }, kinds: { sys: "service" }, viewerId: "me" };
  assert.equal(nameFor("me", names), "You", "the person looking is never shown a blank");
  assert.equal(nameFor("sys", names), "SOLVE", "our word 'kernel' never reaches a person");
  assert.equal(nameFor("ana", names), "Ana");
  assert.equal(nameFor("nobody", names), "Someone", "whitespace is not a name");
  assert.equal(nameFor("unknown", names), "Someone");

  const acts = actsFrom([
    { occurred_at: "2026-11-09T10:00:00Z", type: "kernel.scope.claimed", actor_id: "me", grant_id: null, on_behalf_of: null },
    { occurred_at: "2026-11-09T10:00:01Z", type: "kernel.grant.issued", actor_id: "sys", grant_id: null, on_behalf_of: null },
  ], names);
  assert.equal(provenanceLine(acts[0]), "You · on your own authority · 2026-11-09");
  assert.equal(provenanceLine(acts[1]), "SOLVE · as the system · 2026-11-09");
  for (const act of acts) assert.ok(!/kernel/i.test(provenanceLine(act)), "no internal word in any provenance line");
});

it("says an owner's acts are theirs, and someone else's happened with the owner's permission", () => {
  // From the 2026-11-10 acceptance screenshots: "You · under a grant" for a person's own thing.
  const names = { labels: { ana: "Ana", dana: "Dana" }, viewerId: "ana", ownerId: "ana" };
  const acts = actsFrom([
    { occurred_at: "2026-11-10T10:00:00Z", type: "kernel.entity.created", actor_id: "ana", grant_id: "g-own", on_behalf_of: null },
    { occurred_at: "2026-11-10T11:00:00Z", type: "kernel.confirmation.answered", actor_id: "dana", grant_id: "g-own", on_behalf_of: null },
  ], names);
  assert.equal(provenanceLine(acts[0]), "You · on your own authority · 2026-11-10");
  assert.equal(provenanceLine(acts[1]), "Dana · with your permission · 2026-11-10");
  const seenByDana = actsFrom([{ occurred_at: "2026-11-10T11:00:00Z", type: "x", actor_id: "dana", grant_id: "g", on_behalf_of: null }],
    { labels: { ana: "Ana" }, viewerId: "dana", ownerId: "ana" });
  assert.equal(provenanceLine(seenByDana[0]), "You · with Ana's permission · 2026-11-10");
});

it("shows one human act once, and never merges acts that differ", () => {
  const at = "2026-11-10T10:00:12Z";
  const row = (type: string, actor = "ana", t = at) => ({ occurred_at: t, type, actor_id: actor, grant_id: null, on_behalf_of: null });
  const acts = actsFrom([row("kernel.entity.created"), row("kernel.relation.created"), row("kernel.entity.created"),
    row("kernel.grant.issued", "sys"), row("kernel.entity.created", "ana", "2026-11-10T10:05:00Z")],
    { labels: { ana: "Ana", sys: "kernel" }, kinds: { sys: "service" } });
  const shown = collapseActs(acts);
  assert.deepEqual(shown.map(a => `${actWording(a.type)}/${a.actorLabel}`), ["Created/Ana", "Gave access/SOLVE", "Created/Ana"],
    "three rows of one act become one; a different actor or a later minute stays separate");
});

it("says what changed in a person's identity history, not just that something did", () => {
  assert.equal(identityEventWording({ type: "kernel.person.label.updated" }), "Name changed");
  assert.equal(identityEventWording({ type: "kernel.entity.created", payload: { request: { attributes: { sov: "solve.look" } } } }), "Card look set");
  assert.equal(identityEventWording({ type: "kernel.entity.updated", payload: { request: { attributes: { sov: "solve.look" } } } }), "Card look changed");
  assert.equal(identityEventWording({ type: "kernel.entity.created", payload: { request: { title: "Portrait" } } }), "Created: Portrait");
  assert.ok(!/kernel|entity/.test(identityEventWording({ type: "kernel.entity.updated" })), "never our words");
});
