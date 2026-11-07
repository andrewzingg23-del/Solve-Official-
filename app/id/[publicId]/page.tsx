import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeContactEmail, safeSovLink } from "@/lib/product/sov-contact";
import { PublicSovCard, type PublicSovIdentity } from "./public-sov-card";
import "@/app/card/sov-card.css";

export const metadata: Metadata = {
  title: "SOV ID — SOLVE",
  description: "Meet, connect, and explore someone's public SOV identity.",
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PublicIdentityPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  if (!uuid.test(publicId)) notFound();

  let identity: PublicSovIdentity | null = null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("sov_public_profiles")
      .select("public_id, display_name, handle, tagline, about, public_email, website, featured_url, appearance")
      .eq("public_id", publicId)
      .eq("published", true)
      .maybeSingle();
    if (!error && data && typeof data.display_name === "string") {
      identity = {
        publicId: data.public_id,
        name: data.display_name,
        handle: typeof data.handle === "string" ? data.handle : "",
        line: typeof data.tagline === "string" ? data.tagline : "",
        about: typeof data.about === "string" ? data.about : "",
        email: safeContactEmail(data.public_email),
        website: safeSovLink(data.website),
        featured: safeSovLink(data.featured_url),
        appearance: data.appearance === "secondary" ? "secondary" : "default",
      };
    }
  } catch {
    // Never substitute a different person's identity or a hard-coded sample.
  }
  if (!identity) notFound();

  return <PublicSovCard identity={identity} />;
}
