"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { PHOTO_BUCKET, PHOTO_MAX_BYTES, PHOTO_MAX_SIDE, photoName } from "@/lib/product/photo";
import { addPiece, captureLink, changePresentation, makeInvite, revisePiece, setAppAccess, recordPhoto, setPagePublished } from "./together-actions";
import styles from "./together.module.css";

// Add your piece. The words stay on screen until the kernel has them.
export function AddPiece({ worldId }: { worldId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);
  // Kept until a link is brought in, so pressing again after a dropped connection resumes the same run.
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  // Grow with the words (and shrink back once added) where the browser can't size the field itself.
  useEffect(() => {
    const el = field.current;
    if (!el || CSS.supports("field-sizing", "content")) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return <form className={styles.compose} onSubmit={event => {
    event.preventDefault();
    if (!text.trim() || pending) return;
    start(async () => {
      // A lone web address is brought in as the page itself (title, status, fingerprint), not as words.
      const lone = /^https:\/\/\S+$/.test(text.trim());
      const result = await (lone ? captureLink(worldId, text.trim(), requestId) : addPiece(worldId, text))
        .catch(() => ({ ok: false as const, error: "It wasn't added. Your words are still here; retry when you're connected." }));
      if (!result.ok) { setError(result.error); return; }
      setText(""); setError(""); setRequestId(crypto.randomUUID()); router.refresh();
    });
  }}>
    <label htmlFor="piece" className="s-visually-hidden">Add something</label>
    <textarea ref={field} id="piece" className={styles.words} rows={1} maxLength={5000} value={text} disabled={pending}
      placeholder="Add an idea, a link, a plan…" onChange={event => { setText(event.target.value); setError(""); }} />
    {/* The approved input's round arrow: it says what it does, and is quiet until there's something to add. */}
    <button type="submit" className={styles.send} aria-label="Add" disabled={!text.trim() || pending} data-pending={pending || undefined}>
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
    </button>
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
    </div> : <label htmlFor="photo-file" className={styles.chip} role="button" tabIndex={0}
      onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); input.current?.click(); } }}>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5.5" width="17" height="13" rx="2.5" /><circle cx="9" cy="10.5" r="1.8" /><path d="m20.5 15.5-4.5-4.5-9 7.5" /></svg>
      {busy === "preparing" ? "Opening…" : "Add a photo"}
    </label>}
    {error ? <p role="alert" className="s-error">{error}</p> : null}
  </div>;
}

// Share this as a public page, or stop. Nothing the owner made is public until they tick it, and
// they see exactly what visitors will see before sharing. What friends added is never offered.
export type PageCandidate = { id: string; kind: "text" | "photo"; text: string; url: string | null };

