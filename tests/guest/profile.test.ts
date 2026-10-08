// Guest profile: localStorage persistence, sanitization, safe fallbacks.
import assert from "node:assert/strict";
import { beforeEach, it } from "node:test";
import {
  defaultGuestProfile,
  loadGuestProfile,
  saveGuestProfile,
  clearGuestProfile,
} from "@/lib/guest/profile";

function stubStorage() {
  const store = new Map<string, string>();
  (globalThis as Record<string, unknown>).window = {
    localStorage: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    },
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

beforeEach(() => {
  stubStorage();
  clearGuestProfile();
});

it("round-trips a profile through localStorage", () => {
  const p = { ...defaultGuestProfile(), yourName: "Zed", botName: "Vex", soul: "talk straight" };
  saveGuestProfile(p);
  const back = loadGuestProfile();
  assert.ok(back);
  assert.equal(back.yourName, "Zed");
  assert.equal(back.botName, "Vex");
  assert.equal(back.soul, "talk straight");
});

it("returns null when nothing is stored", () => {
  assert.equal(loadGuestProfile(), null);
});

it("returns null on corrupted JSON", () => {
  const w = (globalThis as Record<string, any>).window;
  w.localStorage.setItem("solve.guest-profile.v1", "{not json");
  assert.equal(loadGuestProfile(), null);
});

it("caps oversized strings and rejects bad shapes", () => {
  const w = (globalThis as Record<string, any>).window;
  w.localStorage.setItem(
    "solve.guest-profile.v1",
    JSON.stringify({
      yourName: "x".repeat(500),
      botName: "ok",
      homeNode: { lat: 999, lng: 0 },
      knowYou: { name: "  Zed  ", junk: 42 },
    }),
  );
  const back = loadGuestProfile();
  assert.ok(back);
  assert.equal(back.yourName.length, 60);
  assert.equal(back.homeNode, null);
  assert.deepEqual(back.knowYou, { name: "Zed" });
});

it("clears the profile", () => {
  saveGuestProfile({ ...defaultGuestProfile(), botName: "Vex" });
  clearGuestProfile();
  assert.equal(loadGuestProfile(), null);
});
