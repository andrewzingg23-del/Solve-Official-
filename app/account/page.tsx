import type { Metadata } from "next";
import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { getKernel } from "@/lib/kernel/server";
import { readLook, type StoredLook } from "@/lib/product/look-store";
import { identityEventWording } from "@/lib/product/thing";
import { Studio } from "./studio";
import { IdCard } from "@/app/ui/id-card";
import { signOut } from "./id-actions";
import styles from "./id.module.css";

export const metadata: Metadata = { title: "Your ID · Solve" };

// Your ID: your card, your name, and the colours your Solve wears.
export default async function IdPage() {
  const user = await getUser();
  let name = "";
  let look: StoredLook | null = null;
  let history: { at: string; what: string }[] = [];
  let unavailable = false;
  if (user) {
    try {
      const kernel = await getKernel();
      const me = await kernel.whoami();
      const [profile] = await kernel.readActors([me.actor_id]).catch(() => []);
      name = profile?.label?.trim() ?? "";
      look = await readLook(kernel, me.actor_id);
      const events = await kernel.readEvents(`actor:${me.actor_id}`, { newestFirst: true, limit: 8 }).catch(() => []);
      history = events.map(e => ({ at: e.occurred_at, what: identityEventWording(e) }));
    } catch {
      unavailable = true;
    }
  }
  const durable = Boolean(user && !user.is_anonymous);

  return <div className={styles.page}>
    <header className={styles.head}>
      <span className="s-label">Control</span>
      <h1>Your ID</h1>
      <p className="s-muted">Your Solve identity and digital card. Only you can see it until you choose to share.</p>
    </header>

    {look
      ? <Studio name={name} saved={look.look} canUndo={look.previous !== null} />
      : <div className={styles.unready}>
          <IdCard name={name} />
          <p role="status" className="s-muted">{unavailable
            ? "Your account couldn't be loaded. Nothing has changed; try again shortly."
            : "This appears as soon as your identity is ready."}</p>
        </div>}


    <section className={styles.facts} aria-label="About your account">
      <div className="s-surface s-stack">
        <h2>Where it lives</h2>
        <p className="s-muted">{durable
          ? "It's the same on every device you sign in on."
          : "It's already yours, kept in this browser. Sign in to reach it from anywhere."}</p>
        {durable
          ? <form action={signOut}><button className="s-button" data-variant="quiet">Sign out</button></form>
          : <Link href="/login?next=%2Faccount" className="s-button" data-variant="quiet">Sign in</Link>}
      </div>
      <div className="s-surface s-stack">
        <h2>What&apos;s happened</h2>
        {history.length === 0
          ? <p className="s-muted">Nothing yet.</p>
          : <ol className={styles.history}>{history.map((h, i) => <li key={i}>
              <span>{h.what}</span>
              <time className="s-muted s-small" dateTime={h.at}>{new Date(h.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</time>
            </li>)}</ol>}
      </div>
    </section>
  </div>;
}
