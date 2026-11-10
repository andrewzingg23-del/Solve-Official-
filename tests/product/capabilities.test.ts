// The capability contract offers a person only what their role in a Space lets them do. It is a
// screen-level promise; the kernel's own check (require_allowed) is tested in tests/kernel.
import assert from "node:assert/strict";
import { it } from "node:test";
import { CAPABILITIES, actionsFor, heldInSpace } from "../../lib/product/capabilities";

const ids = (kind: "text" | "photo" | "link", role: Parameters<typeof heldInSpace>[0]) => actionsFor({ kind }, heldInSpace(role)).map(c => c.id);

it("lets the owner and editors revise text, and nobody else", () => {
  assert.deepEqual(ids("text", "owner"), ["revise"]);
  assert.deepEqual(ids("text", "editor"), ["revise"]);
  assert.deepEqual(ids("text", "viewer"), []);
  assert.deepEqual(ids("text", null), []);
});

it("offers nothing that isn't built: photos and links have no revise yet", () => {
  assert.deepEqual(ids("photo", "owner"), []);
  assert.deepEqual(ids("link", "owner"), []);
});

it("ties every capability to a kernel capability and a provider", () => {
  for (const c of CAPABILITIES) {
    assert.match(c.requires, /^[a-z]+(\.[a-z*]+)+$/, c.id);
    assert.equal(c.provider, "solve");
  }
});

it("honours a wildcard grant the way the kernel does", () => {
  assert.deepEqual(actionsFor({ kind: "text" }, new Set(["*"])).map(c => c.id), ["revise"]);
});
