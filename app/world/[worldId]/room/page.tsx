import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { secondaryAction } from "@/app/ui";
import { LiveLine } from "@/app/command/live-line";
import { parseCapabilityProposal } from "@/lib/bot/gaps";
import { readConnections } from "@/lib/bot/memory";
import { parseOutreach } from "@/lib/bot/outreach";
import { parsePart } from "@/lib/bot/part";
import { parsePixelArt } from "@/lib/bot/pixel-art";
import { proofsIn } from "@/lib/bot/proof";
import { parseRoutes } from "@/lib/bot/routes";
import { loadBot } from "@/lib/bot/store";
import { overview, waitingFrom, type Journey } from "@/lib/bot/waiting";
import { readRepo, repoForWorld, roomRepos } from "@/lib/github/repo";
import { KernelError, type ActorProfile } from "@/lib/kernel/client";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { loadCreativeWorld, type CreativeArtifact } from "@/lib/world/creative";
import { eventTitle } from "../../event-title";
import { WorldLiveSync } from "../live-sync";
import { addNoteAction, linkRepoAction } from "./actions";
import type { RoomPiece } from "./pieces-map";
import { RoomRefresh } from "./refresh";
import { RoomView, type RoomData, type RoomLens } from "./view";

export const metadata: Metadata = { title: "Room · solve" };

const DEFAULT_SUMMARY = "A private World. Start with a blank canvas and shape it as you go.";

const NOTICES: Record<string, { tone: "ok" | "error"; text: string }> = {
  "saved:note": { tone: "ok", text: "Added to the room." },
  "saved:repo": { tone: "ok", text: "Repository linked. The room reads it from GitHub and never writes to it." },
  "error:note-input": { tone: "error", text: "Write something first." },
  "error:repo-input": { tone: "error", text: "That isn't a GitHub repository link. Use https://github.com/owner/repo, optionally with /tree/<branch>." },
};

function noticeFor(saved: unknown, error: unknown) {
  if (typeof saved === "string" && NOTICES[`saved:${saved}`]) return NOTICES[`saved:${saved}`];
  if (typeof error !== "string") return null;
  if (NOTICES[`error:${error}`]) return NOTICES[`error:${error}`];
  if (error.endsWith("-access")) return { tone: "error" as const, text: "Your access to this World has changed." };
  if (error.endsWith("-input")) return { tone: "error" as const, text: "That couldn't be saved as written. Check it and try again." };
  return { tone: "error" as const, text: "That couldn't be saved. Nothing changed; try again in a moment." };
}

function pieceOf(a: CreativeArtifact, journeys: Map<string, Journey>, saved: Set<string>): RoomPiece {
  const base = { id: a.entityId, title: a.title, x: a.position.x, y: a.position.y, saved: saved.has(a.entityId) };
  const routes = parseRoutes(a.body);
  if (routes) {
    const j = journeys.get(a.entityId);
    const detail = !j ? `${routes.routes.length} routes` : j.state === "proposed" ? `${j.options.length} routes to choose from` : j.state === "done" ? `${j.route} · done` : `${j.route} · ${j.done} of ${j.total}`;
    return { ...base, kind: "routes", detail };
  }
  const outreach = parseOutreach(a.body);
  if (outreach) return { ...base, kind: "outreach", detail: `${outreach.leads.length} businesses` };
  if (parsePart(a.body)) return { ...base, kind: "part", detail: null };
  if (parseCapabilityProposal(a.body)) return { ...base, kind: "proposal", detail: null };
  if (parsePixelArt(a.body)) return { ...base, kind: "art", detail: null };
  if (a.title === "Goal") return { ...base, kind: "goal", title: a.body.trim().split("\n")[0].slice(0, 160) || a.title, detail: null };
  const body = a.body.trim();
  return { ...base, kind: "text", detail: body ? (body.length > 90 ? `${body.slice(0, 88).trimEnd()}…` : body) : null };
}

type Loaded = Omit<RoomData, "lens" | "notice" | "addNote" | "linkRepo" | "requestId" | "live" | "sync"> & { userId: string };