export function SharePage({ worldId, title, description, published, selected, candidates, friendsPieces }: {
  worldId: string; title: string; description: string; published: boolean; selected: string[];
  candidates: PageCandidate[]; friendsPieces: number;
}) {
  const router = useRouter();
  const [chosen, setChosen] = useState<string[]>(() => selected.filter(id => candidates.some(c => c.id === id)));
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const path = `/p/${worldId}`;
  const shown = candidates.filter(c => chosen.includes(c.id));
  const changed = published && (chosen.length !== selected.length || chosen.some(id => !selected.includes(id)));
  const save = (next: boolean, message: string) => start(async () => {
    setError(""); setNote("");
    const result = await setPagePublished(worldId, next, chosen);
    if (!result.ok) { setError(result.error); return; }
    setNote(message);
    router.refresh();
  });

  // Sharing is something a person does, not a form that lives on every Space: one quiet line that says
  // where things stand, opening in place — and opening by itself when they arrive from "Private".
  const panel = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const openIfAsked = () => { if (window.location.hash === "#share" && panel.current) panel.current.open = true; };
    openIfAsked();
    window.addEventListener("hashchange", openIfAsked);
    return () => window.removeEventListener("hashchange", openIfAsked);
  }, []);
  return <details ref={panel} id="share" className={styles.sharePanel} data-share>
    <summary className={styles.shareLine}>
      <span className={styles.shareIcon} aria-hidden="true">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.4 2.4 3.4 5.2 3.4 8.5s-1 6.1-3.4 8.5c-2.4-2.4-3.4-5.2-3.4-8.5s1-6.1 3.4-8.5z" /></svg>
      </span>
      <span className={styles.shareText}>
        <h2 id="share-title" className={styles.shareTitle}>Public page</h2>
        <span className="s-muted s-small" data-share-state>{published ? "Shared — anyone with the link can see it" : "Not shared"}</span>
      </span>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.shareChevron}><path d="m7 10 5 5 5-5" /></svg>
    </summary>
    <div className={styles.shareBody}>
    <p className="s-muted s-small">
      {published ? "Shared. Anyone with the link can see what's below — and can save or screenshot it." :
        "Show this to anyone, no account needed to look. Choose what they see; anything you share can be saved or screenshotted by whoever sees it."}
    </p>

    {candidates.length ? <fieldset className={styles.choose}>
      <legend className="s-small">What you added — tick what visitors should see</legend>
      {candidates.map(c => <label key={c.id} className={styles.option} data-choice={c.id}>
        <input type="checkbox" checked={chosen.includes(c.id)} disabled={pending}
          onChange={e => setChosen(now => e.target.checked ? [...now, c.id] : now.filter(id => id !== c.id))} />
        {c.kind === "photo" && c.url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={c.url} alt="" className={styles.thumb} />
          : null}
        <span className={styles.optionText}>{c.text || (c.kind === "photo" ? "A photo" : "")}</span>
      </label>)}
    </fieldset> : <p className="s-small">Nothing you added yet. The page will show the title and your name.</p>}
    {friendsPieces ? <p className="s-muted s-small" data-friends-private>
      {friendsPieces === 1 ? "1 thing a friend added isn't listed — it stays private." : `${friendsPieces} things friends added aren't listed — they stay private.`}
    </p> : null}

    <div className={styles.preview} aria-label="What visitors will see" data-preview>
      <span className="s-label">What visitors will see</span>
      <strong className={styles.previewTitle}>{title}</strong>
      {description ? <p className="s-muted s-small">{description}</p> : null}
      {shown.length ? <ul className={styles.previewList}>{shown.map(c => <li key={c.id}>
        {c.kind === "photo" && c.url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={c.url} alt="" className={styles.previewImage} />
          : null}
        {c.text ? <span>{c.text}</span> : null}
      </li>)}</ul> : <p className="s-muted s-small">Only the title and your name.</p>}
    </div>

    <div className={styles.row}>
      {published ? <>
        {changed ? <button type="button" className="s-button" disabled={pending} onClick={() => save(true, "Updated. Visitors now see what's ticked.")} data-update-page>{pending ? "Updating…" : "Update the page"}</button> : null}
        <a href={path} className="s-button" data-variant="quiet" target="_blank" rel="noopener" data-page-link>Open the page</a>
        <button type="button" className="s-button" data-variant="quiet" onClick={() => {
          const full = window.location.origin + path;
          navigator.clipboard?.writeText(full).then(() => setNote("Link copied."), () => setNote(full));
        }}>Copy link</button>
        <button type="button" className="s-button" data-variant="quiet" disabled={pending} data-unpublish
          onClick={() => save(false, "Stopped sharing. The page no longer opens. A photo someone already had open may keep loading for up to 10 minutes, and anything someone already saved can't be taken back.")}>
          {pending ? "Stopping…" : "Stop sharing"}</button>
      </> : <button type="button" className="s-button" disabled={pending} onClick={() => save(true, "Shared. Anyone with the link can see it.")} data-publish>{pending ? "Sharing…" : "Share as a page"}</button>}
    </div>
    {note ? <p role="status" className="s-small" data-share-note>{note}</p> : null}
    {error ? <p role="alert" className="s-error">{error}</p> : null}
    </div>
  </details>;
}

// Apps here: each app the person connected (Claude, ChatGPT, any tool that signs in through Solve)
// can do nothing in this Space until they choose. Read lets it see this Space; Add also lets it add
// drafts, each labelled as its own. These grants are all the app has: its token is its own agent.
export function AppAccess({ worldId, clientId, current, name }: { worldId: string; clientId: string; current: "none" | "read" | "add"; name: string }) {
  const router = useRouter();
  const [value, setValue] = useState(current);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const choose = (next: "none" | "read" | "add") => {
    const before = value;
    setValue(next); setError("");
    start(async () => {
      const result = await setAppAccess(worldId, clientId, next);
      if (!result.ok) { setValue(before); setError(result.error); return; }
      router.refresh();
    });
  };
  return <fieldset className={styles.choose} disabled={pending} data-app-access={clientId}>
    <legend className="s-small"><strong>{name}</strong></legend>
    <div className={styles.row}>
      {([["none", "Off"], ["read", "Read"], ["add", "Add"]] as const).map(([v, label]) =>
        <label key={v} className={styles.option}><input type="radio" name={`app-${clientId}`} value={v} checked={value === v} onChange={() => choose(v)} data-app-choice={v} />
          <span>{label}</span></label>)}
    </div>
    {error ? <p role="alert" className="s-error">{error}</p> : null}
  </fieldset>;
}

