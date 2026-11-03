import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { label, primaryAction, secondaryAction } from "@/app/ui";
import { BotCharacter } from "@/app/bot/character";
import { loadBot } from "@/lib/bot/store";
import { getKernel } from "@/lib/kernel/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { approveConsentAction, denyConsentAction } from "./actions";

export const metadata: Metadata = { title: "Connect an assistant — solve" };

const ERRORS: Record<string, string> = {
  expired: "This connection request has expired or was already used. Start again from your assistant.",
  "no-bot": "Create your bot first, then come back to this page.",
  kernel: "Sovereign could not record the connection. Nothing was shared; try again.",
};

// Where Supabase Auth's OAuth server sends a person when an assistant (Claude, ChatGPT, Meta Muse)
// asks to connect to Sovereign. Approving lets that assistant speak as the person's bot.
export default async function ConsentPage({ searchParams }: PageProps<"/oauth/consent">) {
  const params = await searchParams;
  const id = typeof params.authorization_id === "string" ? params.authorization_id : "";
  const error = typeof params.error === "string" ? params.error : "";
  if (!id) return <Shell><Notice text="This page opens when an assistant asks to connect to your bot. Nothing is pending." /></Shell>;
  if (!(await getUser())) redirect(`/login?next=${encodeURIComponent(`/oauth/consent?authorization_id=${id}`)}`);

  const supabase = await createClient();
  const details = await supabase.auth.oauth.getAuthorizationDetails(id);
  if (details.error || !details.data) return <Shell><Notice text={ERRORS.expired} /></Shell>;
  // Already approved before: Supabase hands back the assistant's redirect directly.
  if ("redirect_url" in details.data) redirect(details.data.redirect_url);
  const { client } = details.data;

  let bot: Awaited<ReturnType<typeof loadBot>> | null = null;
  try {
    bot = await loadBot(await getKernel());
  } catch {
    return <Shell><Notice text="Your Sovereign identity could not be loaded, so nothing can be shared yet. Open You to finish setting it up." href="/account" action="Open account" /></Shell>;
  }
  const clientName = client.name || "An assistant";

  return (
    <Shell>
      <section className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 rounded-md border border-line bg-surface px-5 py-8 text-center md:px-8">
        <BotCharacter persona={bot.persona} state={bot.avatar ? "listening" : "sleeping"} size={170} />
        <div className="flex flex-col gap-2">
          <p className={label}>Connect an assistant</p>
          <h1 className="text-2xl font-medium leading-tight tracking-tight">
            Let {clientName} speak as {bot.persona.name}?
          </h1>
          {client.uri ? <p className="text-xs text-muted">{client.uri}</p> : null}
        </div>

        {error ? <p role="alert" className="w-full rounded-md border border-negative/30 bg-negative/10 p-3 text-sm">{ERRORS[error] ?? ERRORS.kernel}</p> : null}

        <form className="flex w-full flex-col gap-5 text-left">
            <input type="hidden" name="authorization_id" value={id} />
            <ul className="flex flex-col gap-2 text-sm leading-6 text-muted">
              {!bot.avatar ? <li>Connecting creates your AI, {bot.persona.name}, with its default persona. You can rename it and change how it looks any time on <Link href="/bot" className="text-accent">your AI&apos;s page</Link>.</li> : null}
              <li>It sees {bot.persona.name}&apos;s persona and memories, and which assistants are connected.</li>
              <li>It acts only as {bot.persona.name}, with what you have allowed {bot.persona.name}; Sovereign&apos;s kernel checks every write.</li>
              <li>It cannot pay, purchase or commit to anything.</li>
            </ul>
            <fieldset className="flex flex-col gap-2">
              <legend className={`${label} mb-2`}>What it may do</legend>
              <Mode value="read" title="Read only" hint="See who your bot is and what it remembers." defaultChecked />
              <Mode value="remember" title="Read and add" hint="Also add memories, start private Worlds for your goals, and add drafts to Worlds you let your bot into. Everything it adds is labeled as your bot's, and you can erase memories." />
            </fieldset>
            <div className="flex flex-wrap gap-3 pt-1">
              <button formAction={approveConsentAction} className={primaryAction}>Connect</button>
              <button formAction={denyConsentAction} className={secondaryAction}>Not now</button>
            </div>
            <p className="text-xs leading-5 text-muted">You can disconnect it at any time from your bot&apos;s page.</p>
        </form>
      </section>
    </Shell>
  );
}

function Mode({ value, title, hint, defaultChecked = false }: { value: string; title: string; hint: string; defaultChecked?: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md border border-line p-3 transition-colors duration-300 ease-calm has-[:checked]:border-accent has-[:checked]:bg-accent/10">
      <input type="radio" name="mode" value={value} defaultChecked={defaultChecked} className="mt-1 accent-[var(--accent)]" />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm text-foreground">{title}</span>
        <span className="text-xs leading-5 text-muted">{hint}</span>
      </span>
    </label>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-6 md:px-8 md:py-10">
      <header className="flex items-center gap-4 border-b border-line pb-5">
        <Link href="/" className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">solve</Link>
        <span className="text-muted">/</span>
        <span className="text-xs font-semibold uppercase tracking-[0.2em]">Connect</span>
      </header>
      {children}
    </main>
  );
}

function Notice({ text, href, action }: { text: string; href?: string; action?: string }) {
  return (
    <div role="status" className="mx-auto flex max-w-xl flex-col gap-3 rounded-md border border-line bg-surface p-5">
      <p className="text-sm leading-6 text-muted">{text}</p>
      {href && action ? <Link href={href} className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">{action}</Link> : null}
    </div>
  );
}
