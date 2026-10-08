// Intel link card: glass surface with a cyan border-beam + sheen sweep on
// hover. Plain anchors — the ARGUS and watchlist routes keep working.
export function IntelCard({
  href,
  kicker,
  title,
  desc,
  cta,
  headingId,
}: {
  href: string;
  kicker: string;
  title: string;
  desc: string;
  cta: string;
  headingId?: string;
}) {
  return (
    <a
      href={href}
      className="fx-trace glass group relative block overflow-hidden p-5 transition-all duration-300 ease-calm hover:-translate-y-1 hover:shadow-[var(--shadow-lift)] md:p-6"
    >
      <div className="fx-borderbeam" aria-hidden="true" />
      <div className="fx-sheen" aria-hidden="true" />
      <div className="relative">
        <p className="eyebrow eyebrow-accent">{kicker}</p>
        <h2
          id={headingId}
          className="mt-2 text-xl font-medium tracking-tight text-foreground"
        >
          {title}
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted">{desc}</p>
        <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
          {cta}
          <span
            aria-hidden="true"
            className="inline-block transition-transform duration-300 ease-calm group-hover:translate-x-1"
          >
            →
          </span>
        </p>
      </div>
    </a>
  );
}
