import Link from "next/link";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/safe-next-path";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getUser } from "@/lib/supabase/server";
import { sendMagicLink } from "./actions";

// Sign in. Rebuilt from zero (2026-11-10). Email only: other providers aren't verified on this
// project, and a button that may not work isn't offered. Nothing here promises that work made as a
// visitor moves into the account, because that path hasn't been proven yet.
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error, sent } = await searchParams;
  const nextPath = safeNextPath(next);
  const user = await getUser();
  if (user && !user.is_anonymous) redirect(nextPath);

  return <div className="s-stack" style={{ "--gap": "32px", maxWidth: 560 } as React.CSSProperties}>
    <header className="s-stack" style={{ "--gap": "14px" } as React.CSSProperties}>
      <span className="s-label">SOV ID</span>
      <h1>Keep it with you, everywhere.</h1>
      <p className="s-muted">Sign in with your email and your SOV ID reaches every device you use. We&apos;ll send you a link — no password.</p>
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
