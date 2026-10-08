"use client";

// The agent's dialer, in Practice: a queue of leads, the call, the script with the family's
// number worked out live, and the outcome buttons that schedule every next step by the rules in
// lib/insurance/dialer.ts. Nothing is dialed, texted or sent from this page.
// Leads come from the connected CRM (GoHighLevel). No sample data — an empty queue is honest.
import { useEffect, useMemo, useState } from "react";
import { callableNow, DISPOSITIONS, inCallingHours, nextSteps, type Action, type Disposition } from "@/lib/insurance/dialer";
import { coverageNeed } from "@/lib/ventures/tools";
import { accent, field, label, line, muted, panel, primary } from "../venture-style";

type Lead = { id: string; name: string; city: string; timeZone: string; zone: string; source: string; want: string; phoneEnd: string; textConsent: boolean; attempts: number; last: Disposition | null; nextCall?: string | null };

const SAMPLE: Lead[] = [];

const SCRIPT = {
  open: "Hi {first}, this is {agent} with Family First Life. You asked about {want}; I'm calling to make sure your family is covered the way you want. Is now a good minute?",
  discover: "Walk me through it: who depends on you, what's left on the house, any debts, and how many years you'd want your income replaced.",
  close: "Based on that, your family's number is {need}. Let's see what that costs you a month, and I'll get the application started today.",
};

const usd = (v: number) => v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const when = (iso: string, tz: string) => new Date(iso).toLocaleString("en-US", { timeZone: tz, weekday: "short", hour: "numeric", minute: "2-digit" });
const DONE: Disposition[] = ["sold", "not_interested", "do_not_call"];
const tries = (n: number) => `${n} ${n === 1 ? "try" : "tries"}`;
// Ready to dial: never called, or its next scheduled call is due. Done leads and leads waiting on a
// scheduled call aren't.
const isDone = (l: Lead) => Boolean(l.last && DONE.includes(l.last));
const isReady = (l: Lead, now: Date) => !isDone(l) && (!l.last || (l.nextCall != null && l.nextCall <= now.toISOString())) && callableNow(l.timeZone, now);
const KIND: Record<Action["kind"], string> = { call: "Call", text: "Text", email: "Email", task: "Task", stop: "Stop" };

