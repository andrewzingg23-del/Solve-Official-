"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { normalizeAppearance, proposeAppearance, type SpaceAppearance, type AppearanceProposal } from "@/lib/product/appearance";
import { saveSpaceAppearance } from "./actions";
import { OPTIONAL_INTEGRATIONS } from "@/lib/product/optional-integrations";
import { useGuestProfile } from "@/lib/guest/profile";
import { composePersonalSpace, normalizeSpaceAnswers, spaceMood, type SpaceAnswers } from "@/lib/product/personal-space";
import type { ProjectCard } from "@/app/product/projects";

export function PersonalSpace({
  signedIn,
  initialAnswers,
  projects,
  initialAppearance,
}: {
  signedIn: boolean;
  initialAnswers: SpaceAnswers;
  projects: ProjectCard[] | null;
  initialAppearance: SpaceAppearance;
}) {
  const guest = useGuestProfile();
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [appearance, setAppearance] = useState<SpaceAppearance>(normalizeAppearance(initialAppearance));
  const [styleText, setStyleText] = useState("");
  const [proposal, setProposal] = useState<AppearanceProposal | null>(null);
  const [styleStatus, setStyleStatus] = useState("");
  const [undoAppearance, setUndoAppearance] = useState<SpaceAppearance | null>(null);
  const [styleBusy, setStyleBusy] = useState(false);
  const currentLook = proposal?.changes.length ? proposal.next : appearance;

  function previewStyle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const draft = proposeAppearance(styleText, appearance);
    setProposal(draft.changes.length ? draft : null);
    setStyleStatus(draft.response);
  }

  async function commitStyle(next: SpaceAppearance, previous: SpaceAppearance | null) {
    if (styleBusy) return;
    setStyleBusy(true);
    try {
      if (signedIn) {
        const result = await saveSpaceAppearance(next);
        if (!result.ok) {
          setStyleStatus(result.error || "This look couldn't be saved.");
          return;
        }
      } else {
        try {
          window.localStorage.setItem("solve.space.appearance.v1", JSON.stringify(next));
        } catch {
          setStyleStatus("Your browser isn't allowing preference storage. This preview hasn't been saved.");
          return;
        }
      }
      setAppearance(next);
      setUndoAppearance(previous);
      setProposal(null);
      setStyleStatus("Appearance updated. Your projects, integrations, permissions, and public Profile are unchanged.");
    } finally {
      setStyleBusy(false);
    }
  }

  useEffect(() => {
    if (!signedIn) {
      try {
        const saved = window.localStorage.getItem("solve.space.appearance.v1");
        if (saved) setAppearance(normalizeAppearance(JSON.parse(saved)));
      } catch { /* Stay with safe defaults when storage is unavailable. */ }
    }
  }, [signedIn]);
  useEffect(() => {
    // This is a setup-interest list only; it does not contain authorization tokens.
    try {
      const saved: unknown = JSON.parse(window.localStorage.getItem("sov.optional-app-interests.v1") || "[]");
      const allowed = new Set(OPTIONAL_INTEGRATIONS.map(item => item.id));
      if (Array.isArray(saved)) {
        const picked = saved.filter((id): id is string => typeof id === "string" && allowed.has(id));
        setSelectedApps([...new Set(picked)]);
      }
    } catch { /* Browser storage may be unavailable. */ }
  }, []);
  const localAnswers = normalizeSpaceAnswers(guest.profile?.knowYou);
  const answers = signedIn ? initialAnswers : localAnswers;
  const data = composePersonalSpace({
    ...answers,
    name: answers.name || (!signedIn ? guest.profile?.yourName || "" : ""),
  });
  const hasSavedSpace = data.hasContext || signedIn || guest.active;

  if (!hasSavedSpace) return (
    <main className="solve-page sov-personal" data-space-mood={spaceMood(answers)} data-style-tone={currentLook.tone} data-style-density={currentLook.density} data-style-shape={currentLook.shape} data-style-priority={currentLook.priority}>
      <div className="sov-space-intro">
        <span className="solve-kicker">SOLVE / Your Space</span>
        <h1>It starts with you.</h1>
        <p>Meet your AI, tell us a little about what matters, and build a useful personal environment. No account connections or public sharing required.</p>
        <Link href="/onboarding" className="solve-button">Create my Space →</Link>
      </div>
    </main>
  );

  return (
    <main className="solve-page sov-personal" data-space-mood={spaceMood(answers)} data-style-tone={currentLook.tone} data-style-density={currentLook.density} data-style-shape={currentLook.shape} data-style-priority={currentLook.priority}>
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

      <section className="sov-space-card sov-style-editor" aria-label="Customize your Space through natural language">
        <div className="sov-space-title"><h2>Make your Space yours</h2><span>Appearance only · Private</span></div>
        <p>Tell your AI how this should feel. Preview any changes before they are saved.</p>
        <form className="sov-style-form" onSubmit={previewStyle}>
          <label htmlFor="solve-style-request">Describe the look you want</label>
          <div className="sov-style-input-row">
            <input id="solve-style-request" name="appearance" value={styleText} onChange={event => setStyleText(event.target.value)} maxLength={700} placeholder="Make it feel like a vintage skate magazine, tighter and with mint accents…" />
            <button className="solve-button" type="submit" disabled={!styleText.trim() || styleBusy}>Preview style</button>
          </div>
        </form>
        {styleStatus ? <p className="sov-style-response" role="status">{styleStatus}</p> : null}
        {proposal ? <div className="sov-style-approval">
          <span>Previewing: {proposal.changes.join(", ")}</span>
          <div>
            <button type="button" className="solve-button" disabled={styleBusy} onClick={() => void commitStyle(proposal.next, appearance)}>{styleBusy ? "Saving…" : "Apply this look"}</button>
            <button type="button" className="solve-button solve-button-secondary" disabled={styleBusy} onClick={() => { setProposal(null); setStyleStatus("Preview discarded. Your saved appearance is unchanged."); }}>Discard preview</button>
          </div>
        </div> : null}
        {!proposal && undoAppearance ? <button type="button" className="sov-space-link sov-style-undo" disabled={styleBusy} onClick={() => void commitStyle(undoAppearance, appearance)}>↶ Undo last appearance change</button> : null}
        <small>Style suggestions use a restricted appearance vocabulary for now. This is not permission to change data, actions, or your public Profile.</small>
      </section>
      <div className="sov-personal-stack">
      <div className="sov-personal-top">
        <section className="sov-space-card sov-focus-card">
          <div className="sov-space-title"><h2>My Space</h2><span>Private · Yours</span></div>
          <p>The tools and places that matter to you. Choose or change anything.</p>
          <div className="sov-module-grid">
            {data.modules.length === 0 ? <div className="sov-empty"><strong>Your canvas is yours.</strong><p>Add an interest or create your first project when you're ready.</p><Link href="/onboarding" className="sov-space-link">Choose what belongs here →</Link></div> : data.modules.map(module => (
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
          <p>Choose the apps you love. Each actual connection is authorized separately.</p>
          {selectedApps.length ? <div className="sov-app-picks" aria-label="Selected apps, not connected"><small>Selected for setup · not connected</small><div>{selectedApps.map(id => { const app = OPTIONAL_INTEGRATIONS.find(item => item.id === id); return app ? <span key={id}>{app.name}</span> : null; })}</div></div> : <p className="sov-app-empty">No apps selected yet.</p>}
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
