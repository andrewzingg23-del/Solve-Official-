// The frame for every venture door, on the cinematic dark system: abyssal blue-black,
// ice-white type, hologram cyan as the single accent (founder law 2026-10-06).
// Each door carries one working tool in the middle, not just a button.
import type { ReactNode } from "react";
import Link from "next/link";
import { getVenture, nextVenture, VENTURES } from "./ventures";
import { accent, ink, label, line, muted, primary } from "./venture-style";

const enter = (delay: number) =>
  ({ animation: "page-enter 0.6s var(--ease-calm) both", animationDelay: `${delay}s` }) as const;

export function VenturePage({ slug, children, after }: { slug: string; children?: ReactNode; after?: ReactNode }) {
  const venture = getVenture(slug);
  const next = nextVenture(slug);
  return (
    <div className={`min-h-svh w-full ${ink}`}>
      <main className="relative mx-auto flex min-h-svh w-full max-w-6xl flex-col px-4 py-6 md:px-8 md:py-10">
        {/* Ambient aura over the hero — the construct's cyan bleed from the top. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[420px] overflow-hidden">
          <div className="absolute left-1/2 top-[-180px] h-[360px] w-[720px] -translate-x-1/2 rounded-[50%] bg-accent/[0.08] blur-3xl" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent" />
        </div>

        <header className={`relative flex items-center justify-between gap-4 border-b ${line} pb-5`} style={enter(0)}>
          <Link href="/ventures" aria-label="All ventures">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/solve-wordmark-on-dark.svg" alt="solve." className="h-7 w-auto" />
          </Link>
          <span className={`truncate ${label}`}>{venture.kicker}</span>
        </header>

        <section className="relative flex max-w-4xl flex-col gap-6 py-14 md:py-20">
          <p className={`text-xs font-semibold uppercase tracking-[0.3em] ${accent}`} style={enter(0.05)}>{venture.kicker}</p>
          <h1 className="text-5xl font-semibold leading-[1.02] tracking-tight md:text-7xl" style={enter(0.12)}>{venture.headline}</h1>
          <p className={`max-w-2xl text-lg leading-8 md:text-xl ${muted}`} style={enter(0.19)}>{venture.thesis}</p>
        </section>

        {children ? <section aria-label={venture.tool ?? "Try it"} className="relative flex flex-col gap-6 pb-16" style={enter(0.26)}>{children}</section> : null}

        <section className={`relative flex flex-col border-t ${line}`}>
          {venture.proofs.map((proof, i) => (
            <div key={i} className={`group flex items-baseline gap-6 border-b ${line} py-6`}>
              <span className={`font-mono text-sm tabular-nums ${accent}`}>{String(i + 1).padStart(2, "0")}</span>
              <p className="text-lg font-medium leading-8 transition-transform duration-300 ease-calm group-hover:translate-x-1 md:text-2xl">{proof}</p>
            </div>
          ))}
        </section>

        {venture.goal ? (
          <section className="relative flex flex-col gap-2 py-14">
            <p className={label}>The goal</p>
            <p className="font-mono text-6xl font-semibold tabular-nums text-accent md:text-7xl">{venture.goal.value}</p>
            <p className={`text-sm ${muted}`}>{venture.goal.label}</p>
          </section>
        ) : null}

        {after}

        <section className={`relative flex flex-wrap items-center justify-between gap-6 border-t ${line} py-12`}>
          <div className="flex flex-col gap-2">
            <p className={label}>One move</p>
            <p className="text-2xl font-semibold tracking-tight">{venture.cta.note}</p>
          </div>
          <Link href={venture.cta.href} className={primary}>{venture.cta.label}</Link>
        </section>

        <footer className={`relative mt-auto flex flex-wrap items-center justify-between gap-4 border-t ${line} pt-5`}>
          <span className="text-sm font-medium">Everything here is real.</span>
          <nav aria-label="Ventures" className="flex items-center gap-5">
            <Link href="/ventures" className={`text-xs uppercase tracking-[0.2em] ${muted} transition-colors duration-300 ease-calm hover:text-accent`}>All {VENTURES.length}</Link>
            <Link href={`/${next.slug}`} className={`text-xs uppercase tracking-[0.2em] ${muted} transition-colors duration-300 ease-calm hover:text-accent`}>Next: {next.name} →</Link>
          </nav>
        </footer>
      </main>
    </div>
  );
}
