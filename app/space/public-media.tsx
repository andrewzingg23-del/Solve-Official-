"use client";

import { useEffect, useState, type FormEvent } from "react";
import { parsePublicMedia, type PublicMedia } from "@/lib/product/public-media";
import { saveSpacePublicMedia } from "./actions";

const KEY = "solve.space.public-media.v1";

export function SpacePublicMedia({ signedIn, initialUrl }: { signedIn: boolean; initialUrl: string }) {
  const [url, setUrl] = useState(initialUrl);
  const [savedUrl, setSavedUrl] = useState(initialUrl);
  const [media, setMedia] = useState<PublicMedia | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (signedIn) return;
    try {
      const local = window.localStorage.getItem(KEY) || "";
      setSavedUrl(local);
      setUrl(local);
    } catch { /* Guest preferences are best effort when storage is disabled. */ }
  }, [signedIn]);

  function loadPlayer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = parsePublicMedia(url);
    if (!parsed) {
      setNotice("Paste a public Spotify or YouTube track, playlist, album, episode, or video link.");
      setMedia(null);
      return;
    }
    // This is the explicit user action that allows the third-party iframe to load.
    setMedia(parsed);
    setNotice("Public player loaded. This does not connect or read your account.");
  }

  async function save() {
    const parsed = parsePublicMedia(url);
    if (!parsed || !media || media.sourceUrl !== parsed.sourceUrl || busy) {
      setNotice("Load and preview the public player before saving this link.");
      return;
    }
    setBusy(true);
    try {
      if (signedIn) {
        const result = await saveSpacePublicMedia(parsed.sourceUrl);
        if (!result.ok) { setNotice(result.error || "Couldn't save this link."); return; }
      } else {
        try { window.localStorage.setItem(KEY, parsed.sourceUrl); }
        catch { setNotice("Browser storage is unavailable. This link is not saved."); return; }
      }
      setUrl(parsed.sourceUrl);
      setSavedUrl(parsed.sourceUrl);
      setNotice(signedIn ? "Saved to your private Space." : "Saved on this device.");
    } finally { setBusy(false); }
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    try {
      if (signedIn) {
        const result = await saveSpacePublicMedia("");
        if (!result.ok) { setNotice(result.error || "Couldn't remove this link."); return; }
      } else {
        try { window.localStorage.removeItem(KEY); }
        catch { setNotice("Browser storage is unavailable. The saved link couldn't be removed."); return; }
      }
      setSavedUrl("");
      setUrl("");
      setMedia(null);
      setNotice("Media removed from this Space.");
    } finally { setBusy(false); }
  }

  return (
    <section className="sov-space-card sov-public-media" aria-label="Public media in your private Space">
      <div className="sov-space-title"><h2>Your media</h2><span>Public embeds · Optional</span></div>
      <p>Add a playlist or video that belongs in your environment. You select the link; SOLVE does not read your Spotify or YouTube account.</p>
      <form onSubmit={loadPlayer} className="sov-media-form">
        <label htmlFor="sov-media-url">Spotify or YouTube public link</label>
        <div className="sov-media-input">
          <input id="sov-media-url" type="url" value={url} onChange={e => { setUrl(e.target.value); setNotice(""); }}
            maxLength={600} placeholder="https://open.spotify.com/playlist/…" autoComplete="off" />
          <button className="solve-button" type="submit" disabled={busy || !url.trim()}>Load player</button>
        </div>
      </form>
      {savedUrl && !media ? <div className="sov-media-saved">
        <span>Saved to your {signedIn ? "private account" : "browser"} · Player loads only when requested</span>
        <button type="button" className="sov-space-link" onClick={() => { setUrl(savedUrl); const parsed = parsePublicMedia(savedUrl); setMedia(parsed); setNotice(parsed ? "Public player loaded." : "This saved link is no longer supported."); }}>Load saved player</button>
      </div> : null}
      {media ? <div className="sov-media-player">
        <div className="sov-media-player-heading"><span>{media.label}</span><a href={media.sourceUrl} target="_blank" rel="noopener noreferrer">Open with {media.provider} ↗</a></div>
        <iframe
          title={media.label + " player"}
          src={media.embedUrl}
          height={media.provider === "Spotify" ? 352 : 300}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-same-origin allow-scripts allow-presentation allow-popups"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
        />
        <div className="sov-media-controls">
          <button type="button" className="solve-button solve-button-secondary" disabled={busy || savedUrl === media.sourceUrl} onClick={() => void save()}>{busy ? "Saving…" : savedUrl === media.sourceUrl ? "Saved" : "Save to my Space"}</button>
          <button type="button" className="sov-space-link" onClick={() => { setMedia(null); setNotice("Player closed. No account connection was made."); }}>Close player</button>
        </div>
      </div> : null}
      {savedUrl ? <div className="sov-media-remove"><button className="sov-space-link" disabled={busy} type="button" onClick={() => void remove()}>Remove saved media</button></div> : null}
      {notice ? <p role="status" className="sov-media-notice">{notice}</p> : null}
      <small className="sov-media-privacy">Playing media loads content from the provider and is subject to that provider’s terms and privacy practices. This link is never published to your SOV Profile automatically.</small>
    </section>
  );
}
