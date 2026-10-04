import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { label, primaryAction, quietLink, secondaryAction } from "@/app/ui";
import { KernelError, type ActorProfile } from "@/lib/kernel/client";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { loadCreativeWorld, type CreativeArtifact, type CreativePosition } from "@/lib/world/creative";
import { createArtifactAction, updateArtifactAction } from "./actions";

function eventTitle(type: string) {
  switch (type) {
    case "kernel.scope.claimed": return "World created";
    case "kernel.entity.created": return "Artifact created";
    case "kernel.entity.updated": return "Artifact updated";
    case "kernel.relation.created": return "Connection recorded";
    case "kernel.grant.issued": return "Access granted";
    case "kernel.grant.revoked": return "Access removed";
    default: return type.replace(/^kernel\./, "").replaceAll(".", " ");
  }
}

function actorAttribution(actorId: string, profiles: Map<string, ActorProfile>, labels: Map<string, string>) {
  const actor = profiles.get(actorId);
  const name = labels.get(actorId) ?? actorId.slice(0, 8);
  if (actor?.kind !== "agent" || !actor.accountable_party) return name;
  const owner = labels.get(actor.accountable_party) ?? actor.accountable_party.slice(0, 8);
  return `${name} · agent for ${owner}`;
}

function positionFromArtifact(artifact: CreativeArtifact): CreativePosition {
  return artifact.position;
}

function canvasColumn(position: CreativePosition) {
  return position.x < 34 ? 1 : position.x < 67 ? 2 : 3;
}

function ArtifactCard({ worldId, artifact }: { worldId: string; artifact: CreativeArtifact }) {
  const position = positionFromArtifact(artifact);
  const update = updateArtifactAction.bind(null, worldId);
  return (
    <article className="flex w-full flex-col gap-3 rounded-md border border-line bg-surface/95 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.25)] backdrop-blur-md">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-accent">Document · v{artifact.version}</p>
          <h3 className="mt-1 break-words text-base font-medium leading-snug">{artifact.title}</h3>
        </div>
        <span aria-hidden="true" className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent shadow-[0_0_14px_var(--accent)]" />
      </header>
      {artifact.body ? (
        <p className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-6 text-muted">{artifact.body}</p>
      ) : (
        <p className="text-sm italic text-muted">No text yet.</p>
      )}
      <details className="border-t border-line pt-2">
        <summary className="cursor-pointer list-none text-[10px] font-semibold uppercase tracking-[0.18em] text-muted hover:text-accent">Edit · move</summary>
        <form action={update} className="mt-3 flex flex-col gap-3">
          <input type="hidden" name="entityId" value={artifact.entityId} />
          <input type="hidden" name="requestId" value={randomUUID()} />
          <label className="flex flex-col gap-1.5 text-xs text-muted">
            Title
            <input name="title" required maxLength={160} defaultValue={artifact.title} className="h-10 rounded border border-line bg-background px-3 text-sm text-foreground outline-none focus:border-accent" />
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-muted">
            Text
            <textarea name="body" maxLength={7000} defaultValue={artifact.body} rows={5} className="resize-y rounded border border-line bg-background p-3 text-sm leading-5 text-foreground outline-none focus:border-accent" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-xs text-muted">
              Canvas X · {position.x}%
              <input name="x" type="range" min="0" max="100" defaultValue={position.x} className="accent-accent" />
            </label>
            <label className="flex flex-col gap-1.5 text-xs text-muted">
              Canvas Y · {position.y}%
              <input name="y" type="range" min="0" max="100" defaultValue={position.y} className="accent-accent" />
            </label>
          </div>
          <button type="submit" className={`${secondaryAction} w-full`}>Save revision</button>
        </form>
      </details>
    </article>
  );
}

