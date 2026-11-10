"use client";

import { useState, useTransition } from "react";
import { SovCard } from "@/app/product/sov-card";
import { BASE_LOOK, EXPRESSIONS, FINISHES, SEEDS, TONES, type CardLook } from "@/lib/product/card";
import { resetLook, saveLook, undoLook, type LookResult } from "./look-actions";

const LABEL = {
  expression: { base: "Base", personal: "Personal", expressive: "Expressive" },
  tone: { dark: "Dark", light: "Light" },
  finish: { matte: "Matte", metal: "Metal", glass: "Glass" },
} as const;

// Shaping the card. The preview is the real card component with the draft look, so what a person
// sees is exactly what will be saved. Saving writes a new version to their record; undo and Base
// are writes too. Nothing here can change anything but how the card looks.
export function CardStudio({ name, saved, canUndo: initialUndo }: { name: string; saved: CardLook; canUndo: boolean }) {
  const [draft, setDraft] = useState<CardLook>(saved);
  const [current, setCurrent] = useState<CardLook>(saved);
  const [canUndo, setCanUndo] = useState(initialUndo);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const changed = JSON.stringify(draft) !== JSON.stringify(current);

  const set = (patch: Partial<CardLook>) => { setMessage(null); setDraft(d => ({ ...d, ...patch })); };
  // Choosing a colour on Base would do nothing, so it moves the card to Personal.
  const pickSeed = (seed: string) => set({ seed, expression: draft.expression === "base" ? "personal" : draft.expression });

  const run = (act: () => Promise<LookResult>, done: string) => start(async () => {
    const result = await act();
    if (!result.ok) { setMessage({ tone: "error", text: result.error }); return; }
    setDraft(result.look); setCurrent(result.look); setCanUndo(result.canUndo);
    setMessage({ tone: "ok", text: done });
  });

  return <div className="sov-card-studio">
    <SovCard name={name} look={draft} />

    <fieldset className="sov-studio-group">
      <legend>Expression</legend>
      <div className="sov-studio-choices" role="group" aria-label="Expression">
        {EXPRESSIONS.map(e => <button key={e} type="button" aria-pressed={draft.expression === e} onClick={() => set({ expression: e })}>{LABEL.expression[e]}</button>)}
      </div>
    </fieldset>

    <fieldset className="sov-studio-group">
      <legend>Your colour</legend>
      <div className="sov-studio-swatches" role="group" aria-label="Your colour">
        {SEEDS.map(seed => <button key={seed} type="button" className="sov-swatch" style={{ background: seed }}
          aria-pressed={draft.expression !== "base" && draft.seed === seed} aria-label={`Colour ${seed}`} onClick={() => pickSeed(seed)} />)}
        <label className="sov-swatch sov-swatch-custom" aria-label="Choose any colour">
          <input type="color" value={draft.seed} onChange={event => pickSeed(event.target.value)} />
        </label>
      </div>
      <p className="solve-muted sov-studio-note">Whatever you choose, the writing on your card stays readable — that&apos;s checked, not hoped for.</p>
    </fieldset>

    <div className="sov-studio-pair">
      <fieldset className="sov-studio-group">
        <legend>Tone</legend>
        <div className="sov-studio-choices" role="group" aria-label="Tone">
          {TONES.map(t => <button key={t} type="button" aria-pressed={draft.tone === t} onClick={() => set({ tone: t })}>{LABEL.tone[t]}</button>)}
        </div>
      </fieldset>
      <fieldset className="sov-studio-group">
        <legend>Finish</legend>
        <div className="sov-studio-choices" role="group" aria-label="Finish">
          {FINISHES.map(f => <button key={f} type="button" aria-pressed={draft.finish === f} onClick={() => set({ finish: f })}>{LABEL.finish[f]}</button>)}
        </div>
      </fieldset>
    </div>

    <div className="sov-studio-actions">
      <button type="button" className="solve-button" disabled={!changed || pending} onClick={() => run(() => saveLook(draft), "Saved to your SOV ID.")}>
        {pending ? "Saving…" : "Save look"}
      </button>
      <button type="button" className="solve-button solve-button-secondary" disabled={!canUndo || pending} onClick={() => run(undoLook, "Your previous look is back.")}>Undo</button>
      <button type="button" className="solve-text-link" disabled={pending || (JSON.stringify(current) === JSON.stringify(BASE_LOOK) && !changed)}
        onClick={() => run(resetLook, "Back to SOLVE Base.")}>Return to Base</button>
    </div>
    {changed ? <p className="solve-muted" role="status">Previewing — not saved yet.</p> : null}
    {message ? <p role={message.tone === "error" ? "alert" : "status"} className={message.tone === "error" ? "solve-error" : "sov-studio-saved"}>{message.text}</p> : null}
    <p className="solve-muted sov-studio-note">Your look is part of your SOV ID and only you can see it until you choose to share it. A printed card would be a snapshot of it.</p>
  </div>;
}
