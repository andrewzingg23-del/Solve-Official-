import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { KernelError, type Task } from "@/lib/kernel/client";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { loadCreativeWorld } from "@/lib/world/creative";
import { workStatusLabel } from "@/lib/work/intent";
import { createWorkTaskAction } from "./actions";

export const metadata: Metadata = { title: "Work · SOLVE" };

type WorkView = {
  title: string;
  worldId: string;
  tasks: Task[] | null;
  canCreate: boolean;
};

async function readWork(worldId: string): Promise<WorkView | "missing" | "unavailable"> {
  try {
    const kernel = await getKernel();
    const { world } = await loadCreativeWorld(kernel, worldId);
    const [records, permission] = await Promise.allSettled([
      kernel.readTasks(world.scope),
      kernel.authorize({ capability: "task.create", scope: world.scope }),
    ]);
    const tasks = records.status === "fulfilled" ? records.value : null;
    // A failed read must never appear to be an empty list or a successful task.
    return {
      title: world.title,
      worldId: world.worldId,
      tasks,
      canCreate: tasks !== null && permission.status === "fulfilled" && permission.value.decision === "ALLOW",
    };
  } catch (error) {
    if (error instanceof KernelError && (error.name === "forbidden" || error.name === "not_found" || error.name === "invalid")) return "missing";
    return "unavailable";
  }
}

const notices: Record<string, string> = {
  input: "Check the task title, description and review choice. Nothing was saved.",
  access: "Your permission to create work in this project is missing or has changed. Nothing was saved.",
  unavailable: "The kernel could not confirm the task. Reopen this project before trying again.",
};

export default async function WorldWorkPage({ params, searchParams }: PageProps<"/world/[worldId]/work">) {
  const { worldId } = await params;
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/world/${worldId}/work`)}`);

  const { saved, error } = await searchParams;
  const work = await readWork(worldId);
  if (work === "missing") notFound();
  if (work === "unavailable") {
    return <main className="solve-page mx-auto max-w-3xl">
      <h1>Work is temporarily unavailable.</h1>
      <p>Your project and its tasks have not been deleted. The kernel did not answer.</p>
      <Link href={`/world/${encodeURIComponent(worldId)}/room`} className="solve-text-link">Return to the project</Link>
    </main>;
  }

  const room = `/world/${encodeURIComponent(work.worldId)}/room`;
  const notice = typeof error === "string" ? notices[error] : null;

  return <main className="solve-page mx-auto w-full max-w-6xl space-y-6">
    <header className="solve-page-heading space-y-2">
      <span className="solve-kicker">Your project · Work</span>
      <h1>Make something happen.</h1>
      <p>Start with an outcome. SOLVE keeps the work, permissions and history together in this project.</p>
      <nav aria-label="Project workspace" className="flex flex-wrap gap-4 text-sm">
        <Link href={room} className="solve-text-link">Conversation and people</Link>
        <Link href={`/world/${encodeURIComponent(work.worldId)}`} className="solve-text-link">Project details</Link>
      </nav>
    </header>

    {saved === "task" ? <p role="status" className="rounded-lg border border-line bg-surface p-4 text-sm">Task saved in this project. No AI has been started or given new permissions.</p> : null}
    {notice ? <p role="alert" className="rounded-lg border border-line bg-surface p-4 text-sm">{notice}</p> : null}

    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <section aria-labelledby="new-work-title" className="solve-panel space-y-4 p-5 sm:p-6">
        <div className="space-y-2">
          <span className="solve-kicker">01 · Intention</span>
          <h2 id="new-work-title" className="text-xl font-medium">What needs to happen?</h2>
          <p className="text-sm leading-6 text-muted">A task is a real record. It can later be claimed only by someone you have authorized.</p>
        </div>
        {work.canCreate ? <form action={createWorkTaskAction.bind(null, work.worldId)} className="space-y-4">
          <input type="hidden" name="requestId" value={randomUUID()} />
          <div className="space-y-2">
            <label htmlFor="work-title" className="block text-sm font-medium">Outcome</label>
            <input id="work-title" name="title" type="text" minLength={3} maxLength={160} required
              placeholder="Build a landing page for my business"
              className="min-h-11 w-full rounded-lg border border-line bg-background px-3 py-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" />
          </div>
          <div className="space-y-2">
            <label htmlFor="work-objective" className="block text-sm font-medium">What would success look like? <span className="text-muted">(optional)</span></label>
            <textarea id="work-objective" name="objective" maxLength={2000} rows={4}
              placeholder="Describe the result, constraints or what you want to verify."
              className="w-full resize-y rounded-lg border border-line bg-background px-3 py-3 text-sm leading-6 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" />
          </div>
          <label className="flex cursor-pointer items-start gap-3 text-sm leading-6">
            <input type="checkbox" name="review" value="yes" className="mt-1.5 size-4 accent-white" />
            <span>Require another authorized person or agent to verify completion.</span>
          </label>
          <button type="submit" className="solve-button min-h-11 w-full">Save this work</button>
          <p className="text-xs leading-5 text-muted">Nothing is executed, assigned, published or spent by saving a task. You control who can act next.</p>
        </form> : <div role="status" className="rounded-lg border border-line bg-background/60 p-4 text-sm leading-6 text-muted">
          {work.tasks === null
            ? "Task records could not be read. No new action is available until the connection is restored."
            : "You can view this work, but you do not currently have permission to create tasks here."}
        </div>}
      </section>

      <section aria-labelledby="work-list-title" className="space-y-4">
        <div className="space-y-2">
          <span className="solve-kicker">02 · Durable work</span>
          <h2 id="work-list-title" className="text-xl font-medium">Work in {work.title}</h2>
          <p className="text-sm leading-6 text-muted">These states come from the kernel—not from an AI&apos;s description of what it did.</p>
        </div>
        {work.tasks === null ? (
          <div role="status" className="solve-panel p-5"><p>Tasks could not be loaded. The list is unavailable, not empty.</p></div>
        ) : work.tasks.length === 0 ? (
          <div className="solve-panel space-y-2 p-5">
            <h3 className="font-medium">Nothing recorded yet.</h3>
            <p className="text-sm leading-6 text-muted">Describe your first outcome. It will remain here when you return.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {work.tasks.map(task => <li key={task.task_id} className="solve-panel space-y-3 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h3 className="min-w-0 flex-1 break-words font-medium">{task.title}</h3>
                <span className="rounded-full border border-line bg-background/50 px-3 py-1 text-xs text-muted">{workStatusLabel(task.status)}</span>
              </div>
              {task.objective && task.objective !== task.title ? <p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted">{task.objective}</p> : null}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                <span>{task.worker_id ? "Claimed by an authorized worker" : "No worker assigned"}</span>
                <span>{task.verification === "none" ? "No separate reviewer required" : "Independent review required"}</span>
              </div>
              {task.status === "blocked" || task.status === "failed" || task.status === "needs_reconciliation" ?
                <p role="status" className="text-sm">This task requires attention. Return to the shared project to coordinate the next step.</p> : null}
            </li>)}
          </ul>
        )}
        <p className="text-xs leading-5 text-muted">Assignment, execution and external actions require separate grants and evidence. SOLVE never treats an addressed message as proof that a worker acted.</p>
      </section>
    </div>
  </main>;
}
