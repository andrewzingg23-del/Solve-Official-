"use client";

// The working piece on each venture door. Live as the visitor types; every number is from their own
// inputs (lib/ventures/tools.ts). Nothing here is stored or sent.
import Link from "next/link";
import { useMemo, useState } from "react";
import { breakEven, positionSize } from "@/lib/ventures/tools";
import { accent, field, label, line, muted, panel, primary } from "./venture-style";

const usd = (v: number, digits = 0) => v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits });

function NumberField({ name, value, set, prefix, suffix, step = 1 }: { name: string; value: number; set: (v: number) => void; prefix?: string; suffix?: string; step?: number }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{name}</span>
      <span className="relative flex items-center">
        {prefix ? <span className={`pointer-events-none absolute left-3 text-sm ${muted}`}>{prefix}</span> : null}
        <input type="number" inputMode="decimal" min={0} step={step} value={Number.isFinite(value) ? value : 0}
          onChange={(e) => set(Number(e.target.value))} className={`${field} font-mono tabular-nums ${prefix ? "pl-7" : ""} ${suffix ? "pr-10" : ""}`} />
        {suffix ? <span className={`pointer-events-none absolute right-3 text-sm ${muted}`}>{suffix}</span> : null}
      </span>
    </label>
  );
}

function Result({ big, caption, rows }: { big: string; caption: string; rows: [string, string][] }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        {/* The number is the living object: it glows faintly as it recalculates. */}
        <span
          className="font-mono text-5xl font-semibold tabular-nums transition-all duration-300 md:text-6xl"
          style={{ textShadow: "0 0 32px rgb(34 211 238 / 0.22)" }}
        >
          {big}
        </span>
        <span className={`text-sm ${muted}`}>{caption}</span>
      </div>
      <dl className="flex flex-col">
        {rows.map(([k, v]) => (
          <div key={k} className={`flex items-baseline justify-between gap-4 border-t ${line} py-2.5`}>
            <dt className={`text-sm ${muted}`}>{k}</dt>
            <dd className="font-mono tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Tool({ title, inputs, result, note }: { title: string; inputs: React.ReactNode; result: React.ReactNode; note: string }) {
  return (
    <div className={`${panel} relative grid gap-8 overflow-hidden p-6 md:grid-cols-2 md:p-8`}>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
      <div className="flex flex-col gap-4">
        <p className={label}>{title}</p>
        {inputs}
      </div>
      <div className="flex flex-col justify-between gap-6">
        {result}
        <p className={`text-xs leading-5 ${muted}`}>{note}</p>
      </div>
    </div>
  );
}

export function PositionSizer() {
  const [v, setV] = useState({ account: 25000, riskPct: 1, entry: 50, stop: 48 });
  const set = (k: keyof typeof v) => (x: number) => setV({ ...v, [k]: x });
  const p = useMemo(() => positionSize(v), [v]);
  return (
    <Tool title="Risk first"
      inputs={<div className="grid grid-cols-2 gap-3">
        <NumberField name="Account size" value={v.account} set={set("account")} prefix="$" step={500} />
        <NumberField name="Risk per trade" value={v.riskPct} set={set("riskPct")} suffix="%" step={0.25} />
        <NumberField name="Entry price" value={v.entry} set={set("entry")} prefix="$" step={0.01} />
        <NumberField name="Stop price" value={v.stop} set={set("stop")} prefix="$" step={0.01} />
      </div>}
      result={<Result big={`${p.shares.toLocaleString("en-US")} shares`} caption={`${p.direction} · lose ${usd(p.risk, 2)} if the stop is hit`}
        rows={[["Risk per share", usd(p.perShare, 2)], ["Position value", usd(p.value)], ["Of your account", `${Math.round(p.ofAccount * 100)}%`]]} />}
      note="Practice math, not advice: size every trade by what you can lose, before what you hope to make. Slippage and gaps can lose more than the stop." />
  );
}

export function BreakEvenTool() {
  const [v, setV] = useState({ orderValue: 120, marginPct: 40, targetPct: 15 });
  const set = (k: keyof typeof v) => (x: number) => setV({ ...v, [k]: x });
  const b = useMemo(() => breakEven(v), [v]);
  return (
    <Tool title="Before you spend a dollar"
      inputs={<div className="grid grid-cols-2 gap-3">
        <NumberField name="Average order" value={v.orderValue} set={set("orderValue")} prefix="$" />
        <NumberField name="Gross margin" value={v.marginPct} set={set("marginPct")} suffix="%" />
        <NumberField name="Profit you want" value={v.targetPct} set={set("targetPct")} suffix="%" />
      </div>}
      result={<Result big={b.roas ? `${b.roas.toFixed(2)}×` : "—"} caption="return on ad spend to break even"
        rows={[["Most you can pay per sale", usd(b.maxCpa, 2)], ["Return for your target", b.targetRoas ? `${b.targetRoas.toFixed(2)}×` : "out of reach"], ["Cost per sale for your target", usd(b.targetCpa, 2)]]} />}
      note="Break-even return is one over your margin. Below it, every sale loses money; above it, the desk scales." />
  );
}

const OATH = [
  "I keep my word, especially when it costs me.",
  "I build before I speak.",
  "I protect my family, my brothers and my name.",
  "I earn my rank. I never buy it.",
  "I vouch only for men I would trust with my own.",
];

export function Oath() {
  const [held, setHeld] = useState<boolean[]>(OATH.map(() => false));
  const heldCount = held.filter(Boolean).length;
  const all = heldCount === OATH.length;
  return (
    <div className={`${panel} relative flex flex-col gap-6 overflow-hidden p-6 md:p-8`}>
      {/* The beam fills as each line is held. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
      <div className="flex items-center justify-between gap-4">
        <p className={label}>The oath</p>
        <div className="flex items-center gap-2" aria-hidden>
          {OATH.map((_, i) => (
            <span
              key={i}
              className={`h-1 w-8 rounded-full transition-all duration-500 ease-calm ${held[i] ? "bg-accent shadow-[0_0_12px_rgb(34_211_238/0.7)]" : "bg-line"}`}
            />
          ))}
        </div>
      </div>
      <ol className="flex flex-col">
        {OATH.map((line_, i) => (
          <li key={i} className={`border-t ${line}`}>
            <label className="group flex cursor-pointer items-start gap-4 py-4">
              <input
                type="checkbox"
                checked={held[i]}
                onChange={() => setHeld(held.map((h, j) => (j === i ? !h : h)))}
                className="mt-2 accent-[var(--accent)]"
              />
              <span
                className={`text-xl font-medium leading-8 transition-all duration-300 ease-calm group-hover:translate-x-0.5 md:text-2xl ${
                  held[i] ? "text-accent" : muted
                }`}
              >
                {line_}
              </span>
            </label>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-4">
        {all ? (
          <>
            <Link href="/start" className={primary}>Apply for a seat</Link>
            <span className={`text-sm ${accent}`}>You hold the oath. Applying starts with your SOV ID.</span>
          </>
        ) : (
          <span className={`text-sm ${muted}`}>Hold every line to apply ({heldCount} of {OATH.length}). Then a member vouches for you.</span>
        )}
      </div>
    </div>
  );
}
