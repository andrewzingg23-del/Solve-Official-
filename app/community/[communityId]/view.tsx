import { RecoverableForm } from "@/app/product/recoverable-form";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { Icon } from "@/app/product/icons";
import { COMMUNITY_LIMITS, type Community, type JoinRequest, type Member, type MyAsk, type Note, type Standing } from "@/lib/community/community";
import { aiNotesAction, answerAskAction, askToJoinAction, letMyAiInAction, sendNoteAction } from "./actions";
import { AskRoom } from "./ask-room";
import { RoomBrief } from "./room-brief";
import styles from "@/app/communities/community.module.css";

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
  aiNotes: { until: string | null } | null;
  roomAiConfigured: boolean;
};

const when = (at: string) => new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export function CommunityView({ data, status }: { data: Loaded; status: { bad: boolean; text: string } | null }) {
  const { community: c, standing } = data;
  const id = c.communityId;
  const inside = standing !== "guest";
  const botId = data.bot?.agentId;
  const myBotIn = Boolean(botId && (data.people.some((p) => p.ais.some((a) => a.agentId === botId)) || data.guests.some((g) => g.agentId === botId)));
  const latest = data.asks[0] ?? null;
  const waiting = Boolean(latest && !latest.answer);
  const waitingForAi = Boolean(waiting && botId && latest?.bot === botId);

  return (
    <>
      <header className={styles.communityHeading}>
        <div className={styles.headingMeta}><span className="solve-kicker">Community</span>{inside ? <span className={styles.badge}>{standing === "owner" ? "Owner" : "Member"}</span> : null}<span>Started by {data.ownerName}</span></div>
        <h1>{c.name}</h1>
        {c.about ? <p>{c.about}</p> : null}
        {status ? <div role={status.bad ? "alert" : "status"} className={`${styles.status} ${status.bad ? styles.statusError : ""}`}>{status.text}</div> : null}
        {inside ? (
          <div className={styles.roomLink}>
            <div className={styles.actions}>
              <Link href={`/world/${id}/room`} className="solve-button"><Icon name="chat" width={18} />Open shared project<Icon name="arrow" width={16} /></Link>
              <Link href={`/world/${id}`} className="solve-button solve-button-secondary">Project details</Link>
            </div>
            <p>Keep your conversation, documents, and progress in the shared project room.</p>
          </div>
        ) : null}
      </header>

      <div className={styles.detailLayout}>
        <div className={styles.stack}>
          {standing === "guest" ? (
            <section className={`solve-panel ${styles.section}`} aria-labelledby="join-community-heading">
              <h2 id="join-community-heading">Ask to join</h2>
              <p>Membership gives you access to the shared project. {data.ownerName} reviews each request.</p>
              {waiting && latest ? <p>You asked on <time dateTime={latest.at}>{when(latest.at)}</time>. Your request is waiting for {data.ownerName}.</p> : (
                <>
                  {latest?.answer === "declined" ? <p>Your previous request was declined{latest.answeredAt ? ` on ${when(latest.answeredAt)}` : ""}. You can send a new request.</p> : null}
                  <AskForm id={id} me={data.me} bot={data.bot} label="Send join request" note />
                </>
              )}
            </section>
          ) : null}
          {standing === "owner" ? <Asks id={id} me={data.me} open={data.open} /> : null}
          {inside ? <Notes id={id} me={data.me} notes={data.notes} /> : null}
          {inside && data.roomAiConfigured ? (
            <section className={`solve-panel ${styles.section}`} aria-labelledby="community-assistant-heading">
              <h2 id="community-assistant-heading">Your community notes</h2>
              <p>The assistant summarizes notes addressed to you and answers questions from that context. Check its answers against the original notes.</p>
              <div className={styles.assistant}><RoomBrief id={id} botName="Community assistant" /></div>
              <div className={styles.assistant}><AskRoom id={id} /></div>
            </section>
          ) : null}
        </div>

        <aside className={styles.stack}>
          {inside ? <People id={id} me={data.me} people={data.people} guests={data.guests} /> : (
            <section className={`solve-panel ${styles.section}`}>
              <span className={styles.iconTile}><Icon name="lock" /></span>
              <h2>Shared work stays with members.</h2>
              <p>Once your request is approved, you can enter the project room, see the member list, and send notes to people here.</p>
            </section>
          )}
          {inside ? <YourAi id={id} data={data} botIn={myBotIn} waiting={waitingForAi} /> : null}
          {standing === "owner" ? (
            <section className={`solve-panel ${styles.section}`}>
              <details className={styles.disclosure}>
                <summary>Owner settings</summary>
                <div><p>Share this community page to invite people to ask to join. You can manage existing people and AI access in the project.</p><Link href={`/world/${id}#people-heading`} className="solve-button solve-button-secondary">Manage access<Icon name="arrow" width={16} /></Link></div>
              </details>
            </section>
          ) : null}
        </aside>
      </div>
    </>
  );
}

