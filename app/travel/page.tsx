// Travel pack: plan a ride or a stay, then book it in Uber or Airbnb with one tap. Neither company
// lets outside apps book for you, so this page (and the bot's plan_travel tool) fills everything in
// and hands off; nothing here books, charges or signs in.
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loginRequired } from "@/lib/auth/gate";
import { getUser } from "@/lib/supabase/server";
import { TravelTool } from "./tool";

export const metadata: Metadata = { title: "Travel · solve", description: "Plan a ride or a stay; book it in Uber or Airbnb with one tap." };

export default async function TravelPage() {
  if (!(await getUser()) && loginRequired()) redirect("/login?next=%2Ftravel");
  return (
    <main className="solve-page solve-new-page">
      <header className="solve-page-heading">
        <span className="solve-kicker">Travel</span>
        <h1>Get there. Stay there.</h1>
        <p>
          Fill in a ride or a stay and Uber or Airbnb opens with it ready. You confirm and pay there; solve never books or
          sees your card. Your AI can do the same: ask it for a ride or a place to stay and it hands you these links.
        </p>
      </header>
      <TravelTool uberClientId={process.env.UBER_CLIENT_ID ?? null} />
    </main>
  );
}
