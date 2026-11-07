"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { RoomMessage, RoomSourceRef } from "@/lib/kernel/client";
import type { RoomTurnInput, RoomTurnResult } from "@/lib/world/room";
import { formatTeamMessage, parseTeamMessage, teamRecipient, TEAM_RECIPIENT_LABELS, type TeamRecipient } from "@/lib/world/team-messages";

function mergeMessages(saved: RoomMessage[], incoming: RoomMessage[]) {
  return [...new Map([...saved, ...incoming].map(m => [m.message_id, m])).values()].sort((a, b) => a.seq - b.seq);
}

function readableSourceRefs(value: unknown): RoomSourceRef[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is RoomSourceRef => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
    const ref = entry as Record<string, unknown>;
    return typeof ref.entityId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(ref.entityId) &&
      typeof ref.version === "number" && Number.isInteger(ref.version) && ref.version > 0 && ref.version <= 2147483647 &&
      typeof ref.title === "string" && ref.title.trim().length > 0;
  });
}

export function SharedConversation({ worldId, messages, beforeSeq, canWrite = false, currentActorId }: {
  worldId: string; messages: RoomMessage[]; beforeSeq: number | null; canWrite?: boolean; currentActorId?: string;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [recipient, setRecipient] = useState<TeamRecipient>("team");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [retry, setRetry] = useState<RoomTurnInput | null>(null);
  const [history, setHistory] = useState({ window: messages, messages });
  if (history.window !== messages) {
    setHistory({ window: messages, messages: mergeMessages(history.messages, messages) });
  }
  const [cursor, setCursor] = useState<number | null | undefined>(undefined);
  const request = useRef<{ signature: string; id: string } | null>(null);
  const list = useRef<HTMLOListElement>(null);
  const followLatest = useRef(true);
  const showEarlier = useRef(false);
  const all = history.messages;
  const nextCursor = cursor === undefined ? beforeSeq : cursor;
  useLayoutEffect(() => {
    if (!list.current) return;
    if (showEarlier.current) { list.current.scrollTop = 0; showEarlier.current = false; }
    else if (followLatest.current) list.current.scrollTop = list.current.scrollHeight;
  }, [all]);

  async function send(intent: RoomTurnInput["intent"], previous?: RoomTurnInput) {
    if (busy || !canWrite || (!previous && !text.trim())) return;
    const draft = text.trim();
    let turn = previous;
    if (!turn) {
      let outgoing: string;
      try {
        // An addressed send stays a normal authorized World message. Ask AI
        // still uses the existing in-app provider, NOT the addressed teammate.
        outgoing = intent === "message" ? formatTeamMessage(recipient, draft) : draft;
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Check your message and try again.");
        return;
      }
      const signature = JSON.stringify({ text: outgoing, intent });
      if (!request.current || request.current.signature !== signature) request.current = { signature, id: crypto.randomUUID() };
      turn = { worldId, text: outgoing, intent, requestId: request.current.id };
    }
    setBusy(true); setNotice("");
    try {
      const res = await fetch(`/api/worlds/${worldId}/conversation`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(turn) });
      const data = await res.json() as RoomTurnResult & { error?: string };
      if (!res.ok) throw new Error(data.error || "Your message could not be saved.");
      if (!previous) request.current = null;
      setText(v => v.trim() === draft ? "" : v);
      const retryable = ["failed", "unavailable", "pending"].includes(data.aiStatus);
      setRetry(retryable ? turn : null);
      setNotice(data.error || (data.aiStatus === "pending" ? "Your question is saved. An AI reply is in progress; refresh or retry shortly." : intent === "decision" ? "Your decision is recorded with your name." : "Saved to the room."));
      followLatest.current = true;
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not reach the room. Your text is still here.");
      setRetry(previous ?? null);
    } finally { setBusy(false); }
  }

  async function loadEarlier() {
    if (!nextCursor || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/worlds/${worldId}/conversation?beforeSeq=${nextCursor}`);
      const page = await res.json();
      if (!res.ok) throw new Error(page.error || "Could not read earlier conversation.");
      followLatest.current = false; showEarlier.current = true;
      setHistory(current => ({ ...current, messages: mergeMessages(current.messages, page.messages) })); setCursor(page.beforeSeq);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not read earlier conversation."); }
    finally { setBusy(false); }
  }

  return (
    <section aria-labelledby="shared-conversation-heading" className="mb-4 flex min-w-0 flex-col gap-4 rounded-xl border border-line bg-surface/75 p-4 md:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="shared-conversation-heading" className="text-base font-medium">Shared conversation</h2>
        <span className="text-xs text-muted">Saved in this World</span>
      </div>
      <div className="flex flex-wrap justify-between gap-2 text-xs text-accent">
        {nextCursor ? <button type="button" onClick={loadEarlier} disabled={busy} className="underline disabled:opacity-50">Load earlier messages</button> : null}
        {all.length ? <button type="button" onClick={() => { followLatest.current = true; if (list.current) list.current.scrollTop = list.current.scrollHeight; }} className="ml-auto underline">Jump to latest</button> : null}
      </div>
      <ol ref={list} aria-label="Room messages" onScroll={e => { const el = e.currentTarget; followLatest.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60; }} className="flex max-h-96 flex-col gap-3 overflow-y-auto overscroll-contain">
        {all.map(m => {
          const refs = readableSourceRefs(m.source_refs);
          const addressed = parseTeamMessage(m.text);
          return (
          <li key={m.message_id} className={`rounded-lg border p-3 ${m.kind === "decision" ? "border-positive/30 bg-positive/5" : m.kind === "ai_draft" ? "border-accent/25 bg-accent/5" : "border-line bg-background/40"}`}>
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-xs">
              <span className="font-medium">{m.kind === "ai_draft" ? `AI draft · requested by ${m.actor_label}` : `${m.actor_label}${m.actor_kind === "agent" ? " · AI agent" : ""}${m.kind === "decision" ? " · recorded decision" : ""}`}</span>
              {addressed.addressed ? <span className="text-accent">To {TEAM_RECIPIENT_LABELS[addressed.recipient]}</span> : null}
              <time dateTime={new Date(m.occurred_at).toISOString()} className="text-muted">{new Date(m.occurred_at).toLocaleString("en-US", { timeZone: "UTC", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" })}</time>
            </div>
            <p className="whitespace-pre-wrap break-words text-sm leading-6">{addressed.body}</p>
            {refs.length ? (
              <details className="mt-2 text-xs text-muted"><summary className="cursor-pointer">Shared sources used · {refs.length}</summary>
                <ul className="mt-2 space-y-1">{refs.map(s => <li key={s.entityId}><a href={`/world/${worldId}#piece-${s.entityId}`} className="text-accent underline">{s.title} · v{s.version}</a></li>)}</ul>
              </details>
            ) : null}
            {canWrite && m.actor_id === currentActorId && m.ask_ai && m.reply_state !== "complete" ? <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
              <span>{m.reply_state === "pending" ? "AI reply in progress." : "Question saved; AI reply unavailable."}</span>
              <button type="button" disabled={busy} onClick={() => void send("ask_ai", { worldId, requestId: m.request_id, text: m.text, intent: "ask_ai" })} className="text-accent underline disabled:opacity-50">Retry saved question</button>
            </div> : null}
          </li>
          );
        })}
      </ol>
      {!all.length ? <p className="text-sm leading-6 text-muted">Start with the idea, a question, or what you want to work out together.</p> : null}
      {canWrite ? (
        <form onSubmit={event => { event.preventDefault(); void send("message"); }} className="flex flex-col gap-3">
          <label htmlFor="room-message" className="text-xs text-muted">Message or question</label>
          <textarea id="room-message" value={text} onChange={e => setText(e.target.value)} rows={3} maxLength={7800} required disabled={busy} placeholder="What should we work on together?" className="min-w-0 resize-y rounded-md border border-line bg-background p-3 text-sm leading-6 outline-none focus:border-accent disabled:opacity-60" />
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="room-recipient" className="text-xs text-muted">Send to</label>
            <select id="room-recipient" value={recipient} onChange={event => setRecipient(teamRecipient(event.target.value) ?? "team")} disabled={busy} className="min-h-11 rounded-md border border-line bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
              <option value="team">Everyone in this room</option>
              <option value="claude">Claude</option>
              <option value="chatgpt">ChatGPT</option>
              <option value="muse">Muse</option>
            </select>
            <span className="text-xs text-muted">Shared with every member. Address only; no AI is automatically started.</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button disabled={busy || !text.trim()} className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50">{busy ? "Saving…" : "Send to room"}</button>
            <button type="button" disabled={busy || !text.trim()} onClick={() => void send("ask_ai")} className="rounded-md border border-accent/50 px-4 py-2 text-sm text-accent disabled:opacity-50">Ask AI</button>
            <button type="button" disabled={busy || !text.trim()} onClick={() => void send("decision")} className="rounded-md border border-line px-4 py-2 text-sm disabled:opacity-50">Record decision</button>
          </div>
          <p className="text-[11px] leading-5 text-muted">Send to room stores an addressed message in this World; the selected AI must be connected and authorized to read and respond. This does not start an agent or give it access. Ask AI separately uses the current in-app model through OpenRouter. Personal memory remains private. AI responses are drafts and only people can record their own decisions.</p>
        </form>
      ) : <p className="text-xs text-muted">You can view this room. Ask the owner for editor access to contribute.</p>}
      {notice ? <p role="status" className="text-xs leading-5 text-muted">{notice}</p> : null}
      {retry && canWrite ? <button type="button" disabled={busy} onClick={() => void send("ask_ai", retry)} className="self-start text-sm text-accent underline disabled:opacity-50">Retry AI for saved question</button> : null}
    </section>
  );
}
