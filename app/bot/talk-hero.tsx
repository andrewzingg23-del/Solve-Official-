"use client";

// The Talk hero: the bot as the living center, its reach and its record orbiting it as glass
// cards, the conversation flowing beneath. Every card binds real records (EMPTY_MACHINE renders
// the honest "nothing yet" picture for guests) — nothing is mocked, and Talk's own honest
// states (its 503, its cost meter, its approval gate) stay untouched below.
import type { MachineData } from "@/lib/bot/machine";
import type { Persona } from "@/lib/bot/persona";
import type { Pulse } from "@/lib/bot/pulse";
import { eyebrowAccent, glassCard, statNumber } from "@/app/ui";
import { BotCharacter, STATE_LABELS, type BotState } from "./character";
import { MachineView } from "./machine-view";

const HERO_CSS = `
.talk-orbit{animation:talk-orbit 72s linear infinite;transform-origin:center;transform-box:fill-box}
.talk-orbit-rev{animation:talk-orbit-rev 110s linear infinite;transform-origin:center;transform-box:fill-box}
@keyframes talk-orbit{to{transform:rotate(360deg)}}
@keyframes talk-orbit-rev{to{transform:rotate(-360deg)}}
@media (prefers-reduced-motion:reduce){.talk-orbit,.talk-orbit-rev{animation:none}}
`;

const num = (n: number) => n.toLocaleString("en-US");

function OrbitRings() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
      <svg viewBox="0 0 600 600" className="h-[560px] w-[560px] max-w-[130vw] opacity-60" fill="none">
        <circle className="talk-orbit" cx={300} cy={300} r={238} stroke="var(--accent)" strokeOpacity={0.22} strokeWidth={1} strokeDasharray="3 10" />
        <circle className="talk-orbit-rev" cx={300} cy={300} r={182} stroke="var(--foreground)" strokeOpacity={0.14} strokeWidth={1} strokeDasharray="2 14" />
        <circle cx={300} cy={300} r={124} stroke="var(--accent)" strokeOpacity={0.12} strokeWidth={1} />
        <circle className="talk-orbit" cx={300} cy={62} r={4} fill="var(--accent)" fillOpacity={0.7} stroke="none" />
        <circle className="talk-orbit-rev" cx={482} cy={300} r={3} fill="var(--foreground)" fillOpacity={0.5} stroke="none" />
      </svg>
      <div className="absolute left-1/2 top-[38%] h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/[0.07] blur-3xl" />
    </div>
  );
}

function ReachCard({ persona, state, machine }: { persona: Persona; state: BotState; machine: MachineData }) {
  const addWorlds = machine.worlds.filter((w) => w.access === "add").length;
  const readWorlds = machine.worlds.length - addWorlds;
  const mem = machine.assistants.some((a) => a.mode === "remember") ? "adds" : "reads";
  return (
    <aside aria-label="What it can touch" className={`${glassCard} min-w-0`}>
      <p className="eyebrow">What it can touch</p>
      <div className="mx-auto mt-3 max-w-[240px]">
        <MachineView persona={persona} state={state} machine={machine} size={140} />
      </div>
      <p className="mt-2 text-xs leading-5 text-muted tabular-nums">
        {machine.assistants.length} {machine.assistants.length === 1 ? "assistant" : "assistants"} · {addWorlds} add / {readWorlds} read worlds
      </p>
      <p className="text-xs leading-5 text-muted">Memory: {mem}. Money and access: none.</p>
    </aside>
  );
}

function RecordCard({ machine }: { machine: MachineData }) {
  const peak = Math.max(1, ...machine.activity);
  const days = ACTIVITY_DAYS;
  return (
    <aside aria-label="On the record" className={`${glassCard} min-w-0`}>
      <p className="eyebrow">On the record</p>
      <p className={`${statNumber} mt-3 tabular-nums`}>{num(machine.records)}</p>
      <p className="text-xs leading-5 text-muted">kernel records. Everything it does is kept.</p>
      <div className="mt-4">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-faint">Last {days} days</p>
        <svg viewBox={`0 0 ${machine.activity.length * 6} 22`} className="h-6 w-full" preserveAspectRatio="none" aria-hidden>
          {machine.activity.map((v, i) => (
            <rect
              key={i}
              x={i * 6 + 1}
              y={22 - (v / peak) * 20 - 1}
              width={4}
              height={(v / peak) * 20 + 1}
              rx={1}
              fill={v ? "#22d3ee" : "var(--line)"}
              opacity={v ? 0.75 : 1}
            />
          ))}
        </svg>
        <p className="mt-1.5 text-xs leading-5 text-muted tabular-nums">
          {num(machine.memories)} {machine.memories === 1 ? "memory" : "memories"} kept
        </p>
      </div>
    </aside>
  );
}

const ACTIVITY_DAYS = 14;

export function TalkHero({
  persona,
  name,
  state,
  machine,
  pulse,
}: {
  persona: Persona;
  name: string;
  state: BotState;
  machine: MachineData;
  pulse: Pulse | null;
}) {
  const latest = pulse?.latest;
  return (
    <section aria-label={`${name} — talk`} className="glass relative isolate overflow-hidden px-5 pb-9 pt-7 md:px-10 md:pb-12 md:pt-9">
      <style>{HERO_CSS}</style>
      <OrbitRings />
      <p className={`${eyebrowAccent} relative text-center`}>Talk</p>
      <div className="relative mt-2 grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr] lg:gap-10">
        <div className="order-last lg:order-none">
          <ReachCard persona={persona} state={state} machine={machine} />
        </div>
        <div className="flex min-w-0 flex-col items-center text-center">
          <BotCharacter persona={persona} state={state} size={216} className="h-auto w-44 md:w-52" />
          <h1 className="mt-2 text-xl font-semibold tracking-tight">{name}</h1>
          <p className="mt-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
            {STATE_LABELS[state]}
          </p>
          <p className="mt-3 max-w-sm text-sm leading-6 text-muted" aria-live="polite">
            {pulse ? pulse.line : `Ask ${name === "Your bot" ? "your bot" : name} anything — every reply shows its cost, and anything real waits for your word.`}
          </p>
          {latest ? (
            <p className="mt-1.5 text-xs text-faint tabular-nums">
              {latest.what} · {latest.at}
            </p>
          ) : null}
        </div>
        <div className="order-last">
          <RecordCard machine={machine} />
        </div>
      </div>
    </section>
  );
}
