import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { label, quietLink, secondaryAction } from "@/app/ui";
import { KernelError } from "@/lib/kernel/client";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { IDEA_RELATION_KINDS, IDEA_STATUSES, readIdeaGraph, type IdeaRecord, type IdeaRelationKind } from "@/lib/world/ideas";
import { loadCreativeWorld } from "@/lib/world/creative";
import { createIdeaAction, relateIdeaAction, updateIdeaStatusAction } from "./actions";
import { IdeaExpansion } from "./expansion";

const words = (value: string) => value.replaceAll("_", " ");
const relationTitles: Record<IdeaRelationKind, string> = {
  idea_derived_from: "Derived from",
  idea_supports: "Supports",
  idea_contradicts: "Contradicts",
  idea_supersedes: "Supersedes",
  idea_implemented_by: "Implemented by",
  idea_tested_by: "Tested by",
  idea_evidenced_by: "Evidence from",
  idea_blocked_by: "Blocked by",
};

function IdeaCard({ idea, ideas, worldId, relations }: {
  idea: IdeaRecord;
  ideas: IdeaRecord[];
  worldId: string;
  relations: { id: string; kind: IdeaRelationKind; fromId: string; toId: string }[];
}) {
  const changeStatus = updateIdeaStatusAction.bind(null, worldId);
  const relate = relateIdeaAction.bind(null, worldId);
  const related = relations.filter((edge) => edge.fromId === idea.id || edge.toId === idea.id);
  return (
    <article className="flex flex-col gap-4 rounded-md border border-line bg-surface/75 p-4 md:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-accent">Idea · v{idea.version}</p>
          <h3 className="mt-1 break-words text-lg font-medium">{idea.title}</h3>
          {idea.description && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">{idea.description}</p>}
        </div>
        <span className="rounded border border-line px-2 py-1 text-[9px] uppercase tracking-[0.14em] text-muted">{words(idea.status)}</span>
      </header>

      {(idea.assumptions.length > 0 || idea.openQuestions.length > 0) && (
        <div className="grid gap-3 border-t border-line pt-3 sm:grid-cols-2">
          {idea.assumptions.length > 0 && <div><p className={label}>Assumptions</p><ul className="mt-1 list-disc pl-4 text-xs leading-5 text-muted">{idea.assumptions.map((item, i) => <li key={i}>{item}</li>)}</ul></div>}
          {idea.openQuestions.length > 0 && <div><p className={label}>Open questions</p><ul className="mt-1 list-disc pl-4 text-xs leading-5 text-muted">{idea.openQuestions.map((item, i) => <li key={i}>{item}</li>)}</ul></div>}
        </div>
      )}

      <IdeaExpansion worldId={worldId} ideaId={idea.id} />

      {related.length > 0 && (
        <div className="border-t border-line pt-3">
          <p className={label}>Lineage</p>
          <ul className="mt-2 flex flex-col gap-2 text-xs">
            {related.map((edge) => {
              const otherId = edge.fromId === idea.id ? edge.toId : edge.fromId;
              const other = ideas.find((candidate) => candidate.id === otherId);
              return <li key={edge.id} className="flex flex-wrap gap-1.5 text-muted"><span className="text-accent">{relationTitles[edge.kind]}</span><span aria-hidden="true">·</span><span>{other?.title ?? otherId.slice(0, 8)}</span></li>;
            })}
          </ul>
        </div>
      )}

      {ideas.length > 1 && (
        <details className="border-t border-line pt-3">
          <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.15em] text-muted hover:text-accent">Connect this idea</summary>
          <form action={relate} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input type="hidden" name="fromId" value={idea.id} />
            <input type="hidden" name="requestId" value={randomUUID()} />
            <select name="kind" className="h-10 rounded border border-line bg-background px-2 text-xs">
              {IDEA_RELATION_KINDS.slice(0, 4).map((kind) => <option key={kind} value={kind}>{relationTitles[kind]}</option>)}
            </select>
            <select name="toId" required defaultValue="" className="h-10 min-w-0 rounded border border-line bg-background px-2 text-xs">
              <option value="" disabled>Choose related idea</option>
              {ideas.filter((candidate) => candidate.id !== idea.id).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.title}</option>)}
            </select>
            <button type="submit" className={secondaryAction}>Connect</button>
          </form>
        </details>
      )}

      <details className="border-t border-line pt-3">
        <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.15em] text-muted hover:text-accent">Update status</summary>
        <form action={changeStatus} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input type="hidden" name="ideaId" value={idea.id} />
          <input type="hidden" name="requestId" value={randomUUID()} />
          <select name="status" defaultValue={idea.status} className="h-10 rounded border border-line bg-background px-2 text-xs">
            {IDEA_STATUSES.filter((status) => status !== idea.status).map((status) => <option key={status} value={status}>{words(status)}</option>)}
          </select>
          <input name="reason" maxLength={1000} placeholder="Reason for rejection or blocker" className="h-10 min-w-0 rounded border border-line bg-background px-3 text-xs" />
          <button type="submit" className={secondaryAction}>Save</button>
        </form>
      </details>
    </article>
  );
}

