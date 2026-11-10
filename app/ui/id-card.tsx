import { Icon } from "./icons";
import styles from "./id-card.module.css";

// Your ID, as the launch boards draw it: a glass card with "Solve.", your name, and who can see it.
// Nothing on its face is a decorative claim — no number, no expiry, no payment mark, no badge.
// Its tint follows the person's own colour (the accent their whole Solve wears).
export function IdCard({ name, shared = false }: { name: string; shared?: boolean }) {
  const named = name.trim();
  return <figure className={styles.card} aria-label={named ? `Solve ID for ${named}` : "Your Solve ID, not yet named"} data-id-card>
    <div className={styles.top}>
      <span className={styles.brand}>Solve.</span>
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={styles.mark}>
        <rect x="3" y="5.5" width="18" height="13" rx="2.5" /><circle cx="8.5" cy="11" r="1.8" /><path d="M6 15.5c.6-1.3 1.5-2 2.5-2s1.9.7 2.5 2M14 10h4M14 13.5h3" />
      </svg>
    </div>
    <div className={styles.body}>
      <span className={styles.kind}>Your Solve ID</span>
      <figcaption className={styles.name} data-card-name>{named || "Your Name"}</figcaption>
    </div>
    <span className={styles.status}><Icon name={shared ? "globe" : "lock"} size={16} />{shared ? "Shared" : "Private until shared"}</span>
  </figure>;
}
