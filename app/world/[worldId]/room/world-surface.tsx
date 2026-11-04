import Link from "next/link";
import { Icon } from "@/app/product/icons";
import type { RoomPiece } from "./pieces-map";

/**
 * A real saved-output shelf, not a simulated live preview.
 *
 * The kernel's World artifacts are the only data source. Keep the entry
 * surface empty when there is nothing to show; future renderers (website,
 * 3D, map, media) can implement the same World-surface contract instead of
 * introducing a new World or identity system.
 */
export function WorldSurface({ worldId, pieces }: { worldId: string; pieces: RoomPiece[] }) {
  const outputs = pieces.filter(piece => piece.kind !== "goal" && piece.kind !== "proposal");
  if (outputs.length === 0) return null;
  return (
    <section className="solve-room-surface" aria-labelledby="world-output-heading">
      <div className="solve-room-surface-heading">
        <div>
          <h2 id="world-output-heading">What you're creating</h2>
          <p>Saved in this World. Open an item to explore or edit it.</p>
        </div>
        <Link href={`/world/${worldId}`} className="solve-room-surface-all">
          Open workspace <Icon name="arrow" width={15} height={15} />
        </Link>
      </div>
      <div className="solve-room-surface-grid">
        {outputs.slice(0, 4).map(piece => (
          <Link key={piece.id} href={`/world/${worldId}#piece-${piece.id}`} className="solve-room-surface-item">
            <span className="solve-room-surface-icon"><Icon name="document" width={18} height={18} /></span>
            <strong>{piece.title}</strong>
            <span>{piece.detail || "Saved World item"}</span>
            {piece.saved ? <small>Evidence attached</small> : <small>Saved item · Not independently verified</small>}
          </Link>
        ))}
      </div>
    </section>
  );
}