function YourAi({ id, data, botIn, waiting }: { id: string; data: Loaded; botIn: boolean; waiting: boolean }) {
  const bot = data.bot;
  const me = data.me;
  return (
    <section className={`solve-panel ${styles.section}`} aria-labelledby="community-ai-heading">
      <h2 id="community-ai-heading">Your AI</h2>
      {!bot ? <><p>Create your personal AI, then request access to the shared project. You choose its knowledge and connect an assistant separately.</p><Link href="/bot" className="solve-button solve-button-secondary">Set up your AI<Icon name="arrow" width={16} /></Link></> : (
        <>
          <div className={styles.aiStatus}><Icon name="ai" width={18} />{bot.name} · {botIn ? "Project access granted" : waiting ? "Access request pending" : "No project access"}</div>
          {botIn ? <p>Project permissions determine what {bot.name} can read or add through an authorized connection. Connect an assistant in Your AI to use this access.</p> : data.standing === "owner" ? (
            <><p>Allow {bot.name} to read and add to the shared project under its own identity.</p><RecoverableForm ownerActorId={me} action={letMyAiInAction.bind(null, id)}><button type="submit" className="solve-button solve-button-secondary">Allow project access</button></RecoverableForm></>
          ) : waiting ? <p>{data.ownerName} will review your request to bring {bot.name} into the project.</p> : (
            <><p>The owner needs to approve {bot.name} before it can read or add to the project.</p><AskForm id={id} me={me} bot={bot} label="Request AI access" fixedBot /></>
          )}
          <Link href="/bot" className={styles.textLink}>Manage your AI and connections<Icon name="arrow" width={16} /></Link>
          {botIn || data.aiNotes ? (
            <details className={styles.disclosure}>
              <summary>Permission to send notes</summary>
              <div>
                <p>{data.aiNotes ? `${bot.name} has permission to send notes for you here${data.aiNotes.until ? ` until ${when(data.aiNotes.until)}` : ""}. Each note records your name and the AI that sent it.` : `You can separately allow ${bot.name} to send notes to community members for you. Each note records who sent it, and you can remove this permission.`}</p>
                <p>An authorized connection is required to use this permission.</p>
                <RecoverableForm ownerActorId={me} action={aiNotesAction.bind(null, id)}>
                  <input type="hidden" name="requestId" value={randomUUID()} />
                  <input type="hidden" name="on" value={data.aiNotes ? "off" : "on"} />
                  <button type="submit" className="solve-button solve-button-secondary">{data.aiNotes ? "Remove notes permission" : "Allow AI to send notes"}</button>
                </RecoverableForm>
              </div>
            </details>
          ) : null}
        </>
      )}
    </section>
  );
}

function AskForm({ id, me, bot, label: text, note = false, fixedBot = false }: { id: string; me: string; bot: Loaded["bot"]; label: string; note?: boolean; fixedBot?: boolean }) {
  return (
    <RecoverableForm ownerActorId={me} action={askToJoinAction.bind(null, id)} className="solve-form">
      <input type="hidden" name="requestId" value={randomUUID()} />
      {note ? <><label htmlFor="ask-note">A note for the owner <span className="solve-muted">(optional)</span></label><textarea id="ask-note" name="note" rows={3} maxLength={COMMUNITY_LIMITS.note} placeholder="Introduce yourself and what you'd like to build together." /></> : null}
      {bot ? fixedBot ? <input type="hidden" name="bringBot" value="on" /> : <label className={styles.checkLabel}><input type="checkbox" name="bringBot" /><span>Also request project access for {bot.name}, my AI.</span></label> : null}
      <button type="submit" className="solve-button">{text}<Icon name="arrow" width={16} /></button>
    </RecoverableForm>
  );
}

