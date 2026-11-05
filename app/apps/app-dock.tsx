"use client";

import { useEffect, useState } from "react";
import { parsePublicEmbed } from "@/lib/product/public-embeds";

type SavedSurface = { id: string; url: string };
const STORAGE_KEY = "sov.public-app-surfaces.v1";

function restore(): SavedSurface[] {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw.filter((row): row is SavedSurface =>
      typeof row === "object" && row !== null &&
      typeof row.id === "string" && typeof row.url === "string" && Boolean(parsePublicEmbed(row.url)),
    ).slice(0, 8);
  } catch { return []; }
}

export function AppDock() {
  const [items, setItems] = useState<SavedSurface[]>([]);
  const [url, setUrl] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItems(restore());
    setReady(true);
  }, []);

  function commit(next: SavedSurface[]) {
    setItems(next);
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
    catch { setError("This browser cannot persist app panels. Keep the page open until your preferences can be saved."); }
  }

  function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const embed = parsePublicEmbed(url);
    if (!embed) {
      setError("Use a valid public YouTube video or Spotify track, album, playlist, episode or show link.");
      return;
    }
    if (items.some(item => parsePublicEmbed(item.url)?.src === embed.src)) {
      setError("This player is already in your Space.");
      return;
    }
    if (items.length >= 8) { setError("Remove a player before adding another."); return; }
    commit([...items, { id: crypto.randomUUID(), url: url.trim() }]);
    setUrl("");
  }

  return <div className="sov-app-dock">
    <form className="sov-app-dock-input" onSubmit={add}>
      <label htmlFor="app-url">Add a public media app</label>
      <div><input id="app-url" type="url" required inputMode="url" placeholder="Paste a YouTube or Spotify URL" value={url} onChange={event => setUrl(event.target.value)} disabled={!ready} />
      <button className="solve-button" type="submit" disabled={!ready}>Add player</button></div>
      <p>These official public players work without connecting an account. Playback remains governed by each provider's availability and policies.</p>
      {error ? <p role="alert" className="solve-error">{error}</p> : null}
    </form>
    {items.length ? <div className="sov-app-surface-grid">
      {items.map(item => {
        const embed = parsePublicEmbed(item.url);
        if (!embed) return null;
        return <section className="sov-app-surface" key={item.id} aria-label={embed.title}>
          <div className="sov-app-surface-head"><strong>{embed.provider}</strong><div>
            <a href={item.url} target="_blank" rel="noopener noreferrer">Open provider ↗</a>
            <button type="button" onClick={() => commit(items.filter(other => other.id !== item.id))} aria-label={"Remove " + embed.provider + " player"}>Remove</button>
          </div></div>
          <iframe
            title={embed.title}
            src={embed.src}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
          />
        </section>;
      })}
    </div> : <div className="solve-empty">
      <h2>Your Space stays clear until you add something.</h2>
      <p>Choose a supported media link above. Other third-party accounts are connected separately through provider authorization.</p>
    </div>}
  </div>;
}
