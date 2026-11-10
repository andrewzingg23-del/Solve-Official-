// The boards' icon style: thin, round line icons, one stroke, drawn on a 24-unit grid. Every icon
// is decorative beside a word, so each is hidden from assistive technology.
export type IconName = "space" | "people" | "apps" | "control" | "search" | "add" | "ai" | "lock" | "globe" | "account" | "down";

const paths: Record<IconName, React.ReactNode> = {
  space: <path d="M4 10.5 12 4l8 6.5V20h-5.5v-5.5h-5V20H4z" />,
  people: <><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19c.6-3.1 2.8-5 5.5-5s4.9 1.9 5.5 5" /><path d="M15.5 5.6a3.2 3.2 0 0 1 0 5.8M17.5 14.3c1.6.6 2.7 2.2 3 4.7" /></>,
  apps: <>{[5, 12, 19].flatMap(x => [5, 12, 19].map(y => <circle key={`${x}${y}`} cx={x} cy={y} r="2.4" />))}</>,
  control: <><circle cx="12" cy="12" r="3" /><path d="M10.3 3.5h3.4l.5 2.3 1.6.9 2.2-.8 1.7 2.9-1.7 1.6v1.9l1.7 1.6-1.7 2.9-2.2-.8-1.6.9-.5 2.3h-3.4l-.5-2.3-1.6-.9-2.2.8-1.7-2.9 1.7-1.6v-1.9L4.3 8.8 6 5.9l2.2.8 1.6-.9z" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 5 5" /></>,
  add: <path d="M12 5v14M5 12h14" />,
  ai: <path d="M12 3.5c.6 4.2 2.3 6.5 6.5 8.5-4.2 2-5.9 4.3-6.5 8.5-.6-4.2-2.3-6.5-6.5-8.5 4.2-2 5.9-4.3 6.5-8.5z" />,
  lock: <><rect x="5.5" y="10.5" width="13" height="9.5" rx="2" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></>,
  globe: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.4 2.4 3.4 5.2 3.4 8.5s-1 6.1-3.4 8.5c-2.4-2.4-3.4-5.2-3.4-8.5s1-6.1 3.4-8.5z" /></>,
  account: <><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" /></>,
  down: <path d="m7 10 5 5 5-5" />,
};

/** `filled` is the selected state: the current place is drawn solid, as on the boards. */
export function Icon({ name, size = 20, filled = false }: { name: IconName; size?: number; filled?: boolean }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false"
    fill={name === "apps" || (filled && name === "space") ? "currentColor" : "none"} stroke={name === "apps" ? "none" : "currentColor"}
    strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
