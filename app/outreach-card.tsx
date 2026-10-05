// Outreach on a World piece: each business with why it fits, where it was found and the message
// exactly as it would go out. The person approves each one. On the Practice channel, approving
// records what would be sent and nothing leaves solve, so the card says Practice plainly.
import type { Outreach, Sent } from "@/lib/bot/outreach";
import { finalMessage } from "@/lib/bot/outreach";
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

export function OutreachCard({ pieceId, outreach, sent, approve }: { pieceId: string; outreach: Outreach; sent?: Map<number, Sent>; approve?: FormAction }) {
  const approved = sent?.size ?? 0;
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted tabular-nums">
        Outreach · {approved} of {outreach.leads.length} approved
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
                <p className="text-xs text-muted tabular-nums">Approved · recorded in Practice, not sent · {day(done.at)}</p>
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
