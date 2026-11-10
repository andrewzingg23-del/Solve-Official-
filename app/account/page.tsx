import { randomUUID } from "node:crypto";
import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { getKernel } from "@/lib/kernel/server";
import { getBotAvatar } from "@/lib/bot/avatar";
import { DEFAULT_PERSONA } from "@/lib/bot/persona";
import { loadBot } from "@/lib/bot/store";
import { KernelError, type Actor, type KernelEvent } from "@/lib/kernel/client";
import { ProfileForm } from "./profile-form";
import { registerActor, signOut } from "./actions";
import { CardStudio } from "./card-studio";
import { SovCard } from "@/app/product/sov-card";
import { BASE_LOOK } from "@/lib/product/card";
import { readLook, type StoredLook } from "@/lib/product/look-store";
import { actWording } from "@/lib/product/thing";

export default async function AccountPage() {
  const user = await getUser();
  const avatar = getBotAvatar(user);
  let actor: Actor | null = null;
  let persona = DEFAULT_PERSONA;
  let events: KernelEvent[] = [];
  let issue: "identity" | "unavailable" | null = null;
  // A person's chosen name lives in the kernel's label events (`read_actors` reads them); the raw
  // actor label is empty for almost everyone, which is how the record once showed blank names.
  let chosenName = "";
  let look: StoredLook | null = null;
  if (user) {
    try {
      const kernel = await getKernel();
      actor = await kernel.whoami();
      const bot = await loadBot(kernel); persona = bot.persona;
      events = await kernel.readEvents(`actor:${actor.actor_id}`, { newestFirst: true, limit: 12 });
      const [profile] = await kernel.readActors([actor.actor_id]).catch(() => []);
      chosenName = profile?.label?.trim() ?? "";
      look = await readLook(kernel, actor.actor_id).catch(() => null);
    } catch (error) { issue = error instanceof KernelError && error.name === "unauthenticated" ? "identity" : "unavailable"; }
  }
  const name = chosenName || actor?.label || (typeof user?.user_metadata?.display_name === "string" ? user.user_metadata.display_name : "");
  return <main className="solve-page">
    <div className="solve-page-heading"><span className="solve-kicker">It starts with you</span><h1>Your profile. Your AI.</h1><p>{user ? "One identity across everything you make and share. Make it yours, and choose where your AI can help." : "Try a profile on this device. Sign in when you want to save across devices, invite people and build together."}</p></div>
    <section className="solve-panel sov-id-hero" aria-labelledby="sov-card-heading">
      <span className="solve-kicker" id="sov-card-heading">Your SOV ID</span>
      {actor && look
        ? <CardStudio name={name} saved={look.look} canUndo={look.previous !== null} />
        : <>
            <SovCard name={name} look={BASE_LOOK} />
            <p className="solve-muted mt-3" role="status">{issue === "unavailable"
              ? "Your card's look couldn't be loaded. Nothing has changed; try again shortly."
              : "Your card appears here once your identity is ready."}</p>
          </>}
    </section>
    {user?.is_anonymous ? <p className="solve-muted mb-5">Your guest workspace saves automatically in this browser. Keep its browsing data to return to your work. <Link href="/login?next=%2Faccount" className="solve-text-link">Use an existing account</Link></p> : null}
    <div className="solve-two-columns">
      <section className="solve-panel"><h2 className="mb-6">Make yourself at home</h2><ProfileForm key={user?.id ?? "guest"} signedIn={Boolean(user)} userId={user?.id ?? null} name={name} persona={persona} face={avatar.face} requestId={randomUUID()} /></section>
      <div>
        <section className="solve-panel solve-id-card"><span className="solve-kicker">About your SOV ID</span><p>{actor ? "Your SOV ID belongs to you. Everything you contribute, and every permission you give, stays connected to it wherever you work." : "A local profile is a starting point. An account makes your SOV ID last beyond this browser."}</p>{actor ? null : !user ? <Link href="/login?next=%2Faccount" className="solve-button solve-button-secondary">Sign in to get your ID</Link> : <span className="solve-muted">Your ID will appear when account setup finishes.</span>}<div><h2 className="mb-2">You choose what’s shared.</h2><p>Your AI’s personal knowledge stays private until you choose to share something. Whoever holds a shared thing controls who is invited and what they can do.</p><Link href="/bot?section=connections" className="solve-text-link">Manage AI connections →</Link></div></section>
        {issue === "identity" ? <form action={registerActor} className="solve-panel mt-5"><h2>Finish account setup</h2><p className="my-3">You’re signed in. Create your persistent identity to save your profile and start shared work.</p><button className="solve-button">Finish setup</button></form> : issue === "unavailable" ? <div role="status" className="solve-panel mt-5"><h2>Your account is temporarily unavailable.</h2><p className="my-3">Your saved work has not changed. Keep your edits here and try again shortly.</p><Link href="/account" className="solve-text-link">Try again →</Link></div> : null}
        {user ? <details className="solve-account-history"><summary>Account details and history</summary><p className="solve-muted">{user.email}</p><ol>{events.map(event => <li key={event.id}>{event.type === "kernel.person.label.updated" ? "Name updated" : event.type === "kernel.actor.registered" ? "SOV ID created" : actWording(event.type)}<span>{new Date(event.occurred_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" })}</span></li>)}</ol>{!user.is_anonymous ? <form action={signOut}><button className="solve-text-link">Sign out</button></form> : null}</details> : null}
      </div>
    </div>
  </main>;
}
