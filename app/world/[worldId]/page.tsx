import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { KernelError } from "@/lib/kernel/client";
import { getKernel } from "@/lib/kernel/server";
import { createClient as createSupabase, getUser } from "@/lib/supabase/server";
import { PHOTO_BUCKET, PHOTO_LINK_SECONDS, isPhotoOf } from "@/lib/product/photo";
import { loadCreativeWorld } from "@/lib/world/creative";
import { readWorldMembers } from "@/lib/world/collaboration";
import { nameFor, type ActorNames } from "@/lib/product/thing";
import { AddPhoto, AddPiece, AppAccess, EditSpace, InviteFriend, RevisePiece, SharePage } from "./together";
import { presentationFromParams, readPresentation } from "@/lib/product/presentation";
import { SEEDS } from "@/lib/product/card";
import { environmentFor } from "@/lib/product/environment";
import { actionsFor, heldInSpace } from "@/lib/product/capabilities";
import { accessFrom, botGrantsIn } from "@/lib/bot/worlds";
import { ownDescription, readPublication } from "@/lib/product/page";
import styles from "./together.module.css";
import { GuestGate } from "@/app/ui/guest-gate";
import { Icon } from "@/app/ui/icons";

export const metadata: Metadata = { title: "SOLVE" };

// A thing you're building, with the people building it. Rebuilt from zero (2026-11-10) around the
// founder's answer to "what's the first thing someone does just because it's fun": build something
// and invite your friends. Everything shown is read from the kernel, and who added what is taken
// from the record of who created it — never from anything a screen supplies.
export default async function ThingPage({ params, searchParams }: PageProps<"/world/[worldId]">) {
  const { worldId } = await params;
  const query = await searchParams;
  const user = await getUser();
  if (!user) return <GuestGate />;

  const kernel = await getKernel();
  let data: Awaited<ReturnType<typeof loadCreativeWorld>>;
  try {
    data = await loadCreativeWorld(kernel, worldId);
  } catch (error) {
    if (error instanceof KernelError && ["forbidden", "not_found", "invalid"].includes(error.name)) notFound();
    return <div className="s-stack">
      <h1>This can&apos;t be opened right now.</h1>
      <p className="s-muted">Nothing was deleted. Try again when the connection is back.</p>
    </div>;
  }
  const { world, artifacts, entities } = data;

  const [membership, me, events] = await Promise.all([
    readWorldMembers(kernel, world.scope).catch(() => null),
    kernel.whoami().catch(() => null),
    kernel.readEvents(world.scope, { limit: 200 }).catch(() => []),
  ]);
  const authorOf = new Map<string, string>();
  const editorOf = new Map<string, string>(); // who made the latest change after the first
  for (const e of events) {
    const id = (e.payload as { entity_id?: unknown })?.entity_id;
    if (e.type === "kernel.entity.created" && typeof id === "string" && !authorOf.has(id)) authorOf.set(id, e.actor_id);
    if (e.type === "kernel.entity.updated" && typeof id === "string") editorOf.set(id, e.actor_id);
  }
  const ownerId = membership?.ownerActorId ?? null;
  const memberIds = (membership?.members ?? []).map(m => m.actorId);
  const ids = [...new Set([ownerId, ...memberIds, ...authorOf.values(), ...editorOf.values()].filter((x): x is string => Boolean(x)))];
  const actors = ids.length ? await kernel.readActors(ids).catch(() => []) : [];
  const names: ActorNames = {
    labels: Object.fromEntries(actors.map(a => [a.actor_id, a.label])),
    kinds: Object.fromEntries(actors.map(a => [a.actor_id, a.kind])),
    viewerId: me?.actor_id ?? null,
  };
  const people = [ownerId, ...memberIds].filter((x): x is string => Boolean(x));
  const isOwner = Boolean(ownerId && me?.actor_id === ownerId);
  const role = isOwner ? "owner" as const : (membership?.members ?? []).find(m => m.actorId === me?.actor_id)?.role ?? null;
  const held = heldInSpace(role);
  const canAdd = role === "owner" || role === "editor";
  // Starting a thing also records the starter's opening words as a piece titled "Goal", whose text
  // is the thing's summary — already shown in the header. Listing it again showed the same words
  // twice (acceptance run, 2026-11-10). Only that piece, matched on both markers, is left out.
  const texts = artifacts.filter(a => !(a.title === "Goal" && a.body === world.summary));

  // Photos: the piece records the file; a link to it is issued per view, for ten minutes, and only
  // if storage — asking the kernel — agrees this person may read the thing.
  const photoEntities = entities.filter(e => e.kind === "document" && e.attributes.documentType === "photo"
    && isPhotoOf((e.attributes.file as { name?: unknown } | undefined)?.name, world.worldId));
  const photoNames = photoEntities.map(e => (e.attributes.file as { name: string }).name);
  const links = new Map<string, string>();
  if (photoNames.length) {
    const signed = await (await createSupabase()).storage.from(PHOTO_BUCKET).createSignedUrls(photoNames, PHOTO_LINK_SECONDS).catch(() => null);
    for (const entry of signed?.data ?? []) if (entry.path && entry.signedUrl && !entry.error) links.set(entry.path, entry.signedUrl);
  }
  const linkEntities = entities.filter(e => e.kind === "document" && e.attributes.documentType === "link" && typeof e.attributes.url === "string");
  const publication = isOwner && me ? await readPublication(kernel, me.actor_id, world.worldId).catch(() => null) : null;
  // The apps the owner has connected, and what each may do here — read from the kernel's grants.
  const apps = isOwner ? await kernel.myConnections().then(cs => Promise.all(cs.filter(c => !c.disconnected_at).map(async c => ({
    clientId: c.client_id, name: c.label || "A connected app",
    access: accessFrom(await botGrantsIn(kernel, world.scope, c.agent_id)),
  })))).catch(() => []) : [];
  type Piece = { id: string; at: string; text: string; kind: "text" | "photo" | "link"; version: number; photo?: { url: string | null };
    link?: { url: string; madeWith: string; title?: string; capturedAt?: string } };
  const pieces: Piece[] = [
    ...texts.map(a => ({ id: a.entityId, at: a.updatedAt, text: a.body || a.title, kind: "text" as const, version: a.version })),
    ...photoEntities.map(e => {
      const name = (e.attributes.file as { name: string }).name;
      return { id: e.entity_id, at: e.updated_at, text: typeof e.attributes.caption === "string" ? e.attributes.caption : "", kind: "photo" as const, version: e.version, photo: { url: links.get(name) ?? null } };
    }),
    ...linkEntities.map(e => ({ id: e.entity_id, at: e.updated_at, text: "", kind: "link" as const, version: e.version,
      link: { url: String(e.attributes.url), madeWith: typeof e.attributes.madeWith === "string" ? e.attributes.madeWith : "",
        // Brought in by a capability run: the page's own title and when Solve actually fetched it.
        title: typeof e.attributes.title === "string" ? e.attributes.title : undefined,
        capturedAt: typeof (e.attributes.captured as { at?: unknown } | undefined)?.at === "string" ? (e.attributes.captured as { at: string }).at : undefined } })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const initial = (id: string) => (nameFor(id, names).replace(/^[^\p{L}]+/u, "").charAt(0) || "·").toUpperCase();

  // How this Space is composed: its saved presentation, or a draft being previewed (nothing saved).
  const resources = {
    photos: new Set(pieces.filter(p => p.kind === "photo").map(p => p.id.toLowerCase())),
    notes: new Set(texts.map(a => a.entityId.toLowerCase())),
  };
  const stored = await readPresentation(kernel, world.worldId, resources).catch(() => null);
  const draft = canAdd ? presentationFromParams(query, resources) : null;
  const shown = draft ?? stored?.presentation ?? { composition: "base" as const, cover: null, featured: [], tint: null };
  // The Space's own colour enters only as its accent, computed for readability like the person's look.
  const tint = shown.tint ? environmentFor({ expression: "personal", seed: shown.tint, tone: "light", finish: "glass" }) : null;
  const cover = shown.composition === "story" && shown.cover ? pieces.find(p => p.id.toLowerCase() === shown.cover && p.photo?.url) : undefined;
  const featured = shown.composition === "story" ? shown.featured.map(id => pieces.find(p => p.id.toLowerCase() === id)).filter((p): p is (typeof pieces)[number] => Boolean(p)) : [];
  const rest = pieces.filter(p => !featured.includes(p) && p !== cover);
  const story = shown.composition === "story";

  return <div className={styles.page} data-composition={shown.composition}
    style={tint ? { "--accent": tint.accent, "--on-accent": tint.onAccent } as React.CSSProperties : undefined}>
    {draft ? <div className={styles.previewBar} role="status" data-previewing>
      <span>Previewing — nothing is saved yet.</span>
      <a href={`/world/${encodeURIComponent(world.worldId)}`} className="s-button" data-variant="quiet" style={{ color: "inherit", borderColor: "currentColor" }}>Discard</a>
    </div> : null}
    {cover?.photo?.url ? <div className={styles.hero} data-hero>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={cover.photo.url} alt={cover.text || ""} className={styles.heroImage} />
      <div className={styles.heroText}>
        <h1>{world.title}</h1>
        <div className={styles.row}>
          <a href={isOwner ? "#share" : undefined} className={styles.visibility} data-visibility>
            <Icon name={publication?.published ? "globe" : people.length > 1 ? "people" : "lock"} size={16} />
            {publication?.published ? "Public" : people.length > 1 ? "Shared" : "Private"}
          </a>
          {canAdd ? <a href="#edit-space" className={styles.visibility} data-edit-open>Edit Space</a> : null}
        </div>
      </div>
    </div> : null}
    {cover?.photo?.url ? null : <header className={styles.head}>
      <div className={styles.titleRow}>
        <h1>{world.title}</h1>
        {/* Who can see this Space, from the kernel: its members, and whether it is published. */}
        <a href={isOwner ? "#share" : undefined} className={styles.visibility} data-visibility>
          <Icon name={publication?.published ? "globe" : people.length > 1 ? "people" : "lock"} size={16} />
          {publication?.published ? "Public" : people.length > 1 ? "Shared" : "Private"}
        </a>
        {canAdd ? <a href="#edit-space" className={styles.visibility} data-edit-open>Edit Space</a> : null}
      </div>
      {ownDescription(world.summary, world.title) ? <p className="s-muted">{ownDescription(world.summary, world.title)}</p> : null}
    </header>}

    <section className={styles.people} aria-label="Who's building this">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div className={styles.faces} aria-hidden="true">
          {people.slice(0, 6).map(id => <span key={id} className={styles.face} data-you={id === me?.actor_id}>{initial(id)}</span>)}
        </div>
        <span className={styles.who} data-people>{people.map(id => nameFor(id, names)).join(", ")}</span>
      </div>
      {isOwner ? <InviteFriend worldId={world.worldId} title={world.title} /> : null}
    </section>

    {canAdd ? <div id="add" className={styles.addRow}>
      <AddPiece worldId={world.worldId} />
      <AddPhoto worldId={world.worldId} />
    </div> : null}

    {featured.length ? <section aria-labelledby="highlights-title" className="s-stack" data-highlights>
      <h2 id="highlights-title">Highlights</h2>
      <ul className={styles.highlights}>{featured.map(piece => <li key={piece.id} className={styles.highlight} data-highlight data-piece>
        {piece.text ? <p>{piece.text}</p> : null}
        <span className={styles.by}>Added by <strong>{authorOf.get(piece.id) ? nameFor(authorOf.get(piece.id)!, names) : "Someone"}</strong>{editorOf.has(piece.id) ? <> · edited by <strong>{nameFor(editorOf.get(piece.id)!, names)}</strong></> : null}</span>
        {actionsFor({ kind: piece.kind }, held).map(action => action.id === "revise"
          ? <RevisePiece key={action.id} worldId={world.worldId} entityId={piece.id} version={piece.version} text={piece.text} label={action.label} />
          : null)}
      </li>)}</ul>
    </section> : null}

    <section aria-labelledby="pieces-title" className={story ? `s-stack ${styles.journal}` : "s-stack"}>
      <h2 id="pieces-title">{pieces.length ? (story ? "Journal" : "What's been added") : "Nothing added yet"}</h2>
      {pieces.length === 0
        ? <p className="s-muted">{isOwner ? "Add the first piece, or invite a friend to start it with you." : "Be the first to add something."}</p>
        : <ul className={styles.pieces}>{(story ? rest : pieces).map(piece => {
            const author = authorOf.get(piece.id);
            const who = author ? nameFor(author, names) : "Someone";
            return <li key={piece.id} className={styles.piece} data-piece data-photo={piece.photo ? "" : undefined}>
              {piece.photo
                ? piece.photo.url
                  // A short-lived private link; the image optimiser would cache a private photo, so it isn't used.
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={piece.photo.url} alt={piece.text || `A photo ${who === "You" ? "you" : who} added`} className={styles.image} loading="lazy" />
                  : <div className={styles.missing} role="status">This photo can&apos;t be shown right now.</div>
                : null}
              {piece.link ? piece.link.capturedAt
                ? <p data-captured>
                    <a href={piece.link.url} target="_blank" rel="noopener noreferrer nofollow" className={styles.linkOut}>{piece.link.title || new URL(piece.link.url).hostname}</a>
                    <span className="s-muted s-small"> · {new URL(piece.link.url).hostname}</span>
                  </p>
                : <p>
                    {piece.link.madeWith ? <>Made with {piece.link.madeWith}: </> : <>Link: </>}
                    <a href={piece.link.url} target="_blank" rel="noopener noreferrer nofollow" className={styles.linkOut} data-made>{piece.link.url}</a>
                  </p> : null}
              {piece.text ? <p>{piece.text}</p> : null}
              <span className={styles.by}>Added by <strong data-author>{who}</strong>{editorOf.has(piece.id) ? <> · edited by <strong data-editor>{nameFor(editorOf.get(piece.id)!, names)}</strong></> : null} · {piece.at.slice(0, 10)}{piece.link ? (piece.link.capturedAt ? ` · brought in by Solve on ${piece.link.capturedAt.slice(0, 10)}` : " · their word, not checked by Solve") : ""}</span>
              {actionsFor({ kind: piece.kind }, held).map(action => action.id === "revise"
                ? <RevisePiece key={action.id} worldId={world.worldId} entityId={piece.id} version={piece.version} text={piece.text} label={action.label} />
                : null)}
            </li>;
          })}</ul>}
    </section>

    {isOwner ? <SharePage worldId={world.worldId} title={world.title} description={ownDescription(world.summary, world.title)}
      published={publication?.published ?? false} selected={publication?.pieces ?? []}
      candidates={pieces.filter(p => !p.link && authorOf.get(p.id) === ownerId).map(p => ({
        id: p.id, kind: p.photo ? "photo" as const : "text" as const, text: p.text, url: p.photo?.url ?? null }))}
      friendsPieces={pieces.filter(p => !p.link && authorOf.get(p.id) !== ownerId).length} /> : null}

    {canAdd ? <EditSpace worldId={world.worldId} current={shown} previewing={Boolean(draft)} canUndo={Boolean(stored?.previous)} tints={[...SEEDS]}
      photos={pieces.filter(p => p.kind === "photo").map(p => ({ id: p.id.toLowerCase(), label: p.text || "A photo", url: p.photo?.url ?? null }))}
      notes={texts.map(a => ({ id: a.entityId.toLowerCase(), label: (a.body || a.title).slice(0, 80) }))} /> : null}

    {isOwner && apps.length ? <details className={styles.sharePanel} data-apps-here>
      <summary className={styles.shareLine}>
        <span className={styles.shareText}><h2 className={styles.shareTitle}>Apps here</h2>
          <span className="s-muted s-small">{apps.filter(a => a.access !== "none").length ? `${apps.filter(a => a.access !== "none").map(a => a.name).join(", ")} can reach this Space` : "No app can reach this Space"}</span></span>
      </summary>
      <div className={styles.shareBody}>
        {apps.map(a => <AppAccess key={a.clientId} worldId={world.worldId} clientId={a.clientId} current={a.access} name={a.name} />)}
        <p className="s-muted s-small">An app can only add drafts, labelled as its own. It can&apos;t publish, invite, pay or delete, and what it adds stays yours.</p>
      </div>
    </details> : null}

    <p><Link href={`/world/${encodeURIComponent(world.worldId)}/record`} className="s-button" data-variant="link">See its full record — who did what, and what proves it →</Link></p>
  </div>;
}
