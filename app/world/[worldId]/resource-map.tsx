import { randomUUID } from "node:crypto";
import { label, primaryAction, secondaryAction } from "@/app/ui";
import {
  CREATIVE_RESOURCE_CATEGORIES,
  type CreativeResourceEntry,
} from "@/lib/world/creative";
import { createResourceEntryAction, updateResourceEntryAction } from "./actions";

function ResourceEntryCard({
  worldId,
  entry,
  reportedByLabel,
  reportedOnBehalfOfLabel,
  updatedByLabel,
  updatedOnBehalfOfLabel,
  currentActorId,
}: {
  worldId: string;
  entry: CreativeResourceEntry;
  reportedByLabel: string;
  reportedOnBehalfOfLabel: string | null;
  updatedByLabel: string;
  updatedOnBehalfOfLabel: string | null;
  currentActorId: string;
}) {
  const update = updateResourceEntryAction.bind(null, worldId);
  const stateLabel = entry.status === "withdrawn"
    ? "Withdrawn"
    : entry.entryType === "offer"
      ? "Offer · self-described"
      : "Need · open";

  return (
    <article className="flex flex-col gap-2 rounded border border-line bg-background/65 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-accent">{stateLabel}</span>
          <span className="text-[10px] text-muted">v{entry.version}</span>
        </div>
        <span className="text-[10px] text-muted">
          Reported by {reportedByLabel}{reportedOnBehalfOfLabel ? " for " + reportedOnBehalfOfLabel : ""}
        </span>
      </div>
      {entry.version > 1 && (
        <p className="text-[10px] text-muted">
          Latest revision by {updatedByLabel}{updatedOnBehalfOfLabel ? " for " + updatedOnBehalfOfLabel : ""}
        </p>
      )}
      <h4 className="break-words text-sm font-medium">{entry.title}</h4>
      <p className="whitespace-pre-wrap break-words text-sm leading-5 text-muted">{entry.description}</p>
      {entry.timeWindow && <p className="text-xs text-muted">Time or constraint: {entry.timeWindow}</p>}
      {entry.sourceUrl && (
        <a href={entry.sourceUrl} target="_blank" rel="noreferrer" className="w-fit text-xs text-accent underline underline-offset-2">
          User-supplied source · not verified
        </a>
      )}
      {entry.reportedBy === currentActorId ? (
        <details className="border-t border-line pt-2">
          <summary className="cursor-pointer list-none text-[10px] font-semibold uppercase tracking-[0.14em] text-muted hover:text-accent">Revise or withdraw</summary>
          <form action={update} className="mt-3 flex flex-col gap-3">
            <input type="hidden" name="entityId" value={entry.entityId} />
            <input type="hidden" name="requestId" value={randomUUID()} />
            <label className="flex flex-col gap-1 text-xs text-muted">
              Title
              <input name="title" required maxLength={160} defaultValue={entry.title} className="h-10 rounded border border-line bg-surface px-3 text-sm text-foreground outline-none focus:border-accent" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Details
              <textarea name="description" required maxLength={7000} defaultValue={entry.description} rows={3} className="resize-y rounded border border-line bg-surface p-3 text-sm leading-5 text-foreground outline-none focus:border-accent" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Time window or constraint
              <input name="timeWindow" maxLength={300} defaultValue={entry.timeWindow} className="h-10 rounded border border-line bg-surface px-3 text-sm text-foreground outline-none focus:border-accent" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Source URL · optional
              <input name="sourceUrl" type="url" maxLength={2048} defaultValue={entry.sourceUrl} className="h-10 rounded border border-line bg-surface px-3 text-sm text-foreground outline-none focus:border-accent" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Entry state
              <select name="status" defaultValue={entry.status} className="h-10 rounded border border-line bg-surface px-3 text-sm text-foreground outline-none focus:border-accent">
                <option value="open">Open</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
            </label>
            <button type="submit" className={secondaryAction}>Save revision</button>
          </form>
        </details>
      ) : (
        <p className="border-t border-line pt-2 text-[10px] leading-4 text-muted">Only the original event author can revise or withdraw this entry.</p>
      )}
    </article>
  );
}

