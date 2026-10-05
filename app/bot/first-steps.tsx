// The first run, until the first save: four steps, each ticked only by what is on the record.
import { label } from "@/app/ui";
import { nextStep, type Step } from "@/lib/bot/first-steps";

export function FirstSteps({ steps }: { steps: Step[] }) {
  const next = nextStep(steps);
  if (!next) return null;
  return (
    <section aria-label="First steps" className="flex flex-col gap-4 rounded-md border border-line p-5">
      <p className={label}>From here to real</p>
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.key} className={`flex min-w-0 flex-col gap-1.5 border-t pt-3 ${s.key === next.key ? "border-foreground" : "border-line"}`} aria-current={s.key === next.key ? "step" : undefined}>
            <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted tabular-nums">
              {s.done ? "Done" : `Step ${i + 1}`}
            </span>
            <span className={`text-sm font-medium ${s.done ? "text-muted line-through decoration-line" : ""}`}>{s.title}</span>
            {!s.done ? <span className="text-xs leading-5 text-muted">{s.detail}</span> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
