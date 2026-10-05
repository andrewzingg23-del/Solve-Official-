import { randomUUID } from "node:crypto";
import { label, secondaryAction } from "@/app/ui";
import { KernelError } from "@/lib/kernel/client";
import { getKernel } from "@/lib/kernel/server";
import { listWorldBotAccess, type WorldBotAccess } from "@/lib/world/bot-access";
import { setWorldBotAccessAction } from "./bot-access-actions";

const LEVELS: [WorldBotAccess["access"], string][] = [
  ["read", "Read"],
  ["add", "Add"],
  ["none", "Remove"],
];

export async function WorldBotAccessPanel({ worldId, saved, error }: {
  worldId: string;
  saved: boolean;
  error?: string;
}) {
  let bots: WorldBotAccess[];
  try {
    bots = await listWorldBotAccess(await getKernel(), worldId);
  } catch (caught) {
    if (caught instanceof KernelError && caught.name === "forbidden") return null;
    throw caught;
  }

  const action = setWorldBotAccessAction.bind(null, worldId);
  const botAccessError = ["bot-access-input", "bot-access-owner", "bot-access-missing", "bot-access-save"].includes(error ?? "");
  return (
    <section aria-labelledby="bots-heading" className="flex flex-col gap-4 rounded-md border border-line bg-surface/60 p-4 md:p-5">
      <div>
        <p className={label}>Bots in this World</p>
        <h2 id="bots-heading" className="mt-1 text-lg font-medium">Bring in someone&apos;s bot</h2>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-muted">
          Ask them to copy their Bot SOV ID from <code>/bot</code>, then grant Read or Add. Only the World owner can manage bot access. The bot acts for its owner; its changes appear in History.
        </p>
      </div>
      {saved && <p role="status" className="rounded border border-positive/25 bg-positive/5 px-3 py-2 text-sm text-positive">Bot access updated.</p>}
      {botAccessError && (
        <p role="alert" className="rounded border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative">
          {error === "bot-access-input" ? "Enter a valid Bot SOV ID and choose Read or Add." :
            error === "bot-access-owner" ? "Only the World owner can manage bot access." :
              error === "bot-access-missing" ? "That bot or its active access could not be found." :
                "The bot access change could not be saved. Check kernel access and try again."}
        </p>
      )}

      <form action={action} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <input type="hidden" name="request_id" value={randomUUID()} />
        <label className="flex min-w-0 flex-col gap-1.5 text-xs text-muted">
          Bot SOV ID
          <input name="bot_agent_id" required maxLength={36} autoComplete="off" placeholder="xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx" className="h-10 rounded border border-line bg-background px-3 font-mono text-xs text-foreground outline-none focus:border-accent" />
        </label>
        <label className="flex flex-col gap-1.5 text-xs text-muted">
          Access
          <select name="access" defaultValue="add" className="h-10 min-w-28 rounded border border-line bg-background px-3 text-xs text-foreground">
            <option value="read">Read</option>
            <option value="add">Add</option>
          </select>
        </label>
        <button type="submit" className={secondaryAction + " self-end"}>Let bot in</button>
      </form>

      {bots.length ? (
        <ul className="flex flex-col divide-y divide-line rounded border border-line">
          {bots.map((bot) => (
            <li key={bot.botAgentId} className="flex flex-col gap-3 px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium">{bot.botName} <span className="font-normal text-muted">· bot for {bot.ownerName}</span></p>
                  <p className="mt-1 break-all font-mono text-[10px] text-muted">{bot.botAgentId}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted">{bot.access === "add" ? "Can read and add" : bot.access === "read" ? "Can read" : "No active read grant"}{bot.expiresAt ? ` · until ${new Date(bot.expiresAt).toLocaleDateString()}` : ""}</p>
                </div>
              </div>
              <form action={action} className="flex flex-wrap gap-2" aria-label={`Access for ${bot.botName}`}>
                <input type="hidden" name="bot_agent_id" value={bot.botAgentId} />
                <input type="hidden" name="request_id" value={randomUUID()} />
                {LEVELS.map(([value, name]) => (
                  <button key={value} type="submit" name="access" value={value} aria-pressed={bot.access === value} className={secondaryAction}>
                    {name}
                  </button>
                ))}
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded border border-dashed border-line p-4 text-sm text-muted">No other bots have access yet.</p>
      )}
    </section>
  );
}
