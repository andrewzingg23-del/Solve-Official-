// Every door, on the cinematic dark system. One index for the founder's ventures.
import type { Metadata } from "next";
import Link from "next/link";
import { VENTURES } from "../ventures";
import { accent, label, line, muted } from "../venture-style";

export const metadata: Metadata = { title: "Ventures · solve", description: "Every door has one working tool." };

const enter = (i: number) =>
  ({ animation: "page-enter 0.5s var(--ease-calm) both", animationDelay: `${0.08 + i * 0.06}s` }) as const;

export default function Ventures() {
  return (
    <div className="min-h-svh w-full text-foreground">
      <main className="relative mx-auto flex min-h-svh w-full max-w-6xl flex-col gap-12 px-4 py-6 md:px-8 md:py-10">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[360px] overflow-hidden">
          <div className="absolute left-1/2 top-[-160px] h-[320px] w-[680px] -translate-x-1/2 rounded-[50%] bg-accent/[0.07] blur-3xl" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent" />
        </div>

        <header className={`relative flex items-center justify-between gap-4 border-b ${line} pb-5`}>
          <Link href="/" aria-label="solve">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/solve-wordmark-on-dark.svg" alt="solve." className="h-7 w-auto" />
          </Link>
          <span className={label}>Ventures</span>
        </header>

        <section className="relative flex max-w-3xl flex-col gap-5" style={enter(0)}>
          <p className={`text-xs font-semibold uppercase tracking-[0.3em] ${accent}`}>{VENTURES.length} doors</p>
          <h1 className="text-5xl font-semibold leading-[1.02] tracking-tight md:text-7xl">One operator. Every way in.</h1>
          <p className={`text-lg leading-8 ${muted}`}>Every door has one working tool. Try it before anyone asks you for anything.</p>
        </section>

        <ol className={`relative flex flex-col border-t ${line}`}>
          {VENTURES.map((v, i) => (
            <li key={v.slug} className={`border-b ${line}`} style={enter(i + 1)}>
              <Link href={`/${v.slug}`} className="group grid gap-2 py-6 transition-all duration-300 ease-calm hover:bg-accent/[0.03] md:grid-cols-[3rem_1fr_1.2fr_auto] md:items-baseline md:gap-6">
                <span className={`font-mono text-sm tabular-nums ${accent}`}>{String(i + 1).padStart(2, "0")}</span>
                <span className="text-2xl font-semibold tracking-tight transition-all duration-300 ease-calm group-hover:translate-x-1 group-hover:text-accent">{v.name}</span>
                <span className={`text-base leading-7 ${muted}`}>{v.headline}</span>
                <span aria-hidden="true" className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${muted} transition-all duration-300 ease-calm group-hover:translate-x-1 group-hover:text-accent`}>{v.tool ?? "Enter"} →</span>
              </Link>
            </li>
          ))}
        </ol>

        <section className={`relative flex flex-col gap-3 border-t ${line} pt-8 md:max-w-3xl`} style={enter(VENTURES.length + 1)}>
          <p className={label}>Built on solve</p>
          <p className="text-2xl font-semibold leading-snug tracking-tight md:text-3xl">Every door runs on solve. Its tool is a pack any community can switch on.</p>
          <p className={`text-base leading-7 ${muted}`}>Start your own: a room to build in, members you let in, and their AI working beside them.</p>
          <Link href="/communities" className={`w-fit text-xs font-semibold uppercase tracking-[0.2em] ${accent} transition-opacity duration-300 hover:opacity-80`}>Start a community →</Link>
        </section>

        <footer className={`relative mt-auto flex items-center justify-between border-t ${line} pt-5`}>
          <span className="text-sm font-medium">Everything here is real.</span>
          <Link href="/start" className={`text-xs uppercase tracking-[0.2em] ${muted} transition-colors duration-300 ease-calm hover:text-accent`}>Start your own →</Link>
        </footer>
      </main>
    </div>
  );
}
