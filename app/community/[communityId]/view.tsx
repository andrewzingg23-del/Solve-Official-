// One community, as it renders: its profile; for members, the room, who is in it and notes; for the
// person who started it, the asks to join and the solar desk. Data comes from page.tsx.
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { label, primaryAction, secondaryAction } from "@/app/ui";
import { COMMUNITY_LIMITS, type Community, type JoinRequest, type Member, type MyAsk, type Note, type Standing } from "@/lib/community/community";
import { PACK_IDS, PACKS } from "@/lib/community/packs";
import type { DesignRequest } from "@/lib/solar/desk";
import { aiNotesAction, answerAskAction, answerDesignAction, askToJoinAction, letMyAiInAction, sendNoteAction, updatePacksAction } from "./actions";
import { DeskRequest } from "./desk";

export type Loaded = {
  community: Community;
  me: string;
  standing: Standing;
  ownerName: string;
  bot: { agentId: string; name: string } | null;
  asks: MyAsk[];
  people: Member[];
  guests: { agentId: string; name: string }[];
  notes: Note[];
  open: JoinRequest[];
  desk: DesignRequest[] | null;
  // Whether the /solar door sends its requests to this community.
  routed: boolean;
  // Whether the person's AI may send notes for them here, and until when.
  aiNotes: { until: string | null } | null;
};

const input = "rounded-md border border-line bg-background px-3 text-sm outline-none transition-colors focus:border-accent";
export const panel = "flex flex-col gap-4 rounded-md border border-line bg-surface/75 p-5 md:p-7";
const when = (at: string) => new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export function CommunityView({ data, status }: { data: Loaded; status: { bad: boolean; text: string } | null }) {
  const { community: c, standing } = data;
  const id = c.communityId;
  const inside = standing !== "guest";
  const myBotIn = data.bot ? data.people.some((p) => p.ais.some((a) => a.agentId === data.bot!.agentId)) || data.guests.some((g) => g.agentId === data.bot!.agentId) : false;
  const latest = data.asks[0] ?? null;
  const waiting = latest && !latest.answer;

  return (
    <>
      <section className="flex flex-col gap-4">
        <p className={label}>{standing === "owner" ? "Your community" : standing === "member" ? "You're in" : `Started by ${data.ownerName}`}</p>
        <h1 className="max-w-4xl text-4xl font-medium leading-tight tracking-tight md:text-6xl">{c.name}</h1>
        {c.about ? <p className="max-w-2xl whitespace-pre-line text-base leading-7 text-muted">{c.about}</p> : null}
        {status ? (
          <p role={status.bad ? "alert" : "status"} className={`max-w-2xl rounded-md border p-3 text-sm ${status.bad ? "border-negative/30 bg-negative/10 text-negative" : "border-line bg-surface"}`}>{status.text}</p>
        ) : null}
        {inside ? (
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link href={`/world/${id}/room`} className={primaryAction}>Enter the room</Link>
            <Link href={`/world/${id}`} className={secondaryAction}>Pieces and history</Link>
          </div>
        ) : null}
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.75fr)] lg:items-start">
        <div className="flex flex-col gap-8">
          {standing === "guest" ? (
            <div className={panel}>
              <p className={label}>Join</p>
              {waiting ? (
                <p className="text-sm leading-6">You asked on {when(latest.at)}. {data.ownerName} hasn&apos;t answered yet; you&apos;ll see it here.</p>
              ) : (
                <>
                  {latest?.answer === "declined" ? <p className="text-sm leading-6 text-muted">{data.ownerName} said not now on {when(latest.answeredAt!)}. You can ask again.</p> : null}
                  <AskForm id={id} bot={data.bot} label="Ask to join" note />
                </>
              )}
            </div>
          ) : null}
          {standing === "owner" ? <Asks id={id} open={data.open} /> : null}
          {data.desk ? <Desk id={id} requests={data.desk} routed={data.routed} /> : null}
          {inside ? <People id={id} me={data.me} people={data.people} guests={data.guests} /> : null}
          {inside ? <Notes id={id} notes={data.notes} /> : null}
        </div>

        <aside className="flex flex-col gap-6">
          {inside ? <YourAi id={id} data={data} botIn={myBotIn} waiting={Boolean(waiting)} /> : null}
          <Packs id={id} community={c} owner={standing === "owner"} />
          {standing === "owner" ? (
            <p className="text-xs leading-5 text-muted">
              Invite someone directly: share this page, or add their SOV ID under Access on the <Link href={`/world/${id}`} className="underline hover:text-accent">World page</Link>.
            </p>
          ) : null}
        </aside>
      </div>
    </>
  );
}

