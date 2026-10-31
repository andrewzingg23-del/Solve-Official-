// Starts connecting solve to the person's SOV Passport: registers solve with the passport, then
// sends the person there to approve with their passkey. Signed-in people only.
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authorizeUrl, PassportError, pkcePair, randomToken, registerClient } from "@/lib/passport/client";
import { getUser } from "@/lib/supabase/server";
import { back, FLOW_COOKIE, FLOW_MAX_AGE } from "../shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  if (!(await getUser().catch(() => null))) return NextResponse.redirect(`${origin}/login?next=${encodeURIComponent("/bot?section=knowledge")}`);
  const redirectUri = `${origin}/api/passport/callback`;
  try {
    const clientId = await registerClient(redirectUri);
    const { verifier, challenge } = await pkcePair();
    const state = randomToken(24);
    (await cookies()).set(FLOW_COOKIE, JSON.stringify({ state, verifier, clientId, redirectUri }), {
      httpOnly: true,
      secure: origin.startsWith("https://"),
      sameSite: "lax",
      path: "/api/passport",
      maxAge: FLOW_MAX_AGE,
    });
    return NextResponse.redirect(authorizeUrl({ clientId, redirectUri, state, challenge }));
  } catch (error) {
    return NextResponse.redirect(back(origin, error instanceof PassportError ? error.code : "unavailable"));
  }
}
