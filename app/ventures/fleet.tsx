// The fleet: every venture door, one view. Each links to its door; the Command Center is where the
// operator runs them.
import Link from "next/link";
import { VENTURES } from "../ventures";
import { accent, line, muted, panel } from "../venture-style";

export function Fleet() {
  return (
    <div className={`${panel} grid gap-px overflow-hidden bg-[#d3dde6] sm:grid-cols-2 lg:grid-cols-5`}>
      {VENTURES.filter((v) => v.slug !== "vantage").map((v, i) => (
        <Link key={v.slug} href={`/${v.slug}`} className="group flex min-h-36 flex-col justify-between gap-4 bg-[#f7fafc] p-5 transition-colors hover:bg-white">
          <span className={`font-mono text-[11px] tabular-nums ${muted}`}>{String(i + 1).padStart(2, "0")}</span>
          <span className="flex flex-col gap-1">
            <span className="text-base font-semibold tracking-tight group-hover:text-[#0891b2]">{v.name}</span>
            <span className={`text-xs leading-5 ${muted}`}>{v.headline}</span>
          </span>
          <span className={`border-t ${line} pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] ${accent}`}>{v.tool ?? "Enter"}</span>
        </Link>
      ))}
    </div>
  );
}
