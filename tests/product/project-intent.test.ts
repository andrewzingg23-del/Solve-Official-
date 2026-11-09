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

test("natural explicit creation variants preserve bounded goal", () => {
  const examples = [
    ["Create a project called My insurance agency", "My insurance agency"],
    ["Start a project for my daughter's reading plan", "my daughter's reading plan"],
    ["Make me a project to organize the launch", "organize the launch"],
    ["Set up a project about my community", "my community"],
    ["Build a project: New client onboarding", "New client onboarding"],
  ];
  for (const [request, goal] of examples) {
    assert.deepEqual(projectCreationIntent(request), { title: goal, goal }, request);
  }
});

test("questions and unrelated instructions never cause project writes", () => {
  for (const request of [
    "Can you start a project for me?",
    "What projects should I build?",
    "Build my insurance agency",
    "Start a project?",
    "Make a project for me: should we launch?",
    "Create a project called Planning?",
    "Delete a project called Planning",
  ]) assert.equal(projectCreationIntent(request), null, request);
});
