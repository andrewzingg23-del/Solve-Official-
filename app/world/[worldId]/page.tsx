import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { KernelError } from "@/lib/kernel/client";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { loadCreativeWorld } from "@/lib/world/creative";
import { readWorldMembers } from "@/lib/world/collaboration";
import { nameFor, type ActorNames } from "@/lib/product/thing";
import { AddPiece, InviteFriend } from "./together";
import styles from "./together.module.css";

export const metadata: Metadata = { title: "SOLVE" };

// A thing you're building, with the people building it. Rebuilt from zero (2026-11-10) around the
// founder's answer to "what's the first thing someone does just because it's fun": build something
// and invite your friends. Everything shown is read from the kernel, and who added what is taken
// from the record of who created it — never from anything a screen supplies.
export default async function ThingPage({ params }: PageProps<"/world/[worldId]">) {
  const { worldId } = await params;
  const user = await getUser();
  if (!user) notFound();

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
  const { world, artifacts } = data;

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
  const pieces = artifacts
    .filter(a => !(a.title === "Goal" && a.body === world.summary))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const initial = (id: string) => (nameFor(id, names).replace(/^[^\p{L}]+/u, "").charAt(0) || "·").toUpperCase();

  return <div className={styles.page}>
    <header className={styles.head}>
      <span className="s-label">{people.length > 1 ? "Building together" : "Yours"}</span>
      <h1>{world.title}</h1>
      {world.summary && world.summary !== world.title ? <p className="s-muted">{world.summary}</p> : null}
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

    {canAdd ? <AddPiece worldId={world.worldId} /> : null}

    <section aria-labelledby="pieces-title" className="s-stack">
      <h2 id="pieces-title">{pieces.length ? "What's been added" : "Nothing added yet"}</h2>
      {pieces.length === 0
        ? <p className="s-muted">{isOwner ? "Add the first piece, or invite a friend to start it with you." : "Be the first to add something."}</p>
        : <ul className={styles.pieces}>{pieces.map(piece => {
            const author = authorOf.get(piece.entityId);
            return <li key={piece.entityId} className={styles.piece} data-piece>
              <p>{piece.body || piece.title}</p>
              <span className={styles.by}>Added by <strong data-author>{author ? nameFor(author, names) : "Someone"}</strong> · {piece.updatedAt.slice(0, 10)}</span>
            </li>;
          })}</ul>}
    </section>

    <p><Link href={`/world/${encodeURIComponent(world.worldId)}/record`} className="s-button" data-variant="link">See its full record — who did what, and what proves it →</Link></p>
  </div>;
}
