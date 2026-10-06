import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";

// Starts Meta OAuth (Facebook + Instagram via Facebook Login).
// Honest scaffold: without META_APP_ID / META_APP_SECRET the step shows
// "not connected yet" — nothing is faked.
export async function GET(request: Request) {
  const user = await getUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const appId = process.env.META_APP_ID?.trim();
  if (!appId) {
    return NextResponse.json(
      { error: "Meta connection isn't set up yet — needs the app credentials." },
      { status: 503 },
    );
  }
  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/auth/meta/callback`;
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    // Basic identity + pages/instagram reach; extended scopes need app review.
    scope: "public_profile,email,pages_show_list,instagram_basic",
    response_type: "code",
  });
  return NextResponse.redirect(`https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`);
}
