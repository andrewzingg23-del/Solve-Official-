"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { IdCard } from "@/app/ui/id-card";
import { BASE_LOOK, EXPRESSIONS, SEEDS, TONES, type CardLook } from "@/lib/product/card";
import { resetLook, saveLook, undoLook, type LookResult } from "./look-actions";
import { saveName } from "./id-actions";
import styles from "./studio.module.css";

const LABEL = {
  expression: { base: "Base", personal: "Personal", expressive: "Expressive" },
  tone: { dark: "Dark", light: "Light" },
} as const;

function Choices<T extends string>({ label, options, value, names, onPick }: {
  label: string; options: readonly T[]; value: T; names: Record<T, string>; onPick: (v: T) => void;
}) {
  return <fieldset className={styles.group}>
    <legend className="s-label">{label}</legend>
    <div className={styles.choices} role="group" aria-label={label}>
      {options.map(o => <button key={o} type="button" className={styles.choice} aria-pressed={value === o} onClick={() => onPick(o)}>{names[o]}</button>)}
    </div>
  </fieldset>;
}

// Your ID card, your name, and the colours your whole Solve wears. Saving, undo and Base are all writes to their own record. Because the
// whole environment takes its colours from this card, saving refreshes the page around it too.
export function Studio({ name: initialName, saved, canUndo: initialUndo }: { name: string; saved: CardLook; canUndo: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [draftName, setDraftName] = useState(initialName);
  const [draft, setDraft] = useState<CardLook>(saved);
  const [current, setCurrent] = useState<CardLook>(saved);
  const [canUndo, setCanUndo] = useState(initialUndo);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const lookChanged = JSON.stringify(draft) !== JSON.stringify(current);
  const nameChanged = draftName.trim() !== name;

  const set = (patch: Partial<CardLook>) => { setMessage(null); setDraft(d => ({ ...d, ...patch })); };
  const pickSeed = (seed: string) => set({ seed, expression: draft.expression === "base" ? "personal" : draft.expression });

  const runLook = (act: () => Promise<LookResult>, done: string) => start(async () => {
    const result = await act();
    if (!result.ok) { setMessage({ ok: false, text: result.error }); return; }
    setDraft(result.look); setCurrent(result.look); setCanUndo(result.canUndo);
    setMessage({ ok: true, text: done });
    router.refresh();
  });

  const commitName = () => start(async () => {
    const result = await saveName(draftName);
    if (!result.ok) { setMessage({ ok: false, text: result.error }); return; }
    setName(result.name); setDraftName(result.name);
    setMessage({ ok: true, text: "Your name is on your ID." });
    router.refresh();
  });

  return <div className={styles.studio}>
    <IdCard name={nameChanged ? draftName : name} />
    {lookChanged || nameChanged ? <p className="s-muted s-small" role="status">Not saved yet.</p> : null}

    <div className={styles.controls}>
      <form className={styles.group} onSubmit={event => { event.preventDefault(); if (nameChanged) commitName(); }}>
        <label htmlFor="card-name" className="s-label">Your name</label>
        <div className={styles.nameRow}>
          <input id="card-name" className="s-input" value={draftName} maxLength={80} autoComplete="name"
            placeholder="Your name" onChange={event => { setMessage(null); setDraftName(event.target.value); }} />
          <button type="submit" className="s-button" data-variant="quiet" disabled={!nameChanged || pending}>Save name</button>
        </div>
      </form>

      <Choices label="Expression" options={EXPRESSIONS} value={draft.expression} names={LABEL.expression} onPick={v => set({ expression: v })} />

      <fieldset className={styles.group}>
        <legend className="s-label">Your colour</legend>
        <div className={styles.swatches} role="group" aria-label="Your colour">
          {SEEDS.map(seed => <button key={seed} type="button" className={styles.swatch} style={{ background: seed }}
            aria-pressed={draft.expression !== "base" && draft.seed === seed} aria-label={`Colour ${seed}`} onClick={() => pickSeed(seed)} />)}
          <label className={`${styles.swatch} ${styles.anyColour}`} aria-label="Choose any colour">
            <input type="color" value={draft.seed} onChange={event => pickSeed(event.target.value)} />
          </label>
        </div>
        <p className="s-muted s-small">Your colour becomes your whole SOLVE — and whatever you choose, everything stays readable. That&apos;s checked, not hoped for.</p>
      </fieldset>

      <Choices label="Tone" options={TONES} value={draft.tone} names={LABEL.tone} onPick={v => set({ tone: v })} />

      <div className={styles.actions}>
        <button type="button" className="s-button" disabled={!lookChanged || pending} onClick={() => runLook(() => saveLook(draft), "Saved. Your SOLVE now wears it.")}>
          {pending ? "Saving…" : "Save look"}
        </button>
        <button type="button" className="s-button" data-variant="quiet" disabled={!canUndo || pending} onClick={() => runLook(undoLook, "Your previous look is back.")}>Undo</button>
        <button type="button" className="s-button" data-variant="link"
          disabled={pending || (JSON.stringify(current) === JSON.stringify(BASE_LOOK) && !lookChanged)}
          onClick={() => runLook(resetLook, "Back to SOLVE Base.")}>Return to Base</button>
      </div>
      {message ? <p role={message.ok ? "status" : "alert"} className={message.ok ? "s-ok" : "s-error"}>{message.text}</p> : null}
    </div>
  </div>;
}
