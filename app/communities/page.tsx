import { RecoverableForm } from "@/app/product/recoverable-form";
import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon } from "@/app/product/icons";
import { COMMUNITY_LIMITS, listCommunities, type Community } from "@/lib/community/community";
import { KernelError } from "@/lib/kernel/client";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { loginRequired } from "@/lib/auth/gate";
import { startCommunityAction } from "./actions";
import styles from "./community.module.css";

export const metadata: Metadata = { title: "Communities · solve" };

type Row = Community & { mine: "owner" | "member" | null };

async function load(): Promise<Row[] | "identity" | "unavailable"> {
  try {
    const kernel = await getKernel();
    const [me, grants, communities] = await Promise.all([kernel.whoami(), kernel.myGrants(), listCommunities(kernel)]);
    const inside = new Set(grants.filter((g) => g.capability === "kernel.read" || g.capability === "*").map((g) => g.scope));
    return communities.map((c) => ({ ...c, mine: c.ownerId === me.actor_id ? "owner" : inside.has(c.scope) ? "member" : null }));
  } catch (error) {
    return error instanceof KernelError && error.name === "unauthenticated" ? "identity" : "unavailable";
  }
}

export default async function CommunitiesPage({ searchParams }: PageProps<"/communities">) {
  const user = await getUser();
  if (!user && loginRequired()) redirect("/login?next=%2Fcommunities");
  const { error } = await searchParams;
  // Guests get an introduction without making identity-gated kernel reads.
  const rows = user ? await load() : null;
  const yours = Array.isArray(rows) ? rows.filter((r) => r.mine) : [];
  const others = Array.isArray(rows) ? rows.filter((r) => !r.mine) : [];

  return (
    <main className={`solve-page ${styles.page}`}>
      <header className="solve-page-heading">
        <span className="solve-kicker">Communities</span>
        <h1>Build with people who share your goal.</h1>
        <p>A shared home for your people, their AIs, and the work you do together. Start a community or ask to join one.</p>
      </header>

      <div className={`${styles.directoryLayout} ${!user ? styles.guestLayout : ""}`}>
        <div className={styles.stack}>
          {!user ? <Introduction /> : rows === "identity" ? (
            <section className={`solve-panel ${styles.stack}`} aria-labelledby="community-profile-heading">
              <Icon name="profile" className={styles.accent} />
              <h2 id="community-profile-heading">Finish your profile</h2>
              <p>Your account needs a saved profile before you can join or start a community.</p>
              <Link href="/account" className="solve-button solve-button-secondary">Open Profile<Icon name="arrow" width={16} /></Link>
            </section>
          ) : rows === "unavailable" ? (
            <section className={`solve-panel ${styles.stack}`} aria-labelledby="community-unavailable-heading">
              <h2 id="community-unavailable-heading">We couldn&apos;t load communities.</h2>
              <p>Try loading this page again in a moment.</p>
              <Link href="/communities" className="solve-button solve-button-secondary">Try again</Link>
            </section>
          ) : (
            <>
              {yours.length ? <List title="Your communities" rows={yours} /> : null}
              {others.length ? <List title="Explore communities" rows={others} /> : (
                <section className={`solve-empty ${styles.empty}`}>
                  <Icon name="community" width={30} height={30} />
                  <h2>{yours.length ? "You're up to date." : "Make a place for your people."}</h2>
                  <p>{yours.length ? "There are no other communities to explore yet. You can share your community page with someone you want to build with." : "No communities have been started yet. Give yours a name and a shared goal, then invite people to join."}</p>
                </section>
              )}
            </>
          )}
        </div>

        {!user ? (
          <aside className={`solve-panel ${styles.startPanel}`} aria-labelledby="explore-heading">
            <span className={styles.iconTile}><Icon name="community" width={25} height={25} /></span>
            <h2 id="explore-heading">Find your next collaboration.</h2>
            <p>Sign in to see communities, ask to join, or start a shared place of your own.</p>
            <Link href="/login?next=%2Fcommunities" className="solve-button">Sign in to explore communities<Icon name="arrow" width={16} /></Link>
            <div className={styles.asideFooter}>
              <Icon name="lock" width={16} />
              <p>Community names and goals are visible to signed-in people. Shared work is accessible to members with permission.</p>
            </div>
          </aside>
        ) : Array.isArray(rows) ? (
          <aside className={`solve-panel ${styles.startPanel}`} aria-labelledby="start-community-heading">
            <span className="solve-kicker">Bring people together</span>
            <h2 id="start-community-heading">Start a community</h2>
            <p>Pick a shared goal. You decide who joins, and members get a project room to work in.</p>
            {typeof error === "string" ? (
              <p role="alert" className="solve-error">{error === "input" ? `Add a name of up to ${COMMUNITY_LIMITS.name} characters. You can start up to ${COMMUNITY_LIMITS.perPerson} communities.` : "The community could not be started. Please try again."}</p>
            ) : null}
            <RecoverableForm action={startCommunityAction} ownerUserId={user.id} className="solve-form">
              <input type="hidden" name="nonce" value={randomUUID()} />
              <label htmlFor="community-name">Community name</label>
              <input id="community-name" name="name" required maxLength={COMMUNITY_LIMITS.name} autoComplete="off" placeholder="Give your group a name" />
              <label htmlFor="community-about">What will you build together?</label>
              <textarea id="community-about" name="about" maxLength={COMMUNITY_LIMITS.about} rows={4} placeholder="Describe your shared goal and who this is for." />
              <button type="submit" className="solve-button">Create community<Icon name="plus" width={16} /></button>
            </RecoverableForm>
            <div className={styles.asideFooter}>
              <Icon name="lock" width={16} />
              <p>Your name and goal appear in the directory. Shared work stays within the access you grant.</p>
            </div>
          </aside>
        ) : null}
      </div>
    </main>
  );
}

