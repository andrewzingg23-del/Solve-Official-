// The build, as a place: each builder's station above, the trunk running through the middle with its
// builds, and the branches in flight below. Everything is read from GitHub at the time stated; nothing
// here is a builder's word.
import type { Build, BuildState, Builder, BuilderSummary, Lane, RepoView } from "@/lib/github/repo";
import { ago } from "./time";

const STATE_LABEL: Record<BuildState, string> = { running: "building", passed: "passed", failed: "failed", cancelled: "cancelled", other: "finished" };

function stateClass(state: BuildState) {
  return state === "passed" ? "text-positive" : state === "failed" ? "text-negative" : state === "running" ? "text-accent" : "text-muted";
}

export function BuildMark({ build, now }: { build: Build | null; now: string }) {
  if (!build) return <span className="text-xs text-muted">no build yet</span>;
  return (
    <a href={build.url} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1.5 text-xs tabular-nums hover:underline ${stateClass(build.state)}`}>
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full bg-current ${build.state === "running" ? "motion-safe:animate-pulse" : ""}`} />
      build {build.number} {STATE_LABEL[build.state]} · {ago(build.at, now)}
    </a>
  );
}

// One letter per builder, two where builders share a first letter (Claude "Cl", Codex "Co").
export function initialsFor(names: string[]): Map<string, string> {
  const firsts = new Map<string, number>();
  for (const n of new Set(names)) firsts.set(n[0].toUpperCase(), (firsts.get(n[0].toUpperCase()) ?? 0) + 1);
  return new Map([...new Set(names)].map((n) => [n, (firsts.get(n[0].toUpperCase()) ?? 0) > 1 ? n.slice(0, 2) : n[0].toUpperCase()]));
}

function Monogram({ builder, initials }: { builder: Builder | null; initials: Map<string, string> }) {
  return (
    <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-accent/40 bg-accent/10 text-xs font-semibold text-accent shadow-[0_0_24px_rgba(34,211,238,0.25)]">
      {builder ? initials.get(builder) ?? builder[0] : "·"}
    </span>
  );
}

function Station({ s, now, initials }: { s: BuilderSummary; now: string; initials: Map<string, string> }) {
  const parts = [
    s.open.length ? `${s.open.length} open` : null,
    s.merged ? `${s.merged} merged` : null,
    s.commits ? `${s.commits} on the trunk` : null,
  ].filter(Boolean);
  return (
    <li className="relative flex min-w-0 flex-col items-center gap-2 text-center">
      <div className="flex w-full min-w-0 flex-col items-center gap-2 rounded-lg border border-line bg-surface/70 p-3 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Monogram builder={s.builder} initials={initials} />
          <span className="text-sm font-medium">{s.builder}</span>
        </div>
        <span className="text-[11px] leading-4 text-muted tabular-nums">{parts.join(" · ") || "nothing open"} · active {ago(s.at, now)}</span>
        <BuildMark build={s.build} now={now} />
      </div>
      <span aria-hidden className="h-8 w-px bg-gradient-to-b from-accent/50 to-accent/0" />
    </li>
  );
}

function LaneRow({ lane, now, initials }: { lane: Lane; now: string; initials: Map<string, string> }) {
  return (
    <li className="flex min-w-0 flex-col gap-2 rounded-lg border border-line bg-surface/55 p-3 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <Monogram builder={lane.builder} initials={initials} />
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-mono text-xs">{lane.branch}</span>
          <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
            {lane.pulls.slice(0, 3).map((p) => (
              <a key={p.number} href={p.url} target="_blank" rel="noopener noreferrer" className="min-w-0 hover:text-accent">
                #{p.number} {p.state === "open" ? "open" : p.state} · <span className="break-words">{p.title}</span>
              </a>
            ))}
            {lane.pulls.length ? null : <span>no pull request</span>}
          </span>
        </div>
      </div>
      <div className="shrink-0 pl-11 sm:pl-0"><BuildMark build={lane.build} now={now} /></div>
    </li>
  );
}

