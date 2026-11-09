import type { Metadata } from "next";
import { getUser } from "@/lib/supabase/server";
import { getBotAvatar } from "@/lib/bot/avatar";
import { getKernel } from "@/lib/kernel/server";
import { listCreativeWorlds } from "@/lib/world/creative";
import { normalizeSpaceAnswers } from "@/lib/product/personal-space";
import { normalizeAppearance } from "@/lib/product/appearance";
import type { ProjectCard } from "@/app/product/projects";
import { PersonalSpace } from "./personal-space";
import "./space.css";

export const metadata: Metadata = {
  title: "Your Space — SOLVE",
  description: "A private operating environment shaped by your intentions and connected capabilities.",
};

export default async function SpacePage() {
  const user = await getUser();
  const signedIn = Boolean(user && !user.is_anonymous);
  let projects: ProjectCard[] | null = null;
  // Listed for any identity: a visitor's things are theirs in the kernel, exactly as on Home.
  if (user) {
    try {
      projects = await listCreativeWorlds(await getKernel());
    } catch {
      projects = null;
    }
  }
  return (
    <PersonalSpace
      signedIn={signedIn}
      initialAnswers={normalizeSpaceAnswers(signedIn ? (user?.user_metadata?.sov_personal_space ?? user?.user_metadata?.profile) : null)}
      projects={projects}
      hasIdentity={Boolean(user)}
      initialAppearance={normalizeAppearance(signedIn ? user?.user_metadata?.sov_space_appearance : null)}
      botName={getBotAvatar(user).name || "Your AI"}
    />
  );
}
