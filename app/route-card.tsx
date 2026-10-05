// Routes on a World piece. Before one is taken they are a proposal from an assistant, shown as such;
// the person takes one, and its steps become their tasks. A done step carries the point because it is
// a person's yes on the record (docs/brand/BRAND.md), and it says whose word it rests on. The page
// passes the actions in (app/route-actions.ts); without them the card is read only.
import type { Route, Routes, TakenRoute } from "@/lib/bot/routes";
import { nextStep } from "@/lib/bot/routes";
import { day } from "@/app/save-point";

const smallAction =
  "inline-flex h-8 items-center justify-center rounded-md border border-line px-3 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors duration-300 ease-calm hover:border-accent hover:text-accent";

function StepLink({ link }: { link?: string | null }) {
  if (!link || !/^https?:\/\//i.test(link)) return null;
  let host = link;
  try {
    host = new URL(link).hostname.replace(/^www\./, "");
  } catch {}
  return (
    <a href={link} target="_blank" rel="noopener noreferrer nofollow" className="text-muted underline decoration-line underline-offset-4 hover:text-accent">
      {host}
    </a>
  );
}

type FormAction = (formData: FormData) => void | Promise<void>;

function RouteNotes({ route }: { route: Route }) {
  const notes = [["Takes", route.takes], ["Not yet known", route.unknowns], ["Done when", route.doneWhen]].filter((n): n is [string, string] => Boolean(n[1]));
  if (!notes.length) return null;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs leading-5">
      {notes.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{k}</dt>
          <dd className="break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function RouteCard({ pieceId, routes, taken, who = "you", take, markDone }: { pieceId: string; routes: Routes; taken?: TakenRoute | null; who?: string; take?: FormAction; markDone?: FormAction }) {
  if (taken && routes.routes[taken.route]) {
    const route = routes.routes[taken.route];
    const next = nextStep(taken);
    const done = taken.steps.filter((s) => s.status === "completed").length;
    const word = who === "you" ? "On your word" : `On ${who}'s word`;
    return (
      <div className="flex flex-col gap-3 text-sm">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted tabular-nums">
          Route taken · {done} of {taken.steps.length} done
        </p>
        <p className="leading-6">
          <span className="text-muted">{routes.ask} · </span>
          {route.title}
        </p>
        <ol className="flex flex-col gap-2.5">
          {taken.steps.map((s) => {
            const isNext = next?.taskId === s.taskId;
            return (
              <li key={s.taskId} className="flex min-w-0 items-start gap-2.5 text-xs">
                {s.status === "completed" ? (
                  <span aria-hidden className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent" />
                ) : (
                  <span aria-hidden className={`mt-1 h-2 w-2 shrink-0 rounded-full border ${isNext ? "border-foreground" : "border-line"}`} />
                )}
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className={`break-words ${s.status === "completed" || isNext ? "text-foreground" : "text-muted"}`}>{s.do}</span>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted tabular-nums">
                    {s.status === "completed" && s.doneAt ? <span>Done · {word} · {day(s.doneAt)}</span> : isNext ? <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground">Next</span> : null}
                    <StepLink link={s.link} />
                  </span>
                  {isNext && markDone ? (
                    <form action={markDone}>
                      <input type="hidden" name="taskId" value={s.taskId} />
                      <button type="submit" className={smallAction}>Mark done</button>
                    </form>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ol>
        {route.doneWhen ? <p className="text-xs leading-5"><span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Done when </span>{route.doneWhen}</p> : null}
        {!next ? <p className="text-xs text-muted">Every step is done. If it became something real, save the proof on it.</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
        Proposed · {routes.routes.length === 1 ? "one route" : `${routes.routes.length} routes`}
      </p>
      <p className="leading-6 text-muted">{routes.ask}</p>
      <ol className="flex flex-col gap-4">
        {routes.routes.map((r, i) => (
          <li key={i} className="flex flex-col gap-2 border-t border-line pt-3">
            <p className="font-medium leading-6">
              <span className="mr-2 text-muted tabular-nums">{i + 1}</span>
              {r.title}
            </p>
            {r.why ? <p className="text-xs leading-5 text-muted">{r.why}</p> : null}
            <RouteNotes route={r} />
            <ol className="flex list-decimal flex-col gap-1 pl-5 text-xs leading-5 marker:text-muted">
              {r.steps.map((s, j) => (
                <li key={j} className="break-words">
                  {s.do} {s.link ? <StepLink link={s.link} /> : null}
                </li>
              ))}
            </ol>
            {take ? (
              <form action={take}>
                <input type="hidden" name="pieceId" value={pieceId} />
                <input type="hidden" name="route" value={i} />
                <button type="submit" className={smallAction}>Take this route</button>
              </form>
            ) : null}
          </li>
        ))}
      </ol>
      <p className="text-xs leading-5 text-muted">A proposal from an assistant. Nothing starts until you take a route.</p>
    </div>
  );
}
