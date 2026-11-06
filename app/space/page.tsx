import type { Metadata } from "next";
import { getUser } from "@/lib/supabase/server";
import { getKernel } from "@/lib/kernel/server";
import { listCreativeWorlds } from "@/lib/world/creative";
import { normalizeSpaceAnswers } from "@/lib/product/personal-space";
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
  if (signedIn) {
    try {
      projects = await listCreativeWorlds(await getKernel());
    } catch {
      projects = null;
    }
  }
  return (
    <PersonalSpace
      signedIn={signedIn}
      initialAnswers={normalizeSpaceAnswers(signedIn ? user?.user_metadata?.profile : null)}
      projects={projects}
    />
  );
}
