"use client";

// Words a person has typed but not yet sent, kept on this device so a reload or a lost connection
// never loses them. Never authority, never credentials, never the canonical record — that lives in
// the kernel.

/** Read a device-local value, or null when there is none or the browser refuses storage. */
export function readDeviceText(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Write (or, with null, remove) a device-local value. Returns false when the browser refuses
 * storage, so the caller can tell the person the truth instead of implying it was kept.
 */
export function writeDeviceText(key: string, value: string | null): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    return false;
  }
  return true;
}
