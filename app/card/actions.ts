"use server";

import { getUser, createClient } from "@/lib/supabase/server";
import { safeContactEmail, safeSovLink } from "@/lib/product/sov-contact";

export type PublicSovDraft = {
  name: string;
  handle: string;
  tagline: string;
  about: string;
  email: string;
  website: string;
  featured: string;
  appearance: "default" | "secondary";
};

type PublicationResult =
  | { ok: true; publicId: string }
  | { ok: false; error: string };

const text = (value: unknown, limit: number) =>
  typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, limit)
    : "";

export async function publishSovCard(draft: PublicSovDraft): Promise<PublicationResult> {
  const user = await getUser();
  if (!user || user.is_anonymous) return { ok: false, error: "Sign in with your account to publish a card." };
  if (!draft || typeof draft !== "object") return { ok: false, error: "Review the details on your card." };

  const name = text(draft.name, 90);
  if (!name) return { ok: false, error: "Add your name before publishing." };
  const handle = text(draft.handle, 30).toLowerCase().replace(/^@/, "");
  if (handle && !/^[a-z0-9][a-z0-9_-]{2,29}$/.test(handle)) {
    return { ok: false, error: "Your handle must contain 3–30 letters, numbers, _ or -." };
  }
  const emailValue = text(draft.email, 254);
  const email = safeContactEmail(emailValue);
  if (emailValue && !email) return { ok: false, error: "Enter a valid email address, or leave it blank." };
  const websiteValue = text(draft.website, 2048);
  const website = safeSovLink(websiteValue);
  if (websiteValue && !website) return { ok: false, error: "Use a secure https:// website address." };
  const featuredValue = text(draft.featured, 2048);
  const featured = safeSovLink(featuredValue);
  if (featuredValue && !featured) return { ok: false, error: "Use a secure https:// link for your featured creation." };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("sov_public_profiles").upsert({
      owner_id: user.id,
      display_name: name,
      handle: handle || null,
      tagline: text(draft.tagline, 100),
      about: text(draft.about, 500),
      public_email: email || null,
      website: website || null,
      featured_url: featured || null,
      appearance: draft.appearance === "secondary" ? "secondary" : "default",
      published: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "owner_id" }).select("public_id").single();
    if (error || typeof data?.public_id !== "string") {
      return { ok: false, error: error?.code === "23505"
        ? "That handle is already in use. Choose another."
        : "Publishing is unavailable right now. Your private draft is unchanged." };
    }
    return { ok: true, publicId: data.public_id };
  } catch {
    return { ok: false, error: "Couldn't reach publishing. Your private draft is unchanged." };
  }
}

export async function unpublishSovCard(): Promise<{ ok: boolean; error?: string }> {
  const user = await getUser();
  if (!user || user.is_anonymous) return { ok: false, error: "Sign in to manage your card." };
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("sov_public_profiles")
      .update({ published: false, updated_at: new Date().toISOString() })
      .eq("owner_id", user.id);
    return error ? { ok: false, error: "Couldn't unpublish. Check the connection and try again." } : { ok: true };
  } catch {
    return { ok: false, error: "Couldn't unpublish. Check the connection and try again." };
  }
}
