import { cardFace, cardPalette, type CardLook } from "@/lib/product/card";
import { Mark } from "./mark";
import styles from "./sov-card.module.css";

// The SOV card. One component wherever a person's card appears — on ID, in the shell's frame, and
// later on their public world — rendered from their identity and their look record. Nothing on its
// face is a decorative claim: no number, no expiry, no payment-network or contactless mark, no
// verification badge. The wave marks "this opens something".

export function SovCard({ name, look, size = "full" }: { name: string; look: CardLook; size?: "full" | "mini" }) {
  const p = cardPalette(look);
  const face = cardFace(name);
  return <div className={size === "mini" ? `${styles.frame} ${styles.mini}` : styles.frame}>
    <figure
      className={styles.card}
      data-card={size}
      data-finish={look.finish}
      data-tone={look.tone}
      aria-label={face.named ? `SOV ID card for ${face.name}` : "Your SOV ID card, not yet named"}
      style={{
        "--card-surface": p.surface, "--card-text": p.text, "--card-muted": p.muted,
        "--card-accent": p.accent, "--card-border": p.border,
      } as React.CSSProperties}
    >
      <div className={styles.top}>
        <span className={styles.brand}><Mark className={styles.mark} />SOLVE</span>
        <span className={styles.instrument}>{face.instrument}</span>
      </div>
      <figcaption className={styles.name} data-named={face.named} data-card-name>{face.name}</figcaption>
      <div className={styles.bottom}>
        <span className={styles.line} data-card-line>{face.line}</span>
        <svg viewBox="0 0 36 36" aria-hidden="true" className={styles.wave}>
          <path d="M4 18c4-7 11-7 15 0s11 7 15 0" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      </div>
    </figure>
  </div>;
}
