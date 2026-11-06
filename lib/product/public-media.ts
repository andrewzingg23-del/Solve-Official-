// Supported, provider-hosted public media only. Never execute supplied embed HTML.
// A URL is content selection, not permission to access an external account.
export type PublicMedia = {
  provider: "Spotify" | "YouTube";
  sourceUrl: string;
  embedUrl: string;
  label: string;
};
export function parsePublicMedia(input: unknown): PublicMedia | null {
  if (typeof input !== "string" || input.length > 600 || !input.trim()) return null;
  let u: URL;
  try { u = new URL(input.trim()); } catch { return null; }
  if (u.protocol !== "https:" || u.username || u.password || u.port) return null;
  const host = u.hostname.toLowerCase();
  const parts = u.pathname.split("/").filter(Boolean);
  if (host === "open.spotify.com") {
    const normalized = parts[0]?.startsWith("intl-") ? parts.slice(1) : parts;
    const [type, id] = normalized[0] === "embed" ? normalized.slice(1) : normalized;
    if (normalized.length !== (normalized[0] === "embed" ? 3 : 2)) return null;
    if (!["track","album","playlist","show","episode","artist"].includes(type) || !/^[A-Za-z0-9]{22}$/.test(id || "")) return null;
    return {
      provider: "Spotify",
      sourceUrl: "https://open.spotify.com/" + type + "/" + id,
      embedUrl: "https://open.spotify.com/embed/" + type + "/" + id,
      label: "Spotify " + type,
    };
  }
  if (["www.youtube.com","youtube.com","m.youtube.com","youtu.be","www.youtube-nocookie.com"].includes(host)) {
    let id: string | null = null;
    if (host === "youtu.be" && parts.length === 1) id = parts[0];
    else if (parts.length === 1 && parts[0] === "watch") id = u.searchParams.get("v");
    else if (parts.length === 2 && ["embed","shorts","live"].includes(parts[0])) id = parts[1];
    if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
    return {
      provider: "YouTube",
      sourceUrl: "https://www.youtube.com/watch?v=" + id,
      embedUrl: "https://www.youtube-nocookie.com/embed/" + id + "?playsinline=1",
      label: "YouTube video",
    };
  }
  return null;
}
