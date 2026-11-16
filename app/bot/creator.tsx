"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { LIMITS, validatePersona, type Persona } from "@/lib/bot/persona";
import { loadGuestProfile, useGuestProfile } from "@/lib/guest/profile";
import { saveBotAction } from "./actions";

export function BotCreator({ initial, ownerId, exists }: { initial: Persona; ownerId?: string; exists: boolean }) {
  const guest = useGuestProfile();
  const [saved, setSaved] = useState(initial);
  const [created, setCreated] = useState(exists);
  const [name, setName] = useState(initial.name);
  const [about, setAbout] = useState(exists ? initial.about : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const request = useRef<{ signature: string; id: string } | null>(null);
  const saving = useRef(false);
  const draft = validatePersona({ ...saved, name, about }, saved);
  const dirty = draft.name !== saved.name || draft.about !== saved.about;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving.current || !name.trim() || (created && !dirty)) return;
    saving.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      let result = draft;
      if (ownerId) {
        const signature = JSON.stringify(draft);
        if (request.current?.signature !== signature) request.current = { signature, id: crypto.randomUUID() };
        const response = await saveBotAction(request.current.id, draft, ownerId);
        if (!response.ok) {
          setError(response.error === "unavailable" ? "Save could not be confirmed. Try again." : "Save was refused. Check your account before retrying.");
          return;
        }
        result = response.persona;
      } else {
        guest.save({ botPersona: draft, botName: draft.name });
        if (JSON.stringify(loadGuestProfile()?.botPersona) !== JSON.stringify(draft)) {
          setError("This browser could not save your Agent. Allow device storage and try again.");
          return;
        }
      }
      request.current = null;
      setSaved(result);
      setName(result.name);
      setAbout(result.about);
      setCreated(true);
      setNotice(ownerId ? "Saved to your workspace." : "Saved on this device.");
    } catch {
      setError("Save could not be confirmed. Your edits are still here.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="solve-panel solve-agent-form">
    <label htmlFor="agent-name">Agent name</label>
    <input id="agent-name" required maxLength={LIMITS.name} value={name} disabled={busy}
      onChange={event => { setName(event.target.value); setNotice(""); }} />
    <label htmlFor="agent-about">Working instructions <span>(optional)</span></label>
    <textarea id="agent-about" rows={3} maxLength={LIMITS.about} value={about} disabled={busy}
      placeholder="Keep answers short. Ask before making a decision."
      onChange={event => { setAbout(event.target.value); setNotice(""); }} />
    <p>{ownerId ? "Saved privately to your workspace. You choose which Projects your Agent can access." : "Saved on this device. You can claim the profile later from Account."}</p>
    <div className="solve-ai-actions">
      <button className="solve-button" disabled={busy || !name.trim() || (created && !dirty)}>
        {busy ? "Saving…" : created ? "Save changes" : ownerId ? "Create Agent" : "Save on this device"}
      </button>
      {created && ownerId ? <Link href="/bot?section=connections" className="solve-text-link">Manage access</Link> : null}
    </div>
    {notice ? <p role="status">{notice}</p> : null}
    {error ? <p role="alert" className="solve-error">{error}</p> : null}
  </form>;
}
