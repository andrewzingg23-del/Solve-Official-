import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getKernel } from "@/lib/kernel/server";
import { createClient as createSupabase } from "@/lib/supabase/server";
import { normalizeCardLook } from "@/lib/product/card";
import { environmentFor, environmentStyle } from "@/lib/product/environment";
import { linkParts, ownDescription } from "@/lib/product/page";
import { PHOTO_BUCKET, PHOTO_LINK_SECONDS, isPhotoOf } from "@/lib/product/photo";
import { Mark } from "@/app/ui/mark";
import { SovCard } from "@/app/ui/sov-card";
import styles from "./page.module.css";

// A thing its owner chose to show the world — MySpace-style: their colours, their card, what they
// made. Anyone with the link can look, with no account, and looking never creates one (the proxy
// skips /p/). Everything here comes from kernel_api.read_page, which returns only what the owner
// published and only pieces the owner made themselves (20261110050000).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const load = cache(async (worldId: string) => {
  if (!UUID.test(worldId)) return null;
  try { return await (await getKernel()).readPage(worldId); } catch { return null; }
});

export async function generateMetadata({ params }: PageProps<"/p/[worldId]">): Promise<Metadata> {
  const page = await load((await params).worldId);
  if (!page) return { title: "SOLVE", robots: { index: false, follow: false } };
  const description = ownDescription(page.summary, page.title);
  // Public to anyone with the link; kept out of search engines until a person chooses that separately.
  return { title: `${page.title}${page.by ? ` · ${page.by}` : ""}`, description: description || undefined, robots: { index: false, follow: false } };
}

export default async function PublicPage({ params }: PageProps<"/p/[worldId]">) {
  const { worldId } = await params;
  const page = await load(worldId);
  if (!page) notFound();

  const look = normalizeCardLook(page.look);
  const env = environmentFor(look);
  const names = page.pieces.map(p => p.file).filter((f): f is string => isPhotoOf(f, worldId));
  const links = new Map<string, string>();
  if (names.length) {
    const signed = await (await createSupabase()).storage.from(PHOTO_BUCKET).createSignedUrls(names, PHOTO_LINK_SECONDS).catch(() => null);
    for (const entry of signed?.data ?? []) if (entry.path && entry.signedUrl && !entry.error) links.set(entry.path, entry.signedUrl);
  }
  const by = page.by.trim();
  const description = ownDescription(page.summary, page.title);
  // The owner's opening words are kept as a first piece too; they're already the description above.
  const pieces = page.pieces.filter(p => !(p.kind === "text" && (p.text.trim() === page.summary.trim() || p.text.trim() === page.title.trim())));

  return <div className={styles.page} data-tone={env.tone} style={environmentStyle(env) as React.CSSProperties}>
    <main className={styles.main}>
      <header className={styles.head}>
        {by ? <div className={styles.owner}><SovCard name={by} look={look} size="mini" /><span className="s-label" data-by>{by}</span></div> : null}
        <h1 className={styles.title}>{page.title}</h1>
        {description ? <p className={styles.description}>{description}</p> : null}
      </header>

      {pieces.length ? <ul className={styles.pieces}>
        {pieces.map(piece => {
          const url = piece.file ? links.get(piece.file) : undefined;
          return <li key={piece.id} className={styles.piece} data-public-piece={piece.kind}>
            {piece.kind === "photo"
              ? url
                // A short-lived link to a photo the owner published; not passed through the image optimiser.
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={url} alt={piece.text || `A photo by ${by || "the owner"}`} className={styles.image} loading="lazy" />
                : <div className={styles.missing}>This photo can&apos;t be shown right now.</div>
              : null}
            {piece.text ? <p>{linkParts(piece.text).map((part, i) => "href" in part
              // Links the owner wrote; the page doesn't vouch for where they go.
              ? <a key={i} href={part.href} target="_blank" rel="noopener noreferrer nofollow ugc" className={styles.link}>{part.text}</a>
              : <span key={i}>{part.text}</span>)}</p> : null}
          </li>;
        })}
      </ul> : <p className={styles.description}>Nothing shared here yet.</p>}
    </main>
    <footer className={styles.foot}>
      {/* No prefetch: prefetching Home would give the person looking an identity they never asked for. */}
      <Link href="/" prefetch={false} className={styles.made}><Mark size={18} />Made on SOLVE</Link>
      <Link href="/" prefetch={false} className="s-button" data-variant="quiet">Make your own</Link>
    </footer>
  </div>;
}
