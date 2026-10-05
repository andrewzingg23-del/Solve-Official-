// A printable part on a World's canvas: its side outline, size and material, and the STL to take
// to a slicer. The outline is redrawn from the validated part, never from raw stored text.
import { parsePart, partOutlinePath, sizeText } from "@/lib/bot/part";

export function PartPreview({ worldId, pieceId, body, title }: { worldId: string; pieceId: string; body: string; title: string }) {
  const part = parsePart(body);
  if (!part) return null;
  const { d, width, height } = partOutlinePath(part);
  return (
    <figure className="flex flex-col gap-3 rounded border border-line bg-background/70 p-3">
      <svg viewBox={`-4 -4 ${width + 8} ${height + 8}`} role="img" aria-label={`${title}: side outline, ${sizeText(part)} mm`} className="mx-auto h-auto max-h-40 w-full max-w-64">
        <path d={d} fill="currentColor" fillOpacity={0.08} stroke="currentColor" strokeWidth={1} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        <line x1={-4} y1={height} x2={width + 4} y2={height} stroke="currentColor" strokeOpacity={0.35} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className="flex flex-col gap-1 text-xs leading-5 text-muted">
        <span className="tabular-nums">{sizeText(part)} mm · {part.material}</span>
        <span className="break-words">{part.purpose}</span>
        <a href={`/parts/${worldId}/${pieceId}.stl`} className="mt-1 self-start text-[11px] font-semibold uppercase tracking-[0.2em] text-accent underline decoration-line underline-offset-4 hover:opacity-80">
          Download STL
        </a>
      </figcaption>
    </figure>
  );
}
