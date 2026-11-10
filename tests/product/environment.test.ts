// A person's whole environment takes its colours from their card. These tests hold the two things
// that must survive any choice they make: everything stays readable, and authority stays monochrome.
import assert from "node:assert/strict";
import { it } from "node:test";
import { BASE_LOOK, EXPRESSIONS, FINISHES, SEEDS, TONES } from "../../lib/product/card";
import { environmentFor } from "../../lib/product/environment";
import { contrast, parseHex } from "../../lib/product/palette";

const ratio = (a: string, b: string) => contrast(parseHex(a)!, parseHex(b)!);
const HOSTILE = ["#ffff00", "#fefefe", "#010101", "#ff0000", "#00ff00", "#0000ff", "#808080", ...SEEDS];

it("every look keeps the whole environment readable", () => {
  for (const seed of HOSTILE) for (const expression of EXPRESSIONS) for (const tone of TONES) for (const finish of FINISHES) {
    const env = environmentFor({ expression, seed, tone, finish });
    const where = `${expression}/${tone}/${seed}`;
    for (const surface of [env.page, env.surface, env.raised]) {
      assert.ok(ratio(env.text, surface) >= 4.5, `${where}: text on ${surface}`);
      assert.ok(ratio(env.muted, surface) >= 4.5, `${where}: secondary text on ${surface}`);
    }
    assert.ok(ratio(env.accent, env.page) >= 3, `${where}: the accent must be visible as a mark (${ratio(env.accent, env.page).toFixed(2)}:1)`);
    assert.ok(ratio(env.onAccent, env.accent) >= 4.5, `${where}: text on the accent`);
  }
});

it("the card's tone is the environment's tone", () => {
  assert.equal(environmentFor({ ...BASE_LOOK, tone: "dark" }).tone, "dark");
  assert.equal(environmentFor({ ...BASE_LOOK, tone: "light" }).tone, "light");
});

it("the person's colour enters through the accent and nowhere else", () => {
  const red = environmentFor({ expression: "expressive", seed: "#b8442f", tone: "dark", finish: "matte" });
  const blue = environmentFor({ expression: "expressive", seed: "#1f3d7a", tone: "dark", finish: "matte" });
  assert.notEqual(red.accent, blue.accent, "their colour shows");
  for (const key of ["page", "surface", "raised", "line", "text", "muted"] as const) {
    assert.equal(red[key], blue[key], `${key} is SOLVE's frame, not theirs`);
  }
});

it("Base is monochrome everywhere", () => {
  const env = environmentFor(BASE_LOOK);
  assert.equal(env.accent, env.text, "no colour at all until the person brings one");
});
