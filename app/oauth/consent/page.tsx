import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import { approveConsentAction, denyConsentAction } from "./actions";
import styles from "./consent.module.css";

export const metadata: Metadata = { title: "Connect an app · SOLVE", robots: { index: false, follow: false } };

const ERRORS: Record<string, string> = {
  expired: "This request has expired or was already used. Start again from the app you were connecting.",
  kernel: "Solve couldn't record the connection. Nothing was shared; try again.",
};

// Where Supabase Auth's OAuth server sends a person when an app (Claude, ChatGPT and others) asks to
// connect to their Solve. Everything said here is what the kernel enforces (20261110070000): the app
// becomes its own agent with nothing until the person lets it into a Space.
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

  return <div className={styles.page}>
    <header className="s-stack" style={{ "--gap": "10px" } as React.CSSProperties}>
      <span className="s-label">Connect an app</span>
      <h1>Connect {app} to your Solve?</h1>
      {client.uri ? <p className="s-muted s-small">{client.uri}</p> : null}
    </header>

    {error ? <p role="alert" className="s-error">{ERRORS[error] ?? ERRORS.kernel}</p> : null}

    <form className={styles.form}>
      <input type="hidden" name="authorization_id" value={id} />
      <ul className={styles.facts}>
        <li>It starts with nothing. You choose, Space by Space, whether it can read or add — from inside each Space.</li>
        <li>Everything it adds is labelled as coming from it, and stays yours, even after you disconnect it.</li>
        <li>It can&apos;t pay, buy, publish, invite or delete anything.</li>
        <li>You can disconnect it at any time in Apps, and it stops at once.</li>
      </ul>

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
