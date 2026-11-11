import Link from "next/link";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/safe-next-path";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getUser } from "@/lib/supabase/server";
import { sendMagicLink, signInLeavingGuestBehind } from "./actions";

// Sign in. Rebuilt from zero (2026-11-10). Email only: other providers aren't verified on this
// project, and a button that may not work isn't offered.
//
// A guest keeps their identity: adding an email makes this same identity permanent, so their
// Spaces, a connected GitHub and anything an AI was let into come with them (actions.ts). The one
// case where that is untrue — the address already has an account — is said plainly, with its cost,
// and never taken on the person's behalf.
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error, sent, keeping, taken, left } = await searchParams;
  const nextPath = safeNextPath(next);
  const user = await getUser();
  if (user && !user.is_anonymous) redirect(nextPath);
  const guest = Boolean(user?.is_anonymous);

  return <div className="s-stack" style={{ "--gap": "32px", maxWidth: 560 } as React.CSSProperties}>
    <header className="s-stack" style={{ "--gap": "14px" } as React.CSSProperties}>
      <span className="s-label">SOV ID</span>
      <h1>Keep it with you, everywhere.</h1>
      <p className="s-muted">Sign in with your email and your SOV ID reaches every device you use. We&apos;ll send you a link — no password.</p>
      {guest ? <p className="s-small" data-keeps-work>Everything you&apos;ve already made in this browser stays yours and comes with you: your Spaces, anything you&apos;ve connected, and whatever you&apos;ve let an AI reach. Until you do this, it lives only in this browser.</p> : null}
    </header>

    {!isSupabaseConfigured
      ? <section role="status" className="s-surface s-stack">
          <h2>Signing in isn&apos;t available right now.</h2>
          <p className="s-muted">Nothing you&apos;ve made has changed. Try again shortly.</p>
        </section>
      : typeof taken === "string"
        ? <section role="alert" className="s-surface s-stack" data-taken>
            <h2>That email already has an account.</h2>
            <p><strong>{taken}</strong> belongs to an account already, so it can&apos;t be added to this one. Signing in to it would leave what this browser holds behind — your Spaces here, anything you&apos;ve connected, and whatever you&apos;ve let an AI reach. That can&apos;t be undone from the other account.</p>
            <form action={signInLeavingGuestBehind}>
              <input type="hidden" name="next" value={nextPath} />
              <input type="hidden" name="email" value={taken} />
              <button className="s-button" data-variant="quiet" data-leave-guest>Sign in to that account anyway</button>
            </form>
            <p><Link href={`/login?next=${encodeURIComponent(nextPath)}`} className="s-button" data-variant="link">Use a different email instead</Link></p>
          </section>
        : typeof sent === "string"
          ? <section role="status" className="s-surface s-stack">
              <h2>Check your email.</h2>
              <p>We sent a link to <strong>{sent}</strong>. Open it on this device to continue.</p>
              {keeping === "1" ? <p className="s-small" data-sent-keeping>It confirms this email on the identity you already have, so everything in this browser comes with you.</p> : null}
              {left === "1" ? <p className="s-small" data-sent-left>This signs you in to that existing account. What this browser holds stays behind.</p> : null}
              <p><Link href={`/login?next=${encodeURIComponent(nextPath)}`} className="s-button" data-variant="quiet">Use a different email</Link></p>
            </section>
          : <form action={sendMagicLink} className="s-surface s-stack">
            <input type="hidden" name="next" value={nextPath} />
            <label htmlFor="email" className="s-small">Email</label>
            <input id="email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" className="s-input" />
            <div><button className="s-button">Email me a link</button></div>
            {typeof error === "string" ? <p role="alert" className="s-error">{error}</p> : null}
          </form>}

    <p><Link href="/" className="s-button" data-variant="link">← Back to your idea</Link></p>
  </div>;
}