// Edit one piece, in place. Offered only when the capability contract says this person may; the
// kernel decides again on save. The request id is kept until the save succeeds, so pressing Save
// again after a dropped connection repeats the same request instead of making a second change.
export function RevisePiece({ worldId, entityId, version, text, label }: {
  worldId: string; entityId: string; version: number; text: string; label: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [words, setWords] = useState(text);
  const [expected, setExpected] = useState(version);
  const [requestId, setRequestId] = useState("");
  const [error, setError] = useState("");
  const [latest, setLatest] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!open) return <button type="button" className={styles.reviseOpen} data-revise-open
    onClick={() => { setWords(text); setExpected(version); setRequestId(crypto.randomUUID()); setError(""); setLatest(null); setOpen(true); }}>{label}</button>;
  return <form className={styles.revise} data-revise onSubmit={event => {
    event.preventDefault();
    if (pending || !words.trim()) return;
    start(async () => {
      setError("");
      try {
        const result = await revisePiece(worldId, entityId, expected, words, requestId);
        if (!result.ok) {
          setError(result.error);
          // Someone else saved first: show theirs, keep these words, and aim the next save at theirs.
          if (result.latest) { setLatest(result.latest.text); setExpected(result.latest.version); setRequestId(crypto.randomUUID()); }
          return;
        }
        setOpen(false); setLatest(null);
        router.refresh();
      } catch {
        setError("It wasn't saved — the connection dropped. Your words are still here; save again.");
      }
    });
  }}>
    <label htmlFor={`revise-${entityId}`} className="s-visually-hidden">Edit this piece</label>
    <textarea id={`revise-${entityId}`} className="s-textarea" rows={4} maxLength={5000} value={words} autoFocus
      onChange={event => setWords(event.target.value)} disabled={pending} data-revise-text />
    {latest !== null ? <p className="s-small" data-revise-latest><span className="s-muted">Saved by someone else: </span>{latest}</p> : null}
    <div className={styles.row}>
      <button className="s-button" disabled={pending || !words.trim()} data-revise-save>{pending ? "Saving…" : "Save"}</button>
      <button type="button" className="s-button" data-variant="quiet" disabled={pending} onClick={() => setOpen(false)}>Cancel</button>
    </div>
    {error ? <p role="alert" className="s-error" data-revise-error>{error}</p> : null}
  </form>;
}

// Edit Space: compose how this Space looks from what's already in it. Preview opens the draft at its
// own address and saves nothing; Save, Undo and Return to Base each write a version.
export type EditOption = { id: string; label: string; url?: string | null };