function Introduction() {
  const steps = [
    { icon: "projects" as const, title: "Start with a shared goal", text: "A small team, a project, or a group of people with something to make. Give your community a clear purpose." },
    { icon: "community" as const, title: "Choose who comes in", text: "Share your community page. People ask to join, and the owner reviews each request before granting access." },
    { icon: "chat" as const, title: "Keep the work together", text: "Members use a shared project room and send each other notes. Your AI gets access only with permission." },
  ];
  return (
    <section className={styles.introduction} aria-labelledby="community-how-heading">
      <h2 id="community-how-heading">One place to move forward together.</h2>
      <div className={styles.steps}>
        {steps.map((step) => (
          <article key={step.title} className={styles.step}>
            <span className={styles.iconTile}><Icon name={step.icon} /></span>
            <div><h3>{step.title}</h3><p>{step.text}</p></div>
          </article>
        ))}
      </div>
      <Link href="/worlds/new" className={styles.textLink}>Have an idea of your own? Start a private project<Icon name="arrow" width={16} /></Link>
    </section>
  );
}

function List({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <section aria-label={title}>
      <div className="solve-section-heading"><h2>{title}<span>{rows.length}</span></h2></div>
      <ul className={styles.communityList}>
        {rows.map((c) => (
          <li key={c.communityId}>
            <Link href={`/community/${c.communityId}`} className={styles.communityCard}>
              <span className={styles.iconTile}><Icon name="community" /></span>
              <div className={styles.cardContent}><div className={styles.cardHeading}><h3>{c.name}</h3>{c.mine ? <span className={styles.badge}>{c.mine === "owner" ? "Owner" : "Member"}</span> : null}</div>{c.about ? <p>{c.about}</p> : <p>{c.mine ? "Open your community to see its people and shared work." : "Open the community to learn more and ask to join."}</p>}</div>
              <Icon name="arrow" width={18} className={styles.cardArrow} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
