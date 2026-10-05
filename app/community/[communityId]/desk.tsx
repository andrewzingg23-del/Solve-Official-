// One homeowner's request at the solar desk, as its owner sees it: their details (opened from the
// homeowner's sealed request), their answers, and the form to send back the design made in Aurora.
import { label, primaryAction } from "@/app/ui";
import { estimateSolar, money } from "@/lib/solar/estimate";
import { QUESTIONS, qualify, type Answers } from "@/lib/solar/qualify";
import type { DesignRequest } from "@/lib/solar/desk";

const input = "h-11 rounded-md border border-line bg-background px-3 text-sm outline-none transition-colors focus:border-accent";
const when = (at: string) => new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const STATUS = { qualified: "Pre-qualifies", almost: "Almost: one thing to check", not_yet: "Not yet", incomplete: "Didn't answer every question" } as const;

export function DeskRequest({ request: r, action, requestId }: { request: DesignRequest; action: (form: FormData) => void | Promise<void>; requestId: string }) {
  if (!r.details) {
    return (
      <li className="rounded-md border border-line p-4 text-sm text-muted">
        A request from {when(r.at)}: erased by the homeowner. Their details are gone for good.
      </li>
    );
  }
  const d = r.details;
  const e = estimateSolar({ monthlyBill: d.monthlyBill, monthlyKwh: d.monthlyKwh });
  const answers: Answers = { owner: null, home: null, roof: null, shade: null, credit: null, utility: null, ...d.answers } as Answers;
  const fit = qualify(answers, d.monthlyBill);
  return (
    <li className="flex flex-col gap-4 rounded-md border border-line bg-surface/60 p-4 md:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="text-base font-medium">{d.name}</span>
        <span className="text-xs text-muted">{when(r.at)} · {r.answer ? `answered ${when(r.answer.at)}` : "waiting on a design"}</span>
      </div>
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div className="sm:col-span-2"><dt className="text-xs text-muted">Address</dt><dd className="font-medium">{d.address}</dd></div>
        <div><dt className="text-xs text-muted">Phone</dt><dd>{d.phone || "—"}</dd></div>
        <div><dt className="text-xs text-muted">Email</dt><dd className="break-all">{d.email || "—"}</dd></div>
        <div><dt className="text-xs text-muted">Bill</dt><dd className="font-mono">{money(d.monthlyBill)}/mo{d.monthlyKwh ? ` · ${d.monthlyKwh} kWh` : ""}</dd></div>
        <div><dt className="text-xs text-muted">Estimate</dt><dd className="font-mono">{e.systemKw} kW · {e.panels} panels · {money(e.netCost)}</dd></div>
        <div className="sm:col-span-2"><dt className="text-xs text-muted">Qualifying</dt><dd>{STATUS[fit.status]}{QUESTIONS.filter((q) => d.answers[q.key]).length ? ` · ${QUESTIONS.filter((q) => d.answers[q.key]).map((q) => `${q.key}: ${q.options.find(([v]) => v === d.answers[q.key])?.[1]}`).join(", ")}` : ""}</dd></div>
      </dl>
      {r.answer ? (
        <p className="text-sm">
          Sent: <a href={r.answer.proposalUrl} target="_blank" rel="noreferrer" className="underline hover:text-accent">the proposal</a>
          {r.answer.systemKw ? ` · ${r.answer.systemKw} kW` : ""}{r.answer.panels ? ` · ${r.answer.panels} panels` : ""}{r.answer.price ? ` · ${money(r.answer.price)}` : ""}
        </p>
      ) : null}
      <details open={!r.answer}>
        <summary className="cursor-pointer text-xs uppercase tracking-[0.2em] text-muted hover:text-accent">{r.answer ? "Send a revised design" : "Send the design"}</summary>
        <form action={action} className="mt-3 flex flex-col gap-3">
          <input type="hidden" name="askId" value={r.id} />
          <input type="hidden" name="requestId" value={requestId} />
          <label className={label} htmlFor={`url-${r.id}`}>Aurora proposal link</label>
          <input id={`url-${r.id}`} name="proposalUrl" type="url" required placeholder="https://…" className={`${input} font-mono text-xs`} />
          <div className="grid gap-2 sm:grid-cols-4">
            <input name="systemKw" inputMode="decimal" placeholder="kW" aria-label="System size in kW" className={`${input} font-mono`} />
            <input name="panels" inputMode="numeric" placeholder="Panels" aria-label="Panels" className={`${input} font-mono`} />
            <input name="annualKwh" inputMode="numeric" placeholder="kWh a year" aria-label="Production in kWh a year" className={`${input} font-mono`} />
            <input name="price" inputMode="numeric" placeholder="Price $" aria-label="Price in dollars" className={`${input} font-mono`} />
          </div>
          <input name="note" maxLength={500} placeholder="A note for them (optional)" className={input} />
          <button type="submit" className={primaryAction}>Send to {d.name.split(" ")[0]}</button>
        </form>
      </details>
    </li>
  );
}
