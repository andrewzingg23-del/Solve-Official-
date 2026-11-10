// The approved shell (DECISIONS.md, 2026-11-10: "the shell being truth"): four places, and Search,
// Add, AI, who can see your Space and you always in reach. Every route belongs to one place; only
// pages reached from someone else's link drop the navigation.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { DESTINATIONS, destinationOf } from "../../lib/product/destinations";

it("has exactly the four places, in order", () => {
  assert.deepEqual(DESTINATIONS.map(d => d.label), ["Space", "People", "Apps", "Control"]);
});

it("places every live route under exactly one of the four", () => {
  const cases: Array<[string, string]> = [
    ["/", "/"], ["/world/abc", "/"], ["/world/abc/record", "/"], ["/space", "/"], ["/search", "/"],
    ["/people", "/people"],
    ["/apps", "/apps"],
    ["/control", "/control"], ["/account", "/control"],
  ];
  for (const [path, destination] of cases) assert.equal(destinationOf(path), destination, path);
});

it("does not mistake a route that merely starts with the same letters", () => {
  assert.equal(destinationOf("/spacecraft"), "/spacecraft");
  assert.equal(destinationOf("/controller"), "/controller");
  assert.equal(destinationOf("/peoples"), "/peoples");
});

it("is the only shell, and it keeps Search, Add, AI, visibility and you in reach", () => {
  const layout = readFileSync("app/layout.tsx", "utf8");
  assert.match(layout, /from "\.\/ui\/shell"/, "the root uses the shell");
  const shell = readFileSync("app/ui/shell.tsx", "utf8");
  assert.match(shell, /action="\/search"/, "search is a real form");
  assert.match(shell, /<span>Add<\/span>/, "Add");
  assert.match(shell, /href="\/apps#ai"/, "AI connects your own provider");
  assert.match(shell, /"Public" : "Private"/, "who can see your Space");
  assert.match(shell, /href="\/account"/, "you");
  assert.match(shell, /\/world-invite/, "a link from someone else gets only the name");
});

it("carries no graphic from before: no ring mark, no black card", () => {
  for (const file of ["app/ui/shell.tsx", "app/layout.tsx", "app/account/page.tsx", "app/s/[actorId]/page.tsx", "app/p/[worldId]/page.tsx"]) {
    const source = readFileSync(file, "utf8");
    assert.ok(!/SovCard|ui\/mark|\/brand\//.test(source), file);
  }
});
