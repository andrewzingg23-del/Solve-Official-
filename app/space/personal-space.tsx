"use client";

import Link from "next/link";
import { useGuestProfile } from "@/lib/guest/profile";
import { composePersonalSpace, normalizeSpaceAnswers, type SpaceAnswers } from "@/lib/product/personal-space";
import type { ProjectCard } from "@/app/product/projects";

export function PersonalSpace({
  signedIn,
  initialAnswers,
  projects,
}: {
  signedIn: boolean;
  initialAnswers: SpaceAnswers;
  projects: ProjectCard[] | null;
}) {
  const guest = useGuestProfile();
  const localAnswers = normalizeSpaceAnswers(guest.profile?.knowYou);
  const answers = signedIn ? initialAnswers : localAnswers;
  const data = composePersonalSpace({
    ...answers,
    name: answers.name || (!signedIn ? guest.profile?.yourName || "" : ""),
  });
  const hasSavedSpace = data.hasContext || signedIn;

  if (!hasSavedSpace) return (
    <main className="solve-page sov-personal">
      <div className="sov-space-intro">
        <span className="solve-kicker">SOLVE / Your Space</span>
        <h1>It starts with you.</h1>
        <p>Meet your AI, tell us a little about what matters, and build a useful personal environment. No account connections or public sharing required.</p>
        <Link href="/onboarding" className="solve-button">Create my Space →</Link>
      </div>
    </main>
  );

  return (
    <main className="solve-page sov-personal">
      <header className="sov-space-header">
        <div>
          <span className="solve-kicker">SOLVE / Private Space</span>
          <h1>{data.greeting}</h1>
          <p>{data.goal || "Create, connect, learn, and build. Your Space can change as your life changes."}</p>
        </div>
        <div className="sov-space-actions">
          <Link href="/onboarding" className="solve-button solve-button-secondary">Customize</Link>
          <Link href="/worlds/new" className="solve-button">+ Create</Link>
        </div>
      </header>

      <div className="sov-personal-top">
        <section className="sov-space-card sov-focus-card">
          <div className="sov-space-title"><h2>My Space</h2><span>Private</span></div>
          <p>The tools and places that matter to you. Choose or change anything.</p>
          <div className="sov-module-grid">
            {data.modules.map(module => (
              <Link key={module.id} href={module.href} className="sov-module">
                <strong>{module.label}</strong><small>{module.description}</small><span aria-hidden="true">↗</span>
              </Link>
            ))}
          </div>
        </section>
        <section className="sov-space-card sov-agent-card">
          <div className="sov-space-title"><h2>Your AI</h2><span>Permissioned</span></div>
          <span className="sov-agent-symbol" aria-hidden="true" />
          <p>Ask for help with what you are building. Your AI only gets access to the context and tools you authorize.</p>
          <Link href="/bot" className="sov-space-link">Open your AI →</Link>
          <Link href="/bot?section=connections" className="sov-space-link">Choose AI connections →</Link>
        </section>
      </div>

      <div className="sov-personal-middle">
        <section className="sov-space-card">
          <div className="sov-space-title"><h2>Projects</h2><Link href="/projects">View all →</Link></div>
          {!signedIn ? <div className="sov-empty">
            <strong>Make your first project.</strong>
            <p>Guest preferences are saved only in this browser. Sign in to keep shared work across devices.</p>
            <Link href="/login?next=%2Fworlds%2Fnew" className="sov-space-link">Save my work with an account →</Link>
          </div> : projects === null ? <div className="sov-empty" role="status">
            <strong>Projects couldn't be loaded.</strong>
            <p>Your saved projects have not been changed. Try again after the connection returns.</p>
          </div> : projects.length === 0 ? <div className="sov-empty">
            <strong>Nothing here yet.</strong>
            <p>Projects you create will appear here with their actual saved state.</p>
            <Link href="/worlds/new" className="sov-space-link">Start a project →</Link>
          </div> : <div className="sov-real-projects">
            {projects.slice(0, 5).map(project =>
              <Link key={project.worldId} href={"/world/" + project.worldId + "/room"}>
                <strong>{project.title}</strong><small>{project.summary || "Open shared workspace"}</small><span aria-hidden="true">↗</span>
              </Link>)}
          </div>}
        </section>
        <section className="sov-space-card">
          <div className="sov-space-title"><h2>People & Communities</h2><Link href="/communities">Explore →</Link></div>
          <div className="sov-empty">
            <strong>Your people, your permissions.</strong>
            <p>Invite collaborators through a specific project or community. Nothing here is made public automatically.</p>
            <Link href="/communities" className="sov-space-link">Find or start a community →</Link>
          </div>
        </section>
      </div>

      <div className="sov-personal-bottom">
        <section className="sov-space-card">
          <div className="sov-space-title"><h2>Apps & Integrations</h2><span>Optional</span></div>
          <p>Use recognized services through supported connections and embeds. Selecting an app isn't permission to read it.</p>
          <div className="sov-inline-actions">
            <Link href="/onboarding#apps" className="sov-space-link">Choose apps →</Link>
            <Link href="/apps" className="sov-space-link">Open app surfaces →</Link>
            <Link href="/control" className="sov-space-link">Permissions →</Link>
          </div>
        </section>
        <section className="sov-space-card sov-profile-card">
          <div className="sov-space-title"><h2>Public SOV Profile</h2><span>Not automatically published</span></div>
          <strong>{data.publicPreview.name}</strong>
          <p>{data.publicPreview.bio || "Your creations and chosen identity can be shared with the world. Your private Space stays private."}</p>
          <div className="sov-inline-actions">
            <Link href="/account" className="sov-space-link">Manage identity →</Link>
            <Link href="/sov-id" className="sov-space-link">View SOV ID →</Link>
          </div>
        </section>
      </div>

      {data.goal || data.people || answers.context ? <details className="sov-private-context">
        <summary>Private setup context</summary>
        {data.goal ? <p><strong>Objective:</strong> {data.goal}</p> : null}
        {data.people ? <p><strong>People:</strong> {data.people}</p> : null}
        {answers.context ? <p><strong>Imported summary:</strong> {answers.context}</p> : null}
        <p>These notes are not part of your public Profile. Change or clear them through onboarding.</p>
      </details> : null}
      <footer className="sov-space-foot">
        <span>{signedIn ? "Account preferences saved; projects use their own permissions." : "Saved on this device only."}</span>
        <Link href="/control">Privacy & control →</Link>
      </footer>
    </main>
  );
}
