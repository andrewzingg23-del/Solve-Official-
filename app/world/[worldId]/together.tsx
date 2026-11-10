"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { PHOTO_BUCKET, PHOTO_MAX_BYTES, PHOTO_MAX_SIDE, photoName } from "@/lib/product/photo";
import { addPiece, makeInvite, recordPhoto } from "./together-actions";
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

// Add a photo. The browser redraws it before it leaves the device — that drops the hidden
// details a phone writes into every photo, above all where it was taken — then stores it as this
// person, and the server checks the stored bytes before recording anything.
async function redraw(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("no canvas");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.86));
  if (!blob) throw new Error("no image");
  return blob;
}

export function AddPhoto({ worldId }: { worldId: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<{ blob: Blob; preview: string } | null>(null);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"" | "preparing" | "adding">("");

  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.preview); }, [photo]);

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setError(""); setBusy("preparing");
    try {
      const blob = await redraw(file);
      if (blob.size > PHOTO_MAX_BYTES) throw new Error("too large");
      setPhoto({ blob, preview: URL.createObjectURL(blob) });
    } catch {
      setError("That photo couldn't be opened here. Try a JPEG or PNG.");
    } finally {
      setBusy("");
      if (input.current) input.current.value = "";
    }
  };

  const add = async () => {
    if (!photo || busy) return;
    setError(""); setBusy("adding");
    try {
      const name = photoName(worldId, crypto.randomUUID());
      const { error: stored } = await createClient().storage.from(PHOTO_BUCKET)
        .upload(name, photo.blob, { contentType: "image/jpeg", upsert: false });
      if (stored) { setError("The photo couldn't be stored. You may not be able to add to this; otherwise try again."); return; }
      const result = await recordPhoto(worldId, name, caption);
      if (!result.ok) { setError(result.error); return; }
      setPhoto(null); setCaption(""); router.refresh();
    } catch {
      setError("The photo wasn't added. Your photo is still here; retry when you're connected.");
    } finally {
      setBusy("");
    }
  };

  return <div className={styles.photo}>
    <input ref={input} id="photo-file" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
      className="s-visually-hidden" onChange={event => choose(event.target.files?.[0])} />
    {photo ? <div className={styles.photoDraft}>
      {/* A local preview of the photo as it will be stored. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.preview} alt="The photo you chose" className={styles.photoPreview} />
      <label htmlFor="photo-caption" className="s-visually-hidden">Caption</label>
      <input id="photo-caption" className="s-input" maxLength={500} value={caption} disabled={busy === "adding"}
        placeholder="Say something about it (optional)" onChange={event => setCaption(event.target.value)} />
      <div className={styles.row}>
        <button type="button" className="s-button" onClick={add} disabled={Boolean(busy)} data-add-photo>{busy === "adding" ? "Adding…" : "Add photo"}</button>
        <button type="button" className="s-button" data-variant="quiet" disabled={busy === "adding"} onClick={() => { setPhoto(null); setError(""); }}>Cancel</button>
      </div>
    </div> : <label htmlFor="photo-file" className="s-button" data-variant="quiet" role="button" tabIndex={0}
      onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); input.current?.click(); } }}>
      {busy === "preparing" ? "Opening…" : "Add a photo"}
    </label>}
    {error ? <p role="alert" className="s-error">{error}</p> : null}
  </div>;
}
