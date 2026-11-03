import { ProjectNav } from "./project-nav";
import { readMeaningfulActivity } from "@/lib/world/progress";
import { NextSteps } from "./next-steps/panel";
import { RecoverableForm } from "@/app/product/recoverable-form";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { label, primaryAction, secondaryAction } from "@/app/ui";
import { KernelError } from "@/lib/kernel/client";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { loadCreativeWorld, type CreativeArtifact, type CreativePosition } from "@/lib/world/creative";
import { formatWorldActorAttribution } from "@/lib/world/attribution";
import { parsePixelArt } from "@/lib/bot/pixel-art";
import { parsePart } from "@/lib/bot/part";
import { proofsIn, type SavedProof } from "@/lib/bot/proof";
import { parseOutreach } from "@/lib/bot/outreach";
import { parseRoutes, takenRoutes, type TakenRoute } from "@/lib/bot/routes";
import { PartPreview } from "@/app/part-preview";
import { SavePoint } from "@/app/save-point";
import { RouteCard } from "@/app/route-card";
import { stepDoneAction, takeRouteAction } from "@/app/route-actions";
import { createArtifactAction } from "./actions";
import { ArtifactEditor } from "./artifact-editor";
import { DraftPreview } from "./draft-preview";
import { generateFirstDraftAction } from "./draft-actions";
import { looksLikeHtmlDocument, stripActiveContent } from "@/lib/product/website-draft";

// First-draft generation runs as a server action on this route; give it room for the bounded
// (~50s) model call plus a buffer to return a recoverable result.
export const maxDuration = 60;
import { WorldBotAccessPanel } from "./bot-access-panel";
import { WorldAccessPanel } from "./access-panel";
import { WorldLiveSync } from "./live-sync";
import { WorldPresence } from "./presence";
import { ResourceMapPanel } from "./resource-map";
import { eventTitle } from "../event-title";

