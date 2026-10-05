// A World's room (master spec §7, "Real-time Build Rooms"; the canon's "Enter a Room"): the place to
// work in a World, not a page about it. Who is here and what you're after on the left; the domain
// canvas in the middle (the build for a World that links a repository, otherwise its pieces where
// they were placed); what's waiting on you, what just happened and what is proven on the right; one
// command bar at the bottom. Everything shown is read from the record or from GitHub. Empty means
// empty.
import type { ReactNode } from "react";
import Link from "next/link";
import { SavePoint } from "@/app/save-point";
import type { Connection } from "@/lib/bot/memory";
import type { SavedProof } from "@/lib/bot/proof";
import { groupGaps, type Gap } from "@/lib/bot/gaps";
import type { Journey, WaitingItem } from "@/lib/bot/waiting";
import type { Pull, RepoRead, RepoRef } from "@/lib/github/repo";
import { BuildMap, BuildMark } from "./build-map";
import { PiecesMap, type RoomPiece } from "./pieces-map";
import { ago } from "./time";

export type RoomLens = "build" | "pieces";
export type RoomPerson = { id: string; label: string; kind: "human" | "agent" | "service"; you: boolean };
export type RoomActivity = { id: string; what: string; who: string; at: string };

export type RoomData = {
  worldId: string;
  title: string;
  goal: string;
  now: string; // when the page was read
  lens: RoomLens;
  pieces: RoomPiece[];
  people: RoomPerson[];
  botName: string | null;
  assistants: Connection[];
  journeys: Journey[];
  waiting: WaitingItem[];
  gaps: Gap[];
  saves: SavedProof[];
  activity: RoomActivity[];
  repo: { read: RepoRead; paired: boolean } | null;
  notice?: { tone: "ok" | "error"; text: string } | null;
  addNote?: (form: FormData) => void | Promise<void>;
  linkRepo?: (form: FormData) => void | Promise<void>;
  saveBuild?: (form: FormData) => void | Promise<void>;
  requestId?: string;
  live?: ReactNode; // the bot's live line, when there is a bot
  sync?: ReactNode; // the room's live connection state
};

