import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Icon } from "@/app/product/icons";
import { companionOf } from "@/lib/bot/store";
import { aiSendsNotes, communityMembers, joinRequests, myAsks, notesForMe, readCommunity, standingIn } from "@/lib/community/community";
import { KernelError } from "@/lib/kernel/client";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { CommunityView, type Loaded } from "./view";
import styles from "@/app/communities/community.module.css";

export const metadata: Metadata = { title: "Community · solve" };

async function load(communityId: string): Promise<Loaded | "missing" | "identity" | "unavailable"> {
  try {
    const kernel = await getKernel();
    const community = await readCommunity(kernel, communityId);
    if (!community) return "missing";
    const [{ me, standing }, avatars, [owner]] = await Promise.all([standingIn(kernel, community), kernel.myAvatars(), kernel.readActors([community.ownerId])]);
    const companion = companionOf(avatars);
    const inside = standing !== "guest";
    const [asks, roster, notes, open, aiNotes] = await Promise.all([
      standing === "owner" ? Promise.resolve([]) : myAsks(kernel, community),
      inside ? communityMembers(kernel, community) : Promise.resolve({ people: [], guests: [] }),
      inside ? notesForMe(kernel, community) : Promise.resolve([]),
      standing === "owner" ? joinRequests(kernel, community) : Promise.resolve([]),
      inside && companion ? aiSendsNotes(kernel, community) : Promise.resolve(null),
    ]);
    return {
      community,
      me,
      standing,
      ownerName: owner?.label || "the owner",
      bot: companion ? { agentId: companion.agent_id, name: companion.name } : null,
      asks,
      people: roster.people,
      guests: roster.guests,
      notes,
      open,
      aiNotes,
      roomAiConfigured: Boolean(process.env.OPENROUTER_API_KEY?.trim()),
    };
  } catch (error) {
    return error instanceof KernelError && error.name === "unauthenticated" ? "identity" : "unavailable";
  }
}

const DONE: Record<string, string> = {
  asked: "Request sent. The owner's answer will appear here.",
  "let-in": "Request approved. Access to the project has been granted.",
  declined: "Request declined. The person has been notified.",
  noted: "Note sent.",
  "ai-notes-on": "Your AI has permission to send notes here through an authorized connection.",
  "ai-notes-off": "Your AI's permission to send notes here has been removed.",
  "ai-in": "Your AI has access to the shared project.",
};
const ERRORS: Record<string, string> = {
  input: "Check what you entered and try again.",
  forbidden: "You don't have permission to do that here.",
  missing: "That request or community is no longer available.",
  save: "The change could not be saved. Please try again in a moment.",
};

export default async function CommunityPage({ params, searchParams }: PageProps<"/community/[communityId]">) {
  const { communityId } = await params;
  const path = `/community/${communityId}`;
  if (!(await getUser())) redirect(`/login?next=${encodeURIComponent(path)}`);
  const { done, error, started } = await searchParams;
  const data = await load(communityId);
  if (data === "missing") notFound();
  const status = typeof error === "string" ? { bad: true, text: ERRORS[error] ?? ERRORS.save } : typeof done === "string" && DONE[done] ? { bad: false, text: DONE[done] } : started ? { bad: false, text: "Your community is ready. Share this page so people can ask to join." } : null;

  return (
    <main className={`solve-page ${styles.page}`}>
      <Link href="/communities" className={styles.backLink}><Icon name="arrow" width={16} />All communities</Link>
      {data === "identity" ? (
        <section className={`solve-panel ${styles.stack}`} aria-labelledby="community-profile-heading">
          <h1 id="community-profile-heading">Finish your profile</h1>
          <p>Your account needs a saved profile before you can join this community.</p>
          <Link href="/account" className="solve-button solve-button-secondary">Open Profile</Link>
        </section>
      ) : data === "unavailable" ? (
        <section className={`solve-panel ${styles.stack}`} aria-labelledby="community-unavailable-heading">
          <h1 id="community-unavailable-heading">We couldn&apos;t load this community.</h1>
          <p>Try loading this page again in a moment.</p>
          <Link href={path} className="solve-button solve-button-secondary">Try again</Link>
        </section>
      ) : <CommunityView data={data} status={status} />}
    </main>
  );
}
