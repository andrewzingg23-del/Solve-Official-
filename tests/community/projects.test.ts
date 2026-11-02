import assert from "node:assert/strict";
import { it } from "node:test";
import { kernelClient } from "../../lib/kernel/client";
import { localSupabase } from "../../lib/kernel/local";
import { startCommunity } from "../../lib/community/community";
import { cleanPlace, createProject, listProjects, projectFromEntity, projectsOnMap, PROJECT } from "../../lib/community/projects";
import { createKernelDb, user } from "../kernel/harness";

it("cleanPlace accepts a labelled real coordinate and rejects the rest", () => {
  assert.deepEqual(cleanPlace({ label: "Shop", latitude: 27.95, longitude: -82.46 }), { label: "Shop", latitude: 27.95, longitude: -82.46 });
  assert.equal(cleanPlace({ label: "", latitude: 1, longitude: 2 }), null, "needs a label");
  assert.equal(cleanPlace({ label: "x", latitude: 200, longitude: 2 }), null, "lat out of range");
  assert.equal(cleanPlace({ label: "x", latitude: 1, longitude: 999 }), null, "lng out of range");
  assert.equal(cleanPlace(null), null);
});

it("projectFromEntity reads only community-project resources, and derives the place", () => {
  const base = { entity_id: "e1", title: "Roof build", summary: "s", updated_at: "2026-11-01T00:00:00Z" };
  assert.equal(projectFromEntity("c", { ...base, kind: "organization", attributes: { sov: PROJECT }, latitude: null, longitude: null }), null, "wrong kind");
  assert.equal(projectFromEntity("c", { ...base, kind: "resource", attributes: {}, latitude: null, longitude: null }), null, "no sov marker");
  const noPlace = projectFromEntity("c", { ...base, kind: "resource", attributes: { sov: PROJECT, created_by: "a" }, latitude: null, longitude: null })!;
  assert.equal(noPlace.place, null);
  assert.equal(noPlace.name, "Roof build");
  const placed = projectFromEntity("c", { ...base, kind: "resource", attributes: { sov: PROJECT, place_label: "Tampa" }, latitude: "27.95", longitude: "-82.46" })!;
  assert.deepEqual(placed.place, { label: "Tampa", latitude: 27.95, longitude: -82.46 });
});

it("a member creates projects; Projects lists them; the Map shows only placed ones; retries are one project", async () => {
  const db = await createKernelDb();
  const ana = kernelClient(localSupabase(db, user("auth:proj-ana")));
  await ana.register("Ana");
  const c = await startCommunity(ana, { name: "Zest Solar", about: "Solar.", packs: [], nonce: "0b6f3c1e-8a2d-4f5b-9c7e-1d2e3f4a5b60" });

  const p1 = await createProject(ana, c, { name: "Downtown install", requestId: "proj-00000001" });
  const p2 = await createProject(ana, c, {
    name: "Riverside install",
    description: "A 12-home block.",
    place: { label: "Riverside, Tampa", latitude: 27.97, longitude: -82.47 },
    requestId: "proj-00000002",
  });

  const all = await listProjects(ana, c);
  assert.equal(all.length, 2);
  assert.deepEqual(all.map((p) => p.name).sort(), ["Downtown install", "Riverside install"]);

  const onMap = await projectsOnMap(ana, c);
  assert.deepEqual(onMap.map((p) => p.name), ["Riverside install"]);
  assert.deepEqual(onMap[0].place, { label: "Riverside, Tampa", latitude: 27.97, longitude: -82.47 });

  const retry = await createProject(ana, c, { name: "Downtown install", requestId: "proj-00000001" });
  assert.equal(retry.projectId, p1.projectId, "same requestId → same project, not a duplicate");
  assert.equal((await listProjects(ana, c)).length, 2, "no duplicate created");
  assert.notEqual(p1.projectId, p2.projectId);
});
