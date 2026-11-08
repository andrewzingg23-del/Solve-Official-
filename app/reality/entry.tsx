"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { createProject } from "@/app/product/project-actions";
import { useProjectDraft } from "@/app/product/draft-store";
import type { ProjectCard } from "@/app/product/projects";
import { Icon } from "@/app/product/icons";
import { saveRealityMode, type RealityMode } from "./actions";
import "./reality.css";

const modes: Array<{ id: RealityMode; name: string; detail: string }> = [
  { id: "base", name: "Base", detail: "Black & white" },
  { id: "adaptive", name: "Adaptive", detail: "Your work" },
  { id: "personal", name: "Personal", detail: "Your expression" },
];

function titleFromIntention(input: string): string {
  const first = input.trim().split(/[.!?\n]/)[0]?.trim() || input.trim();
  return first.length > 100 ? first.slice(0, 97).trimEnd() + "…" : first;
}

export function RealityEntry({ owner, initialMode, worldId, projects, name }: {
  owner: string | null;
  initialMode: RealityMode;
  worldId: string;
  projects: ProjectCard[] | null;
  name: string;
}) {
  const router = useRouter();
  const { draft, save, clear } = useProjectDraft(owner);
  const [mode, setMode] = useState<RealityMode>(initialMode);
  const [modePending, startModeTransition] = useTransition();
  const [pending, startTransition] = useTransition();
  const [typed, setTyped] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [appearanceError, setAppearanceError] = useState("");
  const currentText = typed === null ? (draft?.goal || "") : typed;
  const recent = projects?.slice(0, 6) || [];
  const hasSavedProjects = projects !== null && recent.length > 0;

  function changeText(next: string) {
    setTyped(next);
    setError("");
    save({ id: draft?.id ?? worldId, title: titleFromIntention(next), goal: next });
  }

  function changeMode(next: RealityMode) {
    if (next === mode || modePending) return;
    setAppearanceError("");
    if (!owner) { setMode(next); return; }
    startModeTransition(async () => {
      const result = await saveRealityMode(next);
      if (result.ok) {
        setMode(next);
        router.refresh();
      } else {
        setAppearanceError(result.error);
      }
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const intention = currentText.trim();
    if (!intention || pending) return;
    const input = { id: draft?.id ?? worldId, title: titleFromIntention(intention), goal: intention };
    if (!save(input)) {
      setError("Your browser can't keep this draft. Keep this tab open until it is saved.");
      return;
    }
    if (!owner) {
      router.push("/login?next=%2F");
      return;
    }
    startTransition(async () => {
      try {
        const result = await createProject(input, owner);
        if (!result.ok) { setError(result.error); return; }
        clear(result.worldId);
        router.push("/world/" + encodeURIComponent(result.worldId) + "/workbench");
        router.refresh();
      } catch {
        setError("Your project wasn't confirmed. Your words are still here; retry when connected.");
      }
    });
  }

  return <main className={"reality reality--" + mode}>
    <a href="#reality-main" className="reality-skip">Skip to content</a>
    <header className="reality-head">
      <Link href="/" className="reality-wordmark" aria-label="SOLVE home"><span className="reality-mark" aria-hidden="true">S</span><span>SOLVE</span></Link>
      <nav className="reality-head-links" aria-label="Your environment">
        <Link href="/space">Space</Link>
        <Link href={hasSavedProjects ? "/world/" + recent[0].worldId + "/workbench" : "/worlds/new"}>Workbench</Link>
        <Link href="/sov-id">ID</Link>
      </nav>
      <div className="reality-head-account">
        {owner ? <Link href="/account" aria-label="Account" className="reality-avatar">{name.trim().slice(0, 1).toUpperCase() || "S"}</Link>
          : <Link href="/login?next=%2F" className="reality-account-link">Sign in</Link>}
      </div>
    </header>
    <div id="reality-main" className="reality-main">
      <section className="reality-intro" aria-labelledby="reality-title">
        <div className="reality-kicker">{mode === "personal" ? "Your Space" : mode === "adaptive" ? "Your environment" : "A Space for anything"}</div>
        <h1 id="reality-title">{mode === "personal" ? "Make it yours." : mode === "adaptive" && hasSavedProjects ? "Your work, in motion." : "What do you want to do?"}</h1>
        <p className="reality-intro-sub">{mode === "base" ? "Begin with an idea. Make something real." : mode === "adaptive" ? "Pick up where you left off, or begin something new." : "One foundation. A world that grows with you."}</p>
        <form className="reality-intent" onSubmit={submit} aria-label="Start new work">
          <label htmlFor="reality-intention" className="reality-sr">What do you want to accomplish?</label>
          <span className="reality-intent-plus" aria-hidden="true"><Icon name="plus" width={20}/></span>
          <input id="reality-intention" name="intention" placeholder="Describe anything…" maxLength={7000} required value={currentText} onChange={e => changeText(e.target.value)} disabled={pending}/>
          <button type="submit" aria-label={pending ? "Creating project" : "Begin"} disabled={!currentText.trim() || pending} className="reality-intent-submit">
            {pending ? <span className="reality-spinner" aria-hidden="true"/> : <Icon name="arrow" width={19} />}
          </button>
        </form>
        <div className="reality-privacy"><Icon name="lock" width={13}/><span>{owner ? "Private until you choose to share." : "Your draft stays on this device until you sign in."}</span></div>
        {error ? <p className="reality-error" role="alert">{error}</p> : null}
      </section>
      <section className="reality-work" aria-labelledby="reality-work-title">
        <div className="reality-work-head"><h2 id="reality-work-title">{hasSavedProjects ? "Your work" : "Start anywhere"}</h2>{hasSavedProjects ? <Link href="/projects">View all <Icon name="arrow" width={14}/></Link> : null}</div>
        {projects === null && owner ? <p className="reality-load-error" role="status">Projects could not be loaded. Your work has not been deleted; retry shortly.</p> : null}
        {hasSavedProjects ?
          <div className="reality-project-grid">{recent.map(project =>
            <Link className="reality-project" key={project.worldId} href={"/world/" + encodeURIComponent(project.worldId) + "/workbench"}>
              <span className="reality-project-symbol"><Icon name="projects" width={22}/></span>
              <strong>{project.title}</strong>
              <span>{project.summary || "Open your working environment"}</span>
              <small>Private workspace <Icon name="arrow" width={13}/></small>
            </Link>
          )}</div>
          : <div className="reality-starters">
            <button type="button" onClick={() => changeText("Plan an event")}><Icon name="home" width={19}/> Plan an event</button>
            <button type="button" onClick={() => changeText("Build a website")}><Icon name="projects" width={19}/> Build something</button>
            <button type="button" onClick={() => changeText("Organize a project with other people")}><Icon name="community" width={19}/> Work together</button>
          </div>}
      </section>
      <section className="reality-appearance" aria-label="Appearance">
        <div><span>YOUR REALITY</span><p>One environment. Your way.</p></div>
        <div className="reality-mode-list" role="group" aria-label="Appearance mode">
          {modes.map(item => <button key={item.id} type="button" className={mode === item.id ? "reality-mode reality-mode--active" : "reality-mode"} aria-pressed={mode === item.id} disabled={modePending} onClick={() => changeMode(item.id)}>
            <strong>{item.name}</strong><small>{item.detail}</small>
          </button>)}
        </div>
        {appearanceError ? <p className="reality-error" role="alert">{appearanceError}</p> : null}
        {mode === "personal" ? <Link href="/space" className="reality-customize">Customize your Space <Icon name="arrow" width={14}/></Link> : null}
      </section>
    </div>
    <nav className="reality-mobile-nav" aria-label="Mobile navigation">
      <Link href="/" aria-current="page"><Icon name="home"/>Home</Link>
      <Link href={hasSavedProjects ? "/world/" + recent[0].worldId + "/workbench" : "/worlds/new"}><Icon name="projects"/>Work</Link>
      <Link href="/space"><Icon name="community"/>Space</Link>
      <Link href="/account"><Icon name="profile"/>ID</Link>
    </nav>
  </main>;
}
