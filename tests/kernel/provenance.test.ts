// Provenance stamps: empty registry passes through; detectors plug in.
import assert from "node:assert/strict";
import { it, beforeEach } from "node:test";
import {
  clearDetectors,
  detectorNames,
  recordProvenance,
  registerDetector,
  stampContent,
} from "../../lib/kernel/provenance";

beforeEach(() => clearDetectors());

it("passes through unstamped when no detector is registered", () => {
  assert.deepEqual(stampContent("some ai text"), []);
  assert.deepEqual(detectorNames(), []);
});

it("runs registered detectors and collects their stamps", () => {
  registerDetector({
    name: "textgrain-v1",
    detect: (text) => ({ detector: "textgrain-v1", signal: "ai-generated", confidence: 0.97, detail: text.slice(0, 8) }),
  });
  registerDetector({ name: "silent", detect: () => null });
  const stamps = stampContent("hello world, from a model");
  assert.equal(stamps.length, 1);
  assert.equal(stamps[0].detector, "textgrain-v1");
  assert.equal(stamps[0].signal, "ai-generated");
  assert.deepEqual(detectorNames(), ["textgrain-v1", "silent"]);
});

it("a broken detector never blocks the pipeline", () => {
  registerDetector({
    name: "broken",
    detect: () => {
      throw new Error("boom");
    },
  });
  assert.deepEqual(stampContent("anything"), []);
});

it("recordProvenance is a no-op returning [] with no detectors", async () => {
  const attached: unknown[] = [];
  const fake = { attachEvidence: async (...args: unknown[]) => void attached.push(args) };
  const stamps = await recordProvenance(fake as never, "evt-1", "ai text here");
  assert.deepEqual(stamps, []);
  assert.equal(attached.length, 0, "nothing attached when nothing detected");
});

it("recordProvenance attaches one evidence per stamp", async () => {
  registerDetector({
    name: "textgrain-v1",
    detect: () => ({ detector: "textgrain-v1", signal: "ai-generated", confidence: 0.9 }),
  });
  const attached: { basis: string; description: string }[] = [];
  const fake = {
    attachEvidence: async (_eventId: string, evidence: { basis: string; description: string }) => {
      attached.push(evidence);
      return "ev-1";
    },
  };
  const stamps = await recordProvenance(fake as never, "evt-1", "ai text here", "idem-1");
  assert.equal(stamps.length, 1);
  assert.equal(attached.length, 1);
  assert.equal(attached[0].basis, "system_observed");
  assert.ok(attached[0].description.startsWith("provenance:textgrain-v1:ai-generated:"));
});
