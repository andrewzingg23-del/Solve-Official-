"use client";

import { useState } from "react";
import { createIdeaAction } from "./actions";

type Draft = { title: string; description: string; assumptions: string[]; openQuestions: string[]; rationale: string };

export function IdeaExpansion({ worldId, ideaId }: { worldId: string; ideaId: string }) {
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [model, setModel] = useState("");
  const [requestId, setRequestId] = useState("");
  const [error, setError] = useState("");

  async function expand() {
    setLoading(true);
    setError("");
    setDraft(null);
    setRequestId(crypto.randomUUID());
    try {
      const response = await fetch("/api/ideas/expand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worldId, ideaId }),
      });
      const body = await response.json() as { draft?: Draft; model?: string; error?: string };
      if (!response.ok || !body.draft) throw new Error(body.error ?? "Could not draft an expansion.");
      setDraft(body.draft);
      setModel(body.model ?? "reasoning model");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not draft an expansion.");
    } finally {
      setLoading(false);
    }
  }

  const accept = createIdeaAction.bind(null, worldId);
  return (
    <section className="border-t border-line pt-3">
      {!draft && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted">Ask AI to draft one source-linked expansion. Nothing is saved until you accept it.</p>
          <button type="button" onClick={expand} disabled={loading} className="rounded border border-line px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent disabled:opacity-50">
            {loading ? "Thinking…" : "Expand with AI"}
          </button>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-negative">{error}</p>}
      {draft && (
        <div className="mt-3 flex flex-col gap-3 rounded border border-accent/25 bg-background/60 p-3">
          <p className="text-[9px] uppercase tracking-[0.16em] text-accent">AI draft · {model} · not saved</p>
          <form action={accept} className="flex flex-col gap-3">
            <p className="text-xs leading-5 text-muted">{draft.rationale}</p>
            <input type="hidden" name="requestId" value={requestId} />
            <input type="hidden" name="sourceIdeaId" value={ideaId} />
            <input type="hidden" name="sourceModel" value={model} />
            <label className="flex flex-col gap-1 text-xs text-muted">Title<input name="title" required maxLength={160} defaultValue={draft.title} className="h-9 rounded border border-line bg-background px-2 text-sm text-foreground" /></label>
            <label className="flex flex-col gap-1 text-xs text-muted">Description<textarea name="description" required maxLength={7000} rows={4} defaultValue={draft.description} className="rounded border border-line bg-background p-2 text-sm text-foreground" /></label>
            <label className="flex flex-col gap-1 text-xs text-muted">Assumptions<textarea name="assumptions" rows={3} defaultValue={draft.assumptions.join("\n")} className="rounded border border-line bg-background p-2 text-sm text-foreground" /></label>
            <label className="flex flex-col gap-1 text-xs text-muted">Open questions<textarea name="openQuestions" rows={3} defaultValue={draft.openQuestions.join("\n")} className="rounded border border-line bg-background p-2 text-sm text-foreground" /></label>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="rounded bg-accent px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-background">Accept as proposal</button>
              <button type="button" onClick={() => setDraft(null)} className="rounded border border-line px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Discard</button>
            </div>
          </form>
          <p className="text-[10px] leading-4 text-muted">Accepting saves a proposed idea linked to its source. You can edit the draft before saving; no experiment or code change happens automatically.</p>
        </div>
      )}
    </section>
  );
}
