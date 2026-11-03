import { randomUUID } from "node:crypto";
import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { getKernel } from "@/lib/kernel/server";
import { getBotAvatar } from "@/lib/bot/avatar";
import { DEFAULT_PERSONA } from "@/lib/bot/persona";
import { getPersonalBot } from "@/lib/product/identity-server";
import { KernelError, type Actor, type KernelEvent } from "@/lib/kernel/client";
import { ProfileForm } from "./profile-form";
import { registerActor, signOut } from "./actions";

export default async function AccountPage() {
  const user = await getUser();
  const avatar = getBotAvatar(user);
  let actor: Actor | null = null;
  let persona = DEFAULT_PERSONA;
  let events: KernelEvent[] = [];
  let issue: "identity" | "unavailable" | null = null;
  if (user) {
    try {
      const kernel = await getKernel();
      actor = await kernel.whoami();
      const bot = await getPersonalBot(); persona = bot.persona;
      events = await kernel.readEvents(`actor:${actor.actor_id}`, { newestFirst: true, limit: 12 });
    } catch (error) { issue = error instanceof KernelError && error.name === "unauthenticated" ? "identity" : "unavailable"; }
  }
  const name = actor?.label || (typeof user?.user_metadata?.display_name === "string" ? user.user_metadata.display_name : "");
  return <main className="solve-page">
    <div className="solve-page-heading"><span className="solve-kicker">It starts with you</span><h1>Your profile. Your AI.</h1><p>{user?.is_anonymous ? "Your guest workspace connects your projects and communities in this browser. Choose how your AI can help." : user ? "One identity across your projects and communities. Make it yours, and choose where your AI can help." : "Try a profile in this browser. You can start projects and invite people as a guest. Sign in to an existing account for access across devices."}</p></div>
    {user?.is_anonymous ? <p className="solve-muted mb-5">Your projects are saved to a guest workspace. Access depends on this browser’s session; clearing browsing data or using another device can lose that access. <Link href="/login?next=%2Faccount" className="solve-text-link">Use an existing account</Link></p> : null}
    <div className="solve-two-columns">
      <section className="solve-panel"><h2 className="mb-6">Make yourself at home</h2><ProfileForm key={user?.id ?? "guest"} signedIn={Boolean(user)} available={issue !== "unavailable"} guestWorkspace={user?.is_anonymous === true} userId={user?.id ?? null} name={name} persona={persona} face={avatar.face} requestId={randomUUID()} /></section>
      <div>
        <section className="solve-panel solve-id-card"><span className="solve-kicker">Solve ID</span><h2>{actor?.label || "Your workspace identity"}</h2><p>{actor ? user?.is_anonymous ? "This ID belongs to your guest workspace. Keep this browser’s session to retain access. It is not a permanent account." : "This ID belongs to your permanent account. Your contributions and permissions stay connected to it across projects." : "A local profile is a starting point. Your account gives you a persistent ID for shared work."}</p>{actor ? <code>{actor.actor_id}</code> : !user ? <Link href="/login?next=%2Faccount" className="solve-button solve-button-secondary">Sign in to get your ID</Link> : <span className="solve-muted">Your ID will appear when account setup finishes.</span>}<div><h2 className="mb-2">You choose what’s shared.</h2><p>Your AI’s personal knowledge stays private until you choose to publish something into a project. Project owners control invitations and access.</p><Link href="/bot?section=connections" className="solve-text-link">Manage AI connections →</Link></div></section>
        {issue === "identity" ? <form action={registerActor} className="solve-panel mt-5"><h2>Finish account setup</h2><p className="my-3">You’re signed in. Finish your workspace identity to save your profile and start shared work.</p><button className="solve-button">Finish setup</button></form> : issue === "unavailable" ? <div role="status" className="solve-panel mt-5"><h2>Your account is temporarily unavailable.</h2><p className="my-3">Your saved work has not changed. Keep your edits here and try again shortly.</p><Link href="/account" className="solve-text-link">Try again →</Link></div> : null}
        {user ? <details className="solve-account-history"><summary>Account details and history</summary><p className="solve-muted">{user.email}</p><ol>{events.map(event => <li key={event.id}>{event.type === "kernel.person.label.updated" ? "Profile name updated" : event.type === "kernel.actor.registered" ? "Solve ID created" : event.type.replaceAll(".", " ")}<span>{new Date(event.occurred_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" })}</span></li>)}</ol>{!user.is_anonymous ? <form action={signOut}><button className="solve-text-link">Sign out</button></form> : null}</details> : null}
      </div>
    </div>
  </main>;
}
