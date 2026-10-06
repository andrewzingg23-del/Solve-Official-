import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { quietLink } from "@/app/ui";
import { readConnections } from "@/lib/bot/memory";
import { latestSaves } from "@/lib/bot/proof";
import { loadBot } from "@/lib/bot/store";
import { overview } from "@/lib/bot/waiting";
import { worldsForBot } from "@/lib/bot/worlds";
import { KernelError } from "@/lib/kernel/client";
import { getKernel } from "@/lib/kernel/server";
import { myCommunities } from "@/lib/community/community";
import { getUser } from "@/lib/supabase/server";
import { listCreativeWorlds } from "@/lib/world/creative";
import { LiveLine } from "./live-line";
import { WalletPanel } from "./wallet-panel";
import { repoForViewer } from "@/lib/github/repo";
import { deploymentRooms } from "@/lib/github/rooms";
import { repoRoomId, repoRoomTitle } from "@/lib/github/room-id";
import { openRepoRoomAction } from "./repo-actions";
import { RepoRoomCard } from "./repo-room";
import { CommandView, type CommandData } from "./view";
import { loginRequired } from "@/lib/auth/gate";

export const metadata: Metadata = { title: "Command Center · solve" };

const RECENT_SAVES = 6;

async function load(userId: string, email: string | null): Promise<CommandData | "identity" | "unavailable"> {
  try {
    const kernel = await getKernel();
    const [me, bot] = await Promise.all([kernel.whoami(), loadBot(kernel)]);
    const worlds = bot.avatar ? await worldsForBot(kernel, bot.avatar.agent_id) : await listCreativeWorlds(kernel);
    const [{ journeys: all, gaps, approvals, results }, connections, savesByWorld, wallets, communities] = await Promise.all([
      overview(kernel, worlds, me.actor_id),
      bot.avatar ? readConnections(kernel, bot.ownerId) : Promise.resolve([]),
      latestSaves(kernel, worlds, 3),
      kernel.myWallets().catch(() => []),
      myCommunities(kernel).catch(() => []),
    ]);
    const titles = new Map(worlds.map((w) => [w.worldId, w.title]));
    const saves = Object.entries(savesByWorld)
      .flatMap(([worldId, list]) => list.map((s) => ({ ...s, at: new Date(s.at).toISOString(), worldId, worldTitle: titles.get(worldId) ?? "a World" })))
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, RECENT_SAVES);
    const botName = bot.avatar ? bot.persona.name : null;
    const paired = repoForViewer(email, deploymentRooms());
    const roomless = paired && !worlds.some((w) => w.worldId === repoRoomId(me.actor_id, paired)) ? paired : null;
    return {
      name: me.label || "you",
      botName,
      worlds: worlds.map((w) => ({ worldId: w.worldId, title: w.title, updatedAt: w.updatedAt })),
      journeys: all,
      communities,
      gaps,
      approvals,
      results: results.slice(0, RECENT_SAVES),
      connections,
      saves,
      live: botName ? <LiveLine userId={userId} botName={botName} /> : undefined,
      wallet: <WalletPanel wallets={[...new Set(wallets.map((w) => w.address))]} />,
      repoRoom: roomless ? <RepoRoomCard repo={roomless} title={repoRoomTitle(roomless)} open={openRepoRoomAction} /> : undefined,
    };
  } catch (error) {
    if (error instanceof KernelError && error.name === "unauthenticated") return "identity";
    return "unavailable";
  }
}

export default async function CommandPage({ searchParams }: PageProps<"/command">) {
  const user = await getUser();
  if (!user && loginRequired()) redirect("/login?next=/command");
  // The command center is a builder tool — it needs an identity. Guests go to packs.
  if (!user) redirect("/packs");
  const { error } = await searchParams;
  const data = await load(user.id, user.email ?? null);
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 md:px-8 md:py-10">
      <header className="flex flex-wrap items-center justify-between gap-5 border-b border-line pb-5">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">solve</Link>
          <span className="text-muted">/</span>
          <h1 className="text-xs font-semibold uppercase tracking-[0.2em]">Command Center</h1>
        </div>
        <nav className="flex items-center gap-5">
          <Link href="/worlds" className={quietLink}>Worlds</Link>
          <Link href="/bot" className={quietLink}>Your bot</Link>
          <Link href="/account" className={quietLink}>You</Link>
        </nav>
      </header>
      {error === "repo-room" ? (
        <p role="alert" className="rounded border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative">The room couldn&apos;t be opened. Nothing was changed; try again in a moment.</p>
      ) : null}
      {data === "identity" ? (
        <p className="text-sm leading-6 text-muted">
          You are signed in, but no SOV ID is attached yet. <Link href="/account" className="text-accent">Finish setting it up</Link>.
        </p>
      ) : data === "unavailable" ? (
        <p role="status" className="text-sm leading-6 text-muted">The kernel did not answer, so nothing can be shown right now. Nothing was changed; try again in a moment.</p>
      ) : (
        <CommandView data={data} />
      )}
    </main>
  );
}
