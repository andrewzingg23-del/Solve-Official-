"use client";

import { useRef, useState } from "react";
import { confirmBotImport, previewBotImport, type ImportPreview } from "./import-actions";

type Phase = "pick" | "preview" | "done";
type Conversation = NonNullable<ImportPreview["conversations"]>[number];

/**
 * Import requires individual, explicit selection.
 * The server reparses the same file and validates selected indices.
 * This UI never pretends a compact memory is the complete conversation archive.
 */
export function BotImport({ botName }: { botName: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("pick");
  const [busy, setBusy] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const file = () => fileRef.current?.files?.[0] ?? null;

  async function onPreview() {
    const f = file();
    if (!f) { setError("Choose your conversations.json export first."); return; }
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", f);
      const res = await previewBotImport(fd);
      if (!res.ok) { setError(res.error ?? "Couldn't read that file."); return; }
      setConversations(res.conversations ?? []);
      setSelected([]); // No implicit consent, even if every conversation is visible.
      setPhase("preview");
    } catch {
      setError("Could not preview your export. Nothing was imported.");
    } finally {
      setBusy(false);
    }
  }

  async function onConfirm() {
    const f = file();
    if (!f || selected.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", f);
      fd.set("selected_indices", JSON.stringify(selected));
      const res = await confirmBotImport(fd);
      if (!res.ok) { setError(res.error ?? "The import failed."); return; }
      setMessage(res.imported === 0
        ? "No new memories were added. This selection may have already been imported."
        : `Saved ${res.imported} conversation summar${res.imported === 1 ? "y" : "ies"} to ${botName}'s private memory.`);
      setPhase("done");
    } catch {
      setError("The import was interrupted; check your memory before retrying.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setPhase("pick");
    setMessage(null);
    setError(null);
    setConversations([]);
    setSelected([]);
    if (fileRef.current) fileRef.current.value = "";
  }

  function toggle(index: number, checked: boolean) {
    setSelected(current => checked
      ? [...new Set([...current, index])].sort((a, b) => a - b)
      : current.filter(id => id !== index));
  }

  return (
    <section aria-labelledby="import-heading" className="flex flex-col gap-4 rounded-md border border-line bg-surface/60 p-4 md:p-5">
      <div>
        <h2 id="import-heading" className="text-lg font-medium">Choose context to bring into SOLVE</h2>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-muted">
          Upload ChatGPT's conversations.json from your data export. Review and select only what you want.
          The current importer saves a shortened, searchable memory summary of each selected conversation,
          not a full archive. Private imports are never automatically shared with a World.
        </p>
      </div>

      {error ? <p role="alert" className="rounded border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative">{error}</p> : null}
      {message ? <p role="status" className="rounded border border-positive/25 bg-positive/5 px-3 py-2 text-sm text-positive">{message}</p> : null}

      {phase === "pick" ? (
        <div className="flex flex-wrap items-center gap-3">
          <input ref={fileRef} type="file" accept=".json,application/json" aria-label="ChatGPT export file"
            className="text-xs text-muted file:mr-3 file:rounded file:border file:border-line file:bg-background file:px-3 file:py-2 file:text-xs file:text-foreground" />
          <button type="button" onClick={onPreview} disabled={busy}
            className="rounded border border-line px-4 py-2 text-xs font-semibold text-foreground disabled:opacity-50">
            {busy ? "Reading…" : "Review conversations"}
          </button>
        </div>
      ) : null}

      {phase === "preview" ? (
        <>
          <p className="text-sm">Found {conversations.length} conversation{conversations.length === 1 ? "" : "s"} (up to 100 per import). Selected: {selected.length}.</p>
          <div className="flex flex-wrap gap-3 text-sm">
            <button type="button" onClick={() => setSelected(conversations.map(c => c.index))} className="text-accent underline">Select all shown</button>
            <button type="button" onClick={() => setSelected([])} className="text-muted underline">Clear selection</button>
          </div>
          <ul className="max-h-72 space-y-2 overflow-y-auto rounded border border-line p-3" aria-label="Conversations to import">
            {conversations.map(conv => (
              <li key={conv.index}>
                <label className="flex cursor-pointer items-start gap-3 text-sm">
                  <input type="checkbox" checked={selected.includes(conv.index)}
                    onChange={e => toggle(conv.index, e.target.checked)} disabled={busy} className="mt-1" />
                  <span className="min-w-0 break-words">{conv.title}
                    <span className="block text-xs text-muted">{conv.at.slice(0, 10)}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={onConfirm} disabled={busy || selected.length === 0}
              className="rounded bg-accent px-4 py-2 text-xs font-semibold text-background disabled:opacity-50">
              {busy ? "Importing…" : `Save ${selected.length} selected summar${selected.length === 1 ? "y" : "ies"}`}
            </button>
            <button type="button" onClick={reset} disabled={busy} className="rounded border border-line px-4 py-2 text-xs text-muted">
              Choose a different file
            </button>
          </div>
        </>
      ) : null}

      {phase === "done" ? (
        <button type="button" onClick={reset} className="self-start rounded border border-line px-4 py-2 text-xs text-muted">Import another file</button>
      ) : null}
    </section>
  );
}
