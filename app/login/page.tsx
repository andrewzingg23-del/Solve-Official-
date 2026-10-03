import Link from "next/link";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/safe-next-path";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getUser } from "@/lib/supabase/server";
import { SetupNotice } from "@/app/setup-notice";
import { label, primaryAction, quietLink } from "@/app/ui";
import { sendMagicLink } from "./actions";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error, sent } = await searchParams;
  const nextPath = safeNextPath(next);

  if (await getUser()) redirect(nextPath);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-4 py-16">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold tracking-[0.3em] text-accent">solve</p>
        <h1 className="text-2xl font-semibold tracking-tight">Enter</h1>
        <p className="text-sm text-muted">We email you a link. No password.</p>
      </div>

      {!isSupabaseConfigured ? (
        <SetupNotice />
      ) : typeof sent === "string" ? (
        <p className="rounded-md border border-positive/30 bg-positive/10 p-4 text-sm">
          Link sent to <strong>{sent}</strong>.
        </p>
      ) : (
        <form action={sendMagicLink} className="flex flex-col gap-3">
          <input type="hidden" name="next" value={nextPath} />
          <label htmlFor="email" className={label}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="h-11 rounded-md border border-line bg-surface px-3 outline-none transition-colors duration-300 ease-calm placeholder:text-muted/60 focus:border-accent"
          />
          <button type="submit" className={primaryAction}>
            Email me a link
          </button>
          {typeof error === "string" && (
            <p role="alert" className="text-sm text-negative">
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
