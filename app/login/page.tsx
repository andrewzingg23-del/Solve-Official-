import Link from "next/link";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/safe-next-path";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getUser } from "@/lib/supabase/server";
import { SetupNotice } from "@/app/setup-notice";
import { field, primaryAction, quietLink } from "@/app/ui";
import { sendMagicLink } from "./actions";

const enter = (delay: number) =>
  ({ animation: "page-enter 0.6s var(--ease-calm) both", animationDelay: `${delay}s` }) as const;

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error, sent } = await searchParams;
  const nextPath = safeNextPath(next);

  if (await getUser()) redirect(nextPath);

  return (
    <main className="relative mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-4 py-16">
      {/* The door glows before it opens. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 h-[300px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-accent/[0.09] blur-3xl" />
      </div>

      <div className="relative flex flex-col gap-4" style={enter(0)}>
        <p className="eyebrow">solve</p>
        <h1 className="text-6xl font-medium tracking-tight md:text-7xl">
          Enter<span className="text-accent" style={{ textShadow: "0 0 24px rgb(34 211 238 / 0.5)" }}>.</span>
        </h1>
        <p className="text-sm leading-6 text-muted">We email you a link. No password.</p>
      </div>

      {!isSupabaseConfigured ? (
        <div className="relative" style={enter(0.08)}>
          <SetupNotice />
        </div>
      ) : typeof sent === "string" ? (
        <div className="glass relative p-5" style={enter(0.08)}>
          <p className="text-sm">
            Link sent to <strong className="text-foreground">{sent}</strong>.
          </p>
          <p className="mt-1.5 text-xs leading-5 text-muted">Tap the link in that email to enter.</p>
        </div>
      ) : (
        <form action={sendMagicLink} className="relative flex flex-col gap-4" style={enter(0.08)}>
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

      <Link href="/" className={`${quietLink} relative self-start`} style={enter(0.16)}>
        Back
      </Link>
    </main>
  );
}
