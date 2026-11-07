import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

test("private Space composes existing behavior with the scenic visual layer", () => {
  const page = read("app/space/page.tsx");
  const component = read("app/space/personal-space.tsx");
  assert.match(page, /import "\.\/space\.css";\s*import "\.\/space-visual\.css";/);
  assert.match(page, /<PersonalSpace/);
  assert.match(component, /data-style-tone=\{currentLook\.tone\}/);
  assert.match(component, /data-style-density=\{currentLook\.density\}/);
  assert.match(component, /data-style-shape=\{currentLook\.shape\}/);
  assert.match(component, /data-style-priority=\{currentLook\.priority\}/);
  assert.match(component, /saveSpaceAppearance/);
  assert.match(component, /undoAppearance/);
});

test("scenic Space design stays decorative, responsive, and visually reversible", () => {
  const css = read("app/space/space-visual.css");
  const landscape = read("public/brand/solve-space-horizon.svg");
  assert.match(css, /\.sov-personal \.sov-space-header/);
  assert.match(css, /\.sov-personal \.sov-space-intro/);
  assert.match(css, /url\("\/brand\/solve-space-horizon\.svg"\)/);
  assert.match(css, /var\(--space-radius/);
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /@media \(max-width: 390px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /focus-visible/);
  assert.match(landscape, /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.doesNotMatch(landscape, /<script|<foreignObject|<image\b|https?:\/\//i);
});
