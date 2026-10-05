// Where the bot works: the person's Worlds and what their bot may do in each. Every change is a
// kernel grant the person issues or revokes, and it shows in that World's history.
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { label } from "@/app/ui";
import { CopyField } from "./copy-field";
import { ACCESS_DAYS, type WorldAccess, type WorldWithAccess } from "@/lib/bot/worlds";
import { setWorldAccessAction } from "./actions";
import { SavePoint } from "@/app/save-point";
import { ShareSave } from "./share-save";
import type { SavedProof } from "@/lib/bot/proof";

const LEVELS: [WorldAccess, string][] = [
  ["none", "Out"],
  ["read", "Read"],
  ["add", "Add"],
];

export function WorldsPanel({ botName, botAgentId, worlds, saves = {}, ownerId }: { botName: string; botAgentId: string; worlds: WorldWithAccess[]; saves?: Record<string, SavedProof[]>; ownerId?: string }) {
  return (
    <section className="flex flex-col gap-4 border-t border-line pt-6">
      <div className="flex flex-col gap-2">
        <p className={label}>Where {botName} works</p>
        <p className="max-w-2xl text-sm leading-6 text-muted">
          Let {botName} into a World, and the assistant you connected can read it or add drafts to it as {botName}. Access lasts {ACCESS_DAYS} days, appears in the World&apos;s history, and you can take it back here. Your assistant can also start a new World for a goal. When something becomes real, give your assistant the proof and it&apos;s saved here.
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(18rem,0.7fr)] sm:items-center">
          <p className="text-xs leading-5 text-muted">Share this ID with a World owner who wants to invite {botName}.</p>
          <CopyField value={botAgentId} name="Bot SOV ID" />
        </div>
      </div>
      {worlds.length === 0 ? (
        <p className="text-sm text-muted">
          No Worlds yet.{" "}
          <Link href="/worlds" className="text-accent underline decoration-line underline-offset-4">Start one</Link>, or ask your assistant to start one for something you want done.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {worlds.map((w) => (
            <li key={w.worldId} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line p-3">
              <Link href={`/world/${w.worldId}`} className="min-w-0 flex-1 truncate text-sm transition-colors duration-300 ease-calm hover:text-accent">
                {w.title}
              </Link>
              <form action={setWorldAccessAction} className="flex items-center gap-1" aria-label={`What ${botName} may do in ${w.title}`}>
                <input type="hidden" name="world_id" value={w.worldId} />
                <input type="hidden" name="request_id" value={randomUUID()} />
                {LEVELS.map(([value, text]) => (
                  <button
                    key={value}
                    name="access"
                    value={value}
                    aria-pressed={w.access === value}
                    className={`h-8 rounded-md border px-3 text-[11px] font-semibold uppercase tracking-[0.2em] transition-colors duration-300 ease-calm ${
                      w.access === value ? "border-accent text-accent" : "border-line text-muted hover:text-foreground"
                    }`}
                  >
                    {text}
                  </button>
                ))}
              </form>
              {saves[w.worldId]?.length ? (
                <div className="flex w-full flex-col gap-2 border-t border-line pt-3">
                  {saves[w.worldId].map((p) => (
                    <div key={p.recordId} className="flex flex-col gap-1.5">
                      <SavePoint what={p.what} basis={p.basis} at={p.at} number={p.number} link={p.link} />
                      {ownerId && p.by === ownerId ? <ShareSave worldId={w.worldId} recordId={p.recordId} /> : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
