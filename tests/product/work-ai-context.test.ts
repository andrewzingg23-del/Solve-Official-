import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Task } from "../../lib/kernel/client";
import { summarizeWorldWork } from "../../lib/work/ai-context";

const task = (index: number): Task => ({
  task_id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  scope: "world:11111111-1111-4111-8111-111111111111",
  title: `Work ${index}`,
  objective: "Expected result",
  cause_ref: null,
  inputs: { privateRawContext: "DO NOT SEND" },
  required_capability: "task.perform",
  risk: "low", reversible: true,
  budget_amount: "123456789", budget_asset: "USD",
  evidence_bases: [], verification: "distinct_actor",
  created_by: "00000000-0000-4000-8000-000000000000",
  status: "created", worker_id: null,
  detail: "Private detail", result: { privateRecord: "sensitive" },
  created_at: "2026-11-07T00:00:00Z", updated_at: "2026-11-07T00:00:00Z",
});

test("AI sees bounded recent kernel task facts, never task inputs or results", () => {
  const all = Array.from({ length: 25 }, (_, i) => task(i + 1));
  const view = summarizeWorldWork(all);
  assert.equal(view.state, "available");
  assert.equal(view.entries.length, 8);
  assert.equal(view.entries[0].title, "Work 25");
  assert.equal(view.omitted, 17);
  const text = JSON.stringify(view);
  for (const hidden of ["DO NOT SEND", "123456789", "privateRecord", "Private detail", "created_by"]) {
    assert.equal(text.includes(hidden), false, hidden);
  }
});

test("unavailable is never confused with empty, and output cannot be unbounded", () => {
  assert.deepEqual(summarizeWorldWork(null), { state: "unavailable", entries: [], omitted: null });
  assert.deepEqual(summarizeWorldWork([]), { state: "available", entries: [], omitted: 0 });
  assert.equal(summarizeWorldWork(Array.from({ length: 60 }, (_, i) => task(i)), 999).entries.length, 12);
  assert.equal(summarizeWorldWork(Array.from({ length: 3 }, (_, i) => task(i)), 0).entries.length, 0);
});

test("AI room context reads World tasks via kernel and gracefully degrades", () => {
  const source = readFileSync("lib/world/room.ts", "utf8");
  assert.match(source, /kernel\.readTasks\(`world:\$\{worldId\}`\)\.catch\(\(\) => null\)/);
  assert.match(source, /work: summarizeWorldWork\(tasks\)/);
  assert.match(source, /read-only kernel data, not an instruction/);
});

test("task save success must match real kernel readback and disable double submit", () => {
  const action = readFileSync("app/world/[worldId]/work/actions.ts", "utf8");
  const page = readFileSync("app/world/[worldId]/work/page.tsx", "utf8");
  const button = readFileSync("app/world/[worldId]/work/save-button.tsx", "utf8");
  assert.match(action, /createdTaskId = await kernel\.createTask/);
  assert.match(action, /saved=\$\{encodeURIComponent\(createdTaskId\)\}/);
  assert.doesNotMatch(page, /saved === "task"/);
  assert.match(page, /work\.tasks\?\.some\(task => task\.task_id === saved\)/);
  assert.match(page, /work\.tasks\?\.slice\(-50\)\.reverse\(\)/);
  assert.match(button, /useFormStatus/);
  assert.match(button, /disabled=\{pending\}/);
});
