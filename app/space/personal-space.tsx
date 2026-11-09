"use client";

import Link from "next/link";
import { createProject } from "@/app/product/project-actions";
import { projectCreationIntent } from "@/lib/product/project-intent";
import { useRouter } from "next/navigation";
import { isInstagramStyleRequest, instagramHandleInRequest } from "@/lib/product/instagram-style";
import { useMemo, useState, type FormEvent } from "react";
import { normalizeAppearance, proposeAppearance, type SpaceAppearance, type AppearanceProposal } from "@/lib/product/appearance";
import { saveSpaceAppearance } from "./actions";
import { OPTIONAL_INTEGRATIONS } from "@/lib/product/optional-integrations";
import { useGuestProfile } from "@/lib/guest/profile";
import { composePersonalSpace, normalizeSpaceAnswers, spaceMood, type SpaceAnswers } from "@/lib/product/personal-space";
import type { ProjectCard } from "@/app/product/projects";
import { useDeviceText, writeDeviceText } from "@/lib/client/device-storage";

type AgentTurn = { role: "user" | "assistant"; content: string; kind: "appearance" | "conversation" };

const APPEARANCE_KEY = "solve.space.appearance.v1";
const APP_INTERESTS_KEY = "sov.optional-app-interests.v1";

export function PersonalSpace({
  signedIn,
  ownerId,
  initialAnswers,
  projects,
  initialAppearance,
  botName,
}: {
  signedIn: boolean;
  ownerId: string | null;
  initialAnswers: SpaceAnswers;
  projects: ProjectCard[] | null;
  initialAppearance: SpaceAppearance;
  botName: string;
}) {
  const router = useRouter();
  const guest = useGuestProfile();
  // This is a setup-interest list only; it does not contain authorization tokens.
  const appInterestsText = useDeviceText(APP_INTERESTS_KEY);
  const selectedApps = useMemo(() => {
    try {
      const saved: unknown = JSON.parse(appInterestsText || "[]");
      if (!Array.isArray(saved)) return [];
      const allowed = new Set(OPTIONAL_INTEGRATIONS.map(item => item.id));
      return [...new Set(saved.filter((id): id is string => typeof id === "string" && allowed.has(id)))];
    } catch { return []; } // Browser storage may be unavailable.
  }, [appInterestsText]);
  // A signed-in person's appearance comes from their account. A guest's is kept
  // on this device only; either way an applied change in this session wins.
  const appearanceText = useDeviceText(APPEARANCE_KEY);
  const savedAppearance = useMemo(() => {
    if (signedIn || !appearanceText) return normalizeAppearance(initialAppearance);
    try {
      return normalizeAppearance(JSON.parse(appearanceText) as SpaceAppearance);
    } catch {
      return normalizeAppearance(initialAppearance); // Stay with safe defaults when storage is unreadable.
    }
  }, [signedIn, appearanceText, initialAppearance]);
  const [appliedAppearance, setAppliedAppearance] = useState<SpaceAppearance | null>(null);
  const appearance = appliedAppearance ?? savedAppearance;
  const [styleText, setStyleText] = useState("");
  const [proposal, setProposal] = useState<AppearanceProposal | null>(null);
  const [styleStatus, setStyleStatus] = useState("");
  const [undoAppearance, setUndoAppearance] = useState<SpaceAppearance | null>(null);
  const [styleBusy, setStyleBusy] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [agentTurns, setAgentTurns] = useState<AgentTurn[]>([]);
  const currentLook = proposal?.changes.length ? proposal.next : appearance;
  function appendTurn(turn: AgentTurn) {
    setAgentTurns(turns => [...turns, turn].slice(-20));
  }

  async function sendAgentMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = styleText.trim();
    if (!message || styleBusy || chatBusy) return;
    const priorTurns = agentTurns;
    appendTurn({ role: "user", content: message, kind: "conversation" });
    setStyleText("");
    if (isInstagramStyleRequest(message)) {
      appendTurn({ role: "assistant", content: "I'll help you use your own Instagram content as a real source. You'll review the photos and approve the look before SOLVE changes.", kind: "conversation" });
      const handle = instagramHandleInRequest(message);
      router.push("/personalize/instagram" + (handle ? "?profile=" + encodeURIComponent(handle) : ""));
      return;
    }
    const createIntent = projectCreationIntent(message);
    if (createIntent) {
      if (!signedIn || !ownerId) {
        appendTurn({ role: "assistant", content: "Sign in before creating a saved project. Nothing was created.", kind: "conversation" });
        return;
      }
      setChatBusy(true);
      setStyleStatus("");
      setProposal(null);
      try {
        const result = await createProject({ id: crypto.randomUUID(), ...createIntent }, ownerId);
        if (!result.ok) {
          appendTurn({ role: "assistant", content: result.error + " No project creation was confirmed.", kind: "conversation" });
          return;
        }
        appendTurn({ role: "assistant", content: "Your project was saved. Opening its Workbench.", kind: "conversation" });
        router.push("/world/" + encodeURIComponent(result.worldId) + "/workbench");
        router.refresh();
      } catch {
        appendTurn({ role: "assistant", content: "The project save could not be confirmed. Check Projects before retrying.", kind: "conversation" });
      } finally {
        setChatBusy(false);
      }
      return;
    }
    const draft = proposeAppearance(message, appearance);
    if (draft.supported) {
      setProposal(draft.changes.length ? draft : null);
      setStyleStatus(draft.response);
      appendTurn({ role: "assistant", content: draft.response, kind: "appearance" });
      return;
    }
    // No appearance proposal was recognized. Ask the existing conversational AI.
    // This endpoint returns a reply only; no client-side grant, execution or publish action.
    setChatBusy(true);
    setStyleStatus("");
    setProposal(null);
    try {
      const response = await fetch("/api/bot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          botName,
          history: priorTurns.slice(-10).map(turn => ({
            role: turn.role,
            content: turn.content.slice(0, 2000),
          })),
        }),
      });
      const result: unknown = await response.json();
      const value: { reply?: unknown; error?: unknown } = result && typeof result === "object" && !Array.isArray(result)
        ? result as { reply?: unknown; error?: unknown } : {};
      if (!response.ok || typeof value.reply !== "string") {
        const reason = typeof value.error === "string" ? value.error : "Your AI isn't available right now.";
        appendTurn({ role: "assistant", content: reason.slice(0, 280), kind: "conversation" });
      } else {
        appendTurn({ role: "assistant", content: value.reply!.slice(0, 6000), kind: "conversation" });
      }
    } catch {
      appendTurn({ role: "assistant", content: "I couldn't reach your AI. Your Space hasn't changed.", kind: "conversation" });
    } finally {
      setChatBusy(false);
    }
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
      } else if (!writeDeviceText(APPEARANCE_KEY, JSON.stringify(next))) {
        setStyleStatus("Your browser isn't allowing preference storage. This preview hasn't been saved.");
        return;
      }
      setAppliedAppearance(next);
      setUndoAppearance(previous);
      setProposal(null);
      setStyleStatus("Appearance updated. Your projects, integrations, permissions, and public Profile are unchanged.");
    } finally {
      setStyleBusy(false);
    }
  }

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
        <div className="sov-space-title"><h2>Talk to {botName}</h2><span>Private · You approve changes</span></div>
        <p>Ask anything or tell your AI how to change the look of your Space. Appearance changes are previewed before you apply them.</p>
        <div className="sov-agent-transcript" aria-live="polite" aria-label="Your AI conversation">
          {agentTurns.length ? agentTurns.map((turn, index) => (
            <div key={index} className={"sov-agent-turn sov-agent-turn--" + turn.role}>
              <small>{turn.role === "assistant" ? botName + (turn.kind === "appearance" ? " · Appearance" : "") : "You"}</small>
              <p>{turn.content}</p>
            </div>
          )) : <p className="sov-agent-prompt">Try “Make SOLVE look like my Instagram” or “Make this feel like a vintage skate magazine.”</p>}
          {chatBusy ? <p className="sov-agent-waiting" role="status">Your AI is responding…</p> : null}
        </div>
        <form className="sov-style-form" onSubmit={event => void sendAgentMessage(event)}>
          <label htmlFor="solve-style-request" className="sr-only">Talk to your AI</label>
          <div className="sov-style-input-row">
            <input id="solve-style-request" name="message" value={styleText} onChange={event => setStyleText(event.target.value)} maxLength={700} autoComplete="off" placeholder={"Ask " + botName + " or change your Space…"} />
            <button className="solve-button" type="submit" disabled={!styleText.trim() || styleBusy || chatBusy}>{chatBusy ? "Thinking…" : "Send"}</button>
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
        <small>Appearance requests use a restricted local interpreter. Other messages use your existing AI connection when available. This conversation is session-only; no request here authorizes a payment, account connection, or public publishing.</small>
      </section>
      <div className="sov-personal-stack">
      <div className="sov-personal-top">
        <section className="sov-space-card sov-focus-card">
          <div className="sov-space-title"><h2>My Space</h2><span>Private · Yours</span></div>
          <p>The tools and places that matter to you. Choose or change anything.</p>
          <div className="sov-module-grid">
            {data.modules.length === 0 ? <div className="sov-empty"><strong>Your canvas is yours.</strong><p>Add an interest or create your first project when you&apos;re ready.</p><Link href="/onboarding" className="sov-space-link">Choose what belongs here →</Link></div> : data.modules.map(module => (
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
            <strong>Projects couldn&apos;t be loaded.</strong>
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
