"use client";
import { useSyncExternalStore } from "react";
import { draftKey, parseProjectDraft, type ProjectDraft } from "@/lib/product/draft";

const eventName = "solve:project-draft";
const snapshots = new Map<string, { raw: string | null; draft: ProjectDraft | null }>();
const temporary = new Map<string, ProjectDraft>();
const listeners = new Set<() => void>();
const notify = () => { for (const listener of listeners) listener(); };
function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  window.addEventListener(eventName, listener);
  return () => { listeners.delete(listener); window.removeEventListener("storage", listener); window.removeEventListener(eventName, listener); };
}
function read(owner: string | null) {
  const key = draftKey(owner);
  if (temporary.has(key)) return temporary.get(key)!;
  try {
    const raw = window.localStorage.getItem(key) ?? (owner ? window.localStorage.getItem(draftKey(null)) : null);
    const previous = snapshots.get(key);
    if (previous?.raw === raw) return previous.draft;
    const draft = parseProjectDraft(raw);
    snapshots.set(key, { raw, draft });
    return draft;
  } catch { return null; }
}
export function useProjectDraft(owner: string | null) {
  const draft = useSyncExternalStore(subscribe, () => read(owner), () => null);
  const save = (next: ProjectDraft) => {
    const key = draftKey(owner);
    try { window.localStorage.setItem(key, JSON.stringify(next)); temporary.delete(key); notify(); return true; }
    catch { temporary.set(key, next); notify(); return false; }
  };
  const clear = (worldId: string) => {
    for (const key of [draftKey(owner), draftKey(null)]) {
      try { if (parseProjectDraft(window.localStorage.getItem(key))?.id === worldId) window.localStorage.removeItem(key); } catch { /* Keep other drafts intact. */ }
      if (temporary.get(key)?.id === worldId) temporary.delete(key);
    }
    snapshots.clear(); notify();
  };
  const persistent = useSyncExternalStore(subscribe, () => !temporary.has(draftKey(owner)), () => true);
  return { draft, save, clear, persistent };
}
