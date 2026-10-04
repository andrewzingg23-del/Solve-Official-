import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { WorldShell } from "./world/shell";

export default async function Home() {
  // Signed-in people return to durable work. Visitors can explore Arcadia before creating an ID.
  if (await getUser()) redirect("/worlds");
  return <WorldShell />;
}
