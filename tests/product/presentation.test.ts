// A Space's presentation is named choices over the Space's own resources — nothing else survives.
import assert from "node:assert/strict";
import { it } from "node:test";
import { BASE_PRESENTATION, MAX_FEATURED, normalizePresentation, presentationFromParams, presentationParams, samePresentation } from "../../lib/product/presentation";

const photo = "11111111-1111-4111-8111-111111111111";
const note = "22222222-2222-4222-8222-222222222222";
const other = "33333333-3333-4333-8333-333333333333";
const resources = { photos: new Set([photo]), notes: new Set([note]) };

it("keeps only named choices over this Space's own resources", () => {
  const p = normalizePresentation({ composition: "story", cover: photo, featured: [note, other, note], tint: "#1F3D7A" }, resources);
  assert.deepEqual(p, { composition: "story", cover: photo, featured: [note], tint: "#1f3d7a" });
});

it("drops anything it doesn't know: a foreign cover, CSS, a script, an unknown layout, any colour", () => {
  const p = normalizePresentation({ composition: "<script>", cover: other, featured: "x", tint: "red; background:url(x)", css: "body{}", permissions: ["*"] }, resources);
  assert.deepEqual(p, BASE_PRESENTATION);
  assert.equal(normalizePresentation({ cover: note }, resources).cover, null, "a note can't be a cover");
  assert.equal(normalizePresentation({ tint: "#123456" }).tint, "#123456", "any colour: readability is computed from it");
  assert.equal(normalizePresentation({ tint: "rgb(1,2,3)" }).tint, null, "but only as a plain colour");
});

it("features at most a few notes", () => {
  const many = Array.from({ length: 6 }, (_, i) => `4444444${i}-4444-4444-8444-444444444444`);
  assert.equal(normalizePresentation({ featured: many }).featured.length, MAX_FEATURED);
});

it("round-trips a draft through its preview address, and nothing is a preview unless asked", () => {
  const draft = { composition: "story" as const, cover: photo, featured: [note], tint: "#2f6b4f" };
  const back = presentationFromParams(Object.fromEntries(new URLSearchParams(presentationParams(draft))), resources);
  assert.ok(back && samePresentation(back, draft));
  assert.equal(presentationFromParams({ composition: "story" }, resources), null);
});