function PixelArtPreview({ body, title }: { body: string; title: string }) {
  const art = parsePixelArt(body);
  if (!art) return null;
  const width = art.rows[0].length;
  return (
    <figure className="flex flex-col gap-2 rounded border border-line bg-background/70 p-3">
      <div
        role="img"
        aria-label={`${title}: ${art.prompt}`}
        className="mx-auto w-full max-w-64"
        style={{ display: "grid", gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))`, aspectRatio: `${width} / ${art.rows.length}`, imageRendering: "pixelated" }}
      >
        {art.rows.flatMap((row, y) => [...row].map((cell, x) => (
          <span key={`${y}-${x}`} style={{ backgroundColor: cell === "." ? "transparent" : art.palette[Number(cell)] }} />
        )))}
      </div>
      <figcaption className="text-xs leading-5 text-muted">{art.prompt} · {width}×{art.rows.length} pixels</figcaption>
    </figure>
  );
}

function ArtifactCard({ worldId, artifact, saves = [], taken = null, takenBy = "you", canEdit }: { worldId: string; artifact: CreativeArtifact; saves?: SavedProof[]; taken?: TakenRoute | null; takenBy?: string; canEdit: boolean }) {
  const isPixelArt = parsePixelArt(artifact.body) !== null;
  const isPart = parsePart(artifact.body) !== null;
  const routes = parseRoutes(artifact.body);
  const outreach = routes ? null : parseOutreach(artifact.body);
  const isWebsite = !routes && !outreach && !isPart && !isPixelArt && looksLikeHtmlDocument(artifact.body);
  return (
    <article id={`piece-${artifact.entityId}`} className="flex w-full scroll-mt-6 flex-col gap-3 rounded-md border border-line bg-surface/95 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.25)] backdrop-blur-md">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-accent">{artifact.visibility === "private" ? "Private document" : "Document"} · v{artifact.version}{artifact.via ? ` · via ${artifact.via}` : ""}</p>
          <h3 className="mt-1 break-words text-base font-medium leading-snug">{artifact.title}</h3>
        </div>
      </header>
      {outreach ? (
        <div className="flex flex-col gap-3 text-sm"><p className="text-muted">Saved outreach drafts. These messages have not been sent.</p>{outreach.leads.map((lead, index) => <div key={index} className="rounded border border-line p-3"><h4>{lead.name}</h4><p className="mt-2 whitespace-pre-wrap text-muted">{lead.message}</p></div>)}</div>
      ) : routes && canEdit ? (
        <RouteCard pieceId={artifact.entityId} routes={routes} taken={taken} who={takenBy} take={takeRouteAction.bind(null, worldId)} markDone={stepDoneAction.bind(null, worldId)} />
      ) : isPart ? (
        <PartPreview worldId={worldId} pieceId={artifact.entityId} body={artifact.body} title={artifact.title} />
      ) : isPixelArt ? (
        <PixelArtPreview body={artifact.body} title={artifact.title} />
      ) : isWebsite ? (
        <DraftPreview html={stripActiveContent(artifact.body)} title={artifact.title} />
      ) : artifact.body ? (
        <p className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-6 text-muted">{artifact.body}</p>
      ) : (
        <p className="text-sm italic text-muted">No text yet.</p>
      )}
      {saves.length ? (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          {saves.slice(-2).reverse().map((p) => (
            <SavePoint key={p.recordId} what={p.what} basis={p.basis} at={p.at} number={p.number} link={p.link} />
          ))}
        </div>
      ) : null}
      {canEdit ? <details className="border-t border-line pt-2">
        <summary className="cursor-pointer list-none text-[10px] font-semibold uppercase tracking-[0.18em] text-muted hover:text-accent">Edit document</summary>
        <ArtifactEditor worldId={worldId} artifact={artifact} />
      </details> : null}
    </article>
  );
}

function CreateArtifactForm({ worldId, position, error, actorId }: { worldId: string; position: CreativePosition; error?: string; actorId: string }) {
  const create = createArtifactAction.bind(null, worldId);
  return (
    <section className="flex flex-col gap-4 rounded-md border border-line bg-surface/75 p-5 md:p-6">
      <div className="flex flex-col gap-2">
        <p className={label}>Add a document</p>
        <h2 className="text-xl font-medium tracking-tight">Keep your work together</h2>
        <p className="text-sm leading-6 text-muted">Save a note, question or plan. Everyone with access can see shared documents; revisions keep their authorship.</p>
      </div>
      {error && (
        <p role="alert" className="rounded border border-negative/30 bg-negative/10 p-3 text-sm text-negative">
          {error === "artifact-input" ? "Add a title and try again." : error === "access" ? "Your access to this project has changed." : "The change could not be saved. Retry in a moment."}
        </p>
      )}
      <RecoverableForm action={create} ownerActorId={actorId} className="flex flex-col gap-3">
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
        <button type="submit" className={primaryAction}>Save document</button>
      </RecoverableForm>
    </section>
  );
}

function FirstDraftPanel({ worldId, actorId, goal }: { worldId: string; actorId: string; goal: string }) {
  const generate = generateFirstDraftAction.bind(null, worldId);
  return (
    <section className="flex flex-col gap-4 rounded-md border border-accent/40 bg-surface/80 p-5 shadow-[0_0_30px_rgba(34,211,238,0.12)] md:p-6">
      <div className="flex flex-col gap-2">
        <p className={label}>Start here</p>
        <h2 className="text-xl font-medium tracking-tight">See a first draft</h2>
        <p className="text-sm leading-6 text-muted">SOLVE turns your idea into an interactive website draft you can look at and refine. This takes a few seconds.</p>
      </div>
      <RecoverableForm action={generate} ownerActorId={actorId} className="flex flex-col gap-3" successMessage="Building your first preview…">
        <input type="hidden" name="requestId" value={randomUUID()} />
        <label className="flex flex-col gap-1.5 text-xs text-muted">
          What you want to make happen
          <textarea name="goal" defaultValue={goal} maxLength={7000} rows={3} placeholder="Describe your idea. We’ll help shape the first draft." className="resize-y rounded-md border border-line bg-background p-3 text-sm leading-6 text-foreground outline-none placeholder:text-muted/50 focus:border-accent" />
        </label>
        <button type="submit" className={primaryAction}>Create first draft</button>
      </RecoverableForm>
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
  let resources: Awaited<ReturnType<typeof loadCreativeWorld>>["resources"];
  let currentActorId = "";
  let events: Awaited<ReturnType<typeof kernel.readEvents>> = [];
  let profiles: Awaited<ReturnType<typeof kernel.readActors>> = [];
  let saves: SavedProof[] = [];
  let taken = new Map<string, TakenRoute>();
  let canEdit = false;
  let me = "";
  try {
    const loaded = await loadCreativeWorld(kernel, worldId);
    world = loaded.world;
    artifacts = loaded.artifacts;
    resources = loaded.resources;
    currentActorId = (await kernel.whoami()).actor_id;
    events = await readMeaningfulActivity(kernel, world.scope, 12);
    saves = await proofsIn(kernel, world.scope).catch(() => []);
    taken = await takenRoutes(kernel, world.scope).catch(() => new Map<string, TakenRoute>());
    canEdit = (await kernel.myGrants()).some(grant => (grant.scope === world.scope || grant.scope === "*") && (grant.capability === "*" || grant.capability === "world.entity.write"));
    me = (await kernel.whoami()).actor_id;
    profiles = await kernel.readActors([...new Set([...events.map((event) => event.actor_id), ...[...taken.values()].map((t) => t.takenBy)])]);
    const ownerIds = [...new Set(profiles.map((profile) => profile.accountable_party).filter((id): id is string => Boolean(id)))];
    const knownProfileIds = new Set(profiles.map((profile) => profile.actor_id));
    const resourceActorIds = [...new Set(resources
      .flatMap((entry) => [entry.reportedBy, entry.reportedOnBehalfOf, entry.updatedBy, entry.updatedOnBehalfOf])
      .filter((id): id is string => typeof id === "string"))];
    const missingActorIds = [...new Set([...ownerIds, ...resourceActorIds])].filter((id) => !knownProfileIds.has(id));
    if (missingActorIds.length) profiles = [...profiles, ...(await kernel.readActors(missingActorIds))];
  } catch (error) {
    if (error instanceof KernelError && error.name === "unauthenticated") redirect("/account");
    if (error instanceof KernelError && (error.name === "forbidden" || error.name === "not_found" || error.name === "invalid")) notFound();
    return (
      <main className="mx-auto flex min-h-svh w-full max-w-4xl flex-1 flex-col justify-center gap-4 px-4 py-12">
        <p className={label}>Project unavailable</p>
        <h1 className="text-2xl font-medium">This project could not be loaded.</h1>
        <p className="max-w-xl text-sm leading-6 text-muted">Your saved work has not changed. Try loading this project again in a moment.</p>
        <Link href="/worlds" className={secondaryAction}>Your projects</Link>
      </main>
    );
  }

  const savesByPiece = new Map<string, SavedProof[]>();
  for (const save of saves) savesByPiece.set(save.pieceId, [...(savesByPiece.get(save.pieceId) ?? []), save]);
  const profilesById = new Map(profiles.map((profile) => [profile.actor_id, profile]));
  const actorLabels = new Map(profiles.map((profile) => [profile.actor_id, profile.label || profile.actor_id.slice(0, 8)]));
  const takerOf = (id: string) => {
    const t = taken.get(id);
    return !t || t.takenBy === me ? "you" : (actorLabels.get(t.takenBy) ?? "its owner");
  };
  const nextPosition = { x: 24 + (artifacts.length % 3) * 26, y: 26 + (Math.floor(artifacts.length / 3) % 3) * 22 };
  const goalArtifact = artifacts.find((a) => a.title === "Goal");
  const worldSummary = world.summary?.trim() ?? "";
  const goalText = goalArtifact?.body.trim() || (worldSummary.startsWith("A private World") ? "" : worldSummary);
  const hasWebsiteDraft = artifacts.some((a) => looksLikeHtmlDocument(a.body));

  return (
    <main className="solve-page">
      <header className="solve-page-heading">
        <Link href={`/world/${worldId}/room`} className="solve-text-link">← Back to the conversation</Link>
        <span className="solve-kicker mt-5">Private project</span><h1>{world.title}</h1>
        <p>Keep the documents, people and decisions behind your shared work in one place.</p>
        <ProjectNav worldId={worldId} />
        <div className="mt-5 flex flex-wrap gap-3 text-xs text-muted"><WorldLiveSync worldId={worldId} authUserId={user.id} /><WorldPresence worldId={worldId} /></div>
      </header>
      {saved === "artifact" && <p role="status" className="solve-notice">Document saved. Its revision is in project history.</p>}
      {(saved === "route" || saved === "step") && <p role="status" className="solve-notice">Your update is saved in project history.</p>}
      {(error === "route-input" || error === "route-access" || error === "route-save" || error === "world-missing") && <p role="alert" className="solve-error">{error === "route-access" ? "Only the project owner can update this plan." : "The update could not be saved. Your existing work has not changed; try again."}</p>}
      <NextSteps worldId={worldId} actorId={currentActorId} artifacts={artifacts} canWrite={canEdit} />
      {saved === "draft" && <p role="status" className="solve-notice">Your preview is ready below.</p>}
      {canEdit && !hasWebsiteDraft && goalText.length >= 3 ? (
        <section className="mb-9"><FirstDraftPanel worldId={worldId} actorId={currentActorId} goal={goalText} /></section>
      ) : null}
      <section aria-labelledby="documents-heading" className="mb-9 scroll-mt-24">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3"><h2 id="documents-heading">Documents</h2><span className="solve-muted">{artifacts.length} saved · revisions tracked</span></div>
        <div className="solve-two-columns">
          <div className="flex min-w-0 flex-col gap-4">{artifacts.length ? artifacts.map(artifact => <ArtifactCard key={artifact.entityId} worldId={worldId} artifact={artifact} saves={savesByPiece.get(artifact.entityId)} taken={taken.get(artifact.entityId)} takenBy={takerOf(artifact.entityId)} canEdit={canEdit} />) : <div className="solve-empty"><h3>No documents yet</h3><p>{canEdit ? "Add a first note or plan, or return to the conversation to work it out together." : "Shared documents will appear here when a contributor adds them."}</p></div>}</div>
          {canEdit ? <CreateArtifactForm worldId={worldId} actorId={currentActorId} position={nextPosition} error={error === "artifact-input" || error === "artifact-save" || error === "access" ? error : undefined} /> : <div className="solve-panel"><h3>You have view access.</h3><p className="mt-3 solve-muted">Ask the project owner for edit access when you want to contribute documents.</p></div>}
        </div>
      </section>
      <div className="solve-two-columns mb-9">
        <WorldAccessPanel worldId={worldId} scope={world.scope} saved={saved === "collaborator"} error={typeof error === "string" ? error : undefined} />
        <WorldBotAccessPanel worldId={worldId} saved={saved === "bot-access"} error={typeof error === "string" ? error : undefined} />
      </div>
      <details className="solve-panel mb-9"><summary className="cursor-pointer">Offers and needs</summary><div className="mt-5"><ResourceMapPanel worldId={worldId} entries={resources} actorLabels={actorLabels} currentActorId={currentActorId} saved={saved === "resource"} error={typeof error === "string" && ["resource-input", "resource-save", "access"].includes(error) ? error : undefined} /></div></details>
      <details id="history" className="solve-panel scroll-mt-24"><summary className="cursor-pointer">Recent project history</summary><ol className="mt-4 divide-y divide-line">{events.map(event => <li key={event.id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm"><div><p>{eventTitle(event.type)}</p><p className="mt-1 text-xs text-muted">{formatWorldActorAttribution(event.actor_id, profilesById, actorLabels)}</p></div><time className="text-xs text-muted" dateTime={event.occurred_at}>{new Date(event.occurred_at).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short", timeZone: "America/New_York" })}</time></li>)}</ol>{!events.length && <p className="solve-muted mt-3">No changes recorded.</p>}</details>
    </main>
  );
}
