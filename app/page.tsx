import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { WorldShell } from "./world/shell";

export default async function Home() {
  // One home: the claim flow ends at /packs, so signed-in people land there too.
  // Worlds (the maker space) are one tap away on the Bot tab.
  if (await getUser()) redirect("/packs");
  return <WorldShell />;
}
