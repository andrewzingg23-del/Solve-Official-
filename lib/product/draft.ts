export type ProjectDraft = { id: string; title: string; goal: string };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function draftOf(raw: unknown): ProjectDraft | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const d = raw as Record<string, unknown>;
  if (typeof d.id !== "string" || !uuid.test(d.id) || typeof d.title !== "string" || d.title.length > 160 || typeof d.goal !== "string" || d.goal.length > 7000) return null;
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(d.title + d.goal)) return null;
  return { id: d.id, title: d.title, goal: d.goal };
}
export function parseProjectDraft(raw: string | null): ProjectDraft | null {
  if (!raw || raw.length > 45000) return null;
  try { return draftOf(JSON.parse(raw)); } catch { return null; }
}
export function validateProjectDraft(raw: unknown): { ok: true; draft: ProjectDraft } | { ok: false; error: string } {
  const d = draftOf(raw);
  if (!d) return { ok: false, error: "Check the project name and idea, then try again." };
  if (!d.title.trim()) return { ok: false, error: "Give your project a name." };
  return { ok: true, draft: { ...d, title: d.title.trim(), goal: d.goal.trim() } };
}
export function draftKey(owner: string | null): string { return `solve.project-draft.v1:${owner ?? "guest"}`; }
export function clearCreatedDraft(storage: Pick<Storage, "getItem" | "removeItem">, owner: string | null, worldId: string): void {
  const key = draftKey(owner);
  if (parseProjectDraft(storage.getItem(key))?.id === worldId) storage.removeItem(key);
}
