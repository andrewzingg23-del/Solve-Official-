import type { Metadata } from "next";
import { getUser } from "@/lib/supabase/server";
import { SovCard } from "./card-visual";
import "./sov-card.css";

export const metadata: Metadata = {
  title: "Your SOV Card — SOLVE",
  description: "One identity. Yours to make. Preview and personalize your living contact card.",
  robots: { index: false, follow: false },
};

export default async function CardPage() {
  // Account metadata is used only for the owner's preview. No profile is
  // published just because an owner opens this route.
  const user = await getUser();
  const accountName = typeof user?.user_metadata?.display_name === "string"
    ? user.user_metadata.display_name : "";
  const accountHandle = typeof user?.user_metadata?.sov_label === "string"
    ? user.user_metadata.sov_label : "";

  return <SovCard accountName={accountName} accountHandle={accountHandle} />;
}
