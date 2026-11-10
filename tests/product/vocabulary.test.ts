// The product supplies no vocabulary of its own: every label is either a word every human has or
// a word the person supplied (DECISIONS.md, 2026-11-09). "World" is our word for a scope, like
// "row" or "table", and "Project" implies work, which excludes a photograph or a memory.
//
// Derived from the card: a physical card names no category at all. It carries the brand, the
// instrument, and the person's own name. That is also why it reads the same in any language —
// verbs and names translate, abstractions distort ("World" becomes *mundo*, which means something
// else entirely).
//
// This test reads the person-visible strings out of each surface and fails if one of our words
// has been stamped on a person's own thing.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";

// Capitalised only: "a world that grows with you" is ordinary English; "World" is our term.
const OURS = /\b(World|Worlds|Project|Projects)\b/;

const SURFACES = [
  "app/reality/entry.tsx",
  "app/product/thing-inspector.tsx",
  "app/world/[worldId]/record/page.tsx",
  "app/workbench/page.tsx",
  "app/product/shell.tsx",
  "app/space/personal-space.tsx",
  "app/world/[worldId]/record/ask.tsx",
  "app/confirm/[token]/page.tsx",
  "app/confirm/[token]/answer.tsx",
  "app/account/page.tsx",
  "app/account/card-studio.tsx",
  "app/product/sov-card.tsx",
];

/**
 * Strings a person could read: quoted literals and JSX text. Paths, class names, identifiers and
 * anything with a slash or dot are excluded — a URL is not a label.
 */
function visibleStrings(source: string): string[] {
  const found: string[] = [];
  // Strip comments first: an explanation of why we avoid a word is not a label.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
  for (const match of code.matchAll(/"([^"\\\n]{2,})"|'([^'\\\n]{2,})'/g)) {
    found.push(match[1] ?? match[2] ?? "");
  }
  // JSX text between tags.
  for (const match of code.matchAll(/>([^<>{}\n]{2,})</g)) found.push(match[1]);
  return found
    .map(value => value.trim())
    .filter(value =>
      value.length > 1
      && !value.includes("/")                 // a route or path is not a label
      && !/^[a-z][a-z0-9-]*$/.test(value)     // nor a css class or attribute value
      && !/^[a-z0-9_.-]+$/.test(value));      // nor a lowercase identifier or event type
}

for (const file of SURFACES) {
  it(`${file} shows the person no word of ours`, () => {
    const offenders = visibleStrings(readFileSync(file, "utf8")).filter(value => OURS.test(value));
    assert.deepEqual(offenders, [], `these are our words, not a person's: ${offenders.join(" | ")}`);
  });
}

it("reads real labels out of a surface, so the check above cannot pass by finding nothing", () => {
  const strings = visibleStrings(readFileSync("app/product/thing-inspector.tsx", "utf8"));
  assert.ok(strings.includes("No type yet"), "the extractor must actually see visible copy");
  assert.ok(strings.some(s => s.startsWith("Nothing has happened")), "including JSX text");
  // And it must catch our vocabulary when it is there.
  assert.ok(OURS.test("Your Projects"), "the rule itself matches what it is meant to");
  assert.ok(!OURS.test("a world that grows with you"), "ordinary English is left alone");
});

it("an untyped thing is shown as untyped, never labelled with our scope word", () => {
  const record = readFileSync("app/world/[worldId]/record/page.tsx", "utf8");
  assert.match(record, /typeName=\{null\}/, "no category is invented for a thing that has none");
});
