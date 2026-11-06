// Official public embed URLs only. This does NOT authorize SOV to access account data.
export type PublicEmbed = { provider: "YouTube" | "Spotify"; src: string; title: string };

export function parsePublicEmbed(input: unknown): PublicEmbed | null {
  if (typeof input !== "string" || input.length > 2048) return null;
  let url: URL;
  try { url = new URL(input.trim()); } catch { return null; }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  const host = url.hostname.toLowerCase();

  if (host === "youtube.com" || host === "www.youtube.com" || host === "m.youtube.com" ||
      host === "youtu.be" || host === "www.youtube-nocookie.com" || host === "youtube-nocookie.com") {
    const id = host === "youtu.be" ? url.pathname.slice(1) :
      url.pathname === "/watch" ? url.searchParams.get("v") :
      url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/embed/") ? url.pathname.split("/")[2] : null;
    if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) {
      return { provider: "YouTube", src: "https://www.youtube-nocookie.com/embed/" + id, title: "YouTube video" };
    }
  }

  if (host === "open.spotify.com") {
    const match = url.pathname.match(/^\/(?:embed\/)?(track|album|playlist|episode|show)\/([A-Za-z0-9]{22})\/?$/);
    if (match) return { provider: "Spotify", src: "https://open.spotify.com/embed/" + match[1] + "/" + match[2], title: "Spotify " + match[1] };
  }
  return null;
}