const panel = "flex flex-col gap-3 rounded-xl border border-line bg-surface/55 p-4 backdrop-blur-md";
const heading = "text-[10px] font-semibold uppercase tracking-[0.22em] text-muted";
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function Panel({ title, aside, children, id }: { title: string; aside?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section aria-labelledby={id} className={panel}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={id} className={heading}>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

const KIND_MARK: Record<RoomPerson["kind"], string> = { human: "person", agent: "bot", service: "service" };

function journeyLine(j: Journey) {
  if (j.state === "proposed") return `${plural(j.options.length, "route", "routes")} proposed`;
  if (j.state === "done") return `${j.route} · done`;
  return `${j.route} · ${j.done} of ${j.total}`;
}

function waitingLine(item: WaitingItem) {
  if (item.kind === "approve") return { label: "Approve messages", detail: `${item.pending} of ${item.total} to approve` };
  if (item.kind === "choose") return { label: "Choose a route", detail: item.options.join(" · ") };
  return { label: "Next step", detail: `${item.step} · ${item.route}, ${item.done} of ${item.total}` };
}

// Pull requests asking to merge into the trunk wait on whoever merges: the founder.
function reviews(read: RepoRead | undefined): Pull[] {
  if (!read?.ok) return [];
  return read.view.lanes.flatMap((l) => l.pulls.filter((p) => p.state === "open" && p.base === read.view.trunk));
}

function RepoUnavailable({ read, paired, worldId }: { read: Extract<RepoRead, { ok: false }>; paired: boolean; worldId: string }) {
  const ref: RepoRef = read.ref;
  const name = `${ref.owner}/${ref.repo}`;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface/55 p-5 text-sm leading-6">
      <p className="font-medium">{name} isn&apos;t showing yet.</p>
      {read.reason === "not_connected" ? (
        <>
          <p className="text-muted">It is private, or GitHub isn&apos;t answering this deployment without a token. To read it here, the deployment needs a read-only GitHub token and a pairing, set where the app is deployed:</p>
          <pre className="overflow-x-auto rounded border border-line bg-background/80 p-3 font-mono text-xs leading-5">{`GITHUB_TOKEN=<a fine-grained token: read-only Actions, Contents, Metadata, Pull requests>\nGITHUB_ROOMS=${worldId}=${name}${ref.trunk ? `@${ref.trunk}` : ""}`}</pre>
          <p className="text-xs text-muted">Pairing it with this World lets everyone you let into the World see it. Pair it with your sign-in email instead to keep it to you.</p>
        </>
      ) : read.reason === "not_found" ? (
        <p className="text-muted">{paired ? "The token can't see this repository. Check the token's repository access." : "GitHub says it doesn't exist."}</p>
      ) : read.reason === "rate_limited" ? (
        <p className="text-muted">GitHub is limiting reads from this deployment right now. A token raises the limit; otherwise try again in a few minutes.</p>
      ) : (
        <p className="text-muted">GitHub didn&apos;t answer. Nothing was changed; this room reads it again on the next visit.</p>
      )}
    </div>
  );
}

function LinkRepoForm({ linkRepo, requestId }: { linkRepo: NonNullable<RoomData["linkRepo"]>; requestId?: string }) {
  return (
    <form action={linkRepo} className="flex flex-col gap-3 rounded-xl border border-dashed border-line p-5">
      <p className="text-sm font-medium">Build something with code here?</p>
      <p className="text-xs leading-5 text-muted">Link its GitHub repository and the room shows the build as it happens: each builder&apos;s branches, pull requests and whether the build passed. It&apos;s added to this World&apos;s resources, and solve only reads it.</p>
      <input type="hidden" name="requestId" value={requestId ?? ""} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <input name="url" type="url" required placeholder="https://github.com/owner/repo/tree/main" className="h-10 min-w-0 flex-1 rounded-md border border-line bg-background/80 px-3 font-mono text-xs outline-none focus:border-accent" />
        <button type="submit" className="h-10 rounded-md border border-line px-4 text-[10px] font-semibold uppercase tracking-[0.2em] hover:border-accent hover:text-accent">Link repository</button>
      </div>
    </form>
  );
}

export function RoomView({ data }: { data: RoomData }) {
  const read = data.repo?.read;
  const lens: RoomLens = data.repo ? data.lens : "pieces";
  const toReview = reviews(read);
  const waitingCount = data.waiting.length + toReview.length;
  const underway = data.journeys.filter((j) => j.state !== "done");
  const here = data.people.length;
  return (
    <div className="relative flex min-h-svh flex-col lg:h-svh lg:overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(90%_70%_at_50%_45%,rgb(10_18_32)_0%,rgb(4_7_13)_70%)]" />
        <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(rgb(242_247_251/0.035)_1px,transparent_1px),linear-gradient(90deg,rgb(242_247_251/0.035)_1px,transparent_1px)] [background-size:40px_40px] [mask-image:radial-gradient(70%_60%_at_50%_45%,black,transparent)]" />
        <div className="absolute left-1/2 top-[42%] h-[60vmin] w-[60vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/10 blur-3xl motion-safe:animate-[pulse_9s_ease-in-out_infinite]" />
      </div>

      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line/70 px-4 py-3 md:px-6">
        <nav aria-label="Where you are" className="flex min-w-0 items-center gap-2 text-xs">
          <Link href="/command" className="font-semibold uppercase tracking-[0.3em] text-accent">solve</Link>
          <span className="text-muted">/</span>
          <Link href="/worlds" className="text-muted hover:text-accent">Worlds</Link>
          <span className="text-muted">/</span>
          <span className="truncate">{data.title}</span>
          <span className="text-muted">/</span>
          <span className="font-semibold uppercase tracking-[0.2em] text-accent">Room</span>
        </nav>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 whitespace-nowrap text-[10px] uppercase tracking-[0.16em] text-muted">
          {data.sync}
          <span className="tabular-nums">{here} here</span>
          <span className="hidden sm:inline">Private</span>
          <Link href={`/world/${data.worldId}`} className="hover:text-accent">Details</Link>
          <Link href="/command" className="hover:text-accent">Command Center</Link>
        </div>
      </header>

      {data.notice ? (
        <p role={data.notice.tone === "error" ? "alert" : "status"} className={`mx-4 mt-3 rounded-md border px-3 py-2 text-sm md:mx-6 ${data.notice.tone === "error" ? "border-negative/30 bg-negative/10 text-negative" : "border-positive/25 bg-positive/5 text-positive"}`}>
          {data.notice.text}
        </p>
      ) : null}

      <div className="grid flex-1 gap-4 p-4 md:p-6 lg:min-h-0 lg:grid-cols-[16rem_minmax(0,1fr)_20rem]">
        <aside aria-label="Who and what" className="order-3 flex flex-col gap-4 lg:order-1 lg:min-h-0 lg:overflow-y-auto">
          <Panel title="After" id="room-goal">
            <p className="break-words text-sm leading-6">{data.goal || data.title}</p>
          </Panel>
          <Panel title="Here" id="room-here" aside={<span className="text-[10px] text-muted tabular-nums">{here}</span>}>
            <ul className="flex flex-col gap-2 text-sm">
              {data.people.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${p.kind === "agent" ? "border border-accent" : "bg-foreground/70"}`} />
                    <span className="truncate">{p.you ? `${p.label} (you)` : p.label}</span>
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.14em] text-muted">{KIND_MARK[p.kind]}</span>
                </li>
              ))}
            </ul>
            {data.botName ? (
              <p className="text-xs leading-5 text-muted">
                {data.botName}, your bot{data.assistants.length ? `, with ${data.assistants.map((a) => a.clientName).join(", ")}` : ", with no assistant connected"}.
              </p>
            ) : (
              <Link href="/bot" className="text-xs text-accent">Make your bot to work here with your AI</Link>
            )}
            {data.live}
          </Panel>
          <Panel title="Routes" id="room-routes">
            {data.journeys.length ? (
              <ul className="flex flex-col gap-3">
                {data.journeys.map((j) => (
                  <li key={j.pieceId} className="flex flex-col gap-1.5 text-sm">
                    <Link href={`/world/${data.worldId}#piece-${j.pieceId}`} className="break-words hover:text-accent">{j.ask}</Link>
                    {j.state !== "proposed" ? (
                      <span aria-hidden className="h-1 overflow-hidden rounded-full bg-line">
                        <span className="block h-full rounded-full bg-accent" style={{ width: `${j.total ? Math.round((j.done / j.total) * 100) : 0}%` }} />
                      </span>
                    ) : null}
                    <span className="text-xs text-muted tabular-nums">{journeyLine(j)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs leading-5 text-muted">No routes yet. Ask your assistant: &quot;Find me three ways to…&quot;</p>
            )}
          </Panel>
        </aside>

        <section aria-label="Room canvas" className="order-2 flex min-w-0 flex-col gap-3 lg:order-2 lg:min-h-0">
          <div className="flex items-center justify-between gap-3">
            <div role="tablist" aria-label="Canvas" className="flex items-center gap-1 rounded-md border border-line bg-surface/60 p-1 backdrop-blur-md">
              {data.repo ? (
                <Link role="tab" aria-selected={lens === "build"} href={`/world/${data.worldId}/room?lens=build`} className={`rounded px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${lens === "build" ? "bg-accent/15 text-accent" : "text-muted hover:text-foreground"}`}>Build</Link>
              ) : null}
              <Link role="tab" aria-selected={lens === "pieces"} href={`/world/${data.worldId}/room?lens=pieces`} className={`rounded px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${lens === "pieces" ? "bg-accent/15 text-accent" : "text-muted hover:text-foreground"}`}>Pieces · {data.pieces.length}</Link>
            </div>
            <span className="text-[10px] uppercase tracking-[0.16em] text-muted tabular-nums">{plural(underway.length, "route", "routes")} underway · {plural(data.saves.length, "save", "saves")}</span>
          </div>
          <div className="min-h-0 flex-1 lg:overflow-y-auto lg:pr-1">
            {lens === "build" && read ? (
              read.ok ? <BuildMap view={read.view} now={data.now} save={data.saveBuild} savedLinks={new Set(data.saves.map((s) => s.link).filter((l): l is string => !!l))} /> : <RepoUnavailable read={read} paired={data.repo?.paired ?? false} worldId={data.worldId} />
            ) : (
              <div className="flex flex-col gap-4">
                <PiecesMap worldId={data.worldId} pieces={data.pieces} />
                {!data.repo && data.linkRepo ? <LinkRepoForm linkRepo={data.linkRepo} requestId={data.requestId} /> : null}
              </div>
            )}
          </div>
        </section>

        <aside aria-label="What needs you and what happened" className="order-1 flex flex-col gap-4 lg:order-3 lg:min-h-0 lg:overflow-y-auto">
          <Panel title="Waiting on you" id="room-waiting" aside={<span className="text-[10px] text-muted tabular-nums">{waitingCount}</span>}>
            {waitingCount ? (
              <ul className="flex flex-col divide-y divide-line">
                {toReview.map((p) => (
                  <li key={`pr:${p.number}`} className="flex flex-col gap-1 py-2.5 text-sm first:pt-0">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Review to merge</span>
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="break-words hover:text-accent">#{p.number} {p.title}</a>
                    <span className="truncate font-mono text-[11px] text-muted">{p.branch}</span>
                  </li>
                ))}
                {data.waiting.map((item) => {
                  const w = waitingLine(item);
                  return (
                    <li key={`${item.kind}:${item.pieceId}`} className="flex flex-col gap-1 py-2.5 text-sm first:pt-0">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">{w.label}</span>
                      <Link href={`/world/${data.worldId}#piece-${item.pieceId}`} className="break-words hover:text-accent">{item.ask}</Link>
                      <span className="break-words text-xs leading-5 text-muted">{w.detail}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-xs leading-5 text-muted">Nothing is waiting on you here.</p>
            )}
          </Panel>

          <Panel title="Proof" id="room-proof">
            {read?.ok && read.view.trunkBuilds[0] ? (
              <div className="flex flex-col gap-1 text-xs">
                <span className="text-muted">The trunk on GitHub, read {ago(read.view.readAt, data.now)}:</span>
                <BuildMark build={read.view.trunkBuilds[0]} now={data.now} />
              </div>
            ) : null}
            {data.saves.length ? (
              <div className="flex flex-col gap-3">
                {data.saves.slice(-4).reverse().map((s) => <SavePoint key={s.recordId} what={s.what} basis={s.basis} at={s.at} number={s.number} link={s.link} />)}
              </div>
            ) : (
              <p className="text-xs leading-5 text-muted">Nothing saved here yet. When something becomes real, save the proof on it.</p>
            )}
          </Panel>

          <Panel title="Just happened" id="room-activity">
            {data.activity.length ? (
              <ol className="flex flex-col gap-2">
                {data.activity.map((a) => (
                  <li key={a.id} className="flex items-baseline justify-between gap-3 text-xs">
                    <span className="min-w-0"><span className="text-foreground">{a.what}</span> <span className="text-muted">· {a.who}</span></span>
                    <time dateTime={a.at} className="shrink-0 text-[10px] text-muted tabular-nums">{ago(a.at, data.now)}</time>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-xs text-muted">No changes recorded yet.</p>
            )}
          </Panel>

          {data.gaps.length ? (
            <Panel title="What solve can't do yet" id="room-gaps">
              <ul className="flex flex-col gap-2">
                {groupGaps(data.gaps).map((g) => (
                  <li key={g.latest.pieceId} className="flex flex-col gap-0.5 text-xs">
                    <span className="break-words text-foreground">{g.goal}</span>
                    <span className="text-muted">{g.times > 1 ? `Needed ${g.times} times` : "Needed once"}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </aside>
      </div>

      <footer className="border-t border-line/70 bg-background/70 px-4 py-3 backdrop-blur-md md:px-6">
        {data.addNote ? (
          <form action={data.addNote} className="mx-auto flex max-w-4xl flex-col gap-2 sm:flex-row sm:items-center">
            <input type="hidden" name="requestId" value={data.requestId ?? ""} />
            <label className="sr-only" htmlFor="room-note">Add to this room</label>
            <input id="room-note" name="note" required maxLength={7000} autoComplete="off" placeholder="Add a note, a decision or a next step to this room…" className="h-11 min-w-0 flex-1 rounded-md border border-line bg-surface/80 px-4 text-sm outline-none placeholder:text-muted/60 focus:border-accent" />
            <button type="submit" className="h-11 rounded-md bg-accent px-5 text-xs font-semibold uppercase tracking-[0.2em] text-background hover:opacity-85">Add</button>
          </form>
        ) : null}
        <p className="mx-auto mt-2 max-w-4xl text-[11px] leading-4 text-muted">
          Or ask your assistant in Claude or ChatGPT to work here: it reads and adds through solve, only within what you granted.
        </p>
      </footer>
    </div>
  );
}