export default async function WorldIdeasPage({ params, searchParams }: PageProps<"/world/[worldId]/ideas">) {
  const { worldId } = await params;
  if (!(await getUser())) redirect(`/login?next=${encodeURIComponent(`/world/${worldId}/ideas`)}`);
  const { error, saved } = await searchParams;
  const kernel = await getKernel();
  let world: Awaited<ReturnType<typeof loadCreativeWorld>>["world"];
  let graph: Awaited<ReturnType<typeof readIdeaGraph>>;
  try {
    world = (await loadCreativeWorld(kernel, worldId)).world;
    graph = await readIdeaGraph(kernel, world.scope);
  } catch (error) {
    if (error instanceof KernelError && error.name === "unauthenticated") redirect("/account");
    if (error instanceof KernelError && ["forbidden", "not_found", "invalid"].includes(error.name)) notFound();
    throw error;
  }
  const create = createIdeaAction.bind(null, worldId);
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-4 md:gap-8 md:px-8 md:py-7">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link href={`/world/${worldId}`} className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">solve</Link>
          <span className="text-muted">/</span>
          <Link href={`/world/${worldId}`} className="truncate text-sm font-medium hover:text-accent">{world.title}</Link>
          <span className="text-muted">/</span>
          <h1 className="text-sm font-medium text-accent">Ideas</h1>
        </div>
        <nav aria-label="World navigation" className="flex items-center gap-1 rounded-md border border-line bg-surface/75 p-1">
          <Link href={`/world/${worldId}`} className="rounded px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted hover:text-foreground">World</Link>
          <span aria-current="page" className="rounded bg-accent/15 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">Ideas</span>
          <Link href={`/world/${worldId}#history`} className="rounded px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted hover:text-foreground">History</Link>
        </nav>
      </header>

      <section className="flex flex-col gap-2">
        <p className={label}>Development memory · private to this World</p>
        <h2 className="text-2xl font-medium tracking-tight md:text-4xl">Ideas stay connected.</h2>
        <p className="max-w-2xl text-sm leading-6 text-muted">Capture what you are thinking, keep assumptions and open questions visible, and connect new ideas to what came before. Each change is recorded in the kernel history.</p>
      </section>

      {saved && <p role="status" className="rounded border border-positive/25 bg-positive/5 px-3 py-2 text-sm text-positive">{saved === "idea" ? "Idea saved to this World." : saved === "link" ? "Lineage link saved." : "Status change saved to history."}</p>}
      {error && <p role="alert" className="rounded border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative">{error === "access" ? "Your access to this World changed." : error === "input" ? "Check the idea details and status transition." : "The idea could not be saved. Check access and try again."}</p>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-start">
        <section className="flex flex-col gap-4 rounded-md border border-line bg-surface/75 p-5 md:p-6">
          <div><p className={label}>Start with an idea</p><h3 className="mt-1 text-xl font-medium">Add a thought</h3></div>
          <form action={create} className="flex flex-col gap-3">
            <input type="hidden" name="requestId" value={randomUUID()} />
            <label className="flex flex-col gap-1.5 text-xs text-muted">Title<input name="title" required maxLength={160} className="h-10 rounded border border-line bg-background px-3 text-sm text-foreground outline-none focus:border-accent" /></label>
            <label className="flex flex-col gap-1.5 text-xs text-muted">Description<textarea name="description" maxLength={7000} rows={4} className="resize-y rounded border border-line bg-background p-3 text-sm leading-5 text-foreground outline-none focus:border-accent" /></label>
            <label className="flex flex-col gap-1.5 text-xs text-muted">Assumptions<textarea name="assumptions" rows={2} placeholder="One per line" className="resize-y rounded border border-line bg-background p-3 text-sm leading-5 text-foreground outline-none focus:border-accent" /></label>
            <label className="flex flex-col gap-1.5 text-xs text-muted">Open questions<textarea name="openQuestions" rows={2} placeholder="One per line" className="resize-y rounded border border-line bg-background p-3 text-sm leading-5 text-foreground outline-none focus:border-accent" /></label>
            <button type="submit" className="h-11 rounded bg-accent px-4 text-xs font-semibold uppercase tracking-[0.14em] text-background">Save idea</button>
          </form>
          <p className="text-[11px] leading-5 text-muted">Ideas remain private to this World. Rejected or blocked ideas keep their reason and history.</p>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3"><h3 className={label}>Idea graph</h3><span className="text-[10px] uppercase tracking-[0.14em] text-muted">{graph.ideas.length} ideas · {graph.links.length} links</span></div>
          {graph.ideas.length ? (
            [...graph.ideas].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((idea) => <IdeaCard key={idea.id} idea={idea} ideas={graph.ideas} worldId={worldId} relations={graph.links} />)
          ) : (
            <div className="rounded-md border border-dashed border-line bg-surface/25 p-8 text-center">
              <p className="text-lg font-medium">Nothing captured yet</p>
              <p className="mt-2 text-sm leading-6 text-muted">Start anywhere. There is no required funnel or template.</p>
            </div>
          )}
        </section>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4"><Link href={`/world/${worldId}`} className={quietLink}>Back to World</Link><span className="text-[10px] uppercase tracking-[0.16em] text-muted">Private by grant · append-only history</span></footer>
    </main>
  );
}
