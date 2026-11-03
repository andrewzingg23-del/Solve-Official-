import Link from "next/link";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/safe-next-path";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getUser } from "@/lib/supabase/server";
import { sendMagicLink } from "./actions";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error, sent } = await searchParams;
  const nextPath = safeNextPath(next);
  const user = await getUser();
  if (user && !user.is_anonymous) redirect(nextPath);
  return <main className="solve-page solve-login-page">
    <header className="solve-page-heading"><span className="solve-kicker">Welcome to solve</span><h1>Your workspace starts here.</h1><p>Sign in or create an account with your email. Then connect your AI and invite someone to work with you.</p></header>
    {!isSupabaseConfigured ? <section role="status" className="solve-panel"><h2>Sign-in is temporarily unavailable.</h2><p className="mt-3">Your local idea and profile stay on this device. You can return to them while account access is restored.</p><Link href="/worlds/new" className="solve-text-link mt-4 inline-block">Return to your idea →</Link></section> : typeof sent === "string" ? <section role="status" className="solve-panel"><h2>Check your inbox.</h2><p className="mt-3">We sent a sign-in link to <strong>{sent}</strong>. Open it in this same browser to finish signing in.</p><Link href={`/login?next=${encodeURIComponent(nextPath)}`} className="solve-text-link mt-4 inline-block">Try another email</Link></section> : <form action={sendMagicLink} className="solve-form solve-panel">{user?.is_anonymous ? <p className="solve-muted">Signing in opens your account’s projects. Guest work does not automatically transfer; download a backup first if needed.</p> : null}
      <input type="hidden" name="next" value={nextPath} /><label htmlFor="email">Email address</label><input id="email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
      <button className="solve-button">Email me a sign-in link</button>{typeof error === "string" ? <p role="alert" className="solve-error">{error}</p> : null}
    </form>}
    <Link href={nextPath === "/worlds/new" ? "/worlds/new" : "/"} className="solve-text-link mt-6 inline-block">← Back to {nextPath === "/worlds/new" ? "your idea" : "Projects"}</Link>
  </main>;
}
