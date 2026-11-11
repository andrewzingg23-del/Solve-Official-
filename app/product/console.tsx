"use client";
// The console: one place to talk to your AI, on every screen.
//
// It lives in the product shell (app/product/shell.tsx), so it does not unmount
// when the person navigates — the thread survives moving around the app, which
// is the whole point: ask on one screen, keep talking on the next.
//
// This slice talks only. It carries where the person stands
// (lib/product/screen-context.ts) so "this" and "here" resolve, and it says
// plainly that it cannot act yet. Tools come next, and they go through the
// kernel's authority checks — never through this component.
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { screenFromPath } from "@/lib/product/screen-context";
import { CHAT_LIMITS } from "@/lib/bot/chat";
import { CHAT_PROVIDER_OPTIONS, type ChatProvider } from "@/lib/bot/provider-choice";

type Turn = { role: "user" | "assistant"; content: string; provider?: ChatProvider };

const HISTORY_SENT = CHAT_LIMITS.history;

export function Console({ botName }: { botName: string }) {
  const path = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [provider, setProvider] = useState<ChatProvider>("openrouter");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const screen = screenFromPath(path);

  // One shortcut, everywhere: ⌘K / Ctrl+K opens and focuses, Escape closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Keep the newest turn in view as the thread grows.
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [turns, busy]);

  const send = useCallback(async () => {
    const message = draft.trim();
    if (!message || busy) return;
    setDraft("");
    setError(null);
    setBusy(true);
    const selectedProvider = provider;
    const history = turns.slice(-HISTORY_SENT).map(({ role, content }) => ({ role, content }));
    setTurns((prev) => [...prev, { role: "user", content: message }]);
    try {
      const res = await fetch("/api/bot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, botName, history, screen, provider: selectedProvider }),
      });
      const data = (await res.json().catch(() => null)) as
        | { reply?: string; error?: string }
        | null;
      if (!res.ok || !data?.reply) {
        setError(data?.error || "That didn't go through. Try again.");
        return;
      }
      setTurns((prev) => [...prev, { role: "assistant", content: data.reply!, provider: selectedProvider }]);
    } catch {
      setError("That didn't go through. Try again.");
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }, [draft, busy, turns, botName, screen, provider]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  if (!open)
    return (
      <button
        type="button"
        className="solve-console-open"
        onClick={() => setOpen(true)}
        aria-label={`Talk to ${botName}`}
        aria-expanded={false}
        aria-controls="solve-console"
      >
        <span className="solve-console-open-name">{botName}</span>
        <kbd>⌘K</kbd>
      </button>
    );

  return (
    <aside
      id="solve-console"
      className="solve-console"
      aria-label={`Talk to ${botName}`}
    >
      <header className="solve-console-head">
        <div>
          <strong>{botName}</strong>
          {/* Shown, not hidden: the person should see exactly what it knows. */}
          <span className="solve-console-where" title={screen.path}>
            {screen.label}
          </span>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close console">
          ✕
        </button>
      </header>

      <div className="solve-console-provider-choice">
        <label htmlFor="solve-console-provider">AI engine</label>
        <select
          id="solve-console-provider"
          value={provider}
          onChange={(event) => setProvider(event.target.value === "openai" ? "openai" : "openrouter")}
          disabled={busy}
          aria-label="AI engine"
        >
          {CHAT_PROVIDER_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      </div>
      <div className="solve-console-log" ref={logRef} role="log" aria-live="polite">
        {turns.length === 0 && (
          <p className="solve-console-empty">
            Ask about what you&apos;re looking at. {botName} can see which screen you&apos;re
            on — not act on it yet.
          </p>
        )}
        {turns.map((turn, i) => (
          <p key={i} className={turn.role === "user" ? "solve-console-you" : "solve-console-them"}>
            {turn.role === "assistant" && turn.provider ? (
              <span className="solve-console-provider-label">{turn.provider === "openai" ? "OpenAI · GPT" : "Current AI"}</span>
            ) : null}
            {turn.content}
          </p>
        ))}
        {busy && <p className="solve-console-them solve-console-busy">…</p>}
        {error && <p className="solve-console-error" role="alert">{error}</p>}
      </div>

      <div className="solve-console-input">
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, CHAT_LIMITS.message))}
          onKeyDown={onKeyDown}
          rows={2}
          placeholder={`Tell ${botName} what you want here…`}
          aria-label="Your message"
          maxLength={CHAT_LIMITS.message}
        />
        <button type="button" onClick={() => void send()} disabled={busy || !draft.trim()}>
          {busy ? "…" : "Send"}
        </button>
      </div>
    </aside>
  );
}
