import { NextResponse, type NextRequest } from "next/server";
import { kernelClient } from "@/lib/kernel/client";
import { safeNextPath } from "@/lib/safe-next-path";
import { createClient } from "@/lib/supabase/server";

// Magic links and OAuth providers land here with a one-time code to exchange
// for a session cookie.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (!code) return redirectTo(loginWithError("Missing sign-in code", next));

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return redirectTo(loginWithError(error.message, next));

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

function loginWithError(message: string, next: string) {
  return `/login?${new URLSearchParams({ error: message, next })}`;
}
