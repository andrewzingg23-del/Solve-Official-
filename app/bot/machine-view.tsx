"use client";

// The machine under the character: the bot drawn as a living particle cloud, wired to everything it
// can reach (its owner, the assistants that speak through it, the Worlds it was let into, its sealed
// memory), with readouts of its access, reach, activity and record. Every node, line and number
// comes from real records (lib/bot/machine.ts); with nothing connected, the picture is small.
import { useEffect, useRef } from "react";
import type { MachineData } from "@/lib/bot/machine";
import type { Persona } from "@/lib/bot/persona";
import type { BotState } from "./character";

type Node = { key: string; label: string; detail: string; link: "owner" | "write" | "read" | "memory" };

const QUIET: BotState[] = ["unavailable", "sleeping"];
const short = (s: string, n = 14) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function reachNodes(machine: MachineData): Node[] {
  const nodes: Node[] = [{ key: "you", label: "You", detail: "owner", link: "owner" }];
  for (const a of machine.assistants.slice(0, 4)) nodes.push({ key: `a:${a.name}`, label: short(a.name), detail: a.mode === "remember" ? "read + add" : "read", link: a.mode === "remember" ? "write" : "read" });
  if (machine.assistants.length > 4) nodes.push({ key: "a:more", label: `+${machine.assistants.length - 4}`, detail: "assistants", link: "read" });
  for (const w of machine.worlds.slice(0, 5)) nodes.push({ key: `w:${w.title}`, label: short(w.title), detail: w.access === "add" ? "world · add" : "world · read", link: w.access === "add" ? "write" : "read" });
  if (machine.worlds.length > 5) nodes.push({ key: "w:more", label: `+${machine.worlds.length - 5}`, detail: "worlds", link: "read" });
  nodes.push({ key: "memory", label: "Memory", detail: `${machine.memories} sealed`, link: "memory" });
  return nodes;
}

