// Travel pack: plan a ride or a stay, then book it in Uber or Airbnb with one tap. Neither company
// lets outside apps book for you, so this page (and the bot's plan_travel tool) fills everything in
// and hands off; nothing here books, charges or signs in.
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { label, quietLink } from "@/app/ui";
import { loginRequired } from "@/lib/auth/gate";
import { getUser } from "@/lib/supabase/server";
import { TravelTool } from "./tool";

export const metadata: Metadata = { title: "Travel · solve", description: "Plan a ride or a stay; book it in Uber or Airbnb with one tap." };

export default async function TravelPage() {
  if (!(await getUser()) && loginRequired()) redirect("/login?next=%2Ftravel");
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-5xl flex-1 flex-col gap-10 px-4 pb-36 pt-6 md:px-8 md:pb-28 md:pt-10">
      <header className="flex flex-wrap items-center justify-between gap-5 border-b border-line pb-5">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">solve</Link>
          <span className="text-muted">/</span>
          <span className="text-xs font-semibold uppercase tracking-[0.2em]">Travel</span>
        </div>
        <Link href="/command" className={quietLink}>Command Center</Link>
      </header>

      <div className="flex flex-col gap-3">
        <p className={label}>Travel pack</p>
        <h1 className="max-w-3xl text-3xl font-medium leading-tight tracking-tight md:text-5xl">Get there. Stay there.</h1>
        <p className="max-w-2xl text-sm leading-7 text-muted">
          Fill in a ride or a stay and Uber or Airbnb opens with it ready. You confirm and pay there; solve never books or
          sees your card. Your AI can do the same: ask it to plan a ride or a stay and it hands you these links.
        </p>
      </div>

      <TravelTool uberClientId={process.env.UBER_CLIENT_ID ?? null} />
    </main>
  );
}
