// The SOV card's look is personal; its readability and honesty are not negotiable. These tests try
// to break both with hostile choices rather than demonstrate the happy path.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { BASE_LOOK, EXPRESSIONS, FINISHES, ID1, SEEDS, TONES, cardFace, cardPalette, normalizeCardLook } from "../../lib/product/card";
import { contrast, parseHex } from "../../lib/product/palette";

const ratio = (a: string, b: string) => contrast(parseHex(a)!, parseHex(b)!);

// Seeds chosen to be hard: the brightest yellow, near-white, near-black, pure primaries, greys.
const HOSTILE = ["#ffff00", "#fefefe", "#010101", "#ff0000", "#00ff00", "#0000ff", "#808080", "#ff00ff", "#00ffff", ...SEEDS];

it("every look a person can choose keeps all text readable on the card", () => {
  let checked = 0;
  for (const seed of HOSTILE) for (const expression of EXPRESSIONS) for (const tone of TONES) for (const finish of FINISHES) {
    const p = cardPalette({ expression, seed, tone, finish });
    const where = `${expression}/${tone}/${seed}`;
    assert.ok(ratio(p.text, p.surface) >= 4.5, `${where}: name text ${ratio(p.text, p.surface).toFixed(2)}:1`);
    assert.ok(ratio(p.muted, p.surface) >= 4.5, `${where}: secondary text ${ratio(p.muted, p.surface).toFixed(2)}:1`);
    checked++;
  }
  assert.equal(checked, HOSTILE.length * 3 * 2 * 3);
});

it("Base is monochrome whatever seed is stored, so a person can always return to it", () => {
  const a = cardPalette({ ...BASE_LOOK, seed: "#ff0000" });
  const b = cardPalette({ ...BASE_LOOK, seed: "#00ff00" });
  assert.deepEqual(a, b, "the seed has no effect on Base");
});

it("a seed actually changes Personal and Expressive", () => {
  const blue = cardPalette({ ...BASE_LOOK, expression: "personal", seed: "#1f3d7a" });
  const green = cardPalette({ ...BASE_LOOK, expression: "personal", seed: "#2f6b4f" });
  assert.notEqual(blue.surface, green.surface);
  const quiet = cardPalette({ ...BASE_LOOK, expression: "personal", seed: "#7a2f5c" });
  const loud = cardPalette({ ...BASE_LOOK, expression: "expressive", seed: "#7a2f5c" });
  assert.notEqual(quiet.surface, loud.surface, "expressive is more than personal");
});

it("accepts only named choices — never CSS, URLs or anything executable", () => {
  const hostile = normalizeCardLook({
    expression: "url(javascript:alert(1))", seed: "red; background:url(x)", tone: "<script>", finish: "metal",
    permissions: ["*"], css: "body{display:none}",
  });
  assert.deepEqual(hostile, { ...BASE_LOOK, finish: "metal" }, "every unknown value falls back; extra keys are dropped");
  assert.deepEqual(normalizeCardLook(null), BASE_LOOK);
  assert.deepEqual(normalizeCardLook([]), BASE_LOOK);
  assert.equal(normalizeCardLook({ seed: "#ABCDEF" }).seed, "#abcdef");
});

it("is the size of a real card", () => {
  assert.equal(ID1.widthMm, 85.6);
  assert.equal(ID1.heightMm, 53.98);
  assert.ok(Math.abs(ID1.ratio - 1.5858) < 0.001);
});

it("prints nothing on its face that is not true of this card", () => {
  const face = cardFace("Andrew");
  assert.deepEqual(face, { name: "Andrew", named: true, instrument: "SOV ID", line: "Your digital life. In your hands." });
  assert.equal(cardFace("   ").named, false, "an unnamed card invites a name rather than inventing one");
  const source = readFileSync("lib/product/card.ts", "utf8").split("\n").filter(l => !l.trim().startsWith("//")).join("\n");
  for (const forbidden of [/verified/i, /\bvisa\b/i, /mastercard/i, /\bexp(iry)?\b/i, /card number/i, /contactless/i]) {
    assert.ok(!forbidden.test(source), `the card model must not claim ${forbidden}`);
  }
});
