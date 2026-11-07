"use client";

import { useCallback, useSyncExternalStore } from "react";

// Device-local preferences: small, non-authoritative settings a person keeps on
// this browser (chosen appearance, which optional apps they are interested in).
// They are never authority, never credentials, and never the canonical record —
// canonical state lives in the kernel. This module is the one home for reading
// them inside React, following the same useSyncExternalStore convention as
// lib/guest/profile.ts: the server snapshot is null so hydration matches, and
// the stored value arrives immediately after hydration without calling setState
// inside an effect.

const EVENT = "solve:device-storage";
const listeners = new Set<() => void>();

function notify() {
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch {
      // A dead listener must not break the rest.
    }
  }
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

let wired = false;
function ensureWired() {
  if (wired || typeof window === "undefined") return;
  wired = true;
  window.addEventListener(EVENT, notify);
  // Another tab on this device changed the same preference.
  window.addEventListener("storage", notify);
}

/** Read a device-local preference as raw text, outside React. */
export function readDeviceText(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Write (or, with null, remove) a device-local preference.
 * Returns false when the browser refuses storage, so the caller can tell the
 * person the truth instead of implying the preference was kept.
 */
export function writeDeviceText(key: string, value: string | null): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    return false;
  }
  window.dispatchEvent(new CustomEvent(EVENT));
  return true;
}

/**
 * Reactive read of one device-local preference. Returns null on the server and
 * during the first client render; the stored text right after. Text keeps the
 * snapshot referentially stable — parse it with useMemo at the call site.
 */
export function useDeviceText(key: string): string | null {
  ensureWired();
  const read = useCallback(() => readDeviceText(key), [key]);
  return useSyncExternalStore(subscribe, read, () => null);
}

const noSubscription = () => () => {};

/**
 * False on the server and during the first client render, true afterwards.
 * Lets a view distinguish "nothing stored" from "not read yet" without
 * claiming a count it does not have.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(noSubscription, () => true, () => false);
}
