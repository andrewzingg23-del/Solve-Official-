"use client";

// One conversational surface, mounted once by the approved app/ui shell.
// All providers use the same SOLVE context and history; nothing executes here.
import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { CONSOLE_LIMITS, type ConsoleMessage, screenFromPath } from "@/lib/ai/console-contract";
import styles from "./ai-console.module.css";

export function AiConsole({ open, onClose, signedIn, pathname }: {
  open: boolean;
  onClose: () => void;
  signedIn: boolean;
  pathname: string;
}) {
  const [turns, setTurns] = useState<ConsoleMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const entry = useRef<HTMLTextAreaElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const screen = screenFromPath(pathname);

  useEffect(() => { if (open && signedIn) entry.current?.focus(); }, [open, signedIn]);
  useEffect(() => {
    if (log.current && open) log.current.scrollTop = log.current.scrollHeight;
  }, [turns, busy, open]);

  async function send() {
    const message = draft.trim();
    if (!message || busy || !signedIn) return;
    setError(null);
    setDraft("");
    setBusy(true);
    const history = turns.slice(-CONSOLE_LIMITS.history).map(({ role, content }) => ({ role, content }));
    setTurns(prev => [...prev, { role: "user", content: message }]);
    try {
      const res = await fetch("/api/ai/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ message, history, path: pathname }),
      });
      const reply = await res.json().catch(() => null) as { reply?: unknown; error?: unknown } | null;
      if (!res.ok || typeof reply?.reply !== "string" || !reply.reply.trim()) {
        setError(typeof reply?.error === "string" ? reply.error : "No AI reply was received. Nothing was changed.");
        return;
      }
      setTurns(prev => [...prev, { role: "assistant", content: reply.reply as string }]);
    } catch {
      setError("Couldn't reach the AI provider. Nothing was changed.");
    } finally {
      setBusy(false);
      entry.current?.focus();
    }
  }

  function onEntryKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
  }

  // Returning null hides the panel but does NOT discard its state: the
  // component remains mounted in the persistent shell across navigation.
  if (!open) return null;

  return (
    <aside id="solve-ai-console" role="dialog" aria-label="Talk with AI" className={styles.panel}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <strong>AI in SOLVE</strong>
          <span className={styles.context}>Here: {screen?.label ?? "this screen"}</span>
        </div>
        <button type="button" onClick={onClose} className={styles.close} aria-label="Close AI conversation">×</button>
      </header>
      <div className={styles.meta}>
        <span>OpenAI GPT · Preview</span>
        <span>Conversation only · No actions</span>
      </div>
      <div className={styles.log} ref={log} role="log" aria-live="polite" aria-relevant="additions">
        {turns.length === 0 && (
          <div className={styles.empty}>
            <p>Ask about what you&apos;re working on. AI knows which SOLVE screen you&apos;re on, not everything in it.</p>
            <p>Changes to your Space still require your approval and a connected execution capability.</p>
          </div>
        )}
        {turns.map((turn, index) => (
          <div key={index} className={turn.role === "user" ? styles.you : styles.assistant}>
            {turn.role === "assistant" ? <small className={styles.speaker}>OpenAI GPT</small> : null}
            {turn.content}
          </div>
        ))}
        {busy ? <p className={styles.busy}>Thinking…</p> : null}
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
      </div>
      {signedIn ? (
        <form className={styles.entry} onSubmit={e => { e.preventDefault(); void send(); }}>
          <label htmlFor="solve-ai-draft" className="s-visually-hidden">Message to AI</label>
          <textarea
            id="solve-ai-draft"
            ref={entry}
            value={draft}
            onChange={e => setDraft(e.target.value.slice(0, CONSOLE_LIMITS.message))}
            onKeyDown={onEntryKey}
            placeholder="Ask about this screen…"
            maxLength={CONSOLE_LIMITS.message}
            rows={2}
            disabled={busy}
          />
          <button type="submit" disabled={busy || !draft.trim()} aria-label="Send message">Send</button>
        </form>
      ) : (
        <div className={styles.signin}>Sign in to use the internal AI preview. <Link href="/login?next=%2Fapps">Sign in</Link></div>
      )}
      <footer className={styles.footer}>
        <Link href="/apps#ai" onClick={onClose}>Connect your own AI</Link>
        <span>Replies aren&apos;t saved after refresh.</span>
      </footer>
    </aside>
  );
}
