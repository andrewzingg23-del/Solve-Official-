// One shell, five destinations, rebuilt from zero on 2026-11-10. Every route belongs to exactly one
// destination; only pages reached from someone else's link drop the navigation.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { DESTINATIONS, destinationOf } from "../../lib/product/destinations";

it("has exactly the five destinations, in order", () => {
  assert.deepEqual(DESTINATIONS.map(d => d.label), ["Home", "ID", "Space", "Bench", "Control"]);
});

it("places every live route under exactly one of the five destinations", () => {
  const cases: Array<[string, string]> = [
    ["/", "/"],
    ["/account", "/account"],
    ["/space", "/space"],
    ["/workbench", "/workbench"], ["/world/abc", "/workbench"], ["/world/abc/record", "/workbench"],
    ["/control", "/control"],
  ];
  for (const [path, destination] of cases) assert.equal(destinationOf(path), destination, path);
});

it("does not mistake a route that merely starts with the same letters", () => {
  assert.equal(destinationOf("/spacecraft"), "/spacecraft");
  assert.equal(destinationOf("/controller"), "/controller");
});

it("is the only shell, and it is built from nothing earlier", () => {
  const layout = readFileSync("app/layout.tsx", "utf8");
  assert.match(layout, /from "\.\/ui\/shell"/, "the root uses the rebuilt shell");
  for (const old of ["product/shell", "globals.css", "product.css", "approved-language.css", "reality.css", "room.css"]) {
    assert.ok(!layout.includes(old), `the root no longer loads ${old}`);
  }
  const shell = readFileSync("app/ui/shell.tsx", "utf8");
  assert.ok(!/path === "\/"/.test(shell), "Home lives inside the shell, never beside it");
  assert.match(shell, /\/confirm\//, "a link from someone else gets only SOLVE's mark");
});

it("puts the person's own card in the frame", () => {
  const shell = readFileSync("app/ui/shell.tsx", "utf8");
  assert.match(shell, /<SovCard name=\{name\} look=\{look\} size="mini"/);
});