// Saving the trunk's latest passed build as proof. The server reads it from GitHub again before saving.
function SaveBuild({ build, save, saved }: { build: Build; save?: (form: FormData) => void | Promise<void>; saved: boolean }) {
  if (build.state !== "passed") return null;
  if (saved) return <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />Saved</span>;
  if (!save) return null;
  return (
    <form action={save}>
      <input type="hidden" name="buildId" value={build.id} />
      <button type="submit" className="rounded border border-line px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] hover:border-accent hover:text-accent">Save as proof</button>
    </form>
  );
}

export function BuildMap({ view, now, save, savedLinks = new Set() }: { view: RepoView; now: string; save?: (form: FormData) => void | Promise<void>; savedLinks?: Set<string> }) {
  const latest = view.trunkBuilds[0] ?? null;
  const buildBySha = new Map<string, Build>();
  for (const b of [...view.trunkBuilds].reverse()) buildBySha.set(b.sha, b);
  const commits = view.commits.slice(0, 12).reverse(); // oldest on the left, the latest on the right
  const initials = initialsFor([...view.builders.map((b) => b.builder), ...view.lanes.flatMap((l) => (l.builder ? [l.builder] : []))]);
  return (
    <div className="flex flex-col gap-6">
      {view.builders.length ? (
        <ul aria-label="Builders" className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
          {view.builders.slice(0, 8).map((s) => <Station key={s.builder} s={s} now={now} initials={initials} />)}
        </ul>
      ) : null}

      <section aria-label="The trunk" className="relative flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Trunk · <span className="font-mono normal-case tracking-normal">{view.trunk}</span></span>
          <span className="flex items-center gap-3">
            <BuildMark build={latest} now={now} />
            {latest ? <SaveBuild build={latest} save={save} saved={savedLinks.has(latest.url)} /> : null}
          </span>
        </div>
        <div className="relative px-1 py-6">
          <span aria-hidden className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-accent/0 via-accent/70 to-accent shadow-[0_0_18px_rgba(34,211,238,0.6)]" />
          <ol className="relative flex items-center justify-between gap-1">
            {commits.map((c, i) => {
              const build = buildBySha.get(c.sha);
              const last = i === commits.length - 1;
              return (
                <li key={c.sha} className="group relative flex flex-col items-center">
                  <a href={c.url} target="_blank" rel="noopener noreferrer" aria-label={`${c.message}${build ? `, build ${STATE_LABEL[build.state]}` : ""}`} className="relative grid place-items-center">
                    {build ? <span aria-hidden className={`absolute h-5 w-5 rounded-full border ${build.state === "passed" ? "border-positive/70" : build.state === "failed" ? "border-negative/80" : build.state === "running" ? "border-accent motion-safe:animate-ping" : "border-line"}`} /> : null}
                    <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${last ? "bg-foreground shadow-[0_0_14px_rgba(242,247,251,0.8)]" : "bg-foreground/60"}`} />
                  </a>
                  <span className="pointer-events-none absolute top-6 hidden w-48 -translate-x-1/2 left-1/2 rounded border border-line bg-background/95 p-2 text-[11px] leading-4 text-muted group-hover:block group-focus-within:block">
                    {c.message}
                    <span className="block tabular-nums">{c.builder ?? "someone"} · {ago(c.at, now)}{build ? ` · build ${build.number} ${STATE_LABEL[build.state]}` : ""}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
        {view.commits[0] ? (
          <p className="text-xs leading-5 text-muted">
            Latest: <a href={view.commits[0].url} target="_blank" rel="noopener noreferrer" className="text-foreground hover:text-accent">{view.commits[0].message}</a> · {view.commits[0].builder ?? "someone"} · {ago(view.commits[0].at, now)}
          </p>
        ) : null}
      </section>

      {view.lanes.length ? (
        <section aria-label="Branches in flight" className="flex flex-col gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Branches in flight</span>
          <ul className="flex flex-col gap-2">{view.lanes.map((l) => <LaneRow key={l.branch} lane={l} now={now} initials={initials} />)}</ul>
        </section>
      ) : null}

      <p className="text-[11px] leading-5 text-muted">
        {view.source === "deployment" ? `From the code deployed ${ago(view.readAt, now)}` : `Read from GitHub ${ago(view.readAt, now)}`} · <a href={view.url} target="_blank" rel="noopener noreferrer" className="hover:text-accent">{view.ref.owner}/{view.ref.repo}</a>. Builders are named by their branches. Nothing here is anyone&apos;s word.
      </p>
    </div>
  );
}
