import assert from "node:assert/strict";
import { afterEach, it } from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { useDeviceText, useHydrated } from "../../lib/client/device-storage";

// Hydration safety is the reason these hooks exist. The server HTML must never depend on
// what is stored on one person's device, or React hydration mismatches and the first paint
// flickers. useSyncExternalStore's server snapshot gives that guarantee; this pins it, and
// pins that a blocked localStorage degrades to "nothing stored" instead of throwing.

function installWindow(getItem: (key: string) => string | null) {
  (globalThis as { window?: unknown }).window = {
    localStorage: { getItem, setItem: () => {}, removeItem: () => {} },
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
    CustomEvent,
  };
}

afterEach(() => { delete (globalThis as { window?: unknown }).window; });

function Probe() {
  const text = useDeviceText("solve.test.pref");
  const hydrated = useHydrated();
  return createElement("p", null, `hydrated=${hydrated} value=${text ?? "none"}`);
}

it("server rendering ignores this device's stored value, so hydration cannot mismatch", () => {
  // Even with a value present and readable, the server render must not use it.
  installWindow(() => "SECRET-DEVICE-VALUE");
  const html = renderToString(createElement(Probe));
  assert.match(html, /hydrated=false/, "the first render must report that nothing has been read yet");
  assert.match(html, /value=none/, "the server snapshot must be the empty one");
  assert.doesNotMatch(html, /SECRET-DEVICE-VALUE/, "a device-local value must never reach server HTML");
});

it("server rendering works where there is no device at all", () => {
  const html = renderToString(createElement(Probe));
  assert.match(html, /hydrated=false value=none/);
});

it("a browser that refuses storage renders instead of throwing", () => {
  installWindow(() => { throw new Error("storage blocked"); });
  const html = renderToString(createElement(Probe));
  assert.match(html, /hydrated=false value=none/, "a blocked read must degrade, not crash the render");
});
