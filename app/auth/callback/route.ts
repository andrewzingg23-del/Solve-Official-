import { NextResponse, type NextRequest } from "next/server";
import { kernelClient } from "@/lib/kernel/client";
import { safeNextPath } from "@/lib/safe-next-path";
import { createClient } from "@/lib/supabase/server";

// Magic links and OAuth providers land here with a one-time code to exchange
// for a session cookie.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  // A guest confirming the email they just added arrives as an email_change token rather than a
  // code. It is the same session becoming permanent, so it must be honoured here too — otherwise
  // the one path that carries a guest's work into an account dead-ends.
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = safeNextPath(searchParams.get("next"));

  if (!code && !tokenHash) return redirectTo(loginWithError("Missing sign-in code"));

  const supabase = await createClient();
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: emailOtpType(type) });
  if (error) return redirectTo(loginWithError(error.message));

  // Link the session to its canonical kernel actor. Sign-in still succeeds if the kernel is
  // unreachable; the account page shows that state and can retry.
  try {
    await kernelClient(supabase).register();
  } catch (kernelError) {
    console.error("kernel registration failed", kernelError);
  }

  return redirectTo(next);
}

// A relative Location keeps the browser on the host it used (localhost, a preview URL or the
// production domain). request.url reflects the server's own hostname, not the visitor's.
function redirectTo(path: string) {
  return new NextResponse(null, { status: 307, headers: { Location: path } });
}

/** Only the link types sign-in actually sends; anything else is treated as a magic link. */
function emailOtpType(type: string | null): "email_change" | "magiclink" | "email" | "recovery" | "invite" {
  return type === "email_change" || type === "magiclink" || type === "email"
    || type === "recovery" || type === "invite" ? type : "magiclink";
}

function loginWithError(message: string) {
  return `/login?${new URLSearchParams({ error: message })}`;
}
