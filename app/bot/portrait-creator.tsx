"use client";

import { useState } from "react";
import type { Persona } from "@/lib/bot/persona";
import { secondaryAction } from "@/app/ui";

type Reply = { status?: "processing" | "completed" | "failed"; requestId?: string; imageUrl?: string; error?: string };
const defaultPortraitPrompt = (persona: Persona) => `Create an original square avatar portrait for ${persona.name}, a ${persona.body} character. Main color ${persona.palette.primary}, secondary color ${persona.palette.secondary}, glow ${persona.palette.glow}. ${persona.about} Centered subject, clean background, friendly and distinctive, no text.`;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function BotPortraitCreator({ persona }: { persona: Persona }) {
  const [apiKey, setApiKey] = useState("");
  const [prompt, setPrompt] = useState(() => defaultPortraitPrompt(persona));
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [message, setMessage] = useState("Bring your Higgsfield API key to create a portrait concept.");
  const [busy, setBusy] = useState(false);

  async function generate() {
    if (!apiKey.trim() || !prompt.trim() || busy) return;
    setBusy(true);
    setImageUrl(null);
    setMessage("Sending one portrait request to Higgsfield…");
    try {
      const startResponse = await fetch("/api/bot/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", apiKey: apiKey.trim(), prompt: prompt.trim() }),
      });
      const start = (await startResponse.json()) as Reply;
      if (!startResponse.ok) throw new Error(start.error || "Couldn't start portrait generation.");
      if (start.status === "completed" && start.imageUrl) {
        setImageUrl(start.imageUrl);
        setMessage("Portrait concept ready. Download it or revise the prompt.");
        return;
      }
      if (!start.requestId) throw new Error("Higgsfield did not return a generation request.");
      setMessage("Generating portrait… This can take a few minutes.");
      for (let attempt = 0; attempt < 90; attempt++) {
        await wait(4000);
        const statusResponse = await fetch("/api/bot/avatar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "status", apiKey: apiKey.trim(), requestId: start.requestId }),
        });
        const result = (await statusResponse.json()) as Reply;
        if (!statusResponse.ok) throw new Error(result.error || "Couldn't check portrait generation.");
        if (result.status === "completed" && result.imageUrl) {
          setImageUrl(result.imageUrl);
          setMessage("Portrait concept ready. Download it or revise the prompt.");
          return;
        }
        if (result.status === "failed") throw new Error("Higgsfield could not generate that image. Try another prompt.");
      }
      setMessage("Still processing. You can check Higgsfield for this request; SOV stopped polling.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Portrait generation failed.");
    } finally {
      setApiKey("");
      setBusy(false);
    }
  }

  const defaultPrompt = defaultPortraitPrompt(persona);
  const safeImage = imageUrl?.replaceAll('"', "%22").replaceAll("\\", "%5C");

  return (
    <section className="grid gap-6 rounded-md border border-line bg-surface p-5 md:grid-cols-[minmax(0,1fr)_minmax(15rem,0.8fr)] md:p-7" aria-labelledby="portrait-creator-title">
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">Optional visual tool</p>
          <h2 id="portrait-creator-title" className="mt-2 text-xl font-medium">Generate a portrait concept</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted">Use your Higgsfield account to turn this bot’s look into a portrait. This does not replace the saved SOV character or change its permissions.</p>
        </div>
        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-muted">
          Higgsfield API key
          <input
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            autoComplete="new-password"
            spellCheck={false}
            placeholder="Paste the complete key"
            aria-label="Higgsfield API key"
            className="h-11 rounded-md border border-line bg-background px-3 text-sm font-normal normal-case tracking-normal text-foreground outline-none focus:border-accent"
            disabled={busy}
          />
        </label>
        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-muted">
          Visual direction
          <textarea
            rows={4}
            maxLength={1000}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={defaultPrompt}
            aria-label="Portrait visual direction"
            className="rounded-md border border-line bg-background px-3 py-2 text-sm font-normal normal-case leading-6 tracking-normal text-foreground outline-none focus:border-accent"
            disabled={busy}
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => setPrompt(defaultPrompt)} className={secondaryAction} disabled={busy}>Use bot look</button>
          <button type="button" onClick={generate} className="rounded-md bg-accent px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-background disabled:cursor-not-allowed disabled:opacity-50" disabled={busy || !apiKey.trim() || !prompt.trim()}>
            {busy ? "Generating…" : "Generate portrait"}
          </button>
        </div>
        <p aria-live="polite" role="status" className="text-xs leading-5 text-muted">{message}</p>
        <p className="text-[11px] leading-5 text-muted">Your key is held temporarily for this request, sent through SOV’s signed-in server route, and cleared afterward. SOV does not save it.</p>
      </div>
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-md border border-line bg-background p-4 text-center">
        {safeImage ? (
          <>
            <div role="img" aria-label={`${persona.name} portrait concept generated with Higgsfield`} className="aspect-square w-full max-w-sm rounded-md bg-cover bg-center" style={{ backgroundImage: `url("${safeImage}")` }} />
            <a href={imageUrl!} target="_blank" rel="noreferrer" download className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Open or download concept</a>
          </>
        ) : <p className="max-w-xs text-sm leading-6 text-muted">Your generated portrait will appear here. Generation is optional and uses your Higgsfield account.</p>}
      </div>
    </section>
  );
}
