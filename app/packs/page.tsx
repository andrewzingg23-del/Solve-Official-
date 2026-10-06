import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "What do you want to do? — solve" };

const PACKS = [
  {
    id: "trading",
    verb: "Play",
    title: "Trade markets",
    desc: "Live charts, your bot reading them with you, real on-chain swaps.",
    href: "/packs/trading",
    live: true,
  },
  {
    id: "build",
    verb: "Build",
    title: "Build something",
    desc: "Rooms, packs, and tools that compound. Coming soon.",
    href: "/packs",
    live: false,
  },
  {
    id: "create",
    verb: "Create",
    title: "Create",
    desc: "Your avatar, your content, your worlds. Coming soon.",
    href: "/packs",
    live: false,
  },
  {
    id: "gather",
    verb: "Gather",
    title: "Gather your people",
    desc: "Communities with portable identity. Coming soon.",
    href: "/packs",
    live: false,
  },
];

export default async function PacksPage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/packs");
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-12">
      <div>
        <p className="eyebrow">SOV ID</p>
        <h1 className="mt-3 text-3xl font-medium tracking-tight md:text-4xl">What do you want to do?</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          One ID, four verbs. Pick one — the rest are here when you are ready.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {PACKS.map((p) => (
          <Link key={p.id} href={p.href}
            className={`group flex flex-col gap-2 rounded-lg border p-6 transition-all ${
              p.live
                ? "border-line bg-surface/60 hover:border-accent/40 hover:bg-surface-raise"
                : "border-line-soft bg-transparent opacity-50"
            }`}>
            <div className="flex items-center justify-between">
              <p className={`eyebrow ${p.live ? "eyebrow-accent" : ""}`}>{p.verb}</p>
              {p.live ? (
                <span className="rounded-full bg-accent-dim px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">Live</span>
              ) : (
                <span className="rounded-full border border-line px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-faint">Soon</span>
              )}
            </div>
            <h2 className="text-xl font-medium tracking-tight">{p.title}</h2>
            <p className="text-sm leading-6 text-muted">{p.desc}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
