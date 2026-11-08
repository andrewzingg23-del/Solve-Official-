export type PublicInstagramMatch = {
  url: string;
  title: string;
  excerpt: string;
};

export function extractInstagramProfileMatches(body: unknown, handle: string): PublicInstagramMatch[] {
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(handle) || !body || typeof body !== "object") return [];
  const response = body as { choices?: Array<{ message?: { annotations?: unknown } }> };
  const annotations = response.choices?.[0]?.message?.annotations;
  if (!Array.isArray(annotations)) return [];
  const matches: PublicInstagramMatch[] = [];
  for (const raw of annotations) {
    if (!raw || typeof raw !== "object") continue;
    const citation = (raw as { url_citation?: unknown }).url_citation;
    if (!citation || typeof citation !== "object") continue;
    const item = citation as { url?: unknown; title?: unknown; content?: unknown };
    if (typeof item.url !== "string" || item.url.length > 2000) continue;
    let link: URL;
    try { link = new URL(item.url); } catch { continue; }
    if (link.protocol !== "https:" || !["instagram.com","www.instagram.com"].includes(link.hostname.toLowerCase()) ||
      link.username || link.password || link.port) continue;
    // Never treat a generic reel or someone else's profile as the claimed account.
    const parts = link.pathname.split("/").filter(Boolean);
    if (parts.length !== 1 || parts[0].toLowerCase() !== handle.toLowerCase()) continue;
    const url = "https://www.instagram.com/" + handle + "/";
    if (matches.some(item => item.url === url)) continue;
    matches.push({
      url,
      title: typeof item.title === "string" ? item.title.replace(/\s+/g," ").trim().slice(0,130) : "Public Instagram profile",
      excerpt: typeof item.content === "string" ? item.content.replace(/\s+/g," ").trim().slice(0,1000) : ""
    });
  }
  return matches.slice(0,3);
}

export function sourceWordsFromProfile(matches: ReadonlyArray<PublicInstagramMatch>): string {
  // Evidence only. We never use uncited model prose as if it were inspected profile content.
  return matches.map(match => match.excerpt).filter(Boolean).join("\n").slice(0,3000);
}
