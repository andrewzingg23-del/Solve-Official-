// The room's talking bot, client side. A conversation with the person's bot,
// right where they are. It only talks — anything real still goes through the
// Horizon and the kernel.
//
// Trust layer: every reply carries its cost in plain words; a way-plan
// renders as an action card, never just prose; and "Build this way" passes
// the panel gate and asks for the person's word before a real world is
// created. A human hatch sits under the panel, honest about whether anyone
// is on the other end.
"use client";

import { useEffect, useRef, useState } from "react";
import { ventureTitle, type RoutePlan } from "@/lib/world/wayfinder";
import { WayPlanCard } from "./way-plan-card";
import { CostMeter, type TalkUsage } from "./cost-meter";
import { ApprovalCard, worldBuildGate } from "./approval-card";
import { HumanHatch } from "./human-hatch";

type InMind = { id: string; label: string };

type TalkMessage = {
  role: "user" | "bot";
  text: string;
  usage?: TalkUsage | null;
  wayPlan?: RoutePlan | null;
  ask?: string; // the person's ask this reply's plan was drawn from
  inMind?: InMind[]; // the memories the avatar had in mind for this reply (one brain)
  model?: string; // which model answered, in plain words
  kept?: "keeping" | "kept" | "failed";
};

type Approval = { plan: RoutePlan; ask: string; reason: string };

const panel = "flex flex-col gap-3 rounded-xl border border-line bg-surface/55 p-4 backdrop-blur-md";
const heading = "text-[10px] font-semibold uppercase tracking-[0.22em] text-muted";

function readUsage(value: unknown): TalkUsage | null {
  if (!value || typeof value !== "object") return null;
  const u = value as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return {
    estimatedCostUsd: num(u.estimatedCostUsd),
    inputTokens: num(u.inputTokens),
    outputTokens: num(u.outputTokens),
    tokensSpentThisHour: num(u.tokensSpentThisHour),
  };
}

// The chat endpoint's contract is extended by sibling slices; read the new
// fields defensively so a missing or malformed wayPlan never breaks Talk.
function readPlan(value: unknown): RoutePlan | null {
  if (!value || typeof value !== "object") return null;
  const p = value as { milestones?: unknown };
  return Array.isArray(p.milestones) ? (value as RoutePlan) : null;
}

function readInMind(value: unknown): InMind[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is InMind => !!v && typeof v === "object" && typeof (v as InMind).id === "string" && typeof (v as InMind).label === "string")
    .slice(0, 12);
}

