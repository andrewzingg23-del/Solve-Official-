import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { getKernel } from "@/lib/kernel/server";
import { KernelError } from "@/lib/kernel/client";
import { acceptWorldInvitation } from "@/lib/world/invitations";
import { primaryAction, secondaryAction } from "@/app/ui";

export const metadata: Metadata = { title: "World invitation · solve", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function InvitationPage({ params, searchParams }: PageProps<"/world-invite/[token]">) {
  const { token } = await params;
  const { error } = await searchParams;
  const user = await getUser();
  const valid = /^[a-f0-9]{64}$/.test(token);
  async function accept() {
    "use server";
    const signedIn = await getUser();
    if (!signedIn) redirect(`/login?next=${encodeURIComponent(`/world-invite/${token}`)}`);
    let worldId: string;
    try {
      const kernel = await getKernel();
      try { await kernel.whoami(); } catch (caught) {
        if (!(caught instanceof KernelError) || caught.name !== "unauthenticated") throw caught;
        await kernel.register();
      }
      worldId = await acceptWorldInvitation(kernel, token);
    } catch {
      redirect(`/world-invite/${token}?error=unavailable`);
    }
    revalidatePath(`/world/${worldId}`);
    redirect(`/world/${worldId}/work`);
  }
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-xl flex-col justify-center gap-5 px-5 py-12">
      <Link href="/" className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">solve</Link>
      <h1 className="text-3xl font-medium">You’ve been invited to a shared workspace.</h1>
      <p className="text-sm leading-6 text-muted">Accept to join a private space for shared ideas, conversation and AI-assisted work. The owner controls whether you can view or edit. Project details appear after you join.</p>
      {!valid || error ? <p role="alert" className="rounded border border-negative/30 p-3 text-sm text-negative">This invitation is unavailable. It may have expired, been cancelled or already been used. If you already joined, open your Worlds; otherwise ask the owner for a fresh link.</p> : null}
      {user?.is_anonymous ? <p className="text-sm text-muted">You are using a browser-bound guest session. <Link href={`/login?next=${encodeURIComponent(`/world-invite/${token}`)}`} className="text-accent underline">Sign in with email before accepting to keep access across devices.</Link></p> : null}
      {valid && !error ? user && !user.is_anonymous ? <form action={accept}><button className={primaryAction}>Accept invitation</button></form> : <Link href={`/login?next=${encodeURIComponent(`/world-invite/${token}`)}`} className={primaryAction}>Sign in to accept</Link> : null}
      <Link href="/worlds" className={secondaryAction}>My Worlds</Link>
    </main>
  );
}
