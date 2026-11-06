import Link from "next/link";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/safe-next-path";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getUser } from "@/lib/supabase/server";
import { sendMagicLink, beginSocialSignIn } from "./actions";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error, sent } = await searchParams;
  const nextPath = safeNextPath(next);
  const user = await getUser();
  if (user && !user.is_anonymous) redirect(nextPath);
  return <main className="solve-page solve-login-page">
    <header className="solve-page-heading"><span className="solve-kicker">Welcome to solve</span><h1>Sign in to build together.</h1><p>Save your projects, invite your people and bring your AI. We’ll email you a sign-in link.</p></header>
    {!isSupabaseConfigured ? <section role="status" className="solve-panel"><h2>Sign-in is temporarily unavailable.</h2><p className="mt-3">Your local idea and profile stay on this device. You can return to them while account access is restored.</p><Link href="/worlds/new" className="solve-text-link mt-4 inline-block">Return to your idea →</Link></section> : typeof sent === "string" ? <section role="status" className="solve-panel"><h2>Check your inbox.</h2><p className="mt-3">We sent a sign-in link to <strong>{sent}</strong>. Open it to continue where you left off.</p><Link href={`/login?next=${encodeURIComponent(nextPath)}`} className="solve-text-link mt-4 inline-block">Try another email</Link></section> : <form action={sendMagicLink} className="solve-form solve-panel">
      <input type="hidden" name="next" value={nextPath} /><label htmlFor="email">Email address</label><input id="email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
      <button className="solve-button">Email me a sign-in link</button>{typeof error === "string" ? <p role="alert" className="solve-error">{error}</p> : null}
    </form>}
    {isSupabaseConfigured && (!user || user.is_anonymous) ? <section className="solve-panel mt-5">
      <h2 className="mb-3">Or continue with an account</h2>
      <p className="solve-muted mb-4">Account sign-in does not authorize SOV to access your files, messages or repositories. Those permissions are separate and optional.</p>
      <div className="solve-profile-save">
        <form action={beginSocialSignIn}>
          <input type="hidden" name="provider" value="google" />
          <input type="hidden" name="next" value={nextPath} />
          <button type="submit" className="solve-button solve-button-secondary">Continue with Google</button>
        </form>
        <form action={beginSocialSignIn}>
          <input type="hidden" name="provider" value="github" />
          <input type="hidden" name="next" value={nextPath} />
          <button type="submit" className="solve-button solve-button-secondary">Continue with GitHub</button>
        </form>
      </div>
      <p className="solve-muted mt-4">These options require Google/GitHub to be enabled in your Supabase Auth settings.</p>
    </section> : null}
    <Link href={nextPath === "/worlds/new" ? "/worlds/new" : "/"} className="solve-text-link mt-6 inline-block">← Back to {nextPath === "/worlds/new" ? "your idea" : "Projects"}</Link>
  </main>;
}