function Cloud({ persona, state }: { persona: Persona; state: BotState }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const speed = (QUIET.includes(state) ? 0.25 : state === "working" || state === "thinking" ? 1.6 : 0.8) * (0.4 + persona.motion.energy / 100);
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const gauss = () => (rand() + rand() + rand() - 1.5) / 1.5;
    const points = Array.from({ length: 170 }, () => ({ r: Math.abs(gauss()) * 0.2, a: rand() * Math.PI * 2, w: (rand() - 0.5) * 0.012, z: rand(), c: rand() < 0.65 ? persona.palette.glow : persona.palette.primary }));
    let frame = 0;
    let raf = 0;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const size = Math.min(w, h);
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const pos = points.map((p) => {
        if (!still) p.a += p.w * speed;
        const breathe = 1 + Math.sin(frame * 0.02 * speed + p.z * 6) * 0.05;
        return { x: cx + Math.cos(p.a) * p.r * size * breathe, y: cy + Math.sin(p.a) * p.r * size * 0.85 * breathe, p };
      });
      ctx.lineWidth = 0.5;
      for (let i = 0; i < pos.length; i++) {
        for (let j = i + 1; j < pos.length; j += 3) {
          const dx = pos[i].x - pos[j].x;
          const dy = pos[i].y - pos[j].y;
          const d = dx * dx + dy * dy;
          const reach = (size * 0.07) ** 2;
          if (d < reach) {
            ctx.strokeStyle = `${pos[i].p.c}${Math.round((1 - d / reach) * 70).toString(16).padStart(2, "0")}`;
            ctx.beginPath();
            ctx.moveTo(pos[i].x, pos[i].y);
            ctx.lineTo(pos[j].x, pos[j].y);
            ctx.stroke();
          }
        }
      }
      for (const { x, y, p } of pos) {
        ctx.fillStyle = `${p.c}${Math.round(110 + p.z * 145).toString(16).padStart(2, "0")}`;
        ctx.beginPath();
        ctx.arc(x, y, 0.6 + p.z * 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
      frame++;
      if (!still) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [persona.palette.glow, persona.palette.primary, persona.motion.energy, state]);
  return <canvas ref={ref} aria-hidden className="absolute inset-0 h-full w-full" />;
}

export function MachineView({ persona, state, machine, size }: { persona: Persona; state: BotState; machine: MachineData; size: number }) {
  const nodes = reachNodes(machine);
  const at = (i: number) => {
    const angle = -Math.PI / 2 + (i / nodes.length) * Math.PI * 2;
    return { angle, x: 100 + Math.cos(angle) * 74, y: 100 + Math.sin(angle) * 70 };
  };
  const live = !QUIET.includes(state);
  return (
    <div className="relative aspect-[13/10] w-full" style={{ maxWidth: size * 1.66 }} role="img" aria-label={`${persona.name}'s reach: ${nodes.map((n) => `${n.label} (${n.detail})`).join(", ")}`}>
      <style>{`
        .sovmach-flow{stroke-dasharray:2 4;animation:sovmach-flow 1.4s linear infinite}
        @keyframes sovmach-flow{to{stroke-dashoffset:-12}}
        @media (prefers-reduced-motion: reduce){.sovmach-flow{animation:none}}
      `}</style>
      <Cloud persona={persona} state={state} />
      {/* 30 units of margin on each side keep long labels inside the stage. */}
      <svg viewBox="-30 0 260 200" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
        {nodes.map((n, i) => {
          const { x, y } = at(i);
          const stroke = n.link === "memory" ? persona.palette.glow : n.link === "read" ? "var(--muted)" : "var(--accent)";
          return (
            <line
              key={`l-${n.key}`}
              x1={100}
              y1={100}
              x2={x}
              y2={y}
              stroke={stroke}
              strokeOpacity={n.link === "read" ? 0.35 : 0.7}
              strokeWidth={n.link === "owner" ? 0.9 : 0.6}
              strokeDasharray={n.link === "read" ? "1 3" : undefined}
              className={live && n.link === "write" ? "sovmach-flow" : undefined}
            />
          );
        })}
        {nodes.map((n, i) => {
          const { angle, x, y } = at(i);
          const right = Math.cos(angle) > 0.2;
          const left = Math.cos(angle) < -0.2;
          const anchor = right ? "start" : left ? "end" : "middle";
          const dx = right ? 6 : left ? -6 : 0;
          const dy = !right && !left ? (Math.sin(angle) < 0 ? -8 : 11) : 1;
          return (
            <g key={`n-${n.key}`}>
              <rect x={x - 2.6} y={y - 2.6} width={5.2} height={5.2} fill="#03060b" stroke={n.link === "read" ? "var(--muted)" : "var(--accent)"} strokeWidth={0.7} transform={`rotate(45 ${x} ${y})`} />
              <text x={x + dx} y={y + dy} textAnchor={anchor} fontSize={5.4} letterSpacing={0.9} fill="var(--foreground)" style={{ textTransform: "uppercase" }}>
                {n.label}
              </text>
              <text x={x + dx} y={y + dy + 6} textAnchor={anchor} fontSize={4.2} letterSpacing={0.6} fill="var(--muted)" style={{ textTransform: "uppercase" }}>
                {n.detail}
              </text>
            </g>
          );
        })}
        <circle cx={100} cy={100} r={3} fill={persona.palette.glow} />
        <text x={100} y={128} textAnchor="middle" fontSize={5.6} letterSpacing={1.6} fill="var(--foreground)" style={{ textTransform: "uppercase" }}>{short(persona.name, 18)}</text>
      </svg>
    </div>
  );
}

export function MachineReadouts({ machine }: { machine: MachineData }) {
  const adds = machine.assistants.some((a) => a.mode === "remember");
  const addWorlds = machine.worlds.filter((w) => w.access === "add").length;
  const readWorlds = machine.worlds.length - addWorlds;
  const peak = Math.max(1, ...machine.activity);
  const recent = machine.activity.reduce((n, v) => n + v, 0);
  const cell = "flex min-w-0 flex-col gap-2 bg-[#03060b] p-3";
  const head = "text-[10px] uppercase tracking-[0.24em] text-muted";
  return (
    <div className="mt-1 grid w-full max-w-md grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line text-[11px]">
      <div className={cell}>
        <span className={head}>Access ledger</span>
        {machine.assistants.length === 0 ? (
          <span className="text-muted">No assistant connected</span>
        ) : (
          machine.assistants.slice(0, 4).map((a) => (
            <span key={a.name} className="grid grid-cols-[minmax(0,1fr)_3rem] items-center gap-2">
              <span className="truncate">{a.name}</span>
              <span className="h-1 rounded-full bg-line">
                <span className="block h-1 rounded-full bg-accent" style={{ width: a.mode === "remember" ? "100%" : "40%" }} />
              </span>
            </span>
          ))
        )}
      </div>
      <div className={cell}>
        <span className={head}>Blast radius</span>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
          <dt className="text-muted">Memory</dt>
          <dd className="text-right">{adds ? "add" : "read"}</dd>
          <dt className="text-muted">Worlds</dt>
          <dd className="text-right tabular-nums">{addWorlds} add · {readWorlds} read</dd>
          <dt className="text-muted">Money</dt>
          <dd className="text-right text-positive">none</dd>
          <dt className="text-muted">Access</dt>
          <dd className="text-right text-positive">none</dd>
        </dl>
      </div>
      <div className={cell}>
        <span className={head}>Activity · 14 days</span>
        <svg viewBox={`0 0 ${machine.activity.length * 6} 24`} className="h-6 w-full" preserveAspectRatio="none" aria-hidden>
          {machine.activity.map((v, i) => (
            <rect key={i} x={i * 6 + 1} y={24 - (v / peak) * 22 - 1} width={4} height={(v / peak) * 22 + 1} fill={v ? "var(--accent)" : "var(--line)"} />
          ))}
        </svg>
        <span className="tabular-nums text-muted">{recent} {recent === 1 ? "memory" : "memories"} added</span>
      </div>
      <div className={cell}>
        <span className={head}>Audit</span>
        <span className="text-lg font-medium tabular-nums leading-none">{machine.records}</span>
        <span className="text-muted">records on the kernel. Nothing it does goes unrecorded.</span>
      </div>
    </div>
  );
}
