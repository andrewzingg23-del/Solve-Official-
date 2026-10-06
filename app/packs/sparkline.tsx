// Shared SVG sparkline. No dependencies, no animation that implies live
// data — the parent decides what "live" means. Points are real values or
// the component renders nothing (honest empty state, never a fake curve).
export function Sparkline({
  points,
  width = 120,
  height = 36,
  stroke = "var(--accent)",
  label,
}: {
  points: number[];
  width?: number;
  height?: number;
  stroke?: string;
  label?: string;
}) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = width / (points.length - 1);
  const d = points
    .map((p, i) => {
      const x = (i * step).toFixed(1);
      const y = (height - 2 - ((p - min) / span) * (height - 4)).toFixed(1);
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
  const up = points[points.length - 1] >= points[0];
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label ?? `Trend, ${up ? "up" : "down"} over the shown period`}
      className="block"
    >
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle
        cx={width - 1}
        cy={Number((height - 2 - ((points[points.length - 1] - min) / span) * (height - 4)).toFixed(1))}
        r={2.5}
        fill={stroke}
      />
    </svg>
  );
}
