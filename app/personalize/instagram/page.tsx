import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { normalizeAppearance } from "@/lib/product/appearance";
import { instagramProfileUrl } from "@/lib/product/instagram-style";
import { InstagramStyleStudio } from "./studio";
import "./instagram.css";

export const metadata: Metadata = {
  title: "Instagram-inspired Space · SOLVE",
  description: "Use content you choose from Instagram to preview a private SOLVE look."
};

export default async function InstagramPersonalizePage({ searchParams }: PageProps<"/personalize/instagram">) {
  const user = await getUser();
  if (!user || user.is_anonymous) {
    redirect("/login?next=%2Fpersonalize%2Finstagram");
  }
  const params = await searchParams;
  const handle = typeof params.profile === "string" && instagramProfileUrl(params.profile) ? params.profile : "";
  return <InstagramStyleStudio
    initialHandle={handle}
    initialAppearance={normalizeAppearance(user.user_metadata?.sov_space_appearance)}
  />;
}
