// The passport sends the person back here after they approve (or deny) solve. The code is
// exchanged for tokens with the PKCE verifier from this browser's flow cookie, and the tokens are
// sealed onto the person's record.
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { exchangeCode, PassportError } from "@/lib/passport/client";
import { saveLink } from "@/lib/passport/link";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { back, FLOW_COOKIE, readFlow } from "../shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const jar = await cookies();
  const flow = readFlow(jar.get(FLOW_COOKIE)?.value);
  jar.delete({ name: FLOW_COOKIE, path: "/api/passport" });

  if (url.searchParams.get("error") === "access_denied") return NextResponse.redirect(back(origin, "denied"));
  const code = url.searchParams.get("code");
  if (!flow || !code || url.searchParams.get("state") !== flow.state) return NextResponse.redirect(back(origin, "expired"));
  if (!(await getUser().catch(() => null))) return NextResponse.redirect(`${origin}/login?next=${encodeURIComponent("/bot?section=knowledge")}`);

  try {
    const tokens = await exchangeCode({ code, verifier: flow.verifier, clientId: flow.clientId, redirectUri: flow.redirectUri });
    const kernel = await getKernel();
    const me = await kernel.whoami();
    await saveLink(kernel, me.actor_id, tokens);
    return NextResponse.redirect(back(origin, "linked"));
  } catch (error) {
    return NextResponse.redirect(back(origin, error instanceof PassportError ? error.code : "unavailable"));
  }
}