function YourAi({ id, data, botIn, waiting }: { id: string; data: Loaded; botIn: boolean; waiting: boolean }) {
  const bot = data.bot;
  return (
    <div className={panel}>
      <p className={label}>Your AI</p>
      {!bot ? (
        <>
          <p className="text-sm leading-6 text-muted">Set up your bot and connect your own assistant, then bring it in here to help.</p>
          <Link href="/bot" className={secondaryAction}>Set up your bot</Link>
        </>
      ) : !botIn ? (
        data.standing === "owner" ? (
          <>
            <p className="text-sm leading-6 text-muted">Let {bot.name} into the room to help. It adds as itself, for you.</p>
            <form action={letMyAiInAction.bind(null, id)}><button type="submit" className={secondaryAction}>Let {bot.name} in</button></form>
          </>
        ) : waiting ? (
          <p className="text-sm leading-6">You asked to bring {bot.name} in. Waiting on {data.ownerName}.</p>
        ) : (
          <>
            <p className="text-sm leading-6 text-muted">Ask {data.ownerName} to let {bot.name} in to help. It adds to the room as itself, for you, and only while you&apos;re in.</p>
            <AskForm id={id} bot={bot} label={`Bring ${bot.name} in`} fixedBot />
          </>
        )
      ) : (
        <>
          <p className="text-sm leading-6">{bot.name} is in. Through your connected assistant it reads the room and adds to it, for you.</p>
          <form action={aiNotesAction.bind(null, id)} className="flex flex-col gap-2">
            <input type="hidden" name="requestId" value={randomUUID()} />
            <input type="hidden" name="on" value={data.aiNotes ? "off" : "on"} />
            <p className="text-xs leading-5 text-muted">
              {data.aiNotes
                ? `${bot.name} can send notes for you here${data.aiNotes.until ? ` until ${when(data.aiNotes.until)}` : ""}. Each shows it came from ${bot.name}, for you.`
                : `Let ${bot.name} reach people here for you. Each note shows it came from ${bot.name}, for you, and you can stop it any time.`}
            </p>
            <button type="submit" className={secondaryAction}>{data.aiNotes ? `Stop ${bot.name}'s notes` : `Let ${bot.name} send notes for me`}</button>
          </form>
        </>
      )}
    </div>
  );
}

function AskForm({ id, bot, label: text, note = false, fixedBot = false }: { id: string; bot: Loaded["bot"]; label: string; note?: boolean; fixedBot?: boolean }) {
  return (
    <form action={askToJoinAction.bind(null, id)} className="flex flex-col gap-3">
      <input type="hidden" name="requestId" value={randomUUID()} />
      {note ? (
        <>
          <label htmlFor="ask-note" className={label}>A note <span className="font-normal normal-case tracking-normal text-muted">(optional)</span></label>
          <textarea id="ask-note" name="note" rows={3} maxLength={COMMUNITY_LIMITS.note} placeholder="Who you are and what you'd build here." className={`resize-y p-3 leading-6 ${input}`} />
        </>
      ) : null}
      {bot ? (
        fixedBot ? <input type="hidden" name="bringBot" value="on" /> : (
          <label className="flex items-start gap-3 text-sm leading-6 text-muted">
            <input type="checkbox" name="bringBot" defaultChecked className="mt-1 accent-accent" />
            <span>Bring {bot.name}, my AI, to help. It works under its own name, for me.</span>
          </label>
        )
      ) : null}
      <button type="submit" className={primaryAction}>{text}</button>
    </form>
  );
}

