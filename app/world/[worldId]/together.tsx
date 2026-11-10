"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addPiece, makeInvite } from "./together-actions";
import styles from "./together.module.css";

// Add your piece. The words stay on screen until the kernel has them.
export function AddPiece({ worldId }: { worldId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return <form className={styles.compose} onSubmit={event => {
    event.preventDefault();
    if (!text.trim() || pending) return;
    start(async () => {
      const result = await addPiece(worldId, text).catch(() => ({ ok: false as const, error: "It wasn't added. Your words are still here; retry when you're connected." }));
      if (!result.ok) { setError(result.error); return; }
      setText(""); setError(""); router.refresh();
    });
  }}>
    <label htmlFor="piece" className="s-visually-hidden">Add something</label>
    <textarea id="piece" className={styles.words} rows={2} maxLength={5000} value={text} disabled={pending}
      placeholder="Add an idea, a link, a plan — anything" onChange={event => { setText(event.target.value); setError(""); }} />
    <button type="submit" className="s-button" disabled={!text.trim() || pending}>{pending ? "Adding…" : "Add"}</button>
    {error ? <p role="alert" className="s-error">{error}</p> : null}
  </form>;
}

// Invite a friend. Uses the phone's own share sheet where there is one, so the link goes out
// through whatever the person already uses to talk to their friends; otherwise it's shown to copy.
export function InviteFriend({ worldId, title }: { worldId: string; title: string }) {
  const [link, setLink] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  return <div className={styles.invite}>
    <button type="button" className="s-button" disabled={pending} onClick={() => start(async () => {
      setError(""); setNote("");
      const result = await makeInvite(worldId);
      if (!result.ok) { setError(result.error); return; }
      const url = window.location.origin + result.path;
      setLink(url);
      if (typeof navigator.share === "function") {
        try {
          await navigator.share({ title: `Build "${title}" with me`, text: `I'm making "${title}" on SOLVE. Come build it with me:`, url });
          setNote("Sent. It works once, for one person.");
        } catch (e) {
          // Closing the share sheet isn't a failure; the link is still here to copy.
          if ((e as Error)?.name !== "AbortError") setNote("Couldn't open sharing. Copy the link below instead.");
        }
      }
    })}>{pending ? "Making a link…" : "Invite a friend"}</button>
    {link ? <div className="s-stack" style={{ "--gap": "8px" } as React.CSSProperties} data-invite-link>
      <input readOnly className="s-input" value={link} aria-label="Invite link" onFocus={event => event.currentTarget.select()} />
      <div><button type="button" className="s-button" data-variant="quiet" onClick={() =>
        navigator.clipboard?.writeText(link).then(() => setNote("Copied. It works once, for one person."), () => setNote("Select the link above and copy it."))}>Copy link</button></div>
      <p className="s-muted s-small">Each link works once, for one person, for two days. Make a new one for each friend.</p>
    </div> : null}
    {note ? <p role="status" className="s-small">{note}</p> : null}
    {error ? <p role="alert" className="s-error">{error}</p> : null}
  </div>;
}
