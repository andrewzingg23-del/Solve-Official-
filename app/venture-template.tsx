// One template for all ten venture doors. Dark HUD brand lock: abyssal
// blue-black, ice white, single cyan accent. Cinematic, minimal, ego-forward.
import Link from "next/link";
import { getVenture, nextVenture } from "./ventures";

const kicker =
  "text-xs font-semibold uppercase tracking-[0.32em] text-[#22d3ee]";
const headline =
  "text-5xl font-semibold uppercase leading-[1.02] tracking-tight text-[#f2f7fb] md:text-7xl";
const thesis = "max-w-2xl text-lg leading-8 text-[#f2f7fb]/70 md:text-xl";
const proofIndex =
  "font-mono text-sm text-[#22d3ee] tabular-nums";
const proofBody = "text-xl font-medium leading-8 text-[#f2f7fb] md:text-2xl";
const cta =
  "inline-flex h-12 items-center justify-center bg-[#22d3ee] px-8 text-xs font-bold uppercase tracking-[0.24em] text-[#04070d] transition-opacity duration-300 hover:opacity-85";
const quiet =
  "text-xs uppercase tracking-[0.24em] text-[#f2f7fb]/50 transition-colors duration-300 hover:text-[#22d3ee]";

export function VenturePage({ slug }: { slug: string }) {
  const venture = getVenture(slug);
  const next = nextVenture(slug);

  return (
    <div className="min-h-svh w-full bg-[#04070d] text-[#f2f7fb]">
      {/* HUD glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(90% 55% at 50% 0%, rgba(34,211,238,0.14) 0%, rgba(4,7,13,0) 60%)",
        }}
      />
      <main className="relative mx-auto flex min-h-svh w-full max-w-6xl flex-col px-4 py-6 md:px-8 md:py-10">
        <header className="flex items-center justify-between border-b border-white/10 pb-5">
          <Link href="/" aria-label="solve">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/solve-wordmark-on-dark.svg"
              alt="solve."
              className="h-7 w-auto"
            />
          </Link>
          <nav className="flex items-center gap-6" aria-label="Venture">
            <span className="text-xs uppercase tracking-[0.24em] text-[#f2f7fb]/40">
              {venture.kicker}
            </span>
          </nav>
        </header>

        {/* Hero */}
        <section className="relative flex flex-col gap-7 overflow-hidden py-16 md:py-24">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 top-0 hidden opacity-[0.16] md:block"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/solve-mark.svg"
              alt=""
              className="h-72 w-auto"
              style={{
                filter:
                  "drop-shadow(0 0 42px rgba(34,211,238,0.55))",
              }}
            />
          </div>
          <p className={kicker}>{venture.kicker}</p>
          <h1 className={headline}>{venture.headline}</h1>
          <p className={thesis}>{venture.thesis}</p>
          <div className="pt-2">
            <Link href={venture.cta.href} className={cta}>
              {venture.cta.label}
            </Link>
          </div>
        </section>

        {/* Proof */}
        <section className="flex flex-col border-t border-white/10">
          {venture.proofs.map((proof, i) => (
            <div
              key={i}
              className="flex items-baseline gap-6 border-b border-white/10 py-7"
            >
              <span className={proofIndex}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className={proofBody}>{proof}</p>
            </div>
          ))}
        </section>

        {/* Stat */}
        <section className="flex flex-col gap-3 py-16 md:py-20">
          <p className="font-mono text-7xl font-semibold tabular-nums text-[#f2f7fb] md:text-8xl">
            {venture.stat.value}
          </p>
          <p className="text-xs uppercase tracking-[0.28em] text-[#22d3ee]">
            {venture.stat.label}
          </p>
        </section>

        {/* One action */}
        <section className="flex flex-col items-start gap-6 border-t border-white/10 py-16">
          <p className={kicker}>One move</p>
          <Link href={venture.cta.href} className={cta}>
            {venture.cta.label}
          </Link>
        </section>

        <footer className="mt-auto flex items-center justify-between border-t border-white/10 pt-6">
          <Link href="/" aria-label="solve">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/solve-wordmark-on-dark.svg"
              alt="solve."
              className="h-5 w-auto opacity-80"
            />
          </Link>
          <Link
            href={`/${next.slug}`}
            className={quiet}
            aria-label={`Next: ${next.kicker}`}
          >
            Next — {next.kicker} →
          </Link>
        </footer>
      </main>
    </div>
  );
}
