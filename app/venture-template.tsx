// The frame for every venture door, on the brand's white floor (docs/brand/BRAND.md v3: brand surfaces
// open on ice #f2f7fb with ink type; the deep cyan point on light; nothing static pretends to be
// state). Each door carries one working tool in the middle, not just a button.
import type { ReactNode } from "react";
import Link from "next/link";
import { getVenture, nextVenture, VENTURES } from "./ventures";
import { accent, ink, label, line, muted, primary } from "./venture-style";

export function VenturePage({ slug, children, after }: { slug: string; children?: ReactNode; after?: ReactNode }) {
  const venture = getVenture(slug);
  const next = nextVenture(slug);
  return (
    <div className={`min-h-svh w-full bg-[#f2f7fb] ${ink}`}>
      <main className="mx-auto flex min-h-svh w-full max-w-6xl flex-col px-4 py-6 md:px-8 md:py-10">
        <header className={`flex items-center justify-between gap-4 border-b ${line} pb-5`}>
          <Link href="/ventures" aria-label="All ventures">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/solve-wordmark-on-light.svg" alt="solve." className="h-7 w-auto" />
          </Link>
          <span className={`truncate ${label}`}>{venture.kicker}</span>
        </header>

        <section className="flex max-w-4xl flex-col gap-6 py-14 md:py-20">
          <p className={`text-xs font-semibold uppercase tracking-[0.3em] ${accent}`}>{venture.kicker}</p>
          <h1 className="text-5xl font-semibold leading-[1.02] tracking-tight md:text-7xl">{venture.headline}</h1>
          <p className={`max-w-2xl text-lg leading-8 md:text-xl ${muted}`}>{venture.thesis}</p>
        </section>

        {children ? <section aria-label={venture.tool ?? "Try it"} className="flex flex-col gap-6 pb-16">{children}</section> : null}

        <section className={`flex flex-col border-t ${line}`}>
          {venture.proofs.map((proof, i) => (
            <div key={i} className={`flex items-baseline gap-6 border-b ${line} py-6`}>
              <span className={`font-mono text-sm tabular-nums ${accent}`}>{String(i + 1).padStart(2, "0")}</span>
              <p className="text-lg font-medium leading-8 md:text-2xl">{proof}</p>
            </div>
          ))}
        </section>

        {venture.goal ? (
          <section className="flex flex-col gap-2 py-14">
            <p className={label}>The goal</p>
            <p className="font-mono text-6xl font-semibold tabular-nums md:text-7xl">{venture.goal.value}</p>
            <p className={`text-sm ${muted}`}>{venture.goal.label}</p>
          </section>
        ) : null}

        {after}

        <section className={`flex flex-wrap items-center justify-between gap-6 border-t ${line} py-12`}>
          <div className="flex flex-col gap-2">
            <p className={label}>One move</p>
            <p className="text-2xl font-semibold tracking-tight">{venture.cta.note}</p>
          </div>
          <Link href={venture.cta.href} className={primary}>{venture.cta.label}</Link>
        </section>

        <footer className={`mt-auto flex flex-wrap items-center justify-between gap-4 border-t ${line} pt-5`}>
          <span className="text-sm font-medium">Everything here is real.</span>
          <nav aria-label="Ventures" className="flex items-center gap-5">
            <Link href="/ventures" className={`text-xs uppercase tracking-[0.2em] ${muted} hover:text-[#0891b2]`}>All {VENTURES.length}</Link>
            <Link href={`/${next.slug}`} className={`text-xs uppercase tracking-[0.2em] ${muted} hover:text-[#0891b2]`}>Next: {next.name} →</Link>
          </nav>
        </footer>
      </main>
    </div>
  );
}
