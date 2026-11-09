import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isRealityMode } from "../../app/reality/mode";
import { custodyNotice } from "../../lib/product/custody";

const read = (path: string) => readFileSync(path, "utf8");

test("only three approved Reality modes are accepted", () => {
  assert.equal(isRealityMode("base"), true);
  assert.equal(isRealityMode("adaptive"), true);
  assert.equal(isRealityMode("personal"), true);
  assert.equal(isRealityMode("custom-js"), false);
  assert.equal(isRealityMode(null), false);
});

test("the signed-in entry and focus route share the existing owner-backed World", () => {
  assert.match(read("app/page.tsx"), /listCreativeWorlds/);
  assert.match(read("app/page.tsx"), /RealityEntry/);
  const entry = read("app/reality/entry.tsx");
  assert.match(entry, /createProject\(input, owner\)/);
  assert.match(entry, /useProjectDraft\(owner\)/);
  assert.match(entry, /\/workbench/);
  // The custody notice moved into lib/product/custody.ts so the rule could be tested as
  // behaviour (tests/product/custody.test.ts) rather than asserted against source text.
  assert.match(entry, /custodyNotice\(custody\)/);
  assert.equal(custodyNotice("durable"), "Private until you choose to share.");
});

test("Workbench preserves real World data and verifies a saved artifact", () => {
  const page = read("app/world/[worldId]/workbench/page.tsx");
  const action = read("app/world/[worldId]/workbench/actions.ts");
  assert.match(page, /loadCreativeWorld/);
  assert.match(page, /getUser/);
  assert.match(action, /createCreativeArtifact/);
  assert.match(action, /artifactId/);
  assert.match(action, /const confirmed =/);
  assert.match(action, /loadCreativeWorld\(kernel, worldId\)/);
  assert.match(action, /KernelError/);
  assert.doesNotMatch(action, /task\.perform|issue_lease/);
});

test("approved styling remains responsive and Workbench removes global chrome", () => {
  const css = read("app/reality/reality.css");
  const shell = read("app/product/shell.tsx");
  assert.match(css, /reality--base/);
  assert.match(css, /reality--adaptive/);
  assert.match(css, /reality--personal/);
  assert.match(css, /max-width:680px/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(shell, /path === "\/"/);
  assert.match(shell, /\/workbench/);
});
