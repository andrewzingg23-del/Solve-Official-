// The room's talking bot, client side. A conversation with the person's bot,
// right where they are. It only talks — anything real still goes through the
// Horizon and the kernel.
"use client";

import { useEffect, useRef, useState } from "react";

type TalkMessage = { role: "user" | "bot"; text: string };

const panel = "flex flex-col gap-3 rounded-xl border border-line bg-surface/55 p-4 backdrop-blur-md";
const heading = "text-[10px] font-semibold uppercase tracking-[0.22em] text-muted";

export function TalkPanel({ botName }: { botName: string }) {
  const [messages, setMessages] = useState<TalkMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, busy]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    setError(null);
    const next = [...messages, { role: "user" as const, text: message }];
    setMessages(next);
    setInput("");
    try {
      const res = await fetch("/api/bot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          botName,
          history: next.slice(-10).map((m) => ({
            role: m.role === "bot" ? "assistant" : "user",
            content: m.text,
          })),
        }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok || !data.reply) {
        setError(typeof data.error === "string" ? data.error : "The bot didn't answer.");
      } else {
        setMessages([...next, { role: "bot", text: data.reply }]);
      }
    } catch {
      setError("Couldn't reach the bot. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label={`Talk to ${botName}`} className={panel}>
      <h2 className={heading}>Talk · {botName}</h2>
      <div className="flex max-h-72 flex-col gap-2 overflow-y-auto" aria-live="polite">
        {messages.length === 0 ? (
          <p className="text-xs leading-5 text-muted">
            Say hello. {botName} talks here — for anything real, use what you want to make real.
          </p>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[92%] rounded-lg px-3 py-2 text-sm leading-6 ${
                m.role === "user"
                  ? "self-end bg-accent/15 text-foreground"
                  : "self-start border border-line bg-background/60"
              }`}
            >
              {m.role === "bot" ? (
                <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">{botName}</p>
              ) : null}
              <p className="whitespace-pre-wrap break-words">{m.text}</p>
            </div>
          ))
        )}
        {busy ? (
          <p className="self-start text-xs text-muted" aria-label="The bot is answering">
            {botName} is answering…
          </p>
        ) : null}
        <div ref={bottomRef} />
      </div>
      {error ? (
        <p role="alert" className="text-xs leading-5 text-negative">{error}</p>
      ) : null}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <label className="sr-only" htmlFor="room-talk">Talk to {botName}</label>
        <input
          id="room-talk"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={2000}
          autoComplete="off"
          placeholder={`Talk to ${botName}…`}
          className="h-10 min-w-0 flex-1 rounded-md border border-line bg-background/80 px-3 text-sm outline-none placeholder:text-muted/60 focus:border-accent"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="h-10 rounded-md border border-line px-4 text-[10px] font-semibold uppercase tracking-[0.2em] hover:border-accent hover:text-accent disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </section>
  );
}
