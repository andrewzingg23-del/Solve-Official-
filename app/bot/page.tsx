import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { quietLink } from "@/app/ui";
import { DEFAULT_PERSONA, type Persona } from "@/lib/bot/persona";
import { readConnections, readMemories, type Connection, type Memory } from "@/lib/bot/memory";
import { machineData, type MachineData } from "@/lib/bot/machine";
import { botPulse, type Pulse } from "@/lib/bot/pulse";
import { loadBot } from "@/lib/bot/store";
import { worldsForBot, type WorldWithAccess } from "@/lib/bot/worlds";
import { latestSaves, type SavedProof } from "@/lib/bot/proof";
import { KernelError } from "@/lib/kernel/client";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { Connections } from "./connections";
import { BotImport } from "./import-panel";
import { WhileYouWereAway } from "./brief";
import { AgentContract } from "./contract";
import { BotCreator } from "./creator";
import { BotPortraitCreator } from "./portrait-creator";
import { LiveBot } from "./live-bot";
import { WorldsPanel } from "./worlds-panel";
import { FirstSteps } from "./first-steps";
import { firstSteps } from "@/lib/bot/first-steps";
import { waitingOn, type WaitingItem } from "@/lib/bot/waiting";
import { WaitingOnYou } from "./waiting";
import { TalkPanel } from "@/app/world/[worldId]/room/talk";

export const metadata: Metadata = { title: "Your bot — solve" };

type Loaded =
  | { kind: "signed-out" }
  | { kind: "identity" }
  | { kind: "unavailable" }
  | { kind: "ready"; userId: string; persona: Persona; version: number; savedAt: string | null; exists: boolean; connections: Connection[]; memories: Memory[]; worlds: WorldWithAccess[]; saves: Record<string, SavedProof[]>; waiting: WaitingItem[]; ownerId: string; botAgentId: string | null; pulse: Pulse | null; machine: MachineData };

async function load(): Promise<Loaded> {
  const user = await getUser();
  if (!user) return { kind: "signed-out" };
  try {
    const kernel = await getKernel();
    const bot = await loadBot(kernel);
    const [connections, memories] = bot.avatar ? await Promise.all([readConnections(kernel, bot.ownerId), readMemories(kernel, bot.ownerId)]) : [[], []];
    const worlds = bot.avatar ? await worldsForBot(kernel, bot.avatar.agent_id).catch(() => []) : [];
    const [saves, waiting] = await Promise.all([latestSaves(kernel, worlds), waitingOn(kernel, worlds, bot.ownerId)]);
    const pulse = bot.avatar ? botPulse({ persona: bot.persona, since: bot.avatar.created_at, memories, connections, history: bot.history, now: new Date() }) : null;
    const machine = machineData({ connections, worlds, memories, versions: bot.history.length, now: new Date() });
    return { kind: "ready", machine, userId: user.id, persona: bot.persona, version: bot.history.length, savedAt: bot.saved?.at ?? null, exists: Boolean(bot.avatar), connections, memories: memories.slice(0, 50), worlds, saves, waiting, ownerId: bot.ownerId, botAgentId: bot.avatar?.agent_id ?? null, pulse };
  } catch (error) {
    if (error instanceof KernelError && error.name === "unauthenticated") return { kind: "identity" };
    return { kind: "unavailable" };
  }
}

// The connector's public URL, as visitors reach this deployment.
async function connectorUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}/mcp`;
}

export default async function BotPage({ searchParams }: { searchParams?: Promise<{ world_error?: string | string[] }> }) {
  const state = await load();
  const params = searchParams ? await searchParams : {};
  const worldError = typeof params.world_error === "string" ? params.world_error : null;
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-6 pb-24 md:px-8 md:py-10">
      <header className="flex flex-wrap items-center justify-between gap-5 border-b border-line pb-5">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">solve</Link>
          <span className="text-muted">/</span>
          <span className="text-xs font-semibold uppercase tracking-[0.2em]">Your bot</span>
        </div>
        <nav className="flex items-center gap-5">
          <Link href="/command" className={quietLink}>Command Center</Link>
          <Link href="/worlds" className={quietLink}>Worlds</Link>
          <Link href="/account" className={quietLink}>You</Link>
        </nav>
      </header>

      {state.kind === "identity" ? (
        <Notice title="Finish setting up your SOV ID" body="You are signed in, but there is no kernel identity attached yet, so your bot has nowhere to live." href="/account" action="Open account" />
      ) : state.kind === "unavailable" ? (
        <Notice title="Your bot can't be loaded right now" body="The kernel did not answer. Nothing was changed; try again in a moment." />
      ) : (
        <>
          {state.kind === "ready" ? (
            <FirstSteps
              steps={firstSteps({
                botName: state.persona.name,
                hasBot: state.exists,
                connections: state.connections.length,
                worlds: state.worlds.length,
                saves: Object.values(state.saves).reduce((n, list) => n + list.length, 0),
              })}
            />
          ) : null}
          {state.kind === "ready" ? <WaitingOnYou items={state.waiting} /> : null}
          <BotCreator
            initial={state.kind === "ready" ? state.persona : DEFAULT_PERSONA}
            signedIn={state.kind === "ready"}
            version={state.kind === "ready" ? state.version : 0}
            savedAt={state.kind === "ready" ? state.savedAt : null}
            machine={state.kind === "ready" ? state.machine : undefined}
          />
          <TalkPanel botName={state.kind === "ready" ? state.persona.name : "Your bot"} />
          {state.kind === "ready" && state.exists ? <AgentContract botName={state.persona.name} connections={state.connections} worlds={state.worlds} /> : null}
          {state.kind === "ready" && state.exists ? <WhileYouWereAway botName={state.persona.name} /> : null}
          {state.kind === "ready" && state.exists ? <BotImport botName={state.persona.name} /> : null}
          {state.kind === "ready" && state.exists ? (
            <Connections
              botName={state.persona.name}
              connectorUrl={await connectorUrl()}
              connections={state.connections}
              memories={state.memories}
              live={state.pulse ? <LiveBot persona={state.persona} initial={state.pulse} userId={state.userId} /> : null}
            />
          ) : null}
          {state.kind === "ready" && state.exists && state.botAgentId ? <WorldsPanel botName={state.persona.name} botAgentId={state.botAgentId} worlds={state.worlds} saves={state.saves} ownerId={state.ownerId} error={worldError} /> : null}
          {state.kind === "ready" ? <BotPortraitCreator persona={state.persona} /> : null}
        </>
      )}
    </main>
  );
}

function Notice({ title, body, href, action }: { title: string; body: string; href?: string; action?: string }) {
  return (
    <div role="status" className="flex max-w-xl flex-col gap-3 rounded-md border border-line bg-surface p-5">
      <h1 className="text-sm font-medium">{title}</h1>
      <p className="text-sm leading-6 text-muted">{body}</p>
      {href && action ? (
        <Link href={href} className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">{action}</Link>
      ) : null}
    </div>
  );
}
