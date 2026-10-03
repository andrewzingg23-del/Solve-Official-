"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getKernel } from "@/lib/kernel/server";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// Retries kernel registration when it didn't happen at sign-in.
export async function registerActor() {
  const kernel = await getKernel();
  await kernel.register();
  revalidatePath("/account");
}
