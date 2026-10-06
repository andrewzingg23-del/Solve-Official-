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
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">SOV ID</p>
        <h1 className="mt-1 text-2xl font-medium tracking-tight md:text-4xl">What do you want to do?</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          One ID, four verbs. Pick one — the rest are here when you are ready.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {PACKS.map((p) => (
          <Link key={p.id} href={p.href}
            className={`group flex flex-col gap-2 rounded-md border border-line bg-surface/60 p-5 transition-colors ${p.live ? "hover:border-accent/50" : "opacity-60"}`}>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">{p.verb}</p>
              {p.live ? (
                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">Live</span>
              ) : (
                <span className="rounded-full border border-line px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted">Soon</span>
              )}
            </div>
            <h2 className="text-lg font-medium">{p.title}</h2>
            <p className="text-sm text-muted">{p.desc}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