function Asks({ id, open }: { id: string; open: JoinRequest[] }) {
  return (
    <section className="flex flex-col gap-3">
      <p className={label}>Asking to join · {open.length}</p>
      {open.length ? (
        <ul className="flex flex-col divide-y divide-line border-y border-line">
          {open.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-base font-medium">{r.name}{r.member ? <span className="ml-2 text-xs font-normal text-muted">already in</span> : null}</span>
                {r.note ? <span className="whitespace-pre-line text-sm leading-6 text-muted">{r.note}</span> : null}
                <span className="text-xs text-muted">{when(r.at)}{r.bot ? ` · brings ${r.bot.name}, their AI` : ""} · SOV ID {r.personId.slice(0, 8)}</span>
              </div>
              <div className="flex shrink-0 gap-2">
                <form action={answerAskAction.bind(null, id)}>
                  <input type="hidden" name="askId" value={r.id} />
                  <input type="hidden" name="answer" value="in" />
                  <button type="submit" className={primaryAction}>{r.member ? "Let the AI in" : "Let in"}</button>
                </form>
                <form action={answerAskAction.bind(null, id)}>
                  <input type="hidden" name="askId" value={r.id} />
                  <input type="hidden" name="answer" value="declined" />
                  <button type="submit" className={secondaryAction}>Not now</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm leading-6 text-muted">No one is waiting. Share this page; people ask to join from it.</p>
      )}
    </section>
  );
}

function Desk({ id, requests, routed }: { id: string; requests: DesignRequest[]; routed: boolean }) {
  const open = requests.filter((r) => r.details && !r.answer).length;
  return (
    <section className="flex flex-col gap-3">
      <p className={label}>Solar desk · {open} waiting on a design</p>
      {!routed ? (
        <p className="rounded-md border border-line bg-surface p-3 text-xs leading-5 text-muted">
          The <Link href="/solar" className="underline hover:text-accent">/solar</Link> door sends design requests here once it&apos;s pointed at this community: set SOLAR_COMMUNITY to <span className="font-mono text-foreground">{id}</span> where solve is deployed, or have this id put in solve.communities.json.
        </p>
      ) : null}
      {requests.length ? (
        <ul className="flex flex-col gap-3">
          {requests.map((r) => <DeskRequest key={r.id} request={r} action={answerDesignAction.bind(null, id)} requestId={randomUUID()} />)}
        </ul>
      ) : (
        <p className="text-sm leading-6 text-muted">No requests yet. Homeowners ask from the solar door after they see their price and check whether they qualify.</p>
      )}
    </section>
  );
}

function People({ id, me, people, guests }: { id: string; me: string; people: Member[]; guests: { agentId: string; name: string }[] }) {
  return (
    <section className="flex flex-col gap-3">
      <p className={label}>Who&apos;s in · {people.length}</p>
      <ul className="flex flex-col divide-y divide-line border-y border-line">
        {people.map((p) => (
          <li key={p.actorId} className="flex flex-col gap-3 py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <span className="text-base font-medium">
                {p.name}{p.actorId === me ? <span className="ml-2 text-xs font-normal text-muted">you</span> : null}
              </span>
              <span className="text-xs uppercase tracking-[0.18em] text-muted">{p.role === "owner" ? "Started it" : p.role === "member" ? "Builds" : "Sees"}</span>
            </div>
            {p.ais.length ? <p className="text-xs text-muted">With {p.ais.map((a) => a.name).join(", ")}, {p.actorId === me ? "your" : "their"} AI</p> : null}
            {p.actorId !== me ? (
              <details className="group">
                <summary className="cursor-pointer text-xs uppercase tracking-[0.2em] text-muted hover:text-accent">Leave {p.name} a note</summary>
                <NoteForm id={id} to={p.actorId} />
              </details>
            ) : null}
          </li>
        ))}
      </ul>
      {guests.length ? <p className="text-xs text-muted">Also helping: {guests.map((g) => g.name).join(", ")}.</p> : null}
    </section>
  );
}

function NoteForm({ id, to, inReplyTo }: { id: string; to: string; inReplyTo?: string }) {
  return (
    <form action={sendNoteAction.bind(null, id)} className="mt-3 flex flex-col gap-2 sm:flex-row">
      <input type="hidden" name="to" value={to} />
      <input type="hidden" name="requestId" value={randomUUID()} />
      {inReplyTo ? <input type="hidden" name="inReplyTo" value={inReplyTo} /> : null}
      <input name="text" required maxLength={COMMUNITY_LIMITS.note} placeholder={inReplyTo ? "Reply" : "A note"} aria-label={inReplyTo ? "Reply" : "Note"} className={`h-11 w-full min-w-0 sm:flex-1 ${input}`} />
      <button type="submit" className={secondaryAction}>Send</button>
    </form>
  );
}

function Notes({ id, notes }: { id: string; notes: Note[] }) {
  return (
    <section className="flex flex-col gap-3">
      <p className={label}>Notes for you</p>
      {notes.length ? (
        <ul className="flex flex-col divide-y divide-line border-y border-line">
          {notes.map((n) => (
            <li key={n.id} className="flex flex-col gap-1 py-4">
              <span className="text-xs text-muted">{n.from}{n.via ? `, via ${n.via}, their AI` : ""} · {when(n.at)}{n.inReplyTo ? " · a reply" : ""}</span>
              <span className="whitespace-pre-line text-sm leading-6">{n.text}</span>
              <NoteForm id={id} to={n.fromId} inReplyTo={n.id} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm leading-6 text-muted">None yet. Notes are saved on the record with who sent them.</p>
      )}
    </section>
  );
}

function Packs({ id, community, owner }: { id: string; community: Community; owner: boolean }) {
  return (
    <div className={panel}>
      <p className={label}>Packs</p>
      {community.packs.length ? (
        <ul className="flex flex-col gap-3">
          {community.packs.map((p) => (
            <li key={p} className="flex flex-col gap-1">
              <span className="text-sm font-medium">
                {PACKS[p].href ? <Link href={PACKS[p].href!} className="hover:text-accent">{PACKS[p].name} →</Link> : p === "build" ? <Link href={`/world/${id}/room?lens=build`} className="hover:text-accent">{PACKS[p].name} →</Link> : PACKS[p].name}
                {PACKS[p].practice ? <span className="ml-2 text-[10px] uppercase tracking-[0.18em] text-muted">Practice</span> : null}
              </span>
              <span className="text-xs leading-5 text-muted">{PACKS[p].what}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm leading-6 text-muted">No packs yet.</p>
      )}
      {owner ? (
        <details>
          <summary className="cursor-pointer text-xs uppercase tracking-[0.2em] text-muted hover:text-accent">Change packs</summary>
          <form action={updatePacksAction.bind(null, id)} className="mt-3 flex flex-col gap-2">
            {PACK_IDS.map((p) => (
              <label key={p} className="flex items-center gap-3 text-sm">
                <input type="checkbox" name="packs" value={p} defaultChecked={community.packs.includes(p)} className="accent-accent" />
                {PACKS[p].name}
              </label>
            ))}
            <button type="submit" className={secondaryAction}>Save packs</button>
          </form>
        </details>
      ) : null}
    </div>
  );
}
