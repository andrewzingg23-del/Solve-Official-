"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function SourcePublisher({ worldId }: { worldId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const request = useRef<{ signature: string; id: string } | null>(null);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setNotice("");
    const payload = { title: title.trim(), body, position: { x: 50, y: 50 } };
    const signature = JSON.stringify(payload);
    if (!request.current || request.current.signature !== signature) request.current = { signature, id: crypto.randomUUID() };
    try {
      const response = await fetch(`/api/worlds/${worldId}/artifacts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, requestId: request.current.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not share this source.");
      setTitle(""); setBody(""); request.current = null; setNotice("Shared document saved. People and authorized AIs in this room can use it."); router.refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not save. Your text is still here."); }
    finally { setBusy(false); }
  }
  return (
    <details className="mb-4 rounded-xl border border-line bg-surface/55 p-4">
      <summary className="cursor-pointer text-sm font-medium">Bring selected AI knowledge into this room</summary>
      <p className="mt-3 text-xs leading-5 text-muted">Paste the parts of a Claude, ChatGPT or other conversation you want to share. Give it a source title. Saving publishes it to everyone and every AI with access to this World.</p>
      <form onSubmit={save} className="mt-3 flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted">Source title<input required maxLength={160} value={title} onChange={e => setTitle(e.target.value)} placeholder="Claude · prototype research · Oct 9" className="rounded border border-line bg-background p-2 text-sm text-foreground" /></label>
        <label className="flex flex-col gap-1 text-xs text-muted">Selected knowledge<textarea required rows={5} maxLength={7000} value={body} onChange={e => setBody(e.target.value)} className="rounded border border-line bg-background p-2 text-sm leading-6 text-foreground" /></label>
        <button disabled={busy} className="self-start rounded border border-accent/50 px-3 py-2 text-sm text-accent disabled:opacity-50">{busy ? "Saving…" : "Publish shared source"}</button>
      </form>
      {notice ? <p role="status" className="mt-3 text-xs text-muted">{notice}</p> : null}
    </details>
  );
}
