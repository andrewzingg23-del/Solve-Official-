import type { Metadata } from "next";
import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { getKernel } from "@/lib/kernel/server";
import { listCreativeWorlds } from "@/lib/world/creative";

export const metadata: Metadata = { title: "Bench · SOLVE" };

// Bench's own home: where a person begins making something, or picks up what they were making.
// It used to redirect silently to the most recent thing, which meant Bench had no place of its
// own and a person with two things could never choose between them.
//
// Changing a thing needs an account that outlives this browser, so a visitor is told that plainly
// and can still open the record of anything they own. Nothing here offers an editor it cannot open.
export default async function BenchPage() {
  const user = await getUser();
  const durable = Boolean(user && !user.is_anonymous);
  const things = user ? await listCreativeWorlds(await getKernel()).catch(() => null) : [];

  return <main className="solve-page">
    <header className="solve-page-heading">
      <span className="solve-kicker">Bench</span>
      <h1>Make something, or keep making it.</h1>
      <p>Everything you work on here stays yours, with every change kept.</p>
    </header>

    <section className="solve-panel" aria-labelledby="bench-begin">
      <span className="solve-kicker" id="bench-begin">Begin</span>
      <p className="my-3">Say what you want to make, in your own words. You can work on it straight away.</p>
      <Link href="/" className="solve-button">Start something</Link>
    </section>

    <section className="solve-panel mt-6" aria-labelledby="bench-resume">
      <span className="solve-kicker" id="bench-resume">Resume</span>
      {things === null
        ? <p className="my-3" role="status">Your things could not be loaded. Nothing of yours has been deleted; retry shortly.</p>
        : things.length === 0
          ? <p className="my-3 solve-muted">Nothing to resume yet. What you start will appear here.</p>
          : <ul className="solve-resume-list">
              {things.map(thing => <li key={thing.worldId}>
                <Link href={durable
                  ? `/world/${encodeURIComponent(thing.worldId)}/workbench`
                  : `/world/${encodeURIComponent(thing.worldId)}/record`}>
                  <strong>{thing.title}</strong>
                  <span className="solve-muted"> · {durable ? "Open in Bench" : "Open its record"}</span>
                </Link>
              </li>)}
            </ul>}
      {!durable && things !== null && things.length > 0
        ? <p className="solve-muted mt-3">
            Changing a thing needs an account that lasts beyond this browser.{" "}
            <Link href={"/login?next=" + encodeURIComponent("/workbench")}>Sign in to edit</Link>
          </p>
        : null}
    </section>
  </main>;
}
