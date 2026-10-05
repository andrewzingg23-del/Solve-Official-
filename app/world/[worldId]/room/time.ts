// "just now", "6 min ago", "3 h ago", then the day. Relative to the time the page was read.
export function ago(iso: string, now: string | Date) {
  const ms = new Date(now).getTime() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "";
  const min = Math.round(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
