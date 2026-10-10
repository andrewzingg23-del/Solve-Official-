// One community: its public profile for anyone signed in; for members, the way into its room, who is
// in it (people and the AIs they brought) and notes between them; for the person who started it,
// the asks to join and, when it runs the solar pack, the solar desk.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { quietLink, secondaryAction } from "@/app/ui";
import { companionOf } from "@/lib/bot/store";
import { aiSendsNotes, communityMembers, joinRequests, myAsks, notesForMe, readCommunity, standingIn } from "@/lib/community/community";
import { KernelError } from "@/lib/kernel/client";
import { getKernel } from "@/lib/kernel/server";
import { deskCommunityId, deskRequests } from "@/lib/solar/desk";
import { getUser } from "@/lib/supabase/server";
import { readCommunityContext } from "@/lib/community/context";
import { CommunityView, panel, type Loaded } from "./view";

export const metadata: Metadata = { title: "Community · solve" };

async function load(communityId: string): Promise<Loaded | "missing" | "identity" | "unavailable"> {
  try {
    const kernel = await getKernel();
    const community = await readCommunity(kernel, communityId);
    if (!community) return "missing";
    const [{ me, standing }, avatars, [owner]] = await Promise.all([standingIn(kernel, community), kernel.myAvatars(), kernel.readActors([community.ownerId])]);
    const companion = companionOf(avatars);
    const inside = standing !== "guest";
    const [asks, roster, notes, open, desk, aiNotes, shared] = await Promise.all([
      standing === "owner" ? Promise.resolve([]) : myAsks(kernel, community),
      inside ? communityMembers(kernel, community) : Promise.resolve({ people: [], guests: [] }),
      inside ? notesForMe(kernel, community) : Promise.resolve([]),
      standing === "owner" ? joinRequests(kernel, community) : Promise.resolve([]),
      standing === "owner" && community.packs.includes("solar") ? deskRequests(kernel, community) : Promise.resolve(null),
      inside && companion ? aiSendsNotes(kernel, community) : Promise.resolve(null),
      inside ? readCommunityContext(kernel, community).then((c) => c.entries).catch(() => []) : Promise.resolve([]),
    ]);
    return {
      community,
      me,
      standing,
      ownerName: owner?.label || "its owner",
      bot: companion ? { agentId: companion.agent_id, name: companion.name } : null,
      asks,
      people: roster.people,
      guests: roster.guests,
      notes,
      open,
      desk,
      routed: deskCommunityId() === community.communityId,
      aiNotes,
      shared,
    };
  } catch (error) {
    return error instanceof KernelError && error.name === "unauthenticated" ? "identity" : "unavailable";
  }
}

const DONE: Record<string, string> = {
  asked: "Asked. You'll see the answer here.",
  "let-in": "Let in. They can build in the room now.",
  declined: "Answered. They've been told.",
  noted: "Note sent.",
  packs: "Packs saved.",
  designed: "Design sent to the homeowner.",
  "ai-notes-on": "Your AI can send notes for you here now.",
  "ai-notes-off": "Your AI no longer sends notes for you here.",
  "ai-in": "Your AI is in the room.",
  shared: "Added. Every member's AI will see it.",
};
const ERRORS: Record<string, string> = {
  input: "Check what you entered and try again.",
  forbidden: "That isn't yours to do here.",
  missing: "That's no longer here.",
  save: "That didn't go through. Nothing was changed; try again in a moment.",
};


export default async function CommunityPage({ params, searchParams }: PageProps<"/community/[communityId]">) {
  const { communityId } = await params;
  const path = `/community/${communityId}`;
  if (!(await getUser())) redirect(`/login?next=${encodeURIComponent(path)}`);
  const { done, error, started } = await searchParams;
  const data = await load(communityId);
  if (data === "missing") notFound();

  const status = typeof error === "string" ? { bad: true, text: ERRORS[error] ?? ERRORS.save } : typeof done === "string" && DONE[done] ? { bad: false, text: DONE[done] } : started ? { bad: false, text: "Your community is open. Share this page; people ask to join here." } : null;

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-6 md:px-8 md:py-10">
      <header className="flex flex-wrap items-center justify-between gap-5 border-b border-line pb-5">
        <div className="flex min-w-0 items-center gap-4">
          <Link href="/" className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">solve</Link>
          <span className="text-muted">/</span>
          <Link href="/communities" className="text-xs font-semibold uppercase tracking-[0.2em] hover:text-accent">Communities</Link>
        </div>
        <Link href="/command" className={quietLink}>Command Center</Link>
      </header>

      {data === "identity" ? (
        <div className={panel}>
          <h2 className="text-sm font-medium">Finish setting up your SOV ID</h2>
          <p className="text-sm leading-6 text-muted">Your sign-in is active, but there is no kernel identity attached yet.</p>
          <Link href="/account" className={secondaryAction}>Open account</Link>
        </div>
      ) : data === "unavailable" ? (
        <div role="status" className="rounded-md border border-negative/30 bg-negative/10 p-4 text-sm">This community is unavailable for a moment. Nothing was changed.</div>
      ) : (
        <CommunityView data={data} status={status} />
      )}
    </main>
  );
}
