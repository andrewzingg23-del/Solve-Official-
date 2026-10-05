// All ten doors, on the white floor. One index for the founder's ventures.
import type { Metadata } from "next";
import Link from "next/link";
import { VENTURES } from "../ventures";
import { accent, label, line, muted } from "../venture-style";

export const metadata: Metadata = { title: "Ventures · solve", description: "Ten doors, each with one working tool." };

export default function Ventures() {
  return (
    <div className="min-h-svh w-full bg-[#f2f7fb] text-[#04070d]">
      <main className="mx-auto flex min-h-svh w-full max-w-6xl flex-col gap-12 px-4 py-6 md:px-8 md:py-10">
        <header className={`flex items-center justify-between gap-4 border-b ${line} pb-5`}>
          <Link href="/" aria-label="solve">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/solve-wordmark-on-light.svg" alt="solve." className="h-7 w-auto" />
          </Link>
          <span className={label}>Ventures</span>
        </header>
        <section className="flex max-w-3xl flex-col gap-5">
          <p className={`text-xs font-semibold uppercase tracking-[0.3em] ${accent}`}>Ten doors</p>
          <h1 className="text-5xl font-semibold leading-[1.02] tracking-tight md:text-7xl">One operator. Ten ways in.</h1>
          <p className={`text-lg leading-8 ${muted}`}>Every door has one working tool. Try it before anyone asks you for anything.</p>
        </section>
        <ol className={`flex flex-col border-t ${line}`}>
          {VENTURES.map((v, i) => (
            <li key={v.slug} className={`border-b ${line}`}>
              <Link href={`/${v.slug}`} className="group grid gap-2 py-6 md:grid-cols-[3rem_1fr_1.2fr_auto] md:items-baseline md:gap-6">
                <span className={`font-mono text-sm tabular-nums ${accent}`}>{String(i + 1).padStart(2, "0")}</span>
                <span className="text-2xl font-semibold tracking-tight group-hover:text-[#0891b2]">{v.name}</span>
                <span className={`text-base leading-7 ${muted}`}>{v.headline}</span>
                <span className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${muted} group-hover:text-[#0891b2]`}>{v.tool ?? "Enter"} →</span>
              </Link>
            </li>
          ))}
        </ol>
        <footer className={`mt-auto flex items-center justify-between border-t ${line} pt-5`}>
          <span className="text-sm font-medium">Everything here is real.</span>
          <Link href="/start" className={`text-xs uppercase tracking-[0.2em] ${muted} hover:text-[#0891b2]`}>Start your own →</Link>
        </footer>
      </main>
    </div>
  );
}
