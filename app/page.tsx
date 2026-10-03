import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getUser } from "@/lib/supabase/server";
import { SetupNotice } from "./setup-notice";
import { primaryAction } from "./ui";

export default async function Home() {
  const user = await getUser();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-10 px-4 py-16">
      <div className="flex flex-col gap-4">
        <p className="text-sm font-semibold tracking-[0.3em] text-accent">solve</p>
        <h1 className="text-4xl font-semibold leading-tight tracking-tight">
          A living operating system for real life.
        </h1>
        <p className="leading-7 text-muted">
          Ask. Find a route. Enter a Room. Act. Every consequence goes on the record.
        </p>
      </div>

      {!isSupabaseConfigured ? (
        <SetupNotice />
      ) : user ? (
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/account" className={primaryAction}>
            Your record
          </Link>
          <p className="text-sm text-muted">{user.email}</p>
        </div>
      ) : (
        <Link href="/login" className={`${primaryAction} w-fit`}>
          Enter
        </Link>
      )}
    </main>
  );
}
