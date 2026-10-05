import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { StartView } from "./view";

export const metadata: Metadata = {
  title: "Start with what you're making real · solve",
  description: "Create a private World, shape your avatar, and keep a record of the work as it becomes real.",
};

// Signed-out visitors get the start page; signed-in people already have a home, their Command Center.
export default async function StartPage() {
  if (await getUser()) redirect("/command");
  return <StartView />;
}
