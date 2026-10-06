"use client";

import { useRef, useState } from "react";
import { confirmBotImport, previewBotImport } from "./import-actions";

type Phase = "pick" | "preview" | "done";

export function BotImport({ botName }: { botName: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("pick");
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(0);
  const [titles, setTitles] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const file = () => fileRef.current?.files?.[0] ?? null;

  async function onPreview() {
    const f = file();
    if (!f) {
      setError("Choose your conversations.json export first.");
      return;
    }
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("file", f);
    const res = await previewBotImport(fd);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Couldn't read that file.");
      return;
    }
    setCount(res.count ?? 0);
    setTitles(res.titles ?? []);
    setPhase("preview");
  }

  async function onConfirm() {
    const f = file();
    if (!f) return;
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("file", f);
    const res = await confirmBotImport(fd);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "The import failed.");
      return;
    }
    setMessage(
      res.imported === 0
        ? "That file was already imported — nothing new added."
        : `${res.imported} conversations are now part of ${botName}'s memory.`,
    );
    setPhase("done");
  }

  function reset() {
    setPhase("pick");
    setMessage(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <section aria-labelledby="import-heading" className="flex flex-col gap-4 rounded-md border border-line bg-surface/60 p-4 md:p-5">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Bring your bots with you</p>
        <h2 id="import-heading" className="mt-1 text-lg font-medium">Give {botName} your history</h2>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-muted">
          Export your ChatGPT history (Settings → Data controls → Export) and upload the conversations.json here.
          Each conversation becomes a sealed memory {botName} can search — and you can forget any of them later.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative">{error}</p>
      )}
      {message && (
        <p role="status" className="rounded border border-positive/25 bg-positive/5 px-3 py-2 text-sm text-positive">{message}</p>
      )}

      {phase === "pick" && (
        <div className="flex flex-wrap items-center gap-3">
          <input ref={fileRef} type="file" accept=".json,application/json" aria-label="ChatGPT export file"
            className="text-xs text-muted file:mr-3 file:rounded file:border file:border-line file:bg-background file:px-3 file:py-2 file:text-xs file:text-foreground" />
          <button type="button" onClick={onPreview} disabled={busy}
            className="rounded border border-line px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground disabled:opacity-50">
            {busy ? "Reading…" : "Preview"}
          </button>
        </div>
      )}

      {phase === "preview" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            Found <strong>{count}</strong> conversation{count === 1 ? "" : "s"}.
            {titles.length > 0 && <span className="text-muted"> Including: {titles.join(", ")}…</span>}
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={onConfirm} disabled={busy}
              className="rounded bg-accent px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-background disabled:opacity-50">
              {busy ? "Importing…" : `Import ${count} conversations`}
            </button>
            <button type="button" onClick={reset} disabled={busy} className="rounded border border-line px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
              Choose a different file
            </button>
          </div>
        </div>
      )}

      {phase === "done" && (
        <button type="button" onClick={reset} className="self-start rounded border border-line px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
          Import another file
        </button>
      )}
    </section>
  );
}
