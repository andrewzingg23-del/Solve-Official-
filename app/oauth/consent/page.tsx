import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { loadBot } from "@/lib/bot/store";
import { getKernel } from "@/lib/kernel/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { approveConsentAction, denyConsentAction } from "./actions";
import styles from "./consent.module.css";

export const metadata: Metadata = { title: "Connect an app · SOLVE", robots: { index: false, follow: false } };

const ERRORS: Record<string, string> = {
  expired: "This request has expired or was already used. Start again from the app you were connecting.",
  kernel: "SOLVE couldn't record the connection. Nothing was shared; try again.",
};

// Where Supabase Auth's OAuth server sends a person when an app (Claude, ChatGPT and others) asks to
// connect to their SOLVE. Rebuilt to the current standard (2026-11-10). Everything said here is what
// the kernel enforces today (20261110080000): an app connected this way may read what the person can,
// changes nothing directly, and adds only through their AI, only where they let their AI in.
export default async function ConsentPage({ searchParams }: PageProps<"/oauth/consent">) {
  const params = await searchParams;
  const id = typeof params.authorization_id === "string" ? params.authorization_id : "";
  const error = typeof params.error === "string" ? params.error : "";
  if (!id) return <Notice>This page opens when an app asks to connect to your SOLVE. Nothing is waiting.</Notice>;
  if (!(await getUser())) redirect(`/login?next=${encodeURIComponent(`/oauth/consent?authorization_id=${id}`)}`);

  const details = await (await createClient()).auth.oauth.getAuthorizationDetails(id);
  if (details.error || !details.data) return <Notice>{ERRORS.expired}</Notice>;
  // Already approved before: Supabase hands back the app's redirect directly.
  if ("redirect_url" in details.data) redirect(details.data.redirect_url);
  const { client } = details.data;
  const app = client.name?.trim() || "An app";

  let aiName: string | null = null;
  try {
    const bot = await loadBot(await getKernel());
    aiName = bot.avatar ? bot.persona.name : null;
  } catch {
    return <Notice>Your SOLVE couldn&apos;t be loaded, so nothing can be shared yet. Try again in a moment.</Notice>;
  }
  const ai = aiName ?? "your AI";

  return <div className={styles.page}>
    <header className="s-stack" style={{ "--gap": "10px" } as React.CSSProperties}>
      <span className="s-label">Connect an app</span>
      <h1>Let {app} into your SOLVE?</h1>
      {client.uri ? <p className="s-muted s-small">{client.uri}</p> : null}
    </header>

    {error ? <p role="alert" className="s-error">{ERRORS[error] ?? ERRORS.kernel}</p> : null}

    <form className={styles.form}>
      <input type="hidden" name="authorization_id" value={id} />
      <ul className={styles.facts}>
        <li>It can read what you can read in SOLVE.</li>
        <li>It acts as {ai}{aiName ? "" : ", your AI companion, which is made for you when you connect"}. It changes nothing directly: it can only add, through {ai}, to things you let {ai} into.</li>
        <li>It can&apos;t pay, buy or commit to anything.</li>
        <li>You can disconnect it at any time in Control, and it stops at once.</li>
      </ul>

      <fieldset className={styles.modes}>
        <legend className="s-label">What it may do</legend>
        <label className={styles.mode}>
          <input type="radio" name="mode" value="read" defaultChecked />
          <span><strong>Read only</strong><span className="s-muted s-small">See your SOLVE and what {ai} remembers.</span></span>
        </label>
        <label className={styles.mode}>
          <input type="radio" name="mode" value="remember" />
          <span><strong>Read and add</strong><span className="s-muted s-small">Also add memories, and drafts to things you let {ai} into. Everything it adds is labelled as coming from it.</span></span>
        </label>
      </fieldset>

      <div className={styles.row}>
        <button formAction={approveConsentAction} className="s-button" data-connect>Connect</button>
        <button formAction={denyConsentAction} className="s-button" data-variant="quiet">Not now</button>
      </div>
    </form>
  </div>;
}

function Notice({ children }: { children: React.ReactNode }) {
  return <div className={styles.page}>
    <p>{children}</p>
    <p><Link href="/" className="s-button" data-variant="quiet">Go to SOLVE</Link></p>
  </div>;
}
