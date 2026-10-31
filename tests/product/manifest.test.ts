import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { it } from "node:test";
import manifest from "../../app/manifest";

it("the PWA manifest is installable and on-brand", () => {
  const m = manifest();
  assert.equal(m.name, "solve");
  assert.equal(m.start_url, "/");
  assert.equal(m.display, "standalone");
  assert.equal(m.background_color, "#04070d");
  assert.equal(m.theme_color, "#04070d");
  assert.ok(m.icons && m.icons.length >= 1, "has at least one icon");
});

it("every manifest icon file actually exists in public/", () => {
  const m = manifest();
  for (const icon of m.icons ?? []) {
    const src = String(icon.src);
    assert.ok(src.startsWith("/"), `icon src is a root path: ${src}`);
    const path = fileURLToPath(new URL(`../../public${src}`, import.meta.url));
    assert.ok(existsSync(path), `icon file is present: public${src}`);
  }
});
