import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getKernel } from "@/lib/kernel/server";
import { createClient as createSupabase } from "@/lib/supabase/server";
import { cardPalette, normalizeCardLook } from "@/lib/product/card";
import { environmentFor, environmentStyle } from "@/lib/product/environment";
import { PHOTO_BUCKET, PHOTO_LINK_SECONDS, isPhotoOf } from "@/lib/product/photo";
import { Mark } from "@/app/ui/mark";
import { SovCard } from "@/app/ui/sov-card";
import styles from "./page.module.css";

// A person's Space: their card, in their colours, and the things they chose to share — at one link
// anyone can open with no account, and looking never creates one (the proxy skips /s/). Everything
// here comes from kernel_api.read_space, which returns only what the owner chose to share
// (20261110090000). The first consumer milestone: make a card and a Space, share it, and someone
// else can use it at once.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const load = cache(async (actorId: string) => {
  if (!UUID.test(actorId)) return null;
  try { return await (await getKernel()).readSpace(actorId); } catch { return null; }
});

export async function generateMetadata({ params }: PageProps<"/s/[actorId]">): Promise<Metadata> {
  const space = await load((await params).actorId);
  if (!space) return { title: "SOLVE", robots: { index: false, follow: false } };
  const name = space.by.trim();
  return { title: name ? `${name} · SOLVE` : "SOLVE", description: name ? `${name}'s Space on SOLVE.` : undefined, robots: { index: false, follow: false } };
}

export default async function SpacePage({ params }: PageProps<"/s/[actorId]">) {
  const { actorId } = await params;
  const space = await load(actorId);
  if (!space) notFound();

  const look = normalizeCardLook(space.look);
  const env = environmentFor(look);
  const name = space.by.trim();
  const covers = space.pages.map(p => p.cover).filter((c): c is string => typeof c === "string");
  const links = new Map<string, string>();
  if (covers.length) {
    const signed = await (await createSupabase()).storage.from(PHOTO_BUCKET).createSignedUrls(covers, PHOTO_LINK_SECONDS).catch(() => null);
    for (const entry of signed?.data ?? []) if (entry.path && entry.signedUrl && !entry.error) links.set(entry.path, entry.signedUrl);
  }

  // The glow carries no text, so it can be the card's own colour rather than the readability-tuned accent.
  const style = { ...environmentStyle(env), "--glow": cardPalette(look).surface } as React.CSSProperties;
  return <div className={styles.page} data-tone={env.tone} style={style}>
    <main className={styles.main}>
      <header className={styles.hero}>
        <div className={styles.card} data-space-card><SovCard name={name} look={look} /></div>
        {/* The card carries the name; the heading is for screen readers and the tab, not a repeat. */}
        <h1 className="s-visually-hidden">{name ? `${name}'s Space` : "A Space on SOLVE"}</h1>
      </header>

      {space.pages.length ? <section aria-labelledby="made" className={styles.section}>
        <h2 id="made" className="s-label">Shared</h2>
        <ul className={styles.grid}>
          {space.pages.map(page => {
            const cover = page.cover && isPhotoOf(page.cover, page.id) ? links.get(page.cover) : undefined;
            return <li key={page.id}>
              {/* No prefetch: opening a page is the visitor's choice. */}
              <Link href={`/p/${page.id}`} prefetch={false} className={styles.tile} data-space-page={page.id}>
                {cover
                  // A short-lived link to a photo the owner shared; not passed through the image optimiser.
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={cover} alt="" className={styles.cover} />
                  : <span className={styles.plain} aria-hidden="true" />}
                <span className={styles.title}>{page.title}</span>
              </Link>
            </li>;
          })}
        </ul>
      </section> : <p className={styles.empty}>Nothing shared here yet.</p>}
    </main>
    <footer className={styles.foot}>
      {/* No prefetch: prefetching Home would give the person looking an identity they never asked for. */}
      <Link href="/" prefetch={false} className={styles.made}><Mark size={18} />Made on SOLVE</Link>
      <Link href="/" prefetch={false} className="s-button" data-variant="quiet">Make your own</Link>
    </footer>
  </div>;
}
