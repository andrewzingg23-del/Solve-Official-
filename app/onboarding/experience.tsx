"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGuestProfile } from "@/lib/guest/profile";
import { chosenFocus, composePersonalSpace, FOCUS_AREAS, normalizeSpaceAnswers, type SpaceAnswers } from "@/lib/product/personal-space";
import { savePersonalSpace } from "./actions";
import { OptionalConnections } from "./optional-connections";
import { SolveBrand } from "@/app/product/solve-brand";

export function PersonalOnboarding({
  signedIn,
  initialAnswers,
}: {
  signedIn: boolean;
  initialAnswers: SpaceAnswers;
}) {
  const router = useRouter();
  const guest = useGuestProfile();
  const [stage, setStage] = useState(0);
  const [mode, setMode] = useState<"interview" | "import" | "blank">("interview");
  const [draft, setDraft] = useState<SpaceAnswers | null>(null);
  const [error, setError] = useState("");
  const [busy, transition] = useTransition();
  const answers = draft ?? normalizeSpaceAnswers(signedIn ? (Object.keys(initialAnswers).length ? initialAnswers : guest.profile?.knowYou) : guest.profile?.knowYou ?? initialAnswers);
  const view = composePersonalSpace(answers);
  const selected = chosenFocus(answers);

  function change(key: string, value: string) {
    setError("");
    setDraft({ ...answers, [key]: value });
  }

  function toggleFocus(id: string) {
    const next = selected.includes(id as (typeof selected)[number])
      ? selected.filter(item => item !== id)
      : [...selected, id];
    change("focus", next.join(","));
  }

  async function importText(file: File | undefined) {
    if (!file) return;
    if (file.size > 64000 || !/\.(txt|md|json)$/i.test(file.name)) {
      setError("Use a .txt, .md or .json file under 64 KB. For larger exports, paste a short summary.");
      return;
    }
    try {
      const content = (await file.text()).slice(0, 3500);
      change("context", content);
      setMode("import");
    } catch {
      setError("This file could not be read. You can paste a short summary instead.");
    }
  }

  function saveAndEnter() {
    if (busy) return;
    setError("");
    const clean = normalizeSpaceAnswers(answers);
    transition(async () => {
      if (signedIn) {
        const result = await savePersonalSpace(clean);
        if (!result.ok) {
          setError(result.error || "Couldn't save your Space. Try again.");
          return;
        }
      } else {
        const patch = { yourName: clean.name || "", knowYou: clean };
        if (guest.active) guest.save(patch);
        else guest.activate(patch);
      }
      router.push("/space");
      router.refresh();
    });
  }

  return (
    <main className="sov-experience solve-page">
      <div className="solve-onboarding-top">
        <SolveBrand href="/space" />
        <span className="solve-onboarding-top-title">One Setup. A Space That&apos;s Yours.</span>
        <Link href="/space" className="solve-onboarding-top-exit">My Space →</Link>
      </div>
      <header className="sov-experience-head">
        <span className="solve-kicker">SOLVE / Make it yours</span>
        <h1>One setup. A Space that&apos;s yours.</h1>
        <p>Your private operating environment can grow into anything. Start with who you are, not a dashboard full of fake information.</p>
      </header>

      <nav className="sov-steps" aria-label="Onboarding progress">
        {["Meet AI", "Context", "Build", "Your Space"].map((label, i) => (
          <button key={label} type="button" className={stage === i ? "current" : ""} aria-current={stage === i ? "step" : undefined} onClick={() => { setError(""); setStage(i); }}>
            <span>{i + 1}</span>{label}
          </button>
        ))}
      </nav>

      {stage === 0 ? (
        <section className="sov-experience-panel sov-hello">
          <span className="solve-kicker">01 / Meet your AI</span>
          <span className="sov-ai-ring" aria-hidden="true" />
          <h2>A companion that works with you.</h2>
          <p>Talk, build, learn and organize. Your AI can help shape your Space, but it starts with no access to outside accounts. You choose what it can use.</p>
          <div className="sov-onboarding-actions">
            <button type="button" className="solve-button" onClick={() => setStage(1)}>Meet my AI · Continue →</button>
            <Link href="/bot" className="solve-button solve-button-secondary">Customize my AI</Link>
          </div>
          <small>Models and avatars can change later. Your identity and saved work should not depend on one AI provider.</small>
        </section>
      ) : stage === 1 ? (
        <section className="sov-experience-panel">
          <span className="solve-kicker">02 / Context</span>
          <h2>Tell SOLVE what matters.</h2>
          <p>Answer a few questions, bring selected context, or begin with nothing. Context stays private unless you deliberately share something.</p>
          <div className="sov-choice-row" role="group" aria-label="Choose setup method">
            <button type="button" className={mode === "interview" ? "selected" : ""} onClick={() => setMode("interview")}>Short interview</button>
            <button type="button" className={mode === "import" ? "selected" : ""} onClick={() => setMode("import")}>Import context</button>
            <button type="button" className={mode === "blank" ? "selected" : ""} onClick={() => { setMode("blank"); setDraft({}); }}>Start blank</button>
          </div>
          {mode !== "blank" ? (
            <div className="sov-interview-grid">
              <label>What should SOLVE call you?
                <input value={answers.name || ""} maxLength={60} placeholder="Your name (optional)" onChange={event => change("name", event.target.value)} />
              </label>
              <label>What are you hoping to do?
                <input value={answers.building || ""} maxLength={500} placeholder="Create, organize, explore or build…" onChange={event => change("building", event.target.value)} />
              </label>
              {mode === "interview" ? (
                <>
                  <label>Who might you want to work with?
                    <input value={answers.people || ""} maxLength={250} placeholder="Friends, family, collaborators… (optional)" onChange={event => change("people", event.target.value)} />
                  </label>
                  <label>What should stay private?
                    <input value={answers.privacy || ""} maxLength={250} placeholder="Private by default" onChange={event => change("privacy", event.target.value)} />
                  </label>
                </>
              ) : (
                <div className="sov-span-wide">
                  <label>Paste a short personal context summary
                    <textarea value={answers.context || ""} maxLength={3500} rows={5} placeholder="Interests, current work, favorite tools, goals and preferences. Never paste passwords, credentials or private information about other people." onChange={event => change("context", event.target.value)} />
                  </label>
                  <label className="sov-file-input">Or choose a small .txt, .md or .json summary
                    <input type="file" accept=".txt,.md,.json,text/plain,application/json" onChange={event => void importText(event.target.files?.[0])} />
                  </label>
                  <small>The file is read locally in your browser. Only the context you choose to save is retained.</small>
                </div>
              )}
            </div>
          ) : <div className="sov-empty-answer">No context required. You can personalize your Space at any time.</div>}
          <div className="sov-focus-area">
            <h3>What belongs in your Space? <span>Optional · choose any</span></h3>
            <div className="sov-focus-grid">
              {FOCUS_AREAS.map(item => <button key={item.id} type="button" aria-pressed={selected.includes(item.id)} onClick={() => toggleFocus(item.id)} className={selected.includes(item.id) ? "selected" : ""}>
                <strong>{item.label}</strong><small>{item.description}</small>
              </button>)}
            </div>
          </div>
          <label className="sov-ai-opt-in"><input type="checkbox" checked={answers.aiContext === "yes"} onChange={event => change("aiContext", event.target.checked ? "yes" : "no")} /> <span><strong>Let my AI use my goal and selected interests.</strong><small>Optional. Imported documents, private notes and external accounts are not automatically shared with the model.</small></span></label>
          {error ? <p role="alert" className="sov-error">{error}</p> : null}
          <div className="sov-onboarding-actions">
            <button type="button" className="solve-button" onClick={() => { setError(""); setStage(2); }}>Build my Space →</button>
            <button type="button" className="solve-button solve-button-secondary" onClick={() => setStage(0)}>← Back</button>
          </div>
        </section>
      ) : stage === 2 ? (
        <section className="sov-experience-panel sov-build-panel">
          <span className="solve-kicker">03 / Build your Space</span>
          <h2>Made for what matters to you.</h2>
          <p>Here&apos;s the structure assembled from your choices. You can change every part later; this doesn&apos;t connect or share anything.</p>
          <div className="sov-build-preview">
            <div className="sov-build-preview-heading"><span className="sov-build-orb" aria-hidden="true" /><div><strong>{view.greeting}</strong><small>Private Space · Your chosen starting point</small></div></div>
            <div className="sov-preview-modules">
              {view.modules.length ? view.modules.map(item => <div key={item.id}><strong>{item.label}</strong><small>{item.description}</small></div>) :
                <div><strong>Blank canvas</strong><small>Make it your own as you go</small></div>}
            </div>
            <p>{view.goal ? "Your focus: " + view.goal : "A flexible home ready for your first idea."}</p>
          </div>
          <div className="sov-onboarding-actions">
            <button type="button" className="solve-button" onClick={() => setStage(3)}>See my Space →</button>
            <button type="button" className="solve-button solve-button-secondary" onClick={() => setStage(1)}>← Edit my choices</button>
          </div>
        </section>
      ) : (
        <section className="sov-experience-panel">
          <span className="solve-kicker">04 / Your Space is ready</span>
          <h2>{view.greeting}</h2>
          <p>{view.goal || "A private place for your interests, people, projects and connected tools. Start anywhere."}</p>
          <div className="sov-preview">
            <div className="sov-preview-private">
              <div className="sov-preview-title"><span>Private Space</span><span className="sov-privacy-pill">Only you</span></div>
              <div className="sov-preview-modules">
                {view.modules.map(item => <div key={item.id}><strong>{item.label}</strong><small>{item.description}</small></div>)}
              </div>
              <p>Real projects, updates and integrations appear only as you create or authorize them.</p>
            </div>
            <div className="sov-preview-profile">
              <div className="sov-preview-title"><span>Public Profile</span><span className="sov-privacy-pill">Not published</span></div>
              <h3>{view.publicPreview.name}</h3>
              <p>{view.publicPreview.bio || "Choose what people can discover about you, your creations and your communities."}</p>
              <small>Your private context and interviews are never included in this preview.</small>
            </div>
          </div>
          {error ? <p role="alert" className="sov-error">{error}</p> : null}
          <div className="sov-onboarding-actions">
            <button type="button" className="solve-button" disabled={busy} onClick={saveAndEnter}>{busy ? "Saving…" : "Save & enter my Space →"}</button>
            <button type="button" className="solve-button solve-button-secondary" onClick={() => setStage(2)}>← Back to build</button>
          </div>
          <small>{signedIn ? "Your preferences are saved to your account. No integration is authorized by this step." : "Guest setup saves to this browser only. Sign in later for recovery and multi-device access."}</small>
        </section>
      )}

      <details className="sov-optional-apps" id="apps">
        <summary>Bring your apps and accounts (optional)</summary>
        <p>Interest is not connection. Review supported providers and grant access separately.</p>
        <OptionalConnections />
      </details>
    </main>
  );
}