function CreateArtifactForm({ worldId, position, error }: { worldId: string; position: CreativePosition; error?: string }) {
  const create = createArtifactAction.bind(null, worldId);
  return (
    <section className="flex flex-col gap-4 rounded-md border border-line bg-surface/75 p-5 md:p-6">
      <div className="flex flex-col gap-2">
        <p className={label}>Add to this World</p>
        <h2 className="text-xl font-medium tracking-tight">Make the first piece</h2>
        <p className="text-sm leading-6 text-muted">Text is the first artifact type. Its position and every revision are saved with the World.</p>
      </div>
      {error && (
        <p role="alert" className="rounded border border-negative/30 bg-negative/10 p-3 text-sm text-negative">
          {error === "artifact-input" ? "Add a title and check the canvas position." : error === "access" ? "Your access to this World has changed." : "The change could not be saved. Retry in a moment."}
        </p>
      )}
      <form action={create} className="flex flex-col gap-3">
        <input type="hidden" name="requestId" value={randomUUID()} />
        <input type="hidden" name="x" value={position.x} />
        <input type="hidden" name="y" value={position.y} />
        <label className="flex flex-col gap-1.5 text-xs text-muted">
          Title
          <input name="title" required maxLength={160} autoComplete="off" placeholder="A question, sketch, plan, or note" className="h-11 rounded-md border border-line bg-background px-3 text-sm text-foreground outline-none focus:border-accent" />
        </label>
        <label className="flex flex-col gap-1.5 text-xs text-muted">
          Text
          <textarea name="body" maxLength={7000} rows={6} placeholder="Put the first thought here…" className="resize-y rounded-md border border-line bg-background p-3 text-sm leading-6 text-foreground outline-none placeholder:text-muted/50 focus:border-accent" />
        </label>
        <button type="submit" className={primaryAction}>Add to World</button>
      </form>
    </section>
  );
}

