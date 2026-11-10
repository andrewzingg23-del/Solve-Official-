import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { acceptWorldInvitation } from "@/lib/world/invitations";
import styles from "./invite.module.css";

export const metadata: Metadata = { title: "You're invited · SOLVE", robots: { index: false, follow: false } };

// The moment a friend opens an invite. Rebuilt from zero (2026-11-10). It shows who invited them
// and to what — read from the kernel without accepting anything — and joins only when they press
// Join, so a link preview fetching this page can never use up their invitation. No sign-up: they
// join with the identity this browser already has.
function Unavailable({ children }: { children: React.ReactNode }) {
  return <div className={styles.page}>
    <h1>This invite isn&apos;t available.</h1>
    <p className="s-muted">{children}</p>
    <p><Link href="/" className="s-button" data-variant="quiet">Go to SOLVE</Link></p>
  </div>;
}

export default async function InvitePage({ params }: PageProps<"/world-invite/[token]">) {
  const { token } = await params;
  if (!/^[a-f0-9]{64}$/.test(token)) return <Unavailable>The link may be incomplete. Ask the person who sent it for a new one.</Unavailable>;
  if (!(await getUser())) return <Unavailable>Something went wrong opening it. Reload and try again.</Unavailable>;

  let preview: Awaited<ReturnType<Awaited<ReturnType<typeof getKernel>>["readWorldInvitation"]>>;
  try {
    preview = await (await getKernel()).readWorldInvitation(token);
  } catch {
    return <Unavailable>It may have been cancelled, or the link may be incomplete. Ask the person who sent it for a new one.</Unavailable>;
  }
  const from = preview.invited_by?.trim() || "Someone";

  async function join() {
    "use server";
    let worldId: string;
    try {
      worldId = await acceptWorldInvitation(await getKernel(), token);
    } catch {
      redirect(`/world-invite/${token}?gone=1`);
    }
    redirect(`/world/${encodeURIComponent(worldId)}`);
  }

  if (preview.is_yours) {
    return <div className={styles.page}>
      <span className="s-label">Your invite</span>
      <h1>This is your own invite link.</h1>
      <p className="s-muted">Send it to a friend — it works once, for whoever opens it first.</p>
    </div>;
  }
  if (preview.used && !preview.used_by_you) return <Unavailable>It&apos;s already been used. Ask {from} for a new one — each link is for one person.</Unavailable>;
  if (preview.expired && !preview.used_by_you) return <Unavailable>It&apos;s expired. Invites last two days. Ask {from} for a new one.</Unavailable>;

  return <div className={styles.page}>
    <div className={styles.invitation}>
      <span className="s-label">{preview.used_by_you ? "You're in" : "You're invited"}</span>
      <p className={styles.from}>{from} invited you to build</p>
      <h1 className={styles.title}>{preview.title || "something together"}</h1>
    </div>
    <form action={join} className="s-stack" style={{ "--gap": "12px" } as React.CSSProperties}>
      <div><button className="s-button" data-join>{preview.used_by_you ? "Open it" : "Join"}</button></div>
      {!preview.used_by_you ? <p className="s-muted s-small">No sign-up. You&apos;ll join from this browser, and you can sign in later to reach it anywhere.</p> : null}
    </form>
  </div>;
}
