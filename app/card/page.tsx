import type { Metadata } from "next";
import { getUser, createClient } from "@/lib/supabase/server";
import { SovCard } from "./card-visual";
import "./sov-card.css";
import "./publish.css";

export const metadata: Metadata = {
  title: "Your SOV Card — SOLVE",
  description: "One identity. Yours to make. Preview and personalize your living contact card.",
  robots: { index: false, follow: false },
};

export default async function CardPage({ searchParams }: { searchParams?: Promise<{ via?: string | string[] }> }) {
  // Account metadata is used only for the owner's preview. No profile is
  // published just because an owner opens this route.
  const user = await getUser();
  const accountName = typeof user?.user_metadata?.display_name === "string"
    ? user.user_metadata.display_name : "";
  const accountHandle = typeof user?.user_metadata?.sov_label === "string"
    ? user.user_metadata.sov_label : "";

  let publicId: string | null = null;
  const canPublish = Boolean(user && !user.is_anonymous);
  if (canPublish) {
    try {
      const supabase = await createClient();
      const { data } = await supabase.from("sov_public_profiles")
        .select("public_id, published")
        .eq("owner_id", user!.id).maybeSingle();
      if (data?.published && typeof data.public_id === "string") publicId = data.public_id;
    } catch {
      // Owner can still edit locally while publication infrastructure is unavailable.
    }
  }
  // An invitation is just context, not a purchase or a payable referral.
  const params = searchParams ? await searchParams : {};
  const via = typeof params.via === "string" ? params.via : "";
  let invitedBy = "";
  if (/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(via)) {
    try {
      const supabase = await createClient();
      const { data } = await supabase.from("sov_public_profiles")
        .select("display_name").eq("public_id", via).eq("published", true).maybeSingle();
      if (typeof data?.display_name === "string") invitedBy = data.display_name;
    } catch {
      // Invalid or unavailable invitations never block creating a personal card.
    }
  }
  return <SovCard accountName={accountName} accountHandle={accountHandle}
    canPublish={canPublish} initialPublicId={publicId} invitedBy={invitedBy} />;
}
