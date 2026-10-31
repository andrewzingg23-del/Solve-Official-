import assert from "node:assert/strict";
import { it } from "node:test";
import {
  canAfford,
  classAllowed,
  energyReadout,
  remainingEnergy,
} from "../../lib/ai/energy";

it("free tier runs fast tasks only, and says so in plain words", () => {
  assert.equal(classAllowed("free", "fast"), true);
  assert.equal(classAllowed("free", "smart"), false);
  const smart = canAfford("free", 0, "smart");
  assert.equal(smart.ok, false);
  assert.ok(!smart.ok && smart.upgrade);
  assert.ok(!smart.ok && /paid plan/.test(smart.reason));
  assert.deepEqual(canAfford("free", 0, "fast"), { ok: true });
});

it("blocks a task once the monthly pool is spent, with a non-raw message", () => {
  // Free pool is 100; 99 spent leaves room for one fast (cost 1) but not more.
  assert.deepEqual(canAfford("free", 99, "fast"), { ok: true });
  const broke = canAfford("free", 100, "fast");
  assert.equal(broke.ok, false);
  assert.ok(!broke.ok && /out of energy/.test(broke.reason));
  assert.equal(remainingEnergy("free", 100), 0);
  assert.equal(remainingEnergy("free", 250), 0, "never negative");
});

it("paid tier unlocks every class and has a bigger pool", () => {
  assert.equal(classAllowed("paid", "council"), true);
  assert.deepEqual(canAfford("paid", 0, "council"), { ok: true });
  // 2000 pool, council costs 12: affordable at 1988 spent, not at 1989.
  assert.deepEqual(canAfford("paid", 1988, "council"), { ok: true });
  assert.equal(canAfford("paid", 1989, "council").ok, false);
});

it("byok is unlimited and shows no bar", () => {
  assert.equal(remainingEnergy("byok", 999999), Infinity);
  assert.deepEqual(canAfford("byok", 999999, "council"), { ok: true });
  const r = energyReadout("byok", 500);
  assert.equal(r.unlimited, true);
  assert.equal(r.percentUsed, null);
  assert.equal(r.remaining, Infinity);
});

it("readout gives a 0–100 bar for metered tiers", () => {
  const r = energyReadout("free", 25);
  assert.equal(r.total, 100);
  assert.equal(r.used, 25);
  assert.equal(r.remaining, 75);
  assert.equal(r.percentUsed, 25);
  assert.equal(energyReadout("free", 200).percentUsed, 100, "capped at 100");
});
