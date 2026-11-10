import { cardFace, cardPalette, type CardLook } from "@/lib/product/card";
import "./sov-card.css";

// The SOV card face. One component for the digital card everywhere it appears, rendered from a
// person's identity and their look record — never a separate image that could drift from either.
// Nothing on it is decorative claim: no number, no expiry, no payment-network or contactless mark,
// no verification badge. The wave at the corner marks "this opens something", which is true.

export function SovCard({ name, look, className }: { name: string; look: CardLook; className?: string }) {
  const p = cardPalette(look);
  const face = cardFace(name);
  return <div className={`sov-card-frame ${className ?? ""}`}>
    <figure
      className="sov-card"
      data-finish={look.finish}
      data-tone={look.tone}
      aria-label={face.named ? `SOV ID card for ${face.name}` : "Your SOV ID card, not yet named"}
      style={{
        "--card-surface": p.surface, "--card-text": p.text, "--card-muted": p.muted,
        "--card-accent": p.accent, "--card-border": p.border,
      } as React.CSSProperties}
    >
      <div className="sov-card-top">
        <span className="sov-card-brand">
          <svg viewBox="0 0 36 36" aria-hidden="true" className="sov-card-mark">
            <path d="M24.5 7.7A12.5 12.5 0 1 1 11.5 7.7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            <circle cx="9.6" cy="9.4" r="2.1" fill="currentColor" />
          </svg>
          SOLVE
        </span>
        <span className="sov-card-instrument">{face.instrument}</span>
      </div>
      <figcaption className="sov-card-name" data-named={face.named}>{face.name}</figcaption>
      <div className="sov-card-bottom">
        <span className="sov-card-line">{face.line}</span>
        <svg viewBox="0 0 36 36" aria-hidden="true" className="sov-card-wave">
          <path d="M4 18c4-7 11-7 15 0s11 7 15 0" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      </div>
    </figure>
  </div>;
}
