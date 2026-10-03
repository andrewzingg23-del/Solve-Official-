const base = "http://same-origin.invalid";

// `?next=` comes from the URL, so only follow it when it stays on this site.
// "/account?tab=1" passes; "//evil.com", "/\evil.com" and "https://evil.com" become "/".
export function safeNextPath(next: unknown): string {
  if (typeof next !== "string" || next === "") return "/";
  try {
    const url = new URL(next, base);
    return url.origin === base ? url.pathname + url.search : "/";
  } catch {
    return "/";
  }
}
