// SOLVE's mark: an open ring and a point — the same mark as on the card.
export function Mark({ size = 24, className }: { size?: number; className?: string }) {
  return <svg viewBox="0 0 36 36" width={size} height={size} aria-hidden="true" className={className}>
    <path d="M24.5 7.7A12.5 12.5 0 1 1 11.5 7.7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    <circle cx="9.6" cy="9.4" r="2.1" fill="currentColor" />
  </svg>;
}

export type Destination = "home" | "id" | "space" | "bench" | "control";

// One small, consistent icon per destination. The icon for ID is a card, because ID is the card.
export function DestinationIcon({ name }: { name: Destination }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden="true">
    {name === "home" && <path {...common} d="M4 10.8 12 4l8 6.8V20h-5.2v-5.6H9.2V20H4z" />}
    {name === "id" && <><rect {...common} x="3" y="6" width="18" height="12" rx="2.4" /><path {...common} d="M7 14.5h6M7 10.5h2" /></>}
    {name === "space" && <><rect {...common} x="4" y="4" width="7" height="7" rx="1.6" /><rect {...common} x="13" y="4" width="7" height="7" rx="1.6" /><rect {...common} x="4" y="13" width="7" height="7" rx="1.6" /><rect {...common} x="13" y="13" width="7" height="7" rx="1.6" /></>}
    {name === "bench" && <path {...common} d="M4.5 19.5 5.6 15 15.8 4.8a1.8 1.8 0 0 1 2.6 0l.8.8a1.8 1.8 0 0 1 0 2.6L9 18.4zM13.8 6.8l3.4 3.4" />}
    {name === "control" && <><path {...common} d="M5 7h9M18 7h1M5 17h3M12 17h7" /><circle {...common} cx="16" cy="7" r="2" /><circle {...common} cx="10" cy="17" r="2" /></>}
  </svg>;
}
