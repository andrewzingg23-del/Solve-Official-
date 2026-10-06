import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { ClaimFlow } from "./claim-flow";

export const metadata: Metadata = { title: "Claim your SOV ID — solve" };

export default async function ClaimPage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/claim");
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-4xl flex-1 flex-col justify-center px-4 py-12">
      <ClaimFlow />
    </main>
  );
}
