// The shared project workspace. Conversation is the primary surface; supporting
// tools use the same saved record and stay out of the way until needed.
import type { ReactNode } from "react";
import Link from "next/link";
import { SavePoint } from "@/app/save-point";
import type { Connection } from "@/lib/bot/memory";
import type { SavedProof } from "@/lib/bot/proof";
import type { Gap } from "@/lib/bot/gaps";
import type { Journey, WaitingItem } from "@/lib/bot/waiting";
import type { Pull, RepoRead, RepoReadFailure, RepoRef } from "@/lib/github/repo";
import type { RoomMessage } from "@/lib/kernel/client";
import { Icon } from "@/app/product/icons";
import { BuildMap, BuildMark } from "./build-map";
import type { RoomPiece } from "./pieces-map";
import { SharedConversation } from "./conversation";
import { SourcePublisher } from "./source-publisher";
import { CostWorksheet } from "./cost-worksheet";
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
  repo: { read: RepoRead; paired: boolean; unread?: RepoReadFailure } | null; // unread: why GitHub itself wasn't read
  conversation?: { messages: RoomMessage[]; beforeSeq: number | null };
  canWrite?: boolean;
  currentActorId?: string;
  notice?: { tone: "ok" | "error"; text: string } | null;
  addNote?: (form: FormData) => void | Promise<void>;
  linkRepo?: (form: FormData) => void | Promise<void>;
  saveBuild?: (form: FormData) => void | Promise<void>;
  requestId?: string;
  live?: ReactNode; // the bot's live line, when there is a bot
  sync?: ReactNode; // the room's live connection state
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const KIND_MARK: Record<RoomPerson["kind"], string> = { human: "Person", agent: "AI", service: "Service" };

// Pull requests asking to merge into the trunk wait on whoever merges: the founder.
function reviews(read: RepoRead | undefined): Pull[] {
  if (!read?.ok) return [];
  return read.view.lanes.flatMap((l) => l.pulls.filter((p) => p.state === "open" && p.base === read.view.trunk));
}

// What it takes to read a private repository here: a read-only token, and a pairing unless one exists.
function TokenNeeded({ paired, worldId, name, trunk }: { paired: boolean; worldId: string; name: string; trunk: string | null }) {
  return (
    <>
      <p className="text-muted">
        {paired
          ? "This repository is paired with your project. A deployment owner needs to enable GitHub read access before live builds can appear."
          : "A private repository needs read access and a pairing with this project before it can appear here."}
      </p>
      <details className="solve-room-connection-details">
        <summary>Repository connection details</summary>
        <pre>{`GITHUB_TOKEN=<a fine-grained token: read-only Actions, Contents, Metadata, Pull requests>${paired ? "" : `\nGITHUB_ROOMS=${worldId}=${name}${trunk ? `@${trunk}` : ""}`}`}</pre>
        {paired ? null : <p className="text-xs text-muted">A deployment owner can also pair it in solve.rooms.json. A project pairing shares the repository with its members; an email pairing keeps it to that account.</p>}
      </details>
    </>
  );
}

