"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { CardLook } from "@/lib/product/card";
import { SovCard } from "@/app/ui/sov-card";
import { shareSpace } from "./space-actions";
import styles from "./space.module.css";

// Your Space: your card, and the things you've shared as pages, at one link anyone can open.
// The preview is built from exactly what visitors will see.
export function SpaceShare({ name, look, shared, path, pages }: {
  name: string; look: CardLook; shared: boolean; path: string | null; pages: Array<{ id: string; title: string }>;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [link, setLink] = useState(path);
  const [pending, start] = useTransition();
  const toggle = (next: boolean) => start(async () => {
    setNote(""); setError("");
    const result = await shareSpace(next);
    if (!result.ok) { setError(result.error); return; }
    setLink(result.path);
    setNote(next ? "Shared. Anyone with the link can see your Space." :
      "Stopped sharing. Your Space no longer opens. A photo someone already had open may keep loading for up to 10 minutes, and anything someone saved can't be taken back.");
    router.refresh();
  });

  return <section className={`s-surface s-stack ${styles.space}`} aria-labelledby="space-title" data-space-share>
    <div className="s-stack" style={{ "--gap": "8px" } as React.CSSProperties}>
      <h2 id="space-title">Sharing</h2>
      <p className="s-muted">{shared
        ? "Shared. Anyone with the link sees your card and what you've shared as pages — and can save or screenshot it."
        : "Your card and the things you've shared as pages, at one link — for a bio, a message, or someday the back of your card. No account needed to look."}</p>
    </div>

    <div className={styles.spacePreview} aria-label="What visitors will see" data-space-preview>
      <span className="s-label">What visitors will see</span>
      <div className={styles.spacePreviewCard}><SovCard name={name} look={look} size="mini" /></div>
      <strong>{name || "Your card"}</strong>
      {pages.length
        ? <ul className={styles.spacePages}>{pages.map(p => <li key={p.id}>{p.title}</li>)}</ul>
        : <p className="s-muted s-small">No pages yet. Share something as a page from the thing itself, and it appears here.</p>}
    </div>

    <div className={styles.row}>
      {shared && link ? <>
        <a href={link} className="s-button" target="_blank" rel="noopener" data-space-link>Open my Space</a>
        <button type="button" className="s-button" data-variant="quiet" onClick={() => {
          const full = window.location.origin + link;
          navigator.clipboard?.writeText(full).then(() => setNote("Link copied."), () => setNote(full));
        }}>Copy link</button>
        <button type="button" className="s-button" data-variant="quiet" disabled={pending} onClick={() => toggle(false)} data-stop-space>{pending ? "Stopping…" : "Stop sharing"}</button>
      </> : <button type="button" className="s-button" disabled={pending} onClick={() => toggle(true)} data-share-space>{pending ? "Sharing…" : "Share my Space"}</button>}
    </div>
    {note ? <p role="status" className="s-small" data-space-note>{note}</p> : null}
    {error ? <p role="alert" className="s-error">{error}</p> : null}
  </section>;
}
