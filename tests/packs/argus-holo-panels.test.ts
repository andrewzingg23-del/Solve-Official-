import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computePanelPose,
  createFocusMachine,
  createPulse,
  HOLO_MAX_TILT_DEG,
} from "../../app/packs/trading/argus/holo-panels";

describe("computePanelPose", () => {
  it("returns zero pose with no pointer", () => {
    assert.deepEqual(computePanelPose(100, 100, null), { glow: 0, tiltX: 0, tiltY: 0 });
  });
  it("glow is 1 at center, 0 beyond radius", () => {
    assert.equal(computePanelPose(100, 100, { x: 100, y: 100 }, 140).glow, 1);
    assert.equal(computePanelPose(100, 100, { x: 500, y: 100 }, 140).glow, 0);
  });
  it("tilts toward the pointer, clamped to max", () => {
    const p = computePanelPose(100, 100, { x: 240, y: 100 }, 140);
    assert.equal(p.tiltY, HOLO_MAX_TILT_DEG);
    assert.equal(p.tiltX, 0);
    const up = computePanelPose(100, 100, { x: 100, y: -40 }, 140);
    assert.ok(up.tiltX > 0 && up.tiltX <= HOLO_MAX_TILT_DEG);
  });
});

describe("createFocusMachine", () => {
  it("ticks through liquidity/holders/contract then auto-releases", () => {
    let pulsed = 0;
    const states: string[] = [];
    const m = createFocusMachine({
      onPulse: () => pulsed++,
      onChange: (s) => states.push(s.checks.map((c) => c.status[0]).join("")),
    });
    m.focus(2);
    assert.equal(pulsed, 1);
    m.tick(100);
    assert.equal(states.at(-1), "aww");
    m.tick(400);
    assert.equal(states.at(-1), "daw");
    m.tick(400);
    assert.equal(states.at(-1), "dda");
    m.tick(400);
    assert.equal(states.at(-1), "ddd");
    m.tick(2000);
    assert.equal(m.state().focused, null);
  });
  it("tapping the focused panel releases it", () => {
    const m = createFocusMachine({ onPulse: () => {} });
    m.focus(0);
    assert.equal(m.state().focused, 0);
    m.focus(0);
    assert.equal(m.state().focused, null);
  });
  it("resolveInstant completes the sequence without ticks", () => {
    const m = createFocusMachine({ onPulse: () => {} });
    m.focus(1);
    m.resolveInstant();
    assert.deepEqual(
      m.state().checks.map((c) => c.status),
      ["done", "done", "done"]
    );
  });
});

describe("createPulse", () => {
  it("triggers to 1 and decays to 0", () => {
    const p = createPulse();
    assert.equal(p.ref.value, 0);
    p.trigger();
    assert.equal(p.ref.value, 1);
    p.decay(2000);
    assert.equal(p.ref.value, 0);
    p.trigger();
    p.decay(100);
    assert.ok(p.ref.value > 0 && p.ref.value < 1);
  });
});