function RepoUnavailable({ read, paired, worldId }: { read: Extract<RepoRead, { ok: false }>; paired: boolean; worldId: string }) {
  const ref: RepoRef = read.ref;
  const name = `${ref.owner}/${ref.repo}`;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface/55 p-5 text-sm leading-6">
      <p className="font-medium">{name} isn&apos;t showing yet.</p>
      {read.reason === "not_connected" ? (
        <>
          <TokenNeeded paired={paired} worldId={worldId} name={name} trunk={ref.trunk} />
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
    <form action={linkRepo} className="solve-room-repo-form">
      <p className="text-sm font-medium">Connect a GitHub repository</p>
      <p className="text-xs leading-5 text-muted">Follow branches, pull requests and build results alongside the project. solve reads the repository and does not change its code.</p>
      <input type="hidden" name="requestId" value={requestId ?? ""} />
      <label htmlFor="room-repository" className="text-xs text-muted">Repository URL</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input id="room-repository" name="url" type="url" required placeholder="https://github.com/owner/repo/tree/main" className="min-w-0 flex-1 rounded-md border border-line bg-background/80 px-3 text-xs outline-none focus:border-accent" />
        <button type="submit" className="solve-room-button">Link repository</button>
      </div>
    </form>
  );
}

export function RoomView({ data }: { data: RoomData }) {
  const read = data.repo?.read;
  const toReview = reviews(read);
  const resources = data.pieces.filter(piece => piece.kind !== "outreach" && piece.kind !== "proposal" && piece.kind !== "routes");
  const projectUrl = `/world/${data.worldId}`;
  return (
    <div className="solve-room">
      <header className="solve-room-header">
        <nav aria-label="Where you are" className="solve-room-breadcrumb">
          <Link href="/worlds">Projects</Link>
          <span aria-hidden="true">/</span>
          <span>Shared workspace</span>
        </nav>
        <div className="solve-room-heading-row">
          <div className="solve-room-project">
            <span className="solve-room-project-icon"><Icon name="projects" width={24} height={24} /></span>
            <div>
              <h1>{data.title}</h1>
              {data.goal ? <p>{data.goal}</p> : null}
            </div>
          </div>
          <div className="solve-room-status">
            {data.sync}
            <span><Icon name="community" width={14} height={14} />{plural(data.people.length, "member", "members")}</span>
          </div>
        </div>
        <nav aria-label="Project sections" className="solve-room-sections">
          <Link href={`${projectUrl}/room`} aria-current="page"><Icon name="chat" width={17} height={17} />Conversation</Link>
          <Link href={`${projectUrl}/work`}><Icon name="projects" width={17} height={17} />Work</Link>
          <Link href={`${projectUrl}#documents-heading`}><Icon name="document" width={17} height={17} />Documents</Link>
          <Link href={`${projectUrl}#people-heading`}><Icon name="community" width={17} height={17} />People &amp; access</Link>
          <Link href={projectUrl} className="solve-room-details-link">Project details<Icon name="arrow" width={15} height={15} /></Link>
        </nav>
      </header>

      {data.notice ? (
        <p role={data.notice.tone === "error" ? "alert" : "status"} className={`solve-room-notice ${data.notice.tone === "error" ? "solve-room-error" : "solve-room-success"}`}>
          {data.notice.text}
        </p>
      ) : null}

      <div className="solve-room-workspace">
        <div className="solve-room-main">
          <div className="solve-room-conversation">
            {data.conversation ? (
              <SharedConversation worldId={data.worldId} {...data.conversation} canWrite={data.canWrite} currentActorId={data.currentActorId} />
            ) : (
              <section aria-labelledby="shared-conversation-heading">
                <h2 id="shared-conversation-heading">Shared conversation</h2>
                <p role="status">The shared conversation could not be loaded. Reload the project to try again.</p>
              </section>
            )}
          </div>

          {data.canWrite ? <div className="solve-room-publish"><SourcePublisher worldId={data.worldId} /></div> : null}

          <section aria-labelledby="room-tools-heading" className="solve-room-tools">
            <div className="solve-room-tools-heading">
              <h2 id="room-tools-heading">Project tools</h2>
              <p>Open what you need for the next step.</p>
            </div>
            {data.conversation ? <CostWorksheet worldId={data.worldId} canWrite={data.canWrite ?? false} /> : null}

            {data.repo || data.linkRepo ? (
              <details className="solve-room-disclosure">
                <summary><span>Repository and build</span><span className="solve-room-summary-note">{read?.ok ? `${read.view.ref.owner}/${read.view.ref.repo}` : "GitHub"}</span></summary>
                <div className="solve-room-disclosure-body">
                  {read ? (
                    read.ok ? (
                      <>
                        {data.repo?.unread ? (
                          <div className="solve-room-repo-notice">
                            <p><strong>The trunk as this app was deployed.</strong> Live builds and open pull requests need GitHub read access.</p>
                            {data.repo.unread === "not_connected" || data.repo.unread === "not_found" ? <TokenNeeded paired={data.repo.paired} worldId={data.worldId} name={`${read.view.ref.owner}/${read.view.ref.repo}`} trunk={read.view.trunk} /> : null}
                          </div>
                        ) : null}
                        <BuildMap view={read.view} now={data.now} save={data.saveBuild} savedLinks={new Set(data.saves.map(s => s.link).filter((link): link is string => !!link))} />
                        {toReview.length ? (
                          <section aria-labelledby="room-reviews-heading" className="solve-room-record-section">
                            <h3 id="room-reviews-heading">Review to merge</h3>
                            <ul className="solve-room-record-list">
                              {toReview.map(pull => <li key={pull.number}><a href={pull.url} target="_blank" rel="noopener noreferrer">#{pull.number} {pull.title}</a><span>{pull.branch}</span></li>)}
                            </ul>
                          </section>
                        ) : null}
                      </>
                    ) : <RepoUnavailable read={read} paired={data.repo?.paired ?? false} worldId={data.worldId} />
                  ) : data.linkRepo ? <LinkRepoForm linkRepo={data.linkRepo} requestId={data.requestId} /> : null}
                </div>
              </details>
            ) : null}

            <details className="solve-room-disclosure">
              <summary><span>Resources and saved progress</span><span className="solve-room-summary-note">On the record</span></summary>
              <div className="solve-room-disclosure-body">
                <section aria-labelledby="room-resources-heading" className="solve-room-record-section">
                  <h3 id="room-resources-heading">Shared resources</h3>
                  {resources.length ? (
                    <ul className="solve-room-record-list">
                      {resources.map(piece => <li key={piece.id}><Link href={`${projectUrl}#piece-${piece.id}`}><Icon name="document" width={17} height={17} />{piece.title}</Link>{piece.saved ? <span>Saved with proof</span> : null}</li>)}
                    </ul>
                  ) : <p>No shared resources yet. Add a document or selected knowledge when you are ready.</p>}
                </section>
                <section aria-labelledby="room-proof-heading" className="solve-room-record-section">
                  <h3 id="room-proof-heading">Saved proof</h3>
                  {read?.ok && read.view.trunkBuilds[0] ? <BuildMark build={read.view.trunkBuilds[0]} now={data.now} /> : null}
                  {data.saves.length ? (
                    <div className="solve-room-saves">{data.saves.slice().reverse().map(save => {
                      const author = data.people.find(person => person.id === save.by);
                      return <SavePoint key={save.recordId} what={save.what} basis={save.basis} at={save.at} number={save.number} link={save.link} who={author?.you ? "you" : author?.label ?? "the recorded author"} />;
                    })}</div>
                  ) : <p>No proof has been saved in this project yet.</p>}
                </section>
                {data.activity.length ? (
                  <section aria-labelledby="room-activity-heading" className="solve-room-record-section">
                    <h3 id="room-activity-heading">Recent activity</h3>
                    <ol className="solve-room-activity">
                      {data.activity.map(activity => <li key={activity.id}><span>{activity.what}<span className="solve-room-activity-who"> · {activity.who}</span></span><time dateTime={activity.at}>{ago(activity.at, data.now)}</time></li>)}
                    </ol>
                  </section>
                ) : null}
                {data.addNote ? (
                  <details className="solve-room-note">
                    <summary>Add a project note</summary>
                    <form action={data.addNote}>
                      <input type="hidden" name="requestId" value={data.requestId ?? ""} />
                      <label htmlFor="room-note">Note or next step</label>
                      <textarea id="room-note" name="note" required maxLength={7000} rows={3} placeholder="Keep a note with the project resources…" />
                      <button type="submit" className="solve-room-button">Save note</button>
                    </form>
                  </details>
                ) : null}
              </div>
            </details>
          </section>
        </div>

        <aside aria-labelledby="room-members-heading" className="solve-room-members">
          <div className="solve-room-members-heading"><h2 id="room-members-heading">Project members</h2><span>{data.people.length}</span></div>
          {data.people.length ? (
            <ul className="solve-room-people">
              {data.people.map(person => (
                <li key={person.id}>
                  <span aria-hidden="true" className={`solve-room-person-icon${person.kind === "agent" ? " solve-room-ai-icon" : ""}`}>{person.kind === "agent" ? <Icon name="ai" width={18} height={18} /> : person.label.trim().slice(0, 1).toUpperCase() || "·"}</span>
                  <div><strong>{person.label}{person.you ? " (you)" : ""}</strong><span>{KIND_MARK[person.kind]}</span></div>
                </li>
              ))}
            </ul>
          ) : <p className="solve-room-muted">No members could be loaded.</p>}
          <Link href={`${projectUrl}#people-heading`} className="solve-room-manage">Manage people &amp; access<Icon name="arrow" width={15} height={15} /></Link>
          <p className="solve-room-access-note"><Icon name="lock" width={14} height={14} />Shared work is visible to members with project access.</p>
          <section aria-labelledby="room-ai-heading" className="solve-room-personal-ai">
            <h3 id="room-ai-heading">Your AI</h3>
            {data.botName ? <><p>{data.botName}</p><span>{data.assistants.length ? `Connected through ${data.assistants.map(assistant => assistant.clientName).join(", ")}.` : "No external assistant connected."}</span></> : <p>Set up your AI and choose the knowledge you want to share.</p>}
            {data.live}
            <Link href="/bot">{data.botName ? "Manage your AI" : "Set up your AI"}<Icon name="arrow" width={15} height={15} /></Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
