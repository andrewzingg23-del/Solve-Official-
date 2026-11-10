"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CardLook } from "@/lib/product/card";
import { DESTINATIONS, destinationOf } from "@/lib/product/destinations";
import { DestinationIcon, Mark } from "./mark";
import { SovCard } from "./sov-card";
import styles from "./shell.module.css";

// One shell. The frame is SOLVE's; the person is present in it through their own card, which sits
// at the foot of the rail and opens ID. Pages a person reaches from someone else's link get only
// SOLVE's mark — never someone else's navigation.
export function Shell({ name, look, signedIn, children }: {
  name: string; look: CardLook; signedIn: boolean; children: React.ReactNode;
}) {
  const path = usePathname();
  const active = destinationOf(path);
  const fromSomeoneElse = path.startsWith("/confirm/") || path.startsWith("/oauth") || path.startsWith("/world-invite");

  // A person's public page is theirs edge to edge: it draws its own frame in their colours.
  if (path.startsWith("/p/")) return <>{children}</>;

  if (fromSomeoneElse) {
    return <div className={styles.bare}>
      <header className={styles.bareHead}><Link href="/" className={styles.brand} aria-label="SOLVE"><Mark size={22} />SOLVE</Link></header>
      <main className={styles.bareMain}>{children}</main>
    </div>;
  }

  const links = DESTINATIONS.map(d =>
    <Link key={d.href} href={d.href} className={styles.link} aria-current={active === d.href ? "page" : undefined}>
      <DestinationIcon name={d.icon} /><span>{d.label}</span>
    </Link>);
  const here = DESTINATIONS.find(d => d.href === active)?.label ?? "SOLVE";

  return <div className={styles.shell}>
    <a href="#main" className={styles.skip}>Skip to content</a>
    <aside className={styles.rail} aria-label="SOLVE">
      <Link href="/" className={styles.brand} aria-label="SOLVE, home"><Mark size={24} />SOLVE</Link>
      <nav aria-label="Primary" className={styles.nav}>{links}</nav>
      <Link href="/account" className={styles.you} aria-label="Your SOV ID">
        <SovCard name={name} look={look} size="mini" />
        {!signedIn ? <span className={styles.youNote}>Kept in this browser</span> : null}
      </Link>
    </aside>
    <div className={styles.body}>
      <header className={styles.top}>
        <Link href="/" className={styles.brand} aria-label="SOLVE, home"><Mark size={22} />SOLVE</Link>
        <span className={styles.here}>{here}</span>
      </header>
      <main id="main" tabIndex={-1} className={styles.main}>{children}</main>
    </div>
    <nav aria-label="Primary mobile" className={styles.tabs}>{links}</nav>
  </div>;
}
