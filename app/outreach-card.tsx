// Outreach on a World piece: each business with why it fits, where it was found and the message
// exactly as it would go out. The person approves each one. On the Practice channel, approving
// records what would be sent and nothing leaves solve, so the card says Practice plainly.
import { randomUUID } from "node:crypto";
import type { LeadOutcome, Outreach, Sent } from "@/lib/bot/outreach";
import { finalMessage, formatValue, OUTCOME_LABEL, OUTCOMES } from "@/lib/bot/outreach";
import { day, PracticeLabel } from "@/app/save-point";

type FormAction = (formData: FormData) => void | Promise<void>;

const smallAction =
  "inline-flex h-8 items-center justify-center rounded-md border border-line px-3 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors duration-300 ease-calm hover:border-accent hover:text-accent";

function host(link: string) {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function OutreachCard({ pieceId, outreach, sent, approve, outcomes, record }: { pieceId: string; outreach: Outreach; sent?: Map<number, Sent>; approve?: FormAction; outcomes?: Map<number, LeadOutcome[]>; record?: FormAction }) {
  const approved = sent?.size ?? 0;
  const latest = (i: number) => outcomes?.get(i)?.at(-1) ?? null;
  const tally = OUTCOMES.map((o) => [o, outreach.leads.filter((_, i) => latest(i)?.outcome === o).length] as const).filter(([, n]) => n > 0);
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted tabular-nums">
        Outreach · {approved} of {outreach.leads.length} approved{tally.map(([o, n]) => ` · ${n} ${OUTCOME_LABEL[o].toLowerCase()}`).join("")}
      </p>
      <p className="leading-6 text-muted">{outreach.goal}</p>
      <PracticeLabel note="approving records what would be sent; nothing leaves solve yet." />
      <ol className="flex flex-col gap-4">
        {outreach.leads.map((lead, i) => {
          const done = sent?.get(i);
          const src = host(lead.source);
          return (
            <li key={i} className="flex flex-col gap-2 border-t border-line pt-3">
              <p className="font-medium leading-6">{lead.name}</p>
              {lead.why ? <p className="text-xs leading-5 text-muted">{lead.why}</p> : null}
              <p className="flex flex-wrap gap-x-2 text-xs text-muted">
                {src ? (
                  <a href={lead.source} target="_blank" rel="noopener noreferrer nofollow" className="underline decoration-line underline-offset-4 hover:text-accent">found on {src}</a>
                ) : null}
                {lead.contact ? <span>· {lead.contact}</span> : null}
              </p>
              <pre className="whitespace-pre-wrap break-words rounded border border-line bg-background/60 p-3 font-sans text-xs leading-5">{finalMessage(outreach, lead)}</pre>
              {done ? (
                <>
                  <p className="text-xs text-muted tabular-nums">Approved · recorded in Practice, not sent · {day(done.at)}</p>
                  {latest(i) ? (
                    <p className="text-xs tabular-nums">
                      {OUTCOME_LABEL[latest(i)!.outcome]}{latest(i)!.value ? ` · ${formatValue(latest(i)!.value!)}` : ""} · on {latest(i)!.basis === "self_reported" ? "your word" : "the record"} · {day(latest(i)!.at)}
                      {latest(i)!.note ? <span className="text-muted"> · {latest(i)!.note}</span> : null}
                      {latest(i)!.outcome === "said_no" ? <span className="text-muted"> · won&apos;t be contacted again from this World</span> : null}
                    </p>
                  ) : null}
                  {record && latest(i)?.outcome !== "said_no" ? (
                    <form action={record} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="pieceId" value={pieceId} />
                      <input type="hidden" name="lead" value={i} />
                      <input type="hidden" name="requestId" value={randomUUID()} />
                      <select name="outcome" aria-label={`What happened with ${lead.name}`} className="h-8 rounded border border-line bg-background px-2 text-xs">
                        {OUTCOMES.map((o) => <option key={o} value={o}>{OUTCOME_LABEL[o]}</option>)}
                      </select>
                      <input name="note" maxLength={300} placeholder="What they said (optional)" className="h-8 min-w-0 flex-1 rounded border border-line bg-background px-2 text-xs" />
                      <input name="amount" inputMode="decimal" placeholder="Worth, if won" aria-label="What the win was worth" className="h-8 w-28 rounded border border-line bg-background px-2 text-xs" />
                      <input name="currency" maxLength={3} defaultValue="USD" aria-label="Currency" className="h-8 w-14 rounded border border-line bg-background px-2 text-xs uppercase" />
                      <button type="submit" className={smallAction}>Record</button>
                    </form>
                  ) : null}
                </>
              ) : approve ? (
                <form action={approve}>
                  <input type="hidden" name="pieceId" value={pieceId} />
                  <input type="hidden" name="lead" value={i} />
                  <button type="submit" className={smallAction}>Approve this message</button>
                </form>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
