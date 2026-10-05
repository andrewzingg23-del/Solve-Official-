"use client";

// What the bot can reach, drawn plainly: the bot at the center, with lines to its owner, the
// assistants that speak through it, the Worlds it was let into and its sealed memory, and four
// readouts below. Every node, line and number comes from real records (lib/bot/machine.ts); with
// nothing connected, the picture is small.
import type { MachineData } from "@/lib/bot/machine";
import type { Persona } from "@/lib/bot/persona";
import { BotCharacter, type BotState } from "./character";

type Node = { key: string; label: string; detail: string; link: "owner" | "write" | "read" | "memory" };

const short = (s: string, n = 14) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function reachNodes(machine: MachineData): Node[] {
  const nodes: Node[] = [{ key: "you", label: "You", detail: "owner", link: "owner" }];
  for (const a of machine.assistants.slice(0, 4)) nodes.push({ key: `a:${a.name}`, label: short(a.name), detail: a.mode === "remember" ? "reads and adds" : "reads", link: a.mode === "remember" ? "write" : "read" });
  if (machine.assistants.length > 4) nodes.push({ key: "a:more", label: `+${machine.assistants.length - 4}`, detail: "assistants", link: "read" });
  for (const w of machine.worlds.slice(0, 5)) nodes.push({ key: `w:${w.title}`, label: short(w.title), detail: w.access === "add" ? "World, adds" : "World, reads", link: w.access === "add" ? "write" : "read" });
  if (machine.worlds.length > 5) nodes.push({ key: "w:more", label: `+${machine.worlds.length - 5}`, detail: "Worlds", link: "read" });
  nodes.push({ key: "memory", label: "Memory", detail: `${machine.memories} sealed`, link: "memory" });
  return nodes;
}

export function MachineView({ persona, state, machine, size }: { persona: Persona; state: BotState; machine: MachineData; size: number }) {
  const nodes = reachNodes(machine);
  const at = (i: number) => {
    const angle = -Math.PI / 2 + (i / nodes.length) * Math.PI * 2;
    return { angle, x: 100 + Math.cos(angle) * 74, y: 100 + Math.sin(angle) * 70 };
  };
  return (
    <div className="relative aspect-[13/10] w-full" style={{ maxWidth: size * 1.66 }} role="img" aria-label={`${persona.name}'s reach: ${nodes.map((n) => `${n.label} (${n.detail})`).join(", ")}`}>
      {/* 30 units of margin on each side keep long labels inside the stage. */}
      <svg viewBox="-30 0 260 200" className="absolute inset-0 h-full w-full" aria-hidden>
        {nodes.map((n, i) => {
          const { x, y } = at(i);
          return (
            <line
              key={`l-${n.key}`}
              x1={100}
              y1={100}
              x2={x}
              y2={y}
              stroke={n.link === "write" || n.link === "owner" ? "var(--accent)" : "var(--foreground)"}
              strokeOpacity={n.link === "read" ? 0.22 : n.link === "memory" ? 0.35 : 0.55}
              strokeWidth={0.6}
              strokeDasharray={n.link === "read" ? "2 3" : undefined}
            />
          );
        })}
        {nodes.map((n, i) => {
          const { angle, x, y } = at(i);
          const right = Math.cos(angle) > 0.2;
          const left = Math.cos(angle) < -0.2;
          const anchor = right ? "start" : left ? "end" : "middle";
          const dx = right ? 6 : left ? -6 : 0;
          const top = !right && !left && Math.sin(angle) < 0;
          const dy = !right && !left ? (top ? -12 : 10) : 1;
          return (
            <g key={`n-${n.key}`}>
              <circle cx={x} cy={y} r={2.4} fill="#05080e" stroke={n.link === "read" ? "var(--muted)" : "var(--foreground)"} strokeWidth={0.7} />
              <text x={x + dx} y={y + dy} textAnchor={anchor} fontSize={6} fill="var(--foreground)">
                {n.label}
              </text>
              <text x={x + dx} y={y + dy + 6.5} textAnchor={anchor} fontSize={4.6} fill="var(--muted)">
                {n.detail}
              </text>
            </g>
          );
        })}
      </svg>
      {/* The bot itself, small, at the center of what it can reach. */}
      <div className="absolute left-1/2 top-1/2 w-[17%] -translate-x-1/2 -translate-y-1/2">
        <BotCharacter persona={{ ...persona, aura: "none" }} state={state} size={64} className="h-auto w-full" />
      </div>
    </div>
  );
}

export function MachineReadouts({ machine }: { machine: MachineData }) {
  const adds = machine.assistants.some((a) => a.mode === "remember");
  const addWorlds = machine.worlds.filter((w) => w.access === "add").length;
  const readWorlds = machine.worlds.length - addWorlds;
  const peak = Math.max(1, ...machine.activity);
  const recent = machine.activity.reduce((n, v) => n + v, 0);
  const cell = "flex min-w-0 flex-col gap-2 py-3";
  const head = "text-[11px] uppercase tracking-[0.2em] text-muted";
  return (
    <div className="mt-2 grid w-full grid-cols-2 gap-x-6 border-t border-line text-xs">
      <div className={cell}>
        <span className={head}>Assistants</span>
        {machine.assistants.length === 0 ? (
          <span className="text-muted">No assistant connected</span>
        ) : (
          machine.assistants.slice(0, 4).map((a) => (
            <span key={a.name} className="flex justify-between gap-2">
              <span className="truncate">{a.name}</span>
              <span className="shrink-0 text-muted">{a.mode === "remember" ? "adds" : "reads"}</span>
            </span>
          ))
        )}
      </div>
      <div className={cell}>
        <span className={head}>What it can touch</span>
        <span>Memory: {adds ? "adds" : "reads"}</span>
        <span className="tabular-nums">Worlds: {addWorlds} add · {readWorlds} read</span>
        <span className="text-muted">Money and access: none</span>
      </div>
      <div className={cell}>
        <span className={head}>Last 14 days</span>
        <svg viewBox={`0 0 ${machine.activity.length * 6} 20`} className="h-5 w-full" preserveAspectRatio="none" aria-hidden>
          {machine.activity.map((v, i) => (
            <rect key={i} x={i * 6 + 1} y={20 - (v / peak) * 18 - 1} width={4} height={(v / peak) * 18 + 1} fill={v ? "var(--foreground)" : "var(--line)"} opacity={v ? 0.7 : 1} />
          ))}
        </svg>
        <span className="tabular-nums text-muted">{recent} {recent === 1 ? "memory" : "memories"} added</span>
      </div>
      <div className={cell}>
        <span className={head}>On the record</span>
        <span className="text-lg font-medium tabular-nums leading-none">{machine.records}</span>
        <span className="text-muted">kernel records. Everything it does is kept.</span>
      </div>
    </div>
  );
}
