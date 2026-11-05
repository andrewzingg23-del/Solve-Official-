import Link from "next/link";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/safe-next-path";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getUser } from "@/lib/supabase/server";
import { ClaimForm } from "./claim-form";
import { sendMagicLink } from "./actions";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error, sent, mode } = await searchParams;
  const nextPath = safeNextPath(next);
  const user = await getUser();
  if (user && !user.is_anonymous) redirect(nextPath);
  if(user?.is_anonymous&&mode!=="existing")return <main className="solve-page solve-login-page"><header className="solve-page-heading"><span className="sov-eyebrow">YOUR IDENTITY. YOUR WORK.</span><h1>Make your Space recoverable.</h1><p>Keep the identity that already owns your guest Projects.</p></header><ClaimForm userId={user.id}/><Link href={`/login?mode=existing&next=${encodeURIComponent(nextPath)}`} className="solve-text-link">Use an existing account instead →</Link><p className="sov-subtle">Existing accounts retain their own Projects. Guest work is not automatically transferred.</p><Link href="/control" className="solve-text-link">← Control</Link></main>;
  return <main className="solve-page solve-login-page">
    <header className="solve-page-heading"><span className="solve-kicker">Welcome to SOV</span><h1>Sign in to build together.</h1><p>Save your projects, invite your people and bring your AI. We’ll email you a sign-in link.</p></header>
    {!isSupabaseConfigured ? <section role="status" className="solve-panel"><h2>Sign-in is temporarily unavailable.</h2><p className="mt-3">Your local idea and profile stay on this device. You can return to them while account access is restored.</p><Link href="/worlds/new" className="solve-text-link mt-4 inline-block">Return to your idea →</Link></section> : typeof sent === "string" ? <section role="status" className="solve-panel"><h2>Check your inbox.</h2><p className="mt-3">We sent a sign-in link to <strong>{sent}</strong>. Open it to continue where you left off.</p><Link href={`/login?next=${encodeURIComponent(nextPath)}`} className="solve-text-link mt-4 inline-block">Try another email</Link></section> : <form action={sendMagicLink} className="solve-form solve-panel">
      <input type="hidden" name="next" value={nextPath} /><label htmlFor="email">Email address</label><input id="email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
      <button className="solve-button">Email me a sign-in link</button>{typeof error === "string" ? <p role="alert" className="solve-error">{error}</p> : null}
    </form>}
    <Link href={nextPath === "/worlds/new" ? "/worlds/new" : "/"} className="solve-text-link mt-6 inline-block">← Back to {nextPath === "/worlds/new" ? "your idea" : "Projects"}</Link>
  </main>;
}
