import type { SpaceAppearance } from "./appearance";

export type InstagramTone = SpaceAppearance["tone"];
export type InstagramAnalysis = {
  tone: InstagramTone;
  photosRead: number;
  captionsRead: number;
  source: "photos" | "captions" | "photos-and-captions" | "public-profile" | "photos-and-public" | "captions-and-public";
  explanation: string;
};

export function isInstagramStyleRequest(input: unknown): boolean {
  if (typeof input !== "string" || input.length > 7000) return false;
  const text = input.toLowerCase();
  // "My Instagram" alone should not silently create or redesign a World.
  const mentionsInstagram = /\b(instagram|insta|ig profile|ig posts|ig feed)\b/.test(text);
  const asksForStyle = /\b(personali[sz]e|customi[sz]e|style|aesthetic|look|feel|theme|vibe|match|inspir|based on|make it mine|make this me|my space|my world|my reality|find|search|connect|import)\b/.test(text);
  return mentionsInstagram && asksForStyle;
}

export function instagramProfileUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 250) return null;
  const trimmed = value.trim();
  const handle = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
  let candidate = handle;
  const profileInput = /^(?:www\.)?instagram\.com\//i.test(handle) ? "https://" + handle : handle;
  if (/^https?:\/\//i.test(profileInput)) {
    try {
      const url = new URL(profileInput);
      if (!["instagram.com","www.instagram.com"].includes(url.hostname.toLowerCase()) || url.username || url.password || url.port) return null;
      candidate = url.pathname.split("/").filter(Boolean)[0] || "";
    } catch { return null; }
  }
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(candidate) || /^(p|reel|reels|stories|explore|accounts|direct|about|privacy|developer|graphql|api)$/i.test(candidate)) return null;
  return "https://www.instagram.com/" + candidate + "/";
}

// Pure and stable: no guessed Instagram activity, identity or personality.
export function suggestInstagramAppearance(
  current: SpaceAppearance,
  hues: ReadonlyArray<number>,
  captionText = ""
): { next: SpaceAppearance; analysis: InstagramAnalysis | null } {
  const counts = { ocean:0, mint:0, sunset:0, violet:0 } satisfies Record<Exclude<InstagramTone,"graphite">,number>;
  for (const hue of hues) {
    if (!Number.isFinite(hue) || hue < 0 || hue >= 360) continue;
    if (hue >= 35 && hue < 80) counts.sunset += 1;
    else if (hue >= 80 && hue < 175) counts.mint += 1;
    else if (hue >= 175 && hue < 260) counts.ocean += 1;
    else if (hue >= 260 && hue < 345) counts.violet += 1;
    else counts.sunset += 1;
  }
  const caption = captionText.trim().slice(0,10000).toLowerCase();
  const captionTerms: Array<[RegExp,Exclude<InstagramTone,"graphite">]> = [
    [/\b(ocean|sea|blue|surf|water|sailing|coast)\b/g,"ocean"],
    [/\b(nature|forest|garden|green|botanical|earth)\b/g,"mint"],
    [/\b(sunset|warm|gold|desert|orange|sunrise)\b/g,"sunset"],
    [/\b(violet|lavender|purple|nightlife)\b/g,"violet"],
  ];
  // Captions are a weak signal. Images dominate whenever available.
  for (const [pattern,tone] of captionTerms) {
    const words = caption.match(pattern);
    counts[tone] += Math.min(2,words?.length || 0);
  }
  const sorted = (Object.entries(counts) as Array<[Exclude<InstagramTone,"graphite">,number]>).sort((a,b) => b[1]-a[1]);
  const captionCount = caption ? caption.split(/\n+/).filter(Boolean).length : 0;
  if (!hues.length && !captionCount) return { next:current, analysis:null };
  // Monochrome source photos have no dominant chromatic hue. Honor them as graphite.
  const tone: InstagramTone = sorted[0][1] === 0 ? "graphite" : sorted[0][0];
  const next = { ...current, tone };
  const source = hues.length && captionCount ? "photos-and-captions" : hues.length ? "photos" : "captions";
  const explanation = hues.length
    ? "A restrained color mood based on the photos you selected. SOLVE has not searched your full Instagram account."
    : "A tentative color mood based on the captions you supplied. Add photos for a stronger visual match.";
  return { next, analysis:{tone,photosRead:hues.length,captionsRead:captionCount,source,explanation} };
}
