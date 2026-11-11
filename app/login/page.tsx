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
  const { next, error, sent, keeping, taken, left, intent } = await searchParams;
  const nextPath = safeNextPath(next);
  const user = await getUser();
  if (user && !user.is_anonymous) redirect(nextPath);
  const guest = Boolean(user?.is_anonymous);
  const existing = intent === "signin" || typeof taken === "string" || left === "1";

  return <div className="s-stack" style={{ "--gap": "32px", maxWidth: 560 } as React.CSSProperties}>
    <header className="s-stack" style={{ "--gap": "14px" } as React.CSSProperties}>
      <span className="s-label">SOV ID</span>
      <h1>{existing ? "Sign in to your account." : "Keep it with you, everywhere."}</h1>
      <p className="s-muted">Sign in with your email and your SOV ID reaches every device you use. We&apos;ll send you a link — no password.</p>
      {guest && !existing ? <p className="s-small" data-keeps-work>Everything you&apos;ve already made in this browser stays yours and comes with you: your Spaces, anything you&apos;ve connected, and whatever you&apos;ve let an AI reach. Until you do this, it lives only in this browser.</p> : null}
    </header>

    {!isSupabaseConfigured
      ? <section role="status" className="s-surface s-stack">
          <h2>Signing in isn&apos;t available right now.</h2>
          <p className="s-muted">Nothing you&apos;ve made has changed. Try again shortly.</p>
        </section>
      : typeof sent === "string"
          ? <section role="status" className="s-surface s-stack">
              <h2>Check your email.</h2>
              <p>We sent a link to <strong>{sent}</strong>. Open it on this device to continue.</p>
              {keeping === "1" ? <p className="s-small" data-sent-keeping>It confirms this email on the identity you already have, so everything in this browser comes with you.</p> : null}
              {left === "1" ? <p className="s-small" data-sent-left>This signs you in to that existing account. Guest work was not moved or merged into that account.</p> : null}
              <p><Link href={`/login?next=${encodeURIComponent(nextPath)}${existing ? "&intent=signin" : ""}`} className="s-button" data-variant="quiet">Use a different email</Link></p>
            </section>
          : <form action={existing ? signInLeavingGuestBehind : sendMagicLink} className="s-surface s-stack">
            {existing && guest ? <p className="s-small">You are signing into an existing account. Work in this guest session is separate and will not be moved or merged.</p> : null}
            {existing && guest ? <details data-taken><summary>Keep access to work in this guest session</summary><p className="s-small" data-bring-across>Before switching, share a Space and accept its invitation in your account. It stays owned by this browser&apos;s guest identity. Tools and AI access must be connected again.</p></details> : null}
            <input type="hidden" name="next" value={nextPath} />
            <label htmlFor="email" className="s-small">Email</label>
            <input id="email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" defaultValue={typeof taken === "string" ? taken : ""} className="s-input" />
            <div><button className="s-button">{existing ? "Email me a sign-in link" : "Email me a link"}</button></div>
            <Link href={`/login?next=${encodeURIComponent(nextPath)}${existing ? "" : "&intent=signin"}`} className="s-button" data-variant="link">{existing ? (guest ? "Keep this guest’s work with a new account" : "Create an account") : "Sign in to an existing account"}</Link>
            {typeof error === "string" ? <p role="alert" className="s-error">{error}</p> : null}
          </form>}

    <p><Link href="/" className="s-button" data-variant="link">← Back to your idea</Link></p>
  </div>;
}
