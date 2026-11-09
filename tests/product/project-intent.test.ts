import test from "node:test";
import assert from "node:assert/strict";
import { projectCreationIntent } from "../../lib/product/project-intent";

test("explicit creation request produces bounded project draft", () => {
  assert.deepEqual(projectCreationIntent("Create a project for me: Build my insurance agency."), {
    title: "Build my insurance agency", goal: "Build my insurance agency.",
  });
  assert.equal(projectCreationIntent("Please create project for me: Organize a team")?.title, "Organize a team");
});
test("conversation, appearance and ambiguous requests cannot create a project", () => {
  for (const input of ["Hello", "Make my Space blue", "Can you create a project for me?", "Create a project for me", "Create a project for me:", "Create a project for me:   ", "Create a project for me: " + "x".repeat(7001), "Create a project for me: bad\u0000text"]) {
    assert.equal(projectCreationIntent(input), null, input.slice(0, 80));
  }
});
test("multiline goal retained, title bounded", () => {
  const goal = "A".repeat(170) + "\nAnd a next step";
  const result = projectCreationIntent("Create a project for me: " + goal);
  assert.equal(result?.title.length, 160);
  assert.equal(result?.goal, goal);
});
