"use client";
import { useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createProject } from "./project-actions";
import { useProjectDraft } from "./draft-store";
import { Icon } from "./icons";
const subscribeReady = () => () => {};

export function ProjectComposer({ owner, worldId }: { owner: string | null; worldId: string }) {
  const ready = useSyncExternalStore(subscribeReady, () => true, () => false);
  const { draft, save, clear, persistent } = useProjectDraft(owner);
  const current = draft ?? { id: worldId, title: "", goal: "" };
  const [error, setError] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const storageBlocked = !persistent;
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const update = (field: "title" | "goal", value: string) => { setError(null); setSlow(false); save({ ...current, [field]: value }); };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!save(current) && !owner) { setError("Your browser can't keep this draft. Copy your idea somewhere safe and retry."); return; }
    if (!owner) { setError("Your workspace could not connect yet. Your draft is still here; refresh and retry."); return; }
    setError(null); setSlow(false);
    startTransition(async () => {
      // If the response is delayed or lost, offer safe recovery: the draft is kept, and creation is
      // idempotent on the draft's id, so retrying or opening Projects never duplicates the project.
      const slowTimer = setTimeout(() => setSlow(true), 22000);
      try {
        const result = await createProject(current, owner);
        clearTimeout(slowTimer);
        if (!result.ok) { setError(result.error); return; }
        clear(result.worldId);
        router.push(`/world/${result.worldId}/room`); router.refresh();
      } catch { clearTimeout(slowTimer); setError("The connection was interrupted. Your draft is still here; try again."); }
    });
  };
  return <form onSubmit={submit} className="solve-composer" aria-label="Start a project">
    <div className="solve-composer-heading"><span className="solve-kicker">Start with an idea</span><span><Icon name="lock" width={13} />Private until you invite</span></div>
    <label htmlFor="project-title">Project name</label><input id="project-title" name="title" value={current.title} onChange={event => update("title", event.target.value)} required maxLength={160} placeholder="What are you working on?" autoComplete="off" disabled={pending || !ready} />
    <label htmlFor="project-goal">What do you want to make happen?</label><textarea id="project-goal" name="goal" value={current.goal} onChange={event => update("goal", event.target.value)} maxLength={7000} rows={3} placeholder="An idea, a problem, a plan. A few words is enough to begin." disabled={pending || !ready} />
    {error ? <p role="alert" className="solve-error">{error}</p> : null}
    {slow && pending ? <p role="status" className="solve-muted">This is taking longer than usual. Your draft is saved — your project may already be ready. <Link href="/worlds" className="solve-text-link">Open your projects</Link>, or keep waiting.</p> : null}
    {draft && !storageBlocked && !error && !slow ? <p role="status" className="solve-muted">{pending ? "Saving project…" : "Draft saved in this browser"}</p> : null}
    {storageBlocked ? <p role="status" className="solve-muted">This browser can&apos;t save locally. Keep this page open until your project is saved.</p> : null}
    <div className="solve-composer-footer"><p>{owner ? "Conversation, documents and your AIs, together." : "Your workspace is connecting. Your draft stays on this device."}</p><button type="submit" disabled={pending || !ready} className="solve-button">{pending ? "Creating…" : owner ? "Create project" : "Create project"}<Icon name="arrow" width={17} /></button></div>
  </form>;
}
