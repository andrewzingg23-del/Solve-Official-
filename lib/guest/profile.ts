import { useCallback, useSyncExternalStore } from "react";

// Guest profile: the sign-in-free identity. Bot name, your name, face, soul —
// kept on this device in localStorage. Real local data, never mock, never
// synced anywhere. Auth infra stays dormant; this is the way in.
export type GuestProfile = {
  yourName: string;
  botName: string;
  face: string;
  face_url?: string;
  generated?: boolean;
  soul: string;
  sovName: string;
  homeNode: { lat: number; lng: number } | null;
  knowYou: Record<string, string>;
  botPersona: unknown;
  createdAt: string;
};

const KEY = "solve.guest-profile.v1";
const EVENT = "solve:guest-profile";

export function defaultGuestProfile(): GuestProfile {
  return {
    yourName: "",
    botName: "",
    face: "blank",
    soul: "",
    sovName: "",
    homeNode: null,
    knowYou: {},
    botPersona: null,
    createdAt: new Date().toISOString(),
  };
}

function sanitize(raw: unknown): GuestProfile | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  const node = r.homeNode;
  const homeNode =
    node && typeof node === "object" && !Array.isArray(node)
      ? (() => {
          const n = node as Record<string, unknown>;
          const lat = typeof n.lat === "number" ? n.lat : NaN;
          const lng = typeof n.lng === "number" ? n.lng : NaN;
          return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
            ? { lat, lng }
            : null;
        })()
      : null;
  const knowYou: Record<string, string> = {};
  if (r.knowYou && typeof r.knowYou === "object" && !Array.isArray(r.knowYou)) {
    for (const [k, v] of Object.entries(r.knowYou as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim()) knowYou[k.slice(0, 40)] = v.trim().slice(0, 500);
    }
  }
  const faceUrl = typeof r.face_url === "string" ? r.face_url : undefined;
  return {
    yourName: str(r.yourName, 60),
    botName: str(r.botName, 40),
    face: str(r.face, 40) || "blank",
    ...(faceUrl ? { face_url: faceUrl.slice(0, 500_000) } : {}),
    generated: r.generated === true,
    soul: str(r.soul, 2000),
    sovName: str(r.sovName, 60),
    homeNode,
    knowYou,
    botPersona: r.botPersona ?? null,
    createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date().toISOString(),
  };
}

export function loadGuestProfile(): GuestProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    return sanitize(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveGuestProfile(profile: GuestProfile): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(profile));
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    // Storage full or blocked — the in-memory state still holds for the session.
  }
}

export function clearGuestProfile(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    // ignore
  }
}

// Reactive hook: every component showing the guest reads the same truth and
// re-renders when any of them saves. useSyncExternalStore keeps this
// lint-clean and SSR-safe (server snapshot is null; the client picks up the
// stored profile right after hydration).
let cached: GuestProfile | null | undefined;
const listeners = new Set<() => void>();

function readStore(): GuestProfile | null {
  if (cached === undefined) cached = loadGuestProfile();
  return cached;
}

function refresh() {
  cached = loadGuestProfile();
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      // A dead listener must not break the rest.
    }
  });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

let wired = false;
function ensureWired() {
  if (wired || typeof window === "undefined") return;
  wired = true;
  window.addEventListener(EVENT, refresh);
  window.addEventListener("storage", refresh);
}

export function useGuestProfile() {
  ensureWired();
  const profile = useSyncExternalStore(subscribe, readStore, () => null);

  const save = useCallback((patch: Partial<GuestProfile>) => {
    const next = { ...(readStore() ?? defaultGuestProfile()), ...patch };
    saveGuestProfile(next);
    refresh();
  }, []);

  const activate = useCallback((patch?: Partial<GuestProfile>) => {
    const next = { ...defaultGuestProfile(), ...patch };
    saveGuestProfile(next);
    refresh();
    return next;
  }, []);

  const clear = useCallback(() => {
    clearGuestProfile();
    refresh();
  }, []);

  return { profile, active: profile !== null, save, activate, clear };
}
