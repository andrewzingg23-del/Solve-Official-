import Link from "next/link";

// One product wordmark everywhere. SOV ID is the identity, not the product name.
export function SolveBrand({ href = "/space", compact = false }: { href?: string; compact?: boolean }) {
  return <Link href={href} className={compact ? "solve-brand solve-brand--compact" : "solve-brand"} aria-label="SOLVE home">
    <span className="solve-brand-ring" aria-hidden="true" />
    <span className="solve-brand-name">SOLVE</span>
  </Link>;
}
