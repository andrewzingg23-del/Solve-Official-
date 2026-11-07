import assert from "node:assert/strict";
import { afterEach, it } from "node:test";
import { readDeviceText, writeDeviceText } from "../../lib/client/device-storage";

// A device-local preference is not authority and not the canonical record, so
// these helpers must never pretend a refused browser kept the value.

type Store = { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void };

function installWindow(localStorage: Store) {
  const events: string[] = [];
  (globalThis as { window?: unknown }).window = {
    localStorage,
    dispatchEvent: (event: Event) => { events.push(event.type); return true; },
    addEventListener: () => {},
    removeEventListener: () => {},
    CustomEvent,
  };
  return events;
}

afterEach(() => { delete (globalThis as { window?: unknown }).window; });

it("reads and writes a device-local preference and announces the change", () => {
  const values = new Map<string, string>();
  const events = installWindow({
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => { values.set(k, v); },
    removeItem: (k) => { values.delete(k); },
  });

  assert.equal(readDeviceText("solve.test.pref"), null, "nothing stored yet");
  assert.equal(writeDeviceText("solve.test.pref", "[\"a\"]"), true);
  assert.equal(readDeviceText("solve.test.pref"), "[\"a\"]");
  assert.equal(writeDeviceText("solve.test.pref", null), true, "null removes it");
  assert.equal(readDeviceText("solve.test.pref"), null);
  assert.deepEqual(events, ["solve:device-storage", "solve:device-storage"], "each write notifies readers");
});

it("reports failure instead of claiming a refused preference was saved", () => {
  installWindow({
    getItem: () => { throw new Error("storage blocked"); },
    setItem: () => { throw new Error("storage blocked"); },
    removeItem: () => { throw new Error("storage blocked"); },
  });

  assert.equal(writeDeviceText("solve.test.pref", "x"), false, "a blocked write is reported, not swallowed");
  assert.equal(readDeviceText("solve.test.pref"), null, "a blocked read falls back to nothing stored");
});

it("treats the server, where there is no device, as nothing stored", () => {
  assert.equal(readDeviceText("solve.test.pref"), null);
  assert.equal(writeDeviceText("solve.test.pref", "x"), false);
});
