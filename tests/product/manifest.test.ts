import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { it } from "node:test";
import manifest from "../../app/manifest";

it("the PWA manifest is installable and on-brand", () => {
  const m = manifest();
  assert.equal(m.name, "Solve");
  assert.equal(m.start_url, "/");
  assert.equal(m.display, "standalone");
  assert.equal(m.background_color, "#f5f4fa");
  assert.equal(m.theme_color, "#f5f4fa");
  assert.ok(m.icons && m.icons.length >= 1, "has at least one icon");
});

it("its icon is the one drawn in code", () => {
  const m = manifest();
  assert.deepEqual((m.icons ?? []).map(i => i.src), ["/icon"]);
  assert.ok(existsSync(fileURLToPath(new URL("../../app/icon.tsx", import.meta.url))), "app/icon.tsx draws it");
});
