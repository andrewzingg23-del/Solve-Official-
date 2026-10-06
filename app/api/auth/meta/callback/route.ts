import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Meta OAuth callback: exchanges the code for a token, reads the profile,
// and records the connection on user_metadata. Never invents stats.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  if (!code || !appId || !appSecret) {
    return NextResponse.redirect(new URL("/start?step=sovid&social=error", url.origin));
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return NextResponse.redirect(new URL("/login?next=/start", url.origin));

  try {
    const redirectUri = `${url.origin}/api/auth/meta/callback`;
    const tokenRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?${new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri,
        code,
      }).toString()}`,
    );
    const tokenJson = (await tokenRes.json()) as { access_token?: string; error?: { message?: string } };
    if (!tokenJson.access_token) throw new Error(tokenJson.error?.message ?? "Token exchange failed.");

    const meRes = await fetch(
      `https://graph.facebook.com/v21.0/me?${new URLSearchParams({
        fields: "id,name",
        access_token: tokenJson.access_token,
      }).toString()}`,
    );
    const me = (await meRes.json()) as { id?: string; name?: string };
    if (!me.id) throw new Error("Couldn't read the Meta profile.");

    const existing = (data.user.user_metadata?.social_connections ?? {}) as Record<string, unknown>;
    await supabase.auth.updateUser({
      data: {
        social_connections: {
          ...existing,
          facebook: { connected: true, name: me.name ?? "", at: new Date().toISOString() },
          instagram: { ...(existing.instagram as object | undefined), via: "meta" },
        },
      },
    });
    return NextResponse.redirect(new URL("/start?step=sovid&social=connected", url.origin));
  } catch {
    return NextResponse.redirect(new URL("/start?step=sovid&social=error", url.origin));
  }
}