async function load(worldId: string, viewer: { id: string; email?: string | null }): Promise<Loaded | "identity" | "missing" | "unavailable"> {
  try {
    const kernel = await getKernel();
    const me = await kernel.whoami();
    const { world, artifacts, resources } = await loadCreativeWorld(kernel, worldId);
    const links = resources.filter((r) => r.status === "open" && r.sourceUrl).map((r) => r.sourceUrl);
    const repo = repoForWorld({ worldId: world.worldId, viewerEmail: viewer.email, links, rooms: roomRepos(process.env.GITHUB_ROOMS) });
    const [ov, saves, events, bot, read] = await Promise.all([
      overview(kernel, [{ worldId: world.worldId, title: world.title, scope: world.scope }], me.actor_id),
      proofsIn(kernel, world.scope).catch(() => []),
      kernel.readEvents(world.scope, { newestFirst: true, limit: 14 }).catch(() => []),
      loadBot(kernel).catch(() => null),
      repo ? readRepo(repo.ref, { token: repo.paired ? process.env.GITHUB_TOKEN || null : null }) : Promise.resolve(null),
    ]);
    const assistants = bot?.avatar ? await readConnections(kernel, bot.ownerId).catch(() => []) : [];
    const ids = [...new Set([me.actor_id, ...events.map((e) => e.actor_id)])];
    const profiles: ActorProfile[] = await kernel.readActors(ids).catch(() => []);
    const byId = new Map(profiles.map((p) => [p.actor_id, p]));
    const name = (id: string) => (id === me.actor_id ? "you" : byId.get(id)?.label || "someone");

    const journeys = new Map(ov.journeys.map((j) => [j.pieceId, j]));
    const saved = new Set(saves.map((s) => s.pieceId));
    const goalPiece = artifacts.find((a) => a.title === "Goal");
    const goal = goalPiece?.body.trim() || (world.summary && world.summary !== DEFAULT_SUMMARY ? world.summary : "");
    return {
      userId: viewer.id,
      worldId: world.worldId,
      title: world.title,
      goal,
      now: new Date().toISOString(),
      pieces: artifacts.map((a) => pieceOf(a, journeys, saved)),
      people: ids
        .map((id) => ({ id, label: id === me.actor_id ? me.label || "You" : byId.get(id)?.label || "Someone", kind: (byId.get(id)?.kind ?? "human") as "human" | "agent" | "service", you: id === me.actor_id }))
        .filter((p) => p.kind !== "service"),
      botName: bot?.avatar ? bot.persona.name : null,
      assistants,
      journeys: ov.journeys,
      waiting: waitingFrom(ov.journeys, ov.approvals),
      gaps: ov.gaps,
      saves,
      activity: events.slice(0, 10).map((e) => ({ id: e.id, what: eventTitle(e.type), who: name(e.actor_id), at: new Date(e.occurred_at).toISOString() })),
      repo: repo && read ? { read, paired: repo.paired } : null,
    };
  } catch (error) {
    if (error instanceof KernelError && error.name === "unauthenticated") return "identity";
    if (error instanceof KernelError && (error.name === "forbidden" || error.name === "not_found" || error.name === "invalid")) return "missing";
    return "unavailable";
  }
}

export default async function RoomPage({ params, searchParams }: PageProps<"/world/[worldId]/room">) {
  const { worldId } = await params;
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/world/${worldId}/room`)}`);
  const { lens, saved, error } = await searchParams;
  const data = await load(worldId, { id: user.id, email: user.email });
  if (data === "identity") redirect("/account");
  if (data === "missing") notFound();
  if (data === "unavailable") {
    return (
      <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col justify-center gap-4 px-4 py-12">
        <h1 className="text-2xl font-medium">This room could not be opened.</h1>
        <p className="text-sm leading-6 text-muted">The kernel didn&apos;t answer. Nothing was changed; try again in a moment.</p>
        <Link href="/command" className={secondaryAction}>Command Center</Link>
      </main>
    );
  }
  const chosen: RoomLens = lens === "pieces" ? "pieces" : lens === "build" ? "build" : data.repo ? "build" : "pieces";
  const { userId, ...rest } = data;
  return (
    <main className="flex-1">
      <RoomView
        data={{
          ...rest,
          lens: chosen,
          notice: noticeFor(saved, error),
          addNote: addNoteAction.bind(null, data.worldId),
          linkRepo: linkRepoAction.bind(null, data.worldId),
          requestId: randomUUID(),
          live: data.botName ? <LiveLine userId={userId} botName={data.botName} /> : undefined,
          sync: <WorldLiveSync worldId={data.worldId} authUserId={userId} />,
        }}
      />
      {data.repo ? <RoomRefresh /> : null}
    </main>
  );
}
