import Link from "next/link";
import styles from "./things.module.css";

export type ThingItem = { id: string; title: string; summary: string };

// A person's things as a list. One component for Space and Bench, so a thing looks the same
// wherever it is found.
export function Things({ things, empty, action = "Open it" }: { things: ThingItem[] | null; empty: string; action?: string }) {
  if (things === null) return <p role="status" className="s-muted">Your things couldn&apos;t be loaded. Nothing of yours has changed; try again shortly.</p>;
  if (things.length === 0) return <p className="s-muted">{empty}</p>;
  return <ul className={styles.list}>
    {things.map(thing => <li key={thing.id}>
      <Link href={`/world/${encodeURIComponent(thing.id)}`} className={styles.item} data-thing={thing.id}>
        <span className={styles.title}>{thing.title}</span>
        <span className={styles.meta}>{thing.summary && thing.summary !== thing.title ? thing.summary : action}</span>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className={styles.arrow}><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </Link>
    </li>)}
  </ul>;
}
