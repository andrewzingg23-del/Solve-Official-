// The brand's one device in the product (docs/brand/BRAND.md §8). A save point marks something
// real that is now on the record; the practice label marks anything simulated. The point appears
// only on a real save, never in Practice and never as decoration.
import type { EvidenceBasis } from "@/lib/kernel/client";

const BASIS: Record<EvidenceBasis, string> = {
  self_reported: "self-reported",
  witnessed: "witnessed",
  artifact: "with an artifact",
  system_observed: "observed by the system",
  externally_verified: "verified",
};

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

// Only plain web links are ever rendered, whatever path the evidence took into the record.
const webLink = (link?: string | null) => (link && /^https?:\/\//i.test(link) ? link : null);

export function SavePoint({ what, basis, at, record, link }: { what: string; basis: EvidenceBasis; at: string; record: string; link?: string | null }) {
  const href = webLink(link);
  return (
    <div className="flex min-w-0 items-start gap-2.5 text-xs">
      <span aria-hidden className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent" />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em]">Saved · on the record</span>
        <span className="break-words text-foreground">{what}</span>
        <span className="text-muted tabular-nums">
          {BASIS[basis] ?? basis} · {day(at)} · record {record}
          {href ? (
            <>
              {" · "}
              <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="underline decoration-line underline-offset-4 hover:text-accent">
                proof
              </a>
            </>
          ) : null}
        </span>
      </span>
    </div>
  );
}

export function PracticeLabel({ note = "Simulated, so nothing here counts." }: { note?: string }) {
  return (
    <div className="flex items-center gap-2.5 text-xs text-muted">
      <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full border border-dashed border-current" />
      <span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em]">Practice</span> · {note}
      </span>
    </div>
  );
}
