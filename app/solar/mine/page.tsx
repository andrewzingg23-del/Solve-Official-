// The homeowner's solar: what they asked Zest Solar for, and the design when it comes back, with the
// numbers re-run from it and a 3D home with their real panel count. Theirs alone; they can erase a
// request here whenever they like.
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { readCommunity } from "@/lib/community/community";
import { getKernel } from "@/lib/kernel/server";
import { deskCommunityId, myDesigns, type DesignRequest } from "@/lib/solar/desk";
import { getUser } from "@/lib/supabase/server";
import { accent, label, line, muted, panel } from "../../venture-style";
import { Current, Empty, Erase, when } from "./view";
import { loginRequired } from "@/lib/auth/gate";

export const metadata: Metadata = { title: "My solar · Zest Solar", robots: { index: false, follow: false } };

async function load(): Promise<DesignRequest[] | "offline" | "unavailable"> {
  const deskId = deskCommunityId();
  if (!deskId) return "offline";
  try {
    const kernel = await getKernel();
    const desk = await readCommunity(kernel, deskId);
    return desk ? await myDesigns(kernel, desk) : "offline";
  } catch {
    return "unavailable";
  }
}


export default async function MySolar({ searchParams }: PageProps<"/solar/mine">) {
  if (!(await getUser()) && loginRequired()) redirect("/login?next=%2Fsolar%2Fmine");
  const { sent, erased, error } = await searchParams;
  const data = await load();
  const live = Array.isArray(data) ? data.filter((r) => r.details) : [];
  const [current, ...earlier] = live;

  return (
    <div className="min-h-svh w-full bg-[#f2f7fb] text-[#04070d] [color-scheme:light]">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 md:px-8 md:py-12">
        <header className={`flex items-center justify-between gap-4 border-b ${line} pb-5`}>
          <Link href="/solar" className={`text-xs font-semibold uppercase tracking-[0.3em] ${accent}`}>Zest Solar</Link>
          <span className={label}>My solar</span>
        </header>

        {sent ? <p role="status" className={`${panel} p-4 text-sm`}>Sent to Zest Solar. Your design comes back to this page; it usually takes a day or two.</p> : null}
        {erased ? <p role="status" className={`${panel} p-4 text-sm`}>Erased. Your address and contact are gone for good, and Zest Solar can no longer see that request.</p> : null}
        {error ? <p role="alert" className={`${panel} p-4 text-sm text-[#b42318]`}>That didn&apos;t go through. Nothing was changed; try again in a moment.</p> : null}

        {data === "offline" ? (
          <Empty text="Zest Solar's design desk isn't open yet." />
        ) : data === "unavailable" ? (
          <Empty text="Your solar is unavailable for a moment. Nothing was changed." />
        ) : !current ? (
          <Empty text="You haven't asked for a design yet." />
        ) : (
          <Current r={current} />
        )}

        {earlier.length ? (
          <section className="flex flex-col gap-3">
            <p className={label}>Earlier requests</p>
            <ul className={`flex flex-col border-t ${line}`}>
              {earlier.map((r) => (
                <li key={r.id} className={`flex flex-wrap items-center justify-between gap-3 border-b ${line} py-3 text-sm`}>
                  <span>{when(r.at)} · {r.details!.address}</span>
                  <span className="flex items-center gap-4">
                    {r.answer ? <a href={r.answer.proposalUrl} target="_blank" rel="noreferrer" className={`underline ${accent}`}>Proposal</a> : <span className={muted}>Waiting</span>}
                    <Erase id={r.id} />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <footer className={`flex flex-wrap items-center justify-between gap-4 border-t ${line} pt-5`}>
          <span className="text-sm font-medium">Everything here is real.</span>
          <span className={`text-xs ${muted}`}>Your details are sealed for Zest Solar alone.</span>
        </footer>
      </main>
    </div>
  );
}

