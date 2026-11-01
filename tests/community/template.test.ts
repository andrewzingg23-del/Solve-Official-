import assert from "node:assert/strict";
import { it } from "node:test";
import {
  CAPABILITIES,
  COMMUNITY_WORLD_TEMPLATE,
  planFromIntent,
  planFromTemplate,
  templateForIntent,
} from "../../lib/community/template";

it("the Community template plans deterministically with honest readiness", () => {
  const a = planFromTemplate("community", "Local Builders")!;
  const b = planFromTemplate("community", "Local Builders")!;
  assert.deepEqual(a, b, "deterministic");
  assert.equal(a.templateId, "community");
  assert.equal(a.version, "1.0.0");
  assert.equal(a.worldName, "Local Builders");
  assert.deepEqual(a.capabilities.map((c) => c.id), ["membership", "projects", "map", "events"]);
  // Membership is ready; projects/map/events are honestly not-built.
  assert.equal(a.capabilities.find((c) => c.id === "membership")!.status, "ready");
  for (const id of ["projects", "map", "events"] as const) {
    assert.equal(a.capabilities.find((c) => c.id === id)!.status, "development_required");
  }
  assert.equal(a.overall, "needs_development");
  assert.deepEqual(a.installableNow, ["membership"], "only membership can be installed today");
  assert.ok(a.notes.some((n) => /not built yet|proposed to build/.test(n)));
});

it("validates dependencies within the template's own capability set", () => {
  const plan = planFromTemplate("community", "X")!;
  // map depends on membership + projects, both in the template → no missing deps.
  assert.deepEqual(plan.capabilities.find((c) => c.id === "map")!.missingDependencies, []);
  // Capability catalog self-consistency: every dependency names a real capability.
  for (const cap of Object.values(CAPABILITIES)) {
    for (const dep of cap.dependencies) assert.ok(dep in CAPABILITIES, `${cap.id} dep ${dep} exists`);
  }
});

it("returns null for an unknown template", () => {
  assert.equal(planFromTemplate("nope", "X"), null);
});

it("matches intent to the community template, or defers", () => {
  assert.equal(templateForIntent("a community for local builders")?.id, "community");
  assert.equal(templateForIntent("people who restore old cars together")?.id, "community");
  assert.equal(templateForIntent("a map of events and projects")?.id, "community");
  assert.equal(templateForIntent("render me a 3D spaceship"), null, "no template → the AI asks, not guesses");
  assert.equal(planFromIntent("a community with a map and events", "Cars")?.overall, "needs_development");
  assert.equal(planFromIntent("render me a spaceship", "X"), null);
});

it("every template capability exists in the catalog and every room maps to one", () => {
  for (const id of COMMUNITY_WORLD_TEMPLATE.capabilities) assert.ok(id in CAPABILITIES);
  for (const room of COMMUNITY_WORLD_TEMPLATE.rooms) {
    assert.ok(room.capability in CAPABILITIES, `room ${room.type} → ${room.capability}`);
    assert.ok(COMMUNITY_WORLD_TEMPLATE.capabilities.includes(room.capability));
  }
});
