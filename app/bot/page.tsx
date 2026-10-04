import type { Metadata } from "next";
import Link from "next/link";
import { quietLink } from "@/app/ui";
import { DEFAULT_PERSONA, type Persona } from "@/lib/bot/persona";
import { loadBot } from "@/lib/bot/store";
import { KernelError } from "@/lib/kernel/client";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { BotCreator } from "./creator";

export const metadata: Metadata = { title: "Your bot — solve" };

type Loaded =
  | { kind: "signed-out" }
  | { kind: "identity" }
  | { kind: "unavailable" }
  | { kind: "ready"; persona: Persona; version: number; savedAt: string | null; exists: boolean };

async function load(): Promise<Loaded> {
  if (!(await getUser())) return { kind: "signed-out" };
  try {
    const bot = await loadBot(await getKernel());
    return { kind: "ready", persona: bot.persona, version: bot.history.length, savedAt: bot.saved?.at ?? null, exists: Boolean(bot.avatar) };
  } catch (error) {
    if (error instanceof KernelError && error.name === "unauthenticated") return { kind: "identity" };
    return { kind: "unavailable" };
  }
}

export default async function BotPage() {
  const state = await load();
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-6 md:px-8 md:py-10">
      <header className="flex flex-wrap items-center justify-between gap-5 border-b border-line pb-5">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">solve</Link>
          <span className="text-muted">/</span>
          <span className="text-xs font-semibold uppercase tracking-[0.2em]">Your bot</span>
        </div>
        <nav className="flex items-center gap-5">
          <Link href="/worlds" className={quietLink}>Worlds</Link>
          <Link href="/account" className={quietLink}>You</Link>
        </nav>
      </header>

      {state.kind === "identity" ? (
        <Notice title="Finish setting up your SOV ID" body="You are signed in, but there is no kernel identity attached yet, so your bot has nowhere to live." href="/account" action="Open account" />
      ) : state.kind === "unavailable" ? (
        <Notice title="Your bot can't be loaded right now" body="The kernel did not answer. Nothing was changed; try again in a moment." />
      ) : (
        <BotCreator
          initial={state.kind === "ready" ? state.persona : DEFAULT_PERSONA}
          signedIn={state.kind === "ready"}
          version={state.kind === "ready" ? state.version : 0}
          savedAt={state.kind === "ready" ? state.savedAt : null}
        />
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
