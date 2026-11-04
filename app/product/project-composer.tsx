"use client";
import { useSyncExternalStore, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProject } from "./project-actions";
import { useProjectDraft } from "./draft-store";
import { Icon } from "./icons";

const subscribeReady = () => () => {};
const inferTitle = (idea: string) => idea.trim().split(/\n/).find(line => line.trim())?.trim().slice(0, 160) ?? "";

/**
 * One intention, one World. Keep the existing validated title+goal persistence
 * contract beneath a single input. The same saved local draft follows a guest
 * through sign-in without pretending a kernel World exists before authentication.
 */
export function ProjectComposer({ owner, worldId }: { owner: string | null; worldId: string }) {
  const ready = useSyncExternalStore(subscribeReady, () => true, () => false);
  const { draft, save, clear } = useProjectDraft(owner);
  const current = draft ?? { id: worldId, title: "", goal: "" };
  const idea = current.goal || current.title;
  const [error, setError] = useState<string | null>(null);
  const [storageBlocked, setStorageBlocked] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function update(value: string) {
    setError(null);
    setStorageBlocked(!save({ ...current, title: inferTitle(value), goal: value }));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!idea.trim()) return;
    const next = { ...current, title: inferTitle(idea), goal: idea };
    if (!save(next) && !owner) {
      setError("This browser can't preserve your draft. Copy it somewhere safe before signing in.");
      return;
    }
    if (!owner) {
      // The draft store restores the guest's idea after sign-in. Do not claim
      // a World was created or send unauthenticated writes to the kernel.
      router.push("/login?next=%2F");
      return;
    }
    startTransition(async () => {
      try {
        const result = await createProject(next, owner);
        if (!result.ok) { setError(result.error); return; }
        clear(result.worldId);
        router.push(`/world/${result.worldId}/room`);
        router.refresh();
      } catch {
        setError("The connection was interrupted. Your idea is still here; try again.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="solve-composer" aria-label="Start a World">
      <div className="solve-composer-heading">
        <span className="solve-kicker">Start with an idea</span>
        <span><Icon name="lock" width={13} />Private until you invite</span>
      </div>
      <label htmlFor="project-idea">What do you want to make happen?</label>
      <textarea
        id="project-idea"
        name="idea"
        value={idea}
        onChange={event => update(event.target.value)}
        required
        maxLength={7000}
        rows={4}
        placeholder="A project, a problem, a business, an invention, an idea…"
        disabled={pending || !ready}
      />
      {error ? <p role="alert" className="solve-error">{error}</p> : null}
      {storageBlocked ? <p role="status" className="solve-muted">This browser couldn't save the draft locally. Keep this page open.</p> : null}
      <div className="solve-composer-footer">
        <p>{owner
          ? "We'll create a private World. Add people, context and tools when you need them."
          : "Draft freely. Sign in only when you're ready to save your World."}</p>
        <button type="submit" disabled={pending || !ready || !idea.trim()} className="solve-button">
          {pending ? "Creating…" : owner ? "Start World" : "Continue to save"}
          <Icon name="arrow" width={17} />
        </button>
      </div>
    </form>
  );
}
