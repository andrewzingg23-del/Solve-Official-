"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TaskPlan } from "@/lib/capabilities/contracts";

type TasksResponse = { tasks: TaskPlan[]; complete: boolean; error?: string };

/** A task can be planned in SOLVE now. Execution is never simulated. */
export function WorldTaskBoard({ worldId, canWrite }: { worldId: string; canWrite: boolean }) {
  const [tasks, setTasks] = useState<TaskPlan[]>([]);
  const [complete, setComplete] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [notice, setNotice] = useState("");
  const pendingId = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/worlds/${worldId}/tasks`, { cache: "no-store" });
      const data = await response.json() as TasksResponse;
      if (!response.ok) throw new Error(data.error ?? "Could not read tasks.");
      setTasks(data.tasks);
      setComplete(data.complete);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not read tasks."); }
    finally { setLoading(false); }
  }, [worldId]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function propose(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !title.trim()) return;
    setBusy(true); setNotice("");
    const requestId = pendingId.current ?? crypto.randomUUID();
    pendingId.current = requestId;
    try {
      const response = await fetch(`/api/worlds/${worldId}/tasks`, {
        method:"POST", headers: { "Content-Type":"application/json" },
        body: JSON.stringify({
          requestId, title: title.trim(), instructions: instructions.trim(),
          capabilityId: "github.coding.worker",
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Task could not be saved.");
      pendingId.current = null;
      setTitle(""); setInstructions("");
      setNotice("Task created in the kernel. No coding worker has been dispatched.");
      await refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "The request failed; your draft remains."); }
    finally { setBusy(false); }
  }

  return (
    <details className="rounded-xl border border-line bg-surface/60 p-4">
      <summary className="cursor-pointer text-sm font-medium">Development tasks {tasks.length ? `· ${tasks.length}` : ""}</summary>
      <p className="mt-3 text-xs leading-5 text-muted">
        Tasks are saved with the World. Creating a task does not dispatch an agent or claim code has been delivered.
        Connect and authorize a real coding worker to dispatch these in a later stage.
      </p>
      {loading ? <p className="mt-3 text-xs text-muted">Loading tasks…</p> : tasks.length ? (
        <ul className="mt-3 space-y-2">
          {tasks.slice(0, 20).map(t => (
            <li key={t.id} className="rounded border border-line p-3">
              <p className="text-sm font-medium">{t.title}</p>
              {t.instructions ? <p className="mt-1 whitespace-pre-wrap text-xs text-muted">{t.instructions}</p> : null}
              <p className="mt-2 text-xs text-muted">{t.status} · {t.status === "created" ? "Not dispatched" : "See kernel task status"} · {t.capabilityId}</p>
            </li>
          ))}
        </ul>
      ) : <p className="mt-3 text-xs text-muted">No development tasks yet.</p>}
      {!complete ? <p className="text-xs text-muted">Showing a partial history. Older records were not scanned.</p> : null}
      {canWrite ? (
        <form onSubmit={propose} className="mt-4 flex flex-col gap-2">
          <label className="text-xs text-muted" htmlFor="task-title">Task name</label>
          <input id="task-title" required maxLength={160} value={title} onChange={e => { pendingId.current = null; setTitle(e.target.value); }}
            placeholder="Add a capability to the World" className="rounded border border-line bg-background p-3 text-sm" />
          <label className="text-xs text-muted" htmlFor="task-detail">What should be built?</label>
          <textarea id="task-detail" value={instructions} maxLength={7000} rows={3}
            onChange={e => { pendingId.current = null; setInstructions(e.target.value); }}
            placeholder="Describe the desired result and how to verify it" className="rounded border border-line bg-background p-3 text-sm" />
          <button type="submit" disabled={busy || !title.trim()} className="self-start rounded border border-accent/50 px-3 py-2 text-sm text-accent disabled:opacity-50">
            {busy ? "Saving…" : "Save development task"}
          </button>
        </form>
      ) : null}
      {notice ? <p role="status" className="mt-2 text-xs text-muted">{notice}</p> : null}
    </details>
  );
}
