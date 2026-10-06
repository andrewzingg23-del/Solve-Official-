import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { loginRequired } from "@/lib/auth/gate";
import { TradingCardVisual } from "./trading-card-visual";
import { BotPulse } from "./bot-pulse";

export const metadata: Metadata = { title: "What do you want to do? — solve" };

const PACKS = [
  {
    id: "trading",
    verb: "Play",
    title: "Trade markets",
    desc: "Live charts, your bot reading them with you, real on-chain swaps.",
    href: "/packs/trading",
    live: true,
    wash: "from-accent-dim via-transparent to-transparent",
  },
  {
    id: "build",
    verb: "Build",
    title: "Build something",
    desc: "Rooms, packs, and tools that compound. Coming soon.",
    href: "/packs",
    live: false,
    wash: "from-surface-sunken via-transparent to-transparent",
  },
  {
    id: "create",
    verb: "Create",
    title: "Create",
    desc: "Your avatar, your content, your worlds. Coming soon.",
    href: "/packs",
    live: false,
    wash: "from-surface-sunken via-transparent to-transparent",
  },
  {
    id: "gather",
    verb: "Gather",
    title: "Gather your people",
    desc: "Communities with portable identity. Coming soon.",
    href: "/packs",
    live: false,
    wash: "from-surface-sunken via-transparent to-transparent",
  },
];

export default async function PacksPage() {
  const user = await getUser();
  if (!user && loginRequired()) redirect("/login?next=/packs");
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-12 pb-24">
      <div>
        <p className="eyebrow">Your ID</p>
        <h1 className="mt-3 text-3xl font-medium tracking-tight md:text-4xl">What do you want to do?</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Pick one to start. The rest are coming.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {PACKS.map((p) => {
          const card = (
            <>
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${p.wash}`} aria-hidden="true" />
              <div className="relative flex items-center justify-between">
                <p className="eyebrow">{p.verb}</p>
                {p.live ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-accent-dim px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" aria-hidden="true" />
                    Live
                  </span>
                ) : (
                  <span className="rounded-full border border-line px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-faint">Soon</span>
                )}
              </div>
              <h2 className="relative text-2xl font-medium tracking-tight">{p.title}</h2>
              <p className="relative text-sm leading-6 text-muted">{p.desc}</p>
              {p.id === "trading" && (
                <div className="relative mt-3 flex flex-col gap-2 border-t border-line-soft pt-3">
                  <TradingCardVisual />
                  <BotPulse />
                </div>
              )}
              {p.live && (
                <span className="relative mt-2 text-xs font-medium text-accent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  Enter →
                </span>
              )}
            </>
          );
          const cls = `group relative flex flex-col gap-2 overflow-hidden rounded-2xl border p-7 transition-all duration-300 ${
            p.live
              ? "border-line bg-surface hover:-translate-y-1 hover:border-accent/30 hover:shadow-[var(--shadow-lift)]"
              : "border-line-soft bg-surface/50 opacity-60"
          }`;
          // Soon cards are not links — a tap that reloads the same page feels broken.
          return p.live ? (
            <Link key={p.id} href={p.href} className={cls}>{card}</Link>
          ) : (
            <div key={p.id} className={cls} aria-disabled="true">{card}</div>
          );
        })}
      </div>
    </main>
  );
}
