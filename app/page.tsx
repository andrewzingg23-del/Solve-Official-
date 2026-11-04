import { randomUUID } from "node:crypto";
import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { getKernel } from "@/lib/kernel/server";
import { listCreativeWorlds } from "@/lib/world/creative";
import { ProjectComposer } from "./product/project-composer";
import { Projects, type ProjectCard } from "./product/projects";

export default async function Home() {
  const user = await getUser();
  let projects: ProjectCard[] | null = null;
  if (user) projects = await listCreativeWorlds(await getKernel()).catch(() => null);

  return (
    <main className="solve-page solve-home">
      <section className={`solve-home-intro ${user ? "solve-home-member" : ""}`}>
        <div className="solve-home-copy">
          <span className="solve-kicker">SOLVE · Your space to build</span>
          <h1>What do you want to <span>make happen?</span></h1>
          <p>
            Start with a thought. SOLVE gives it a private World where you can
            keep the conversation, bring in people and connect intelligence when you need it.
          </p>
        </div>
        <ProjectComposer owner={user?.id ?? null} worldId={randomUUID()} />
      </section>

      {user ? (
        projects ? (projects.length ? <Projects projects={projects} /> : null) : (
          <section className="solve-empty" role="status">
            <h2>Your Worlds could not be loaded.</h2>
            <p>Your work hasn't been changed. Check your account or try again.</p>
            <Link href="/account" className="solve-text-link">Check your account</Link>
          </section>
        )
      ) : (
        <section className="solve-how" aria-label="Get started">
          <p className="solve-muted">
            You can draft an idea without an account. Sign in to create, save and
            collaborate in a World. Personalization and connected AIs are optional.
          </p>
        </section>
      )}
      <footer className="solve-page-footer">
        <span>Begin simply. Build anything.</span>
        <Link href="/start">Set up your identity and AI when you're ready</Link>
      </footer>
    </main>
  );
}