export default async function CreativeWorldPage({ params, searchParams }: PageProps<"/world/[worldId]">) {
  const { worldId } = await params;
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/world/${worldId}`)}`);
  const { error, saved } = await searchParams;

  const kernel = await getKernel();
  let world: Awaited<ReturnType<typeof loadCreativeWorld>>["world"];
  let artifacts: CreativeArtifact[];
  let events: Awaited<ReturnType<typeof kernel.readEvents>> = [];
  let profiles: Awaited<ReturnType<typeof kernel.readActors>> = [];
  try {
    const loaded = await loadCreativeWorld(kernel, worldId);
    world = loaded.world;
    artifacts = loaded.artifacts;
    events = await kernel.readEvents(world.scope, { newestFirst: true, limit: 12 });
    profiles = await kernel.readActors([...new Set(events.map((event) => event.actor_id))]);
    const ownerIds = [...new Set(profiles.map((profile) => profile.accountable_party).filter((id): id is string => Boolean(id)))];
    const knownProfileIds = new Set(profiles.map((profile) => profile.actor_id));
    const missingOwnerIds = ownerIds.filter((id) => !knownProfileIds.has(id));
    if (missingOwnerIds.length) profiles = [...profiles, ...(await kernel.readActors(missingOwnerIds))];
  } catch (error) {
    if (error instanceof KernelError && error.name === "unauthenticated") redirect("/account");
    if (error instanceof KernelError && (error.name === "forbidden" || error.name === "not_found" || error.name === "invalid")) notFound();
    return (
      <main className="mx-auto flex min-h-svh w-full max-w-4xl flex-1 flex-col justify-center gap-4 px-4 py-12">
        <p className={label}>World unavailable</p>
        <h1 className="text-2xl font-medium">This World could not be loaded.</h1>
        <p className="max-w-xl text-sm leading-6 text-muted">The saved work is unchanged. Check the staging connection, then return and try again.</p>
        <Link href="/worlds" className={secondaryAction}>Your Worlds</Link>
      </main>
    );
  }

  const profilesById = new Map(profiles.map((profile) => [profile.actor_id, profile]));
  const actorLabels = new Map(profiles.map((profile) => [profile.actor_id, profile.label || profile.actor_id.slice(0, 8)]));
  const nextPosition = { x: 24 + (artifacts.length % 3) * 26, y: 26 + (Math.floor(artifacts.length / 3) % 3) * 22 };

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-[1440px] flex-1 flex-col gap-6 px-4 py-4 md:gap-8 md:px-8 md:py-7">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div className="flex min-w-0 items-center gap-3 md:gap-4">
          <Link href="/worlds" aria-label="Your Worlds" className="shrink-0 text-sm font-semibold uppercase tracking-[0.3em] text-accent">solve</Link>
          <span className="text-muted">/</span>
          <h1 className="truncate text-sm font-medium tracking-wide md:text-base">{world.title}</h1>
        </div>
        <nav aria-label="World navigation" className="flex items-center gap-1 rounded-md border border-line bg-surface/75 p-1">
          <span aria-current="page" className="rounded bg-accent/15 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">World</span>
          <a href="#history" className="rounded px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted hover:text-foreground">History</a>
        </nav>
      </header>

      <section className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className={label}>Private World · only granted people and agents can enter</p>
          <h2 className="text-2xl font-medium tracking-tight md:text-4xl">{world.title}</h2>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-positive" /> Saved to kernel</span>
          <span className="hidden font-mono md:inline">{worldId.slice(0, 8)}</span>
        </div>
      </section>

      {saved === "artifact" && <p role="status" className="rounded border border-positive/25 bg-positive/5 px-3 py-2 text-sm text-positive">Revision saved to World history.</p>}
      {error === "world-missing" && <p role="alert" className="rounded border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative">This World could not be found in the selected scope.</p>}

      <section aria-label="World canvas" className="grid flex-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(19rem,0.38fr)] xl:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <p className={label}>Canvas · {artifacts.length} {artifacts.length === 1 ? "piece" : "pieces"}</p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted">Changes are versioned</p>
          </div>
          {artifacts.length ? (
            <>
              <div
                className="hidden min-h-[600px] grid-cols-1 content-start gap-4 overflow-hidden rounded-md border border-line bg-surface/35 p-4 md:grid md:grid-cols-3"
                style={{
                  backgroundImage: "linear-gradient(rgb(242 247 251 / 0.035) 1px, transparent 1px), linear-gradient(90deg, rgb(242 247 251 / 0.035) 1px, transparent 1px), radial-gradient(ellipse at 50% 45%, rgb(34 211 238 / 0.07), transparent 55%)",
                  backgroundSize: "32px 32px, 32px 32px, 100% 100%",
                }}
              >
                {[...artifacts].sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x).map((artifact) => (
                  <div key={artifact.entityId} className="min-w-0" style={{ gridColumnStart: canvasColumn(artifact.position) }}>
                    <ArtifactCard worldId={worldId} artifact={artifact} />
                  </div>
                ))}
              </div>
              <div className="grid gap-3 md:hidden">
                {[...artifacts].sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x).map((artifact) => <ArtifactCard key={artifact.entityId} worldId={worldId} artifact={artifact} />)}
              </div>
            </>
          ) : (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-md border border-dashed border-line bg-surface/25 px-5 text-center md:min-h-[470px]">
              <span aria-hidden="true" className="text-3xl font-light text-accent/80">＋</span>
              <h3 className="text-lg font-medium">An open space</h3>
              <p className="max-w-sm text-sm leading-6 text-muted">Add the first piece from the panel. This canvas is blank until you decide what to make.</p>
            </div>
          )}
        </div>

        <aside className="flex flex-col gap-6">
          <CreateArtifactForm worldId={worldId} position={nextPosition} error={error === "artifact-input" || error === "artifact-save" || error === "access" ? error : undefined} />
          <section id="history" className="scroll-mt-6 flex flex-col gap-3 rounded-md border border-line bg-surface/45 p-5">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className={label}>History</h2>
              <span className="text-[10px] uppercase tracking-[0.14em] text-muted">Kernel events</span>
            </div>
            <ol className="flex flex-col divide-y divide-line">
              {events.map((event) => (
                <li key={event.id} className="flex items-start justify-between gap-4 py-3 text-sm">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span>{eventTitle(event.type)}</span>
                    <span className="truncate text-xs text-muted">{actorAttribution(event.actor_id, profilesById, actorLabels)}</span>
                  </div>
                  <time className="shrink-0 text-right text-[10px] leading-4 text-muted" dateTime={event.occurred_at}>
                    {new Date(event.occurred_at).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })}
                  </time>
                </li>
              ))}
            </ol>
            {!events.length && <p className="text-sm text-muted">No changes recorded.</p>}
          </section>
          <p className="px-1 text-xs leading-5 text-muted">Authority follows explicit kernel grants. Creating this World did not publish it or give any agent access.</p>
        </aside>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4">
        <Link href="/worlds" className={quietLink}>Your Worlds</Link>
        <span className="text-[10px] uppercase tracking-[0.16em] text-muted">One workspace · mobile and laptop</span>
      </footer>
    </main>
  );
}