/** The average colour of the middle of a photo the person added — their own content as the Space's colour. */
async function colourOf(url: string): Promise<string> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = 32; c.height = 32;
  const g = c.getContext("2d")!;
  g.drawImage(img, img.width * 0.2, img.height * 0.2, img.width * 0.6, img.height * 0.6, 0, 0, 32, 32);
  const d = g.getImageData(0, 0, 32, 32).data; // throws if the browser won't let the photo be read
  let r = 0, gr = 0, b = 0;
  for (let i = 0; i < d.length; i += 4) { r += d[i]; gr += d[i + 1]; b += d[i + 2]; }
  const n = d.length / 4, hex = (x: number) => Math.round(x / n).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(gr)}${hex(b)}`;
}
export function EditSpace({ worldId, current, previewing, photos, notes, tints, canUndo }: {
  worldId: string; current: { composition: string; cover: string | null; featured: string[]; tint: string | null };
  previewing: boolean; photos: EditOption[]; notes: EditOption[]; tints: string[]; canUndo: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(current);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const panel = useRef<HTMLDetailsElement>(null);
  // Opened in place from the Space's own header ("Edit Space"), like sharing.
  useEffect(() => {
    const openIfAsked = () => { if (window.location.hash === "#edit-space" && panel.current) panel.current.open = true; };
    openIfAsked();
    window.addEventListener("hashchange", openIfAsked);
    return () => window.removeEventListener("hashchange", openIfAsked);
  }, []);
  const coverUrl = photos.find(p => p.id === draft.cover)?.url ?? null;
  const fromCover = async () => {
    if (!coverUrl) return;
    setError("");
    try { const tint = await colourOf(coverUrl); setDraft(d => ({ ...d, tint })); }
    catch { setError("This photo's colour can't be read here. Choose a colour instead."); }
  };
  const run = (mode: "save" | "undo" | "base") => start(async () => {
    setError("");
    const result = await changePresentation(worldId, mode, draft, crypto.randomUUID());
    if (!result.ok) { setError(result.error); return; }
    router.replace(`/world/${encodeURIComponent(worldId)}`);
    router.refresh();
  });
  const previewHref = () => {
    const q = new URLSearchParams({ preview: "1", composition: draft.composition });
    if (draft.cover) q.set("cover", draft.cover);
    if (draft.featured.length) q.set("featured", draft.featured.join(","));
    if (draft.tint) q.set("tint", draft.tint);
    return `/world/${encodeURIComponent(worldId)}?${q}`;
  };
  return <details ref={panel} id="edit-space" className={styles.sharePanel} data-edit-space open={previewing || undefined}>
    <summary className={styles.shareLine}>
      <span className={styles.shareIcon} aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="17" height="7" rx="1.5" /></svg></span>
      <span className={styles.shareText}><h2 className={styles.shareTitle}>Edit Space</h2><span className="s-muted s-small">{previewing ? "Previewing — not saved" : "How this Space looks"}</span></span>
    </summary>
    <div className={styles.shareBody}>
      <fieldset className={styles.choose} disabled={pending}>
        <legend className="s-small">Layout</legend>
        {[["base", "Base", "Solve's own layout"], ["story", "Story", "A cover leads, your highlights first"]].map(([v, l, h]) =>
          <label key={v} className={styles.option}><input type="radio" name="composition" checked={draft.composition === v} data-composition={v}
            onChange={() => setDraft(d => ({ ...d, composition: v }))} /><span><strong>{l}</strong> <span className="s-muted s-small">{h}</span></span></label>)}
      </fieldset>
      {photos.length ? <label className="s-stack" style={{ "--gap": "6px" } as React.CSSProperties}><span className="s-small">Cover</span>
        <select className="s-input" value={draft.cover ?? ""} data-cover disabled={pending} onChange={e => setDraft(d => ({ ...d, cover: e.target.value || null }))}>
          <option value="">No cover</option>
          {photos.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select></label> : <p className="s-muted s-small">Add a photo to use it as a cover.</p>}
      {notes.length ? <fieldset className={styles.choose} disabled={pending}>
        <legend className="s-small">Highlights (up to 3)</legend>
        {notes.map(n => <label key={n.id} className={styles.option}><input type="checkbox" data-feature={n.id} checked={draft.featured.includes(n.id)}
          onChange={e => setDraft(d => ({ ...d, featured: e.target.checked ? [...d.featured, n.id].slice(0, 3) : d.featured.filter(x => x !== n.id) }))} />
          <span className={styles.optionText}>{n.label}</span></label>)}
      </fieldset> : null}
      <fieldset className={styles.choose} disabled={pending}>
        <legend className="s-small">Colour</legend>
        <div className={styles.row}>
          <button type="button" className={styles.swatch} aria-pressed={!draft.tint} aria-label="Solve's own colour" data-tint="" onClick={() => setDraft(d => ({ ...d, tint: null }))} />
          {tints.map(t => <button key={t} type="button" className={styles.swatch} style={{ background: t }} aria-pressed={draft.tint === t} aria-label={`Colour ${t}`} data-tint={t}
            onClick={() => setDraft(d => ({ ...d, tint: t }))} />)}
          <label className={styles.swatch} aria-label="Any colour" style={draft.tint && !tints.includes(draft.tint) ? { background: draft.tint } : undefined}
            data-any-tint aria-pressed={Boolean(draft.tint && !tints.includes(draft.tint))}>
            <input type="color" className="s-visually-hidden" value={draft.tint ?? "#888888"} onChange={e => setDraft(d => ({ ...d, tint: e.target.value }))} />
          </label>
        </div>
        {coverUrl ? <button type="button" className={styles.chip} onClick={fromCover} data-tint-from-cover>Take the colour from the cover</button> : null}
        <p className="s-muted s-small">Whatever you choose, text stays readable — that&apos;s computed, not hoped for.</p>
      </fieldset>
      <div className={styles.row}>
        <a href={previewHref()} className="s-button" data-variant="quiet" data-preview-space>Preview</a>
        <button type="button" className="s-button" disabled={pending} onClick={() => run("save")} data-save-space>{pending ? "Saving…" : "Save"}</button>
        <button type="button" className="s-button" data-variant="quiet" disabled={pending || !canUndo} onClick={() => run("undo")} data-undo-space>Undo</button>
        <button type="button" className="s-button" data-variant="link" disabled={pending} onClick={() => run("base")} data-base-space>Return to Base</button>
      </div>
      {error ? <p role="alert" className="s-error">{error}</p> : null}
    </div>
  </details>;
}