export function Dialer() {
  const [leads, setLeads] = useState<Lead[]>(SAMPLE);
  const [current, setCurrent] = useState("1");
  const [practiceClock, setPracticeClock] = useState<Date | null>(null);
  const [tick, setTick] = useState(() => Date.now());
  const [onCall, setOnCall] = useState<number | null>(null);
  const [tab, setTab] = useState<keyof typeof SCRIPT>("open");
  const [need, setNeed] = useState({ income: 60000, years: 10, mortgage: 220000, debts: 15000 });
  const [scheduled, setScheduled] = useState<(Action & { who: string; tz: string })[]>([]);
  const [power, setPower] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const now = practiceClock ? new Date(practiceClock.getTime() + (tick % 1000)) : new Date(tick);
  const number = useMemo(() => coverageNeed({ income: 60000, years: 10, mortgage: 220000, debts: 15000, education: 0, existing: 0 }).need, []);

  // Honest empty state: no fake leads. The queue fills from the connected CRM.
  if (leads.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-line bg-surface p-8 text-center">
          <p className="eyebrow">Dialer</p>
          <h2 className="mt-2 text-xl font-medium tracking-tight">No leads yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">
            Connect your lead source (GoHighLevel) and your real queue shows up here. Nothing fake, nothing sample.
          </p>
        </div>
      </div>
    );
  }

  const lead = leads.find((l) => l.id === current) ?? leads[0];
  const open = leads.filter((l) => !isDone(l));
  const anyCallable = open.some((l) => callableNow(l.timeZone, now));
  const callable = callableNow(lead.timeZone, now);
  const first = lead.name.split(" ")[0];

  function dispose(d: Disposition) {
    const steps = nextSteps(d, { attempts: lead.attempts, timeZone: lead.timeZone, textConsent: lead.textConsent }, now);
    setScheduled((s) => [...s.filter((a) => a.who !== lead.name || d !== "do_not_call"), ...steps.map((a) => ({ ...a, who: lead.name, tz: lead.timeZone }))].sort((a, b) => a.at.localeCompare(b.at)));
    const nextCall = steps.find((a) => a.kind === "call")?.at ?? null;
    setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, attempts: l.attempts + 1, last: d, nextCall } : l)));
    setOnCall(null);
    setTab("open");
    if (power) {
      const next = leads.find((l) => l.id !== lead.id && isReady(l, now));
      if (next) setCurrent(next.id);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className={`inline-flex items-center gap-2 text-xs ${muted}`}>
          <span aria-hidden className="h-2.5 w-2.5 rounded-full border border-dashed border-current" />
          <span><span className="font-semibold uppercase tracking-[0.2em]">Practice</span> · nothing is dialed, texted or sent</span>
        </span>
        <div className="flex items-center gap-4 text-xs">
          <label className="flex items-center gap-2"><input type="checkbox" checked={power} onChange={() => setPower(!power)} className="accent-[var(--accent)]" /> Power dial</label>
          {!anyCallable && !practiceClock ? (
            <button type="button" onClick={() => setPracticeClock(inCallingHours("America/New_York", new Date(new Date().setUTCHours(18, 0, 0, 0))))} className={`underline ${accent}`}>
              It&apos;s outside calling hours everywhere. Practice as if it&apos;s 2pm Eastern
            </button>
          ) : practiceClock ? <span className={muted}>Practice clock: 2pm Eastern</span> : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)_18rem]">
        <ol aria-label="Lead queue" className={`${panel} flex flex-col divide-y divide-line overflow-hidden`}>
          {leads.map((l) => {
            const done = isDone(l);
            const ready = isReady(l, now);
            return (
              <li key={l.id}>
                <button type="button" onClick={() => setCurrent(l.id)} className={`flex w-full flex-col items-start gap-0.5 border-l-2 px-4 py-3 text-left ${l.id === lead.id ? "border-accent" : "border-transparent"} ${l.id === lead.id ? "bg-accent/[0.07]" : "hover:bg-surface-raise/60"}`}>
                  <span className={`text-sm font-medium ${done ? muted : ""}`}>{l.name}</span>
                  <span className={`text-[11px] ${muted}`}>{l.city} · {l.want}</span>
                  <span className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${ready ? accent : muted}`}>
                    {done
                      ? DISPOSITIONS.find((d) => d.id === l.last)!.label
                      : ready
                        ? `Ready · ${tries(l.attempts)}`
                        : l.last && l.nextCall
                          ? `${DISPOSITIONS.find((d) => d.id === l.last)!.label} · next ${when(l.nextCall, l.timeZone)}`
                          : !callableNow(l.timeZone, now) ? "Outside calling hours" : `${tries(l.attempts)}`}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className={`${panel} flex flex-col gap-5 p-5`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <p className="text-2xl font-semibold tracking-tight">{lead.name}</p>
              <p className={`text-sm ${muted}`}>{lead.city} · (555) •••-••{lead.phoneEnd} · {lead.source}</p>
              <p className={`text-xs ${muted}`}>
                {when(now.toISOString(), lead.timeZone)} {lead.zone} · {callable ? <span className={accent}>OK to call</span> : "outside 8am–9pm, their time"} · texts {lead.textConsent ? "consented" : "not consented"}
              </p>
            </div>
            {onCall === null ? (
              <button type="button" disabled={!callable || isDone(lead)} onClick={() => setOnCall(Date.now())} className={primary}>Call</button>
            ) : (
              <span className="rounded-md border border-accent/50 bg-accent/[0.06] px-4 py-3 font-mono text-sm tabular-nums shadow-[0_0_24px_rgb(34_211_238/0.15)]">On call · {Math.floor((tick - onCall) / 60000)}:{String(Math.floor(((tick - onCall) / 1000) % 60)).padStart(2, "0")}</span>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <div role="tablist" aria-label="Script" className="flex gap-1">
              {(["open", "discover", "close"] as const).map((k) => (
                <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] ${tab === k ? "bg-accent text-accent-ink" : muted}`}>{k}</button>
              ))}
            </div>
            <p className="text-lg leading-8">{SCRIPT[tab].replace("{first}", first).replace("{agent}", "your agent").replace("{want}", lead.want.toLowerCase()).replace("{need}", usd(number))}</p>
            {tab !== "open" ? (
              <div className={`grid grid-cols-2 gap-3 border-t ${line} pt-3 sm:grid-cols-4`}>
                {(["income", "years", "mortgage", "debts"] as const).map((k) => (
                  <label key={k} className="flex flex-col gap-1 text-xs capitalize">{k}
                    <input type="number" min={0} value={need[k]} onChange={(e) => setNeed({ ...need, [k]: Math.max(0, Number(e.target.value)) })} className={`${field} h-10 font-mono text-sm`} />
                  </label>
                ))}
                <p className="col-span-2 text-sm sm:col-span-4">Their number: <span className="font-mono text-lg font-semibold">{usd(number)}</span> <span className={muted}>(debts + income × years + mortgage)</span></p>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <p className={label}>How did it go?</p>
            <div className="flex flex-wrap gap-2">
              {DISPOSITIONS.map((d) => (
                <button key={d.id} type="button" disabled={onCall === null && d.id !== "do_not_call"} onClick={() => dispose(d.id)}
                  className={`rounded-md border px-3 py-2 text-sm transition-colors disabled:opacity-40 ${d.id === "do_not_call" ? "border-negative/40 text-negative" : `${line} bg-surface-sunken hover:border-accent`}`}>
                  {d.label}
                </button>
              ))}
            </div>
            <p className={`text-xs ${muted}`}>Start the call to log how it went. Do-not-call works any time.</p>
          </div>
        </div>

        <div className={`${panel} flex flex-col gap-3 p-5`}>
          <p className={label}>Automations</p>
          {scheduled.length ? (
            <ol className="flex flex-col divide-y divide-line">
              {scheduled.slice(0, 12).map((a, i) => (
                <li key={i} className="flex flex-col gap-0.5 py-2.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em]"><span className={a.kind === "stop" ? "text-negative" : accent}>{KIND[a.kind]}</span> · {a.who}</span>
                  <span className="text-sm leading-5">{a.what}</span>
                  <span className={`text-[11px] ${muted}`}>{when(a.at, a.tz)} their time</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className={`text-sm leading-6 ${muted}`}>Log a call and its next steps appear here: retries, texts, reminders and follow-ups, scheduled for you.</p>
          )}
          <p className={`border-t ${line} pt-3 text-[11px] leading-4 ${muted}`}>Calls and texts only 8am–9pm in the lead&apos;s time zone. Texts only with written consent. Three tries, then email. Do-not-call stops everything.</p>
        </div>
      </div>
    </div>
  );
}
