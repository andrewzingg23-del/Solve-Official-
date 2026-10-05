// The Command Center (VISION-CANON: "zoom toward their node, then into their personal Command
// Center"). Its sections follow the canon's promise, in order: where you are, where you want to go
// and the routes there, the systems and people with you, what actually happened, and what's next.
// Everything shown is read from the record. Empty means empty, never filled with examples.
import type { ReactNode } from "react";
import Link from "next/link";
import { label, quietLink } from "@/app/ui";
import { day, SavePoint } from "@/app/save-point";
import { WaitingOnYou } from "@/app/bot/waiting";
import type { Connection } from "@/lib/bot/memory";
import type { SavedProof } from "@/lib/bot/proof";
import { groupGaps, type Gap } from "@/lib/bot/gaps";
import { formatValue, OUTCOME_LABEL } from "@/lib/bot/outreach";
import { madeIn, noticed, waitingFrom, type Approval, type Journey, type Result } from "@/lib/bot/waiting";
import type { MyCommunity } from "@/lib/community/community";

export type CommandData = {
  name: string; // the person's label
  botName: string | null;
  worlds: { worldId: string; title: string; updatedAt: string }[];
  journeys: Journey[];
  now?: Date; // for what is noticed; the page passes the time of the request
  connections: Connection[];
  gaps?: Gap[]; // what assistants recorded that solve can't do yet
  approvals?: Approval[]; // outreach messages waiting for the person's approval
  results?: Result[]; // what happened with approved outreach, latest first
  saves: (SavedProof & { worldId: string; worldTitle: string })[];
  live?: ReactNode; // who is working right now, when presence is available
  wallet?: ReactNode; // the person's linked wallets and the way to link one
  repoRoom?: ReactNode; // a paired repository with no room yet
  communities?: MyCommunity[]; // the ones they started or are in, with what waits on them
};

