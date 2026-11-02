"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CreativeArtifact } from "@/lib/world/creative";
import { looksLikeHtmlDocument } from "@/lib/product/website-draft";

export function ArtifactEditor({ worldId, artifact }: { worldId: string; artifact: CreativeArtifact }) {
  const router = useRouter();
  const bodyId = useId();
  const [draft, setDraft] = useState({ title: artifact.title, body: artifact.body, position: artifact.position });
  const [version, setVersion] = useState(artifact.version);
  const [latest, setLatest] = useState<CreativeArtifact | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const bodyLimit = looksLikeHtmlDocument(artifact.body) ? 12000 : 7000;
  const request = useRef<{ signature: string; id: string } | null>(null);
  const saved = latest && latest.version >= artifact.version ? latest : artifact;
  const changed = saved.version > version;
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setNotice("");
    const payload = { ...draft, entityId: artifact.entityId, expectedVersion: version };
    const signature = JSON.stringify(payload);
    if (!request.current || request.current.signature !== signature) request.current = { signature, id: crypto.randomUUID() };
    try {
      const res = await fetch(`/api/worlds/${worldId}/artifacts`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, requestId: request.current.id }) });
      const result = await res.json();
      if (!res.ok) {
        if (res.status === 409 && result.latest) setLatest(result.latest);
        throw new Error(result.error || "Could not save this revision.");
      }
      setVersion(version + 1); setLatest(null); setNotice("Revision saved."); router.refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not save. Your draft is still here."); }
    finally { setBusy(false); }
  }
  return (
    <form onSubmit={save} className="mt-3 flex min-w-0 flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-xs text-muted">Title<input required maxLength={160} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} className="h-10 rounded border border-line bg-background px-3 text-sm text-foreground" /></label>
      <div className="flex flex-col gap-1.5"><label htmlFor={bodyId} className="text-xs text-muted">Text</label><textarea id={bodyId} maxLength={bodyLimit} rows={5} value={draft.body} onChange={e => setDraft({ ...draft, body: e.target.value })} className="resize-y rounded border border-line bg-background p-3 text-sm leading-5 text-foreground" /></div>
      <div className="grid grid-cols-2 gap-3">
        {(["x", "y"] as const).map(axis => <label key={axis} className="flex flex-col gap-1.5 text-xs text-muted">Canvas {axis.toUpperCase()} · {draft.position[axis]}%<input type="range" min="0" max="100" value={draft.position[axis]} onChange={e => setDraft({ ...draft, position: { ...draft.position, [axis]: Number(e.target.value) } })} className="accent-accent" /></label>)}
      </div>
      {changed ? <div className="flex flex-col gap-2 rounded border border-accent/40 p-3 text-xs leading-5">
        <p>A newer version is saved: v{saved.version}. Your draft is still here.</p>
        <details><summary className="cursor-pointer text-accent">Compare saved revision</summary><p className="mt-2 font-medium">{saved.title}</p><p className="max-h-60 overflow-y-auto whitespace-pre-wrap break-words">{saved.body}</p></details>
        <button type="button" onClick={() => { setVersion(saved.version); setNotice("Your draft is kept. The next save will revise the version you just compared."); }} className="text-left text-accent underline">I have compared it — use v{saved.version} as the base for my draft</button>
        <button type="button" onClick={() => { setDraft({ title: saved.title, body: saved.body, position: saved.position }); setVersion(saved.version); setNotice("Saved version loaded."); }} className="text-left text-muted underline">Replace my draft with the saved version</button>
      </div> : null}
      {notice ? <p role="status" className="text-xs leading-5 text-muted">{notice}</p> : null}
      <button type="submit" disabled={busy || changed} className="rounded border border-line px-4 py-2 text-xs font-semibold uppercase tracking-widest disabled:opacity-50">{busy ? "Saving…" : "Save revision"}</button>
    </form>
  );
}