// Under a message: keep it in the avatar's memory, see what it had in mind, and which model spoke.
// Rows here never use self-start/self-end, which TalkCinema styles as bubbles.
function MessageMeta({ m, canKeep, onKeep }: { m: TalkMessage; canKeep: boolean; onKeep: () => void }) {
  const [open, setOpen] = useState(false);
  const mind = m.inMind ?? [];
  if (!canKeep && !mind.length && !m.model) return null;
  return (
    <div className={`flex w-full flex-col gap-1.5 ${m.role === "user" ? "items-end" : "items-start"}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-faint">
        {canKeep ? (
          <button
            type="button"
            onClick={onKeep}
            disabled={m.kept === "keeping" || m.kept === "kept"}
            className="inline-flex min-h-8 items-center rounded-full px-1 font-semibold uppercase tracking-[0.16em] transition-colors hover:text-accent disabled:hover:text-faint"
          >
            {m.kept === "kept" ? "Kept" : m.kept === "keeping" ? "Keeping…" : m.kept === "failed" ? "Not kept · retry" : "Keep"}
          </button>
        ) : null}
        {mind.length ? (
          <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="inline-flex min-h-8 items-center px-1 transition-colors hover:text-accent">
            {mind.length} {mind.length === 1 ? "memory" : "memories"} in mind
          </button>
        ) : null}
        {m.model ? <span>{m.model}</span> : null}
      </div>
      {open && mind.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {mind.map((x) => (
            <li key={x.id}>
              <a href={`#memory-${x.id}`} className="inline-flex min-h-8 items-center rounded-full border border-line px-2.5 text-[11px] text-muted transition-colors hover:border-accent hover:text-accent">
                {x.label}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function TalkPanel({ botName, canKeep = false }: { botName: string; canKeep?: boolean }) {
  const [messages, setMessages] = useState<TalkMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [building, setBuilding] = useState(false);
  const [approval, setApproval] = useState<Approval | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, busy, approval]);

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
        const wayPlan = readPlan((data as { wayPlan?: unknown }).wayPlan ?? null);
        setMessages([
          ...next,
          {
            role: "bot",
            text: data.reply,
            usage: readUsage((data as { usage?: unknown }).usage ?? null),
            wayPlan,
            ask: wayPlan ? message : undefined,
            inMind: readInMind((data as { inMind?: unknown }).inMind),
            model: (() => {
              const label = ((data as { usage?: { modelLabel?: unknown } }).usage ?? {}).modelLabel;
              return typeof label === "string" ? label.slice(0, 60) : undefined;
            })(),
          },
        ]);
      }
    } catch {
      setError("Couldn't reach the bot. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  // "Keep this": the line goes into the avatar's shared memory, with whose words they were.
  async function keep(index: number) {
    const m = messages[index];
    if (!m || m.kept === "keeping" || m.kept === "kept") return;
    const mark = (kept: TalkMessage["kept"]) => setMessages((all) => all.map((x, i) => (i === index ? { ...x, kept } : x)));
    mark("keeping");
    try {
      const res = await fetch("/api/bot/keep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: m.text, from: m.role === "bot" ? "bot" : "you", model: m.model }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(typeof data.error === "string" ? data.error : "That wasn't kept.");
        mark("failed");
        return;
      }
      mark("kept");
    } catch {
      setError("Couldn't reach the server. Nothing was kept.");
      mark("failed");
    }
  }

  // "Build this way" never acts directly: the panel gate is consulted, and an
  // approval-level action only shows the card. A deny closes it; anything the
  // gate forbids says why and stops.
  function requestBuild(plan: RoutePlan, ask: string) {
    const decision = worldBuildGate();
    if (decision.decision === "needs-approval") {
      setError(null);
      setApproval({ plan, ask, reason: decision.reason });
    } else if (decision.decision === "allow") {
      void approveBuild(ask);
    } else {
      setError(decision.reason);
    }
  }

  // The real path: a venture world is a world. The request goes to the
  // server route (never a server-action import — the client's import graph
  // stays server-only-free); the kernel creates it under the person's own
  // identity and the room opens on it. Guests get a 401 and an honest line —
  // a world lives on someone's record. Nothing is ever faked.
  async function approveBuild(ask: string) {
    setApproval(null);
    setBuilding(true);
    setError(null);
    try {
      const res = await fetch("/api/worlds/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: ventureTitle(ask).slice(0, 160), goal: ask.slice(0, 7000) }),
      });
      const data = (await res.json()) as { roomUrl?: string; error?: string };
      if (!res.ok || !data.roomUrl) {
        setError(typeof data.error === "string" ? data.error : "The world couldn't be created. Nothing was written — try again.");
        setBuilding(false);
        return;
      }
      window.location.href = data.roomUrl;
    } catch {
      setError("Couldn't reach the server. Nothing was written — try again.");
      setBuilding(false);
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
          messages.map((m, i) => {
            const plan = m.role === "bot" ? (m.wayPlan ?? null) : null;
            const ask = m.role === "bot" ? m.ask : undefined;
            return (
              <div key={i} className="flex flex-col gap-1.5">
                <div
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
                <MessageMeta m={m} canKeep={canKeep} onKeep={() => void keep(i)} />
                {m.role === "bot" && m.usage ? <CostMeter usage={m.usage} /> : null}
                {plan && ask ? (
                  <WayPlanCard plan={plan} onBuild={() => requestBuild(plan, ask)} />
                ) : null}
              </div>
            );
          })
        )}
        {approval ? (
          <ApprovalCard
            title={`Build this way — ${ventureTitle(approval.ask)}`}
            whatItDoes={[
              `Creates a world called "${ventureTitle(approval.ask)}".`,
              "Your ask becomes its goal, on your record.",
              "Opens the world's room so you can build the milestones out.",
            ]}
            cost={`About $${approval.plan.capitalUsd.toLocaleString("en-US")} in planner estimates — nothing is spent or moved.`}
            reason={approval.reason}
            note="Creating a world needs your sign-in — it lives on someone's record."
            onApprove={() => void approveBuild(approval.ask)}
            onDeny={() => setApproval(null)}
          />
        ) : null}
        {building ? (
          <p className="self-start text-xs text-muted">Building your world…</p>
        ) : null}
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
      <HumanHatch />
    </section>
  );
}