function Communities({ list }: { list: MyCommunity[] }) {
  const waiting = (c: MyCommunity) => [c.asking ? plural(c.asking, "person asking to join", "people asking to join") : "", c.requests ? plural(c.requests, "request", "requests") : ""].filter(Boolean).join(" · ");
  return (
    <Section id="communities" title="Communities" aside={<Link href="/communities" className={quietLink}>{list.length ? "All" : "Start or join one"}</Link>}>
      {list.length ? (
        <ul className="flex flex-col divide-y divide-line">
          {list.map((c) => (
            <li key={c.communityId} className="flex items-baseline justify-between gap-4 py-2 text-sm">
              <Link href={`/community/${c.communityId}`} className="min-w-0 truncate hover:text-accent">{c.name}</Link>
              <span className={`shrink-0 text-xs tabular-nums ${waiting(c) ? "font-medium text-foreground" : "text-muted"}`}>{waiting(c) || (c.standing === "owner" ? "yours" : "you're in")}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm leading-6 text-muted">Build with others: start a community, or ask to join one. Your AI can come with you.</p>
      )}
    </Section>
  );
}

function Section({ id, title, children, aside }: { id: string; title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 rounded-md border border-line bg-surface/45 p-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id={id} className={label}>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function journeyState(j: Journey) {
  if (j.state === "proposed") return `Proposed · ${plural(j.options.length, "route", "routes")}${j.canChoose ? "" : " · its owner chooses"}`;
  if (j.state === "done") return `${j.route} · all ${j.total} steps done`;
  return `${j.route} · ${j.done} of ${j.total} done`;
}

export function CommandView({ data }: { data: CommandData }) {
  const underway = data.journeys.filter((j) => j.state === "underway").length;
  const waiting = waitingFrom(data.journeys, data.approvals);
  const seen = noticed(data.journeys, data.now);
  const year = (data.now ?? new Date()).getUTCFullYear();
  const made = madeIn(data.results ?? [], year);
  return (
    <div className="flex flex-col gap-6">
      {data.repoRoom}
      <Section id="where-you-are" title="Where you are">
        <p className="text-sm leading-6">
          {data.worlds.length
            ? `${plural(data.worlds.length, "World", "Worlds")} · ${plural(underway, "route", "routes")} underway · ${plural(data.saves.length, "recent save", "recent saves")} on the record`
            : "No Worlds yet. A World starts from something you want to make real."}
        </p>
        {made.length ? (
          <p className="text-sm leading-6 tabular-nums">
            Made through solve in {year}: {made.map(formatValue).join(" + ")} <span className="text-muted">· from wins you recorded, on your word</span>
          </p>
        ) : null}
        {data.worlds.length ? (
          <ul className="flex flex-col divide-y divide-line">
            {data.worlds.map((w) => (
              <li key={w.worldId} className="flex items-baseline justify-between gap-4 py-2 text-sm">
                <Link href={`/world/${w.worldId}/room`} className="min-w-0 truncate hover:text-accent">{w.title}</Link>
                <span className="shrink-0 text-xs text-muted tabular-nums">changed {day(w.updatedAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Link href="/worlds" className={quietLink}>Start a World</Link>
        )}
      </Section>

      <Communities list={data.communities ?? []} />

      <WaitingOnYou items={waiting} />

      {seen.length ? (
        <Section id="noticed" title="Noticed">
          <ul className="flex flex-col divide-y divide-line">
            {seen.map((n) => (
              <li key={n.pieceId} className="py-2 text-sm leading-6">
                <Link href={`/world/${n.worldId}#piece-${n.pieceId}`} className="break-words hover:text-accent">{n.text}</Link>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">Read from the record. Nothing here acts or tells anyone else.</p>
        </Section>
      ) : null}

      <Section id="where-going" title="Where you're going">
        {data.journeys.length ? (
          <ol className="flex flex-col divide-y divide-line">
            {data.journeys.map((j) => (
              <li key={j.pieceId} className="flex flex-col gap-1 py-3 text-sm">
                <Link href={`/world/${j.worldId}#piece-${j.pieceId}`} className="break-words hover:text-accent">{j.ask}</Link>
                <span className="break-words text-xs leading-5 text-muted tabular-nums">{journeyState(j)} · in {j.worldTitle}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm leading-6 text-muted">Nothing asked yet. Ask your assistant for a way to do something; it researches and proposes up to three routes here.</p>
        )}
      </Section>

      <Section id="party" title="With you">
        {data.botName ? (
          <>
            <p className="text-sm leading-6">
              {data.botName}, your bot{data.connections.length ? `, with ${plural(data.connections.length, "assistant", "assistants")} connected` : ", with no assistant connected yet"}.
            </p>
            {data.connections.length ? (
              <ul className="flex flex-col divide-y divide-line">
                {data.connections.map((c) => (
                  <li key={c.clientId} className="flex items-baseline justify-between gap-4 py-2 text-sm">
                    <span className="min-w-0 truncate">{c.clientName}</span>
                    <span className="shrink-0 text-xs text-muted tabular-nums">{c.mode === "remember" ? "can add" : "read only"} · since {day(c.since)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <Link href="/bot" className={quietLink}>Connect your AI</Link>
            )}
            {data.live}
          </>
        ) : (
          <Link href="/bot" className={quietLink}>Make your bot</Link>
        )}
        {data.wallet}
      </Section>

      <Section id="happened" title="What actually happened">
        {data.results?.length ? (
          <ul className="flex flex-col divide-y divide-line">
            {data.results.map((r) => (
              <li key={`${r.pieceId}:${r.business}`} className="flex flex-col gap-0.5 py-2 text-sm">
                <span>
                  {OUTCOME_LABEL[r.outcome]}{r.value ? ` · ${formatValue(r.value)}` : ""} · {r.business}
                  {r.note ? <span className="text-muted"> · {r.note}</span> : null}
                </span>
                <span className="text-xs text-muted tabular-nums">
                  on your word · {day(r.at)} · <Link href={`/world/${r.worldId}`} className="hover:text-accent">in {r.worldTitle}</Link>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {data.saves.length ? (
          <div className="flex flex-col gap-3">
            {data.saves.map((s) => (
              <div key={s.recordId} className="flex flex-col gap-1">
                <SavePoint what={s.what} basis={s.basis} at={s.at} number={s.number} link={s.link} />
                <Link href={`/world/${s.worldId}`} className="pl-[18px] text-xs text-muted hover:text-accent">in {s.worldTitle}</Link>
              </div>
            ))}
          </div>
        ) : data.results?.length ? null : (
          <p className="text-sm leading-6 text-muted">Nothing saved yet. When something becomes real, save the proof on it and it shows here.</p>
        )}
      </Section>

      {data.gaps?.length ? (
        <Section id="gaps" title="What solve can't do yet">
          <ul className="flex flex-col divide-y divide-line">
            {groupGaps(data.gaps).map((g) => (
              <li key={g.latest.pieceId} className="flex flex-col gap-1 py-3 text-sm">
                <Link href={`/world/${g.latest.worldId}`} className="break-words hover:text-accent">{g.goal}</Link>
                <span className="break-words text-xs leading-5 text-muted">{g.result}</span>
                <span className="text-xs text-muted tabular-nums">
                  {g.times > 1 ? `Needed ${g.times} times` : "Needed once"} · in {g.worlds.join(", ")}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs leading-5 text-muted">Drafts your assistants recorded when solve couldn&apos;t do what you asked. Needs that repeat are the next things to build. Nothing here runs.</p>
        </Section>
      ) : null}

      <Section id="next" title="What's next">
        <p className="text-sm leading-6 text-muted">
          {waiting.length
            ? "Start with what's waiting on you."
            : data.journeys.some((j) => j.state === "done")
              ? "A route is done. Save its proof, then ask for the next thing you want to make real."
              : "Ask your assistant: \"Find me three ways to…\" Routes it proposes show up here."}
        </p>
      </Section>
    </div>
  );
}