function Asks({ id, me, open }: { id: string; me: string; open: JoinRequest[] }) {
  return (
    <section className={`solve-panel ${styles.section}`} aria-labelledby="community-requests-heading">
      <div className={styles.sectionHeading}><h2 id="community-requests-heading">Join requests</h2><span>{open.length} pending</span></div>
      {open.length ? <ul className={styles.rows}>{open.map((r) => (
        <li key={r.id} className={styles.request}>
          <div className={styles.person}><span className={styles.initial} aria-hidden="true">{r.name.slice(0, 1).toUpperCase()}</span><div className={styles.personInfo}><strong>{r.name}</strong><p>{r.member ? "Already a member · requesting AI access" : "Requesting membership"}{r.bot ? ` · with ${r.bot.name}` : ""}</p></div></div>
          {r.note ? <p className={styles.requestText}>{r.note}</p> : null}
          <p className={styles.rowMeta}><time dateTime={r.at}>{when(r.at)}</time> · Person ID {r.personId.slice(0, 8)}</p>
          <div className={styles.actions}>
            <RecoverableForm ownerActorId={me} action={answerAskAction.bind(null, id)}><input type="hidden" name="askId" value={r.id} /><input type="hidden" name="answer" value="in" /><button type="submit" className="solve-button">{r.member ? "Approve AI access" : "Approve request"}</button></RecoverableForm>
            <RecoverableForm ownerActorId={me} action={answerAskAction.bind(null, id)}><input type="hidden" name="askId" value={r.id} /><input type="hidden" name="answer" value="declined" /><button type="submit" className="solve-button solve-button-secondary">Decline</button></RecoverableForm>
          </div>
        </li>
      ))}</ul> : <p>No requests waiting. Share this community page so people can ask to join.</p>}
    </section>
  );
}

function People({ id, me, people, guests }: { id: string; me: string; people: Member[]; guests: { agentId: string; name: string }[] }) {
  return (
    <section className={`solve-panel ${styles.section}`} aria-labelledby="community-members-heading">
      <div className={styles.sectionHeading}><h2 id="community-members-heading">People</h2><span>{people.length} {people.length === 1 ? "person" : "people"}</span></div>
      <ul className={styles.rows}>{people.map((p) => (
        <li key={p.actorId}>
          <div className={styles.person}>
            <span className={styles.initial} aria-hidden="true">{p.name.slice(0, 1).toUpperCase()}</span>
            <div className={styles.personInfo}><strong>{p.name}{p.actorId === me ? <span className={styles.you}>You</span> : null}</strong><p>{p.role === "owner" ? "Owner" : p.role === "member" ? "Member" : "Can view"}</p>{p.ais.length ? <small>With {p.ais.map((a) => a.name).join(", ")}</small> : null}</div>
          </div>
          {p.actorId !== me ? <details className={`${styles.disclosure} ${styles.noteDisclosure}`}><summary>Send {p.name} a note</summary><NoteForm id={id} me={me} to={p.actorId} recipient={p.name} /></details> : null}
        </li>
      ))}</ul>
      {guests.length ? <p>Additional AIs with access: {guests.map((g) => g.name).join(", ")}.</p> : null}
    </section>
  );
}

function NoteForm({ id, me, to, recipient, inReplyTo }: { id: string; me: string; to: string; recipient: string; inReplyTo?: string }) {
  const inputId = `note-${to}-${inReplyTo ?? "new"}`;
  return (
    <RecoverableForm ownerActorId={me} action={sendNoteAction.bind(null, id)} className={styles.noteForm}>
      <input type="hidden" name="to" value={to} /><input type="hidden" name="requestId" value={randomUUID()} />
      {inReplyTo ? <input type="hidden" name="inReplyTo" value={inReplyTo} /> : null}
      <label htmlFor={inputId}>{inReplyTo ? `Reply to ${recipient}` : `Your note to ${recipient}`}</label>
      <textarea id={inputId} name="text" required maxLength={COMMUNITY_LIMITS.note} rows={3} placeholder="Write a note…" />
      <button type="submit" className="solve-button solve-button-secondary">{inReplyTo ? "Send reply" : "Send note"}<Icon name="arrow" width={16} /></button>
    </RecoverableForm>
  );
}

function Notes({ id, me, notes }: { id: string; me: string; notes: Note[] }) {
  return (
    <section className={`solve-panel ${styles.section}`} aria-labelledby="community-notes-heading">
      <h2 id="community-notes-heading">Notes for you</h2>
      {notes.length ? <ul className={styles.rows}>{notes.map((n) => (
        <li key={n.id} className={styles.note}>
          <div className={styles.noteHeader}><strong>{n.from}</strong><time dateTime={n.at}>{when(n.at)}</time></div>
          {n.via || n.inReplyTo ? <p className={styles.rowMeta}>{n.via ? `Sent by ${n.via}, for ${n.from}` : ""}{n.via && n.inReplyTo ? " · " : ""}{n.inReplyTo ? "Reply" : ""}</p> : null}
          <p className={styles.requestText}>{n.text}</p>
          <details className={`${styles.disclosure} ${styles.noteDisclosure}`}><summary>Reply to {n.from}</summary><NoteForm id={id} me={me} to={n.fromId} recipient={n.from} inReplyTo={n.id} /></details>
        </li>
      ))}</ul> : <p>No notes yet. Choose someone in People to send your first note. Notes record the person and AI that sent them.</p>}
    </section>
  );
}
