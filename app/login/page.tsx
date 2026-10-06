import Link from "next/link";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/safe-next-path";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getUser } from "@/lib/supabase/server";
import { SetupNotice } from "@/app/setup-notice";
import { field, primaryAction, quietLink } from "@/app/ui";
import { sendMagicLink } from "./actions";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error, sent } = await searchParams;
  const nextPath = safeNextPath(next);

  if (await getUser()) redirect(nextPath);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-4 py-16">
      <div className="flex flex-col gap-4">
        <p className="eyebrow">solve</p>
        <h1 className="text-6xl font-medium tracking-tight md:text-7xl">
          Enter<span className="text-accent">.</span>
        </h1>
        <p className="text-sm leading-6 text-muted">We email you a link. No password.</p>
      </div>

      {!isSupabaseConfigured ? (
        <SetupNotice />
      ) : typeof sent === "string" ? (
        <div className="glass p-5">
          <p className="text-sm">
            Link sent to <strong className="text-foreground">{sent}</strong>.
          </p>
          <p className="mt-1.5 text-xs leading-5 text-muted">Tap the link in that email to enter.</p>
        </div>
      ) : (
        <form action={sendMagicLink} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={nextPath} />
          <label htmlFor="email" className="eyebrow">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className={field}
          />
          <button type="submit" className={primaryAction}>
            Email me a link
          </button>
          {typeof error === "string" && (
            <p role="alert" className="alert-pin rounded-xl px-4 py-3 text-sm">
              {error}
            </p>
          )}
        </form>
      )}

      <Link href="/" className={quietLink}>
        Back
      </Link>
    </main>
  );
}