export function ResourceMapPanel({
  worldId,
  entries,
  actorLabels,
  currentActorId,
  saved,
  error,
}: {
  worldId: string;
  entries: CreativeResourceEntry[];
  actorLabels: Map<string, string>;
  currentActorId: string;
  saved: boolean;
  error?: string;
}) {
  const create = createResourceEntryAction.bind(null, worldId);
  const errorMessage = error === "resource-input"
    ? "Check the category, title, details, time window, and source URL."
    : error === "access"
      ? "Your access to this World has changed."
      : error === "resource-save"
        ? "This entry could not be saved. Retry in a moment."
        : null;
  const offers = entries.filter((entry) => entry.entryType === "offer" && entry.status === "open").length;
  const needs = entries.filter((entry) => entry.entryType === "need" && entry.status === "open").length;

  return (
    <section id="resources" className="scroll-mt-6 flex flex-col gap-4 rounded-md border border-line bg-surface/55 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <p className={label}>Project resources</p>
          <h2 className="text-xl font-medium tracking-tight">What we have · what we need</h2>
          <p className="max-w-2xl text-sm leading-6 text-muted">
            Map time, skill, ideas, capital, labor, and other resources in this World. Offers are possibilities, not promises; needs are not assigned automatically.
          </p>
        </div>
        <p className="text-xs text-muted">{offers} open {offers === 1 ? "offer" : "offers"} · {needs} open {needs === 1 ? "need" : "needs"}</p>
      </div>

      {saved && <p role="status" className="rounded border border-positive/25 bg-positive/5 px-3 py-2 text-sm text-positive">Resource map updated. The change is recorded in World history.</p>}
      {errorMessage && <p role="alert" className="rounded border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative">{errorMessage}</p>}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {CREATIVE_RESOURCE_CATEGORIES.map((category) => {
          const categoryEntries = entries
            .filter((entry) => entry.category === category.value)
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
          return (
            <section key={category.value} className="flex min-w-0 flex-col gap-3 rounded border border-line bg-surface/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-[0.14em]">{category.label}</h3>
                <span className="text-[10px] text-muted">{categoryEntries.length} {categoryEntries.length === 1 ? "entry" : "entries"}</span>
              </div>
              {categoryEntries.length ? (
                <div className="flex flex-col gap-2">
                  {categoryEntries.map((entry) => (
                    <ResourceEntryCard
                      key={entry.entityId}
                      worldId={worldId}
                      entry={entry}
                      reportedByLabel={entry.reportedBy ? actorLabels.get(entry.reportedBy) ?? entry.reportedBy.slice(0, 8) : "Attribution unavailable"}
                      reportedOnBehalfOfLabel={entry.reportedOnBehalfOf ? actorLabels.get(entry.reportedOnBehalfOf) ?? entry.reportedOnBehalfOf.slice(0, 8) : null}
                      updatedByLabel={entry.updatedBy ? actorLabels.get(entry.updatedBy) ?? entry.updatedBy.slice(0, 8) : "Attribution unavailable"}
                      updatedOnBehalfOfLabel={entry.updatedOnBehalfOf ? actorLabels.get(entry.updatedOnBehalfOf) ?? entry.updatedOnBehalfOf.slice(0, 8) : null}
                      currentActorId={currentActorId}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-xs leading-5 text-muted">Not mapped yet. An empty category means unknown, not available.</p>
              )}
            </section>
          );
        })}
      </div>

      <details className="rounded border border-line bg-background/60 p-4">
        <summary className="cursor-pointer list-none text-sm font-medium hover:text-accent">Add an offer or need</summary>
        <form action={create} className="mt-4 grid gap-3 md:grid-cols-2">
          <input type="hidden" name="requestId" value={randomUUID()} />
          <label className="flex flex-col gap-1.5 text-xs text-muted">
            I can offer / I need
            <select name="entryType" defaultValue="need" className="h-10 rounded border border-line bg-surface px-3 text-sm text-foreground outline-none focus:border-accent">
              <option value="need">I need this</option>
              <option value="offer">I can offer this</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-muted">
            Resource category
            <select name="category" defaultValue="time" className="h-10 rounded border border-line bg-surface px-3 text-sm text-foreground outline-none focus:border-accent">
              {CREATIVE_RESOURCE_CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-muted md:col-span-2">
            Short title
            <input name="title" required maxLength={160} autoComplete="off" placeholder="e.g. CAD modeling help or $500 materials budget" className="h-10 rounded border border-line bg-surface px-3 text-sm text-foreground outline-none focus:border-accent" />
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-muted md:col-span-2">
            Details
            <textarea name="description" required maxLength={7000} rows={3} placeholder="What exactly is available or needed?" className="resize-y rounded border border-line bg-surface p-3 text-sm leading-5 text-foreground outline-none focus:border-accent" />
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-muted">
            Time window or constraint · optional
            <input name="timeWindow" maxLength={300} autoComplete="off" placeholder="e.g. by Friday, 4 hours each week" className="h-10 rounded border border-line bg-surface px-3 text-sm text-foreground outline-none focus:border-accent" />
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-muted">
            Source or evidence URL · optional
            <input name="sourceUrl" type="url" maxLength={2048} autoComplete="url" placeholder="https://…" className="h-10 rounded border border-line bg-surface px-3 text-sm text-foreground outline-none focus:border-accent" />
          </label>
          <p className="md:col-span-2 text-xs leading-5 text-muted">
            This remains private to people and agents granted access to this World. A supplied URL is an unverified pointer; do not paste secrets, signed private links, or sensitive personal details. SOV does not match, assign, message, purchase, or publish from this entry.
          </p>
          <button type="submit" className={primaryAction}>Add to resource map</button>
        </form>
      </details>
    </section>
  );
}
