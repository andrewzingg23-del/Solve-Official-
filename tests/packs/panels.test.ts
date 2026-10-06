// Pack panels: the gate decides before anything runs; unknown is deny.
import assert from "node:assert/strict";
import { it, beforeEach } from "node:test";
import {
  clearPanels,
  gateAction,
  getPanel,
  registerPanel,
  suggestLevel,
} from "../../lib/packs/panels";

beforeEach(() => {
  clearPanels();
  registerPanel({
    packId: "trading",
    title: "Trading",
    actions: [
      { id: "view-chart", label: "View chart", level: "open", reason: "Read-only." },
      { id: "place-swap", label: "Place swap", level: "approval", reason: "Moves real money." },
      { id: "withdraw-all", label: "Withdraw all", level: "forbidden", reason: "Never from a panel." },
    ],
  });
});

it("allows open actions without asking", () => {
  assert.deepEqual(gateAction("trading", "view-chart"), { decision: "allow", actionId: "view-chart" });
});

it("requires approval for money-moving actions, with the reason", () => {
  const d = gateAction("trading", "place-swap");
  assert.equal(d.decision, "needs-approval");
  assert.ok(d.reason.length > 0);
});

it("denies forbidden actions and unknown packs or actions", () => {
  assert.equal(gateAction("trading", "withdraw-all").decision, "deny");
  assert.equal(gateAction("nope", "view-chart").decision, "deny", "unknown pack is closed");
  assert.equal(gateAction("trading", "nope").decision, "deny", "unknown action is closed");
});

it("suggests levels by verb convention", () => {
  assert.equal(suggestLevel("view-chart"), "open");
  assert.equal(suggestLevel("read-memory"), "open");
  assert.equal(suggestLevel("place-swap"), "approval");
  assert.equal(suggestLevel("send-message"), "approval");
  assert.equal(suggestLevel("delete-everything"), "forbidden");
  assert.equal(suggestLevel("grant-admin"), "forbidden");
});

it("registers and reads panels back", () => {
  assert.equal(getPanel("trading")?.title, "Trading");
  assert.equal(getPanel("missing"), null);
});
