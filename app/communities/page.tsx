// Every community on solve, and the form to start one. A community is a World with a front door:
// its name and what it's for are public to anyone signed in; everything built inside stays with its
// members.
import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { label, primaryAction, quietLink, secondaryAction } from "@/app/ui";
import { COMMUNITY_LIMITS, listCommunities, type Community } from "@/lib/community/community";
import { PACK_IDS, PACKS } from "@/lib/community/packs";
import { KernelError } from "@/lib/kernel/client";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { startCommunityAction } from "./actions";
import { loginRequired } from "@/lib/auth/gate";

export const metadata: Metadata = { title: "Communities · solve" };

type Row = Community & { mine: "owner" | "member" | null };

async function load(): Promise<Row[] | "identity" | "unavailable"> {
  try {
    const kernel = await getKernel();
    const [me, grants, communities] = await Promise.all([kernel.whoami(), kernel.myGrants(), listCommunities(kernel)]);
    const inside = new Set(grants.filter((g) => g.capability === "kernel.read" || g.capability === "*").map((g) => g.scope));
    return communities.map((c) => ({ ...c, mine: c.ownerId === me.actor_id ? "owner" : inside.has(c.scope) ? "member" : null }));
  } catch (error) {
    return error instanceof KernelError && error.name === "unauthenticated" ? "identity" : "unavailable";
  }
}

const input = "rounded-md border border-line bg-background px-3 text-sm outline-none transition-colors focus:border-accent";

export default async function CommunitiesPage({ searchParams }: PageProps<"/communities">) {
  if (!(await getUser()) && loginRequired()) redirect("/login?next=%2Fcommunities");
  const { error } = await searchParams;
  const rows = await load();
  const nonce = randomUUID();
  const yours = Array.isArray(rows) ? rows.filter((r) => r.mine) : [];
  const others = Array.isArray(rows) ? rows.filter((r) => !r.mine) : [];

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-6 md:px-8 md:py-10">
      <header className="flex flex-wrap items-center justify-between gap-5 border-b border-line pb-5">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">solve</Link>
          <span className="text-muted">/</span>
          <span className="text-xs font-semibold uppercase tracking-[0.2em]">Communities</span>
        </div>
        <div className="flex items-center gap-5">
          <Link href="/command" className={quietLink}>Command Center</Link>
          <Link href="/worlds" className={quietLink}>Your Worlds</Link>
        </div>
      </header>

      <section className="grid flex-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.7fr)] lg:items-start">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <p className={label}>Communities</p>
            <h1 className="max-w-3xl text-3xl font-medium leading-tight tracking-tight md:text-5xl">Build with the people you build with.</h1>
            <p className="max-w-xl text-sm leading-6 text-muted md:text-base">
              A community is a shared World with a front door. Members build in its room, bring their own AI to help, and reach each other. Whoever starts it decides who comes in.
            </p>
          </div>

          {rows === "identity" ? (
            <div className="flex flex-col gap-3 rounded-md border border-line bg-surface p-5">
              <h2 className="text-sm font-medium">Finish setting up your SOV ID</h2>
              <p className="text-sm leading-6 text-muted">Your sign-in is active, but there is no kernel identity attached yet.</p>
              <Link href="/account" className={secondaryAction}>Open account</Link>
            </div>
          ) : rows === "unavailable" ? (
            <div role="status" className="rounded-md border border-negative/30 bg-negative/10 p-4 text-sm">Communities are unavailable for a moment. Nothing was changed.</div>
          ) : (
            <>
              {yours.length ? <List title="Yours" rows={yours} /> : null}
              {others.length ? (
                <List title="On solve" rows={others} />
              ) : (
                <div className="rounded-md border border-line bg-surface/70 p-5 md:p-7">
                  <p className={label}>{yours.length ? "No one else's yet" : "None yet"}</p>
                  <p className="mt-3 max-w-lg text-sm leading-6 text-muted">When someone starts a community, it shows here for everyone signed in.</p>
                </div>
              )}
            </>
          )}
        </div>

        {Array.isArray(rows) ? (
          <aside className="flex flex-col gap-4 rounded-md border border-line bg-surface/75 p-5 md:p-7">
            <div className="flex flex-col gap-2">
              <p className={label}>Start one</p>
              <h2 className="text-xl font-medium tracking-tight">Start a community</h2>
              <p className="text-sm leading-6 text-muted">You get its World and room. People ask to join and you let them in.</p>
            </div>
            {typeof error === "string" ? (
              <p role="alert" className="rounded border border-negative/30 bg-negative/10 p-3 text-sm text-negative">
                {error === "input" ? `Give it a name (up to ${COMMUNITY_LIMITS.name} characters). One person can start up to ${COMMUNITY_LIMITS.perPerson}.` : "The community could not be started. Try again in a moment."}
              </p>
            ) : null}
            <form action={startCommunityAction} className="flex flex-col gap-3">
              <input type="hidden" name="nonce" value={nonce} />
              <label htmlFor="community-name" className={label}>Name</label>
              <input id="community-name" name="name" required maxLength={COMMUNITY_LIMITS.name} autoComplete="off" placeholder="Zest Solar" className={`h-12 ${input}`} />
              <label htmlFor="community-about" className={label}>What it&apos;s for</label>
              <textarea id="community-about" name="about" maxLength={COMMUNITY_LIMITS.about} rows={4} placeholder="Who it's for and what you build together." className={`resize-y p-3 leading-6 ${input}`} />
              <fieldset className="flex flex-col gap-2">
                <legend className={`${label} mb-2`}>Packs</legend>
                {PACK_IDS.map((id) => (
                  <label key={id} className="flex items-start gap-3 rounded-md border border-line p-3 text-sm">
                    <input type="checkbox" name="packs" value={id} className="mt-1 accent-accent" />
                    <span className="flex flex-col gap-1">
                      <span className="font-medium">{PACKS[id].name}{PACKS[id].practice ? <span className="ml-2 text-[10px] uppercase tracking-[0.18em] text-muted">Practice</span> : null}</span>
                      <span className="text-xs leading-5 text-muted">{PACKS[id].what}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
              <button type="submit" className={primaryAction}>Start the community</button>
            </form>
            <p className="border-t border-line pt-4 text-xs leading-5 text-muted">
              Its name, what it&apos;s for and its packs are public to anyone signed in. Everything built inside stays with its members.
            </p>
          </aside>
        ) : null}
      </section>
    </main>
  );
}

function List({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div className="flex flex-col gap-3">
      <p className={label}>{title}</p>
      <ul className="flex flex-col divide-y divide-line border-y border-line">
        {rows.map((c) => (
          <li key={c.communityId}>
            <Link href={`/community/${c.communityId}`} className="group flex items-center justify-between gap-6 py-5 transition-colors hover:text-accent">
              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="truncate text-lg font-medium tracking-tight">{c.name}</span>
                {c.about ? <span className="line-clamp-2 text-sm leading-6 text-muted">{c.about}</span> : null}
                <span className="text-xs text-muted">
                  {c.mine === "owner" ? "You started it" : c.mine === "member" ? "You're in" : "Ask to join"}
                  {c.packs.length ? ` · ${c.packs.map((p) => PACKS[p].name).join(", ")}` : ""}
                </span>
              </div>
              <span aria-hidden="true" className="text-xl text-muted transition-transform group-hover:translate-x-1 group-hover:text-accent">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
