// The World's pieces where they were placed, around its goal. Each piece keeps the canvas position it
// was saved with; the lines only show they belong to the same goal. The point marks a piece with a
// real save on it, and nothing else.
import Link from "next/link";

export type RoomPieceKind = "goal" | "routes" | "outreach" | "part" | "proposal" | "art" | "text";
export type RoomPiece = { id: string; title: string; x: number; y: number; kind: RoomPieceKind; detail: string | null; saved: boolean; via?: string | null };

const KIND_LABEL: Record<RoomPieceKind, string> = { goal: "Goal", routes: "Routes", outreach: "Outreach", part: "Part", proposal: "Can't do yet", art: "Pixel art", text: "Note" };

const clamp = (n: number) => Math.min(92, Math.max(8, n));

export function PiecesMap({ worldId, pieces }: { worldId: string; pieces: RoomPiece[] }) {
  if (!pieces.length) {
    return (
      <div className="grid min-h-[420px] place-items-center rounded-xl border border-dashed border-line px-6 text-center">
        <div className="flex max-w-sm flex-col gap-2">
          <p className="text-lg font-medium">An open room</p>
          <p className="text-sm leading-6 text-muted">Add a note below, or ask your assistant to propose routes here. Pieces appear where they are placed.</p>
        </div>
      </div>
    );
  }
  const goal = pieces.find((p) => p.kind === "goal") ?? null;
  const hub = goal ? { x: clamp(goal.x), y: clamp(goal.y) } : { x: 50, y: 50 };
  return (
    <>
      <div className="relative hidden aspect-[16/10] w-full overflow-hidden rounded-xl border border-line md:block">
        <svg aria-hidden className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {pieces.filter((p) => p !== goal).map((p) => (
            <line key={p.id} x1={hub.x} y1={hub.y} x2={clamp(p.x)} y2={clamp(p.y)} stroke="rgb(34 211 238 / 0.22)" strokeWidth="0.15" vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        {pieces.map((p) => (
          <Link
            key={p.id}
            href={`/world/${worldId}#piece-${p.id}`}
            style={{ left: `${clamp(p.x)}%`, top: `${clamp(p.y)}%` }}
            className={`group absolute flex w-44 -translate-x-1/2 -translate-y-1/2 flex-col gap-1 rounded-lg border bg-surface/80 p-3 backdrop-blur-md transition-[border-color,transform] duration-300 ease-calm hover:-translate-y-[54%] hover:border-accent ${p.kind === "goal" ? "w-56 border-accent/50 shadow-[0_0_40px_rgba(34,211,238,0.25)]" : "border-line"}`}
          >
            <span className="flex items-center justify-between gap-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-muted">
              {KIND_LABEL[p.kind]}
              {p.saved ? <span aria-label="Saved with proof" className="h-1.5 w-1.5 rounded-full bg-accent" /> : null}
            </span>
            <span className={`break-words leading-snug ${p.kind === "goal" ? "text-base font-medium" : "text-sm"}`}>{p.title}</span>
            {p.detail ? <span className="text-[11px] leading-4 text-muted">{p.detail}</span> : null}
            {p.via ? <span className="text-[10px] uppercase tracking-[0.16em] text-accent/80">via {p.via}</span> : null}
          </Link>
        ))}
      </div>
      <ul className="flex flex-col gap-2 md:hidden">
        {pieces.map((p) => (
          <li key={p.id}>
            <Link href={`/world/${worldId}#piece-${p.id}`} className="flex flex-col gap-1 rounded-lg border border-line bg-surface/70 p-3">
              <span className="flex items-center justify-between text-[9px] font-semibold uppercase tracking-[0.2em] text-muted">
                {KIND_LABEL[p.kind]}
                {p.saved ? <span aria-label="Saved with proof" className="h-1.5 w-1.5 rounded-full bg-accent" /> : null}
              </span>
              <span className="text-sm">{p.title}</span>
              {p.detail ? <span className="text-[11px] text-muted">{p.detail}</span> : null}
              {p.via ? <span className="text-[10px] uppercase tracking-[0.16em] text-accent/80">via {p.via}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
