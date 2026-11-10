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
import { AddPhoto, AddPiece, AiAccess, InviteFriend, SharePage } from "./together";
import { loadBot } from "@/lib/bot/store";
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
export default async function ThingPage({ params }: PageProps<"/world/[worldId]">) {
  const { worldId } = await params;
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
  for (const e of events) {
    const id = (e.payload as { entity_id?: unknown })?.entity_id;
    if (e.type === "kernel.entity.created" && typeof id === "string" && !authorOf.has(id)) authorOf.set(id, e.actor_id);
  }
  const ownerId = membership?.ownerActorId ?? null;
  const memberIds = (membership?.members ?? []).map(m => m.actorId);
  const ids = [...new Set([ownerId, ...memberIds, ...authorOf.values()].filter((x): x is string => Boolean(x)))];
  const actors = ids.length ? await kernel.readActors(ids).catch(() => []) : [];
  const names: ActorNames = {
    labels: Object.fromEntries(actors.map(a => [a.actor_id, a.label])),
    kinds: Object.fromEntries(actors.map(a => [a.actor_id, a.kind])),
    viewerId: me?.actor_id ?? null,
  };
  const people = [ownerId, ...memberIds].filter((x): x is string => Boolean(x));
  const isOwner = Boolean(ownerId && me?.actor_id === ownerId);
  const canAdd = isOwner || (membership?.members ?? []).some(m => m.actorId === me?.actor_id && m.role === "editor");
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
  // The owner's own AI, if they have connected one, and what it may do here — read from the grants.
  const ai = isOwner ? await loadBot(kernel).then(async bot => bot.avatar
    ? { name: bot.persona.name, access: accessFrom(await botGrantsIn(kernel, world.scope, bot.avatar.agent_id)) }
    : null).catch(() => null) : null;
  type Piece = { id: string; at: string; text: string; photo?: { url: string | null }; link?: { url: string; madeWith: string } };
  const pieces: Piece[] = [
    ...texts.map(a => ({ id: a.entityId, at: a.updatedAt, text: a.body || a.title })),
    ...photoEntities.map(e => {
      const name = (e.attributes.file as { name: string }).name;
      return { id: e.entity_id, at: e.updated_at, text: typeof e.attributes.caption === "string" ? e.attributes.caption : "", photo: { url: links.get(name) ?? null } };
    }),
    ...linkEntities.map(e => ({ id: e.entity_id, at: e.updated_at, text: "",
      link: { url: String(e.attributes.url), madeWith: typeof e.attributes.madeWith === "string" ? e.attributes.madeWith : "" } })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const initial = (id: string) => (nameFor(id, names).replace(/^[^\p{L}]+/u, "").charAt(0) || "·").toUpperCase();

  return <div className={styles.page}>
    <header className={styles.head}>
      <div className={styles.titleRow}>
        <h1>{world.title}</h1>
        {/* Who can see this Space, from the kernel: its members, and whether it is published. */}
        <a href={isOwner ? "#share" : undefined} className={styles.visibility} data-visibility>
          <Icon name={publication?.published ? "globe" : people.length > 1 ? "people" : "lock"} size={16} />
          {publication?.published ? "Public" : people.length > 1 ? "Shared" : "Private"}
        </a>
      </div>
      {ownDescription(world.summary, world.title) ? <p className="s-muted">{ownDescription(world.summary, world.title)}</p> : null}
    </header>

    <section className={styles.people} aria-label="Who's building this">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div className={styles.faces} aria-hidden="true">
          {people.slice(0, 6).map(id => <span key={id} className={styles.face} data-you={id === me?.actor_id}>{initial(id)}</span>)}
        </div>
        <span className={styles.who} data-people>{people.map(id => nameFor(id, names)).join(", ")}</span>
      </div>
      {isOwner ? <InviteFriend worldId={world.worldId} title={world.title} /> : null}
    </section>

    {canAdd ? <div id="add" className="s-stack" style={{ "--gap": "12px" } as React.CSSProperties}>
      <AddPiece worldId={world.worldId} />
      <AddPhoto worldId={world.worldId} />
    </div> : null}

    <section aria-labelledby="pieces-title" className="s-stack">
      <h2 id="pieces-title">{pieces.length ? "What's been added" : "Nothing added yet"}</h2>
      {pieces.length === 0
        ? <p className="s-muted">{isOwner ? "Add the first piece, or invite a friend to start it with you." : "Be the first to add something."}</p>
        : <ul className={styles.pieces}>{pieces.map(piece => {
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
              {piece.link ? <p>
                {piece.link.madeWith ? <>Made with {piece.link.madeWith}: </> : <>Link: </>}
                <a href={piece.link.url} target="_blank" rel="noopener noreferrer nofollow" className={styles.linkOut} data-made>{piece.link.url}</a>
              </p> : null}
              {piece.text ? <p>{piece.text}</p> : null}
              <span className={styles.by}>Added by <strong data-author>{who}</strong> · {piece.at.slice(0, 10)}{piece.link ? " · their word, not checked by SOLVE" : ""}</span>
            </li>;
          })}</ul>}
    </section>

    {isOwner ? <SharePage worldId={world.worldId} title={world.title} description={ownDescription(world.summary, world.title)}
      published={publication?.published ?? false} selected={publication?.pieces ?? []}
      candidates={pieces.filter(p => !p.link && authorOf.get(p.id) === ownerId).map(p => ({
        id: p.id, kind: p.photo ? "photo" as const : "text" as const, text: p.text, url: p.photo?.url ?? null }))}
      friendsPieces={pieces.filter(p => !p.link && authorOf.get(p.id) !== ownerId).length} /> : null}

    {ai ? <AiAccess worldId={world.worldId} current={ai.access} name={ai.name} /> : null}

    <p><Link href={`/world/${encodeURIComponent(world.worldId)}/record`} className="s-button" data-variant="link">See its full record — who did what, and what proves it →</Link></p>
  </div>;
}
