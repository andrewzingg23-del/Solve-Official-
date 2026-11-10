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

test("Home records what a person writes as theirs, and lists their real things", () => {
  // Rebuilt 2026-11-10. Behaviour is proven against staging by scripts/acceptance/scenarios/home.mjs;
  // this only pins that Home stays wired to the kernel rather than to a device draft.
  const page = read("app/page.tsx");
  const action = read("app/home/actions.ts");
  const view = read("app/home/home.tsx");
  assert.match(page, /listCreativeWorlds/, "Home lists the person's things from the kernel");
  assert.match(action, /createCreativeWorld\(/, "and records new ones there");
  assert.match(view, /custodyNotice\(custody\)/, "and says truthfully who is holding them");
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
