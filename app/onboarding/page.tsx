import type { Metadata } from "next";
import { getUser } from "@/lib/supabase/server";
import { normalizeSpaceAnswers } from "@/lib/product/personal-space";
import { PersonalOnboarding } from "./experience";
import "./onboarding.css";
import "./experience.css";

export const metadata: Metadata = {
  title: "Meet your AI · Make SOLVE yours",
  description: "Tell SOLVE what matters, bring selected context, and create a personal operating environment.",
};

export default async function OnboardingPage() {
  const user = await getUser();
  const signedIn = Boolean(user && !user.is_anonymous);
  const saved = signedIn ? user?.user_metadata?.profile : null;
  return <PersonalOnboarding signedIn={signedIn} initialAnswers={normalizeSpaceAnswers(saved)} />;
}
