// Decorative motifs for the "Soon" pack cards. These are illustrations,
// not data — no numbers, no axes, nothing that could read as a fake chart.
// Each pack gets its own quiet visual so the row feels alive without lying.
function Frame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="pointer-events-none text-faint/70" aria-hidden="true" role="presentation">
      <svg viewBox="0 0 160 72" className="h-[72px] w-full" aria-label={label}>
        {children}
      </svg>
    </div>
  );
}

const stroke = "currentColor";
const sw = { strokeWidth: 1.25, fill: "none", stroke } as const;

// Build: small nodes feeding into one core — tools compounding.
export function BuildVisual() {
  return (
    <Frame label="Abstract diagram of connected nodes">
      {[14, 32, 50].map((y) => (
        <g key={y}>
          <rect x={8} y={y - 5} width={18} height={10} rx={3} {...sw} opacity={0.8} />
          <path d={`M26 ${y} C 44 ${y}, 52 ${36}, 68 ${36}`} {...sw} opacity={0.5} />
        </g>
      ))}
      <rect x={68} y={24} width={24} height={24} rx={7} {...sw} opacity={0.9} />
      <circle cx={80} cy={36} r={3.5} {...sw} opacity={0.9} />
      <path d="M92 36 C 104 36, 112 28, 128 28" {...sw} opacity={0.5} />
      <rect x={128} y={23} width={18} height={10} rx={3} {...sw} opacity={0.8} />
      <path d="M92 36 C 104 36, 112 44, 128 44" {...sw} opacity={0.35} />
      <rect x={128} y={39} width={18} height={10} rx={3} {...sw} opacity={0.6} />
    </Frame>
  );
}

// Create: concentric rings — a signal going out.
export function CreateVisual() {
  return (
    <Frame label="Abstract concentric rings">
      {[28, 20, 12].map((r, i) => (
        <circle key={r} cx={80} cy={36} r={r} {...sw} opacity={0.85 - i * 0.22} />
      ))}
      <circle cx={80} cy={36} r={3} fill={stroke} opacity={0.7} stroke="none" />
      {[
        [80, 8],
        [108, 36],
        [80, 64],
        [52, 36],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={2.2} fill={stroke} opacity={0.6} stroke="none" />
      ))}
    </Frame>
  );
}

// Gather: three overlapping circles — people, one graph.
export function GatherVisual() {
  return (
    <Frame label="Abstract overlapping circles">
      <line x1={56} y1={44} x2={80} y2={28} {...sw} opacity={0.4} />
      <line x1={104} y1={44} x2={80} y2={28} {...sw} opacity={0.4} />
      <line x1={56} y1={44} x2={104} y2={44} {...sw} opacity={0.25} />
      <circle cx={56} cy={44} r={13} {...sw} opacity={0.8} />
      <circle cx={104} cy={44} r={13} {...sw} opacity={0.8} />
      <circle cx={80} cy={28} r={13} {...sw} opacity={0.9} />
      <circle cx={80} cy={28} r={2.5} fill={stroke} opacity={0.7} stroke="none" />
    </Frame>
  );
}
